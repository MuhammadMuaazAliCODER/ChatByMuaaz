import { stripe, PLAN_TO_ROLE } from '../config/stripe.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

class WebhookController {

  async handleWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    console.log('\n📦 Stripe webhook hit');
    console.log('Body Buffer:', Buffer.isBuffer(req.body));

    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).send('Raw body not received.');
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        webhookSecret
      );
    } catch (err) {
      console.error('❌ Signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`✅ Webhook verified: ${event.type}`);

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object);
          break;

        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;

        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;

        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;

        default:
          console.log(`ℹ️ Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });

    } catch (error) {
      console.error('❌ Webhook handler error:', error);
      res.status(500).json({ error: 'Webhook handler failed' });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SAFE DATE HELPER (PREVENTS INVALID DATE CRASH)
  // ─────────────────────────────────────────────────────────────
  getSafeDateFromUnix(unix) {
    if (!unix) return null;

    const date = new Date(unix * 1000);

    if (isNaN(date.getTime())) {
      console.warn('⚠️ Invalid Unix timestamp received:', unix);
      return null;
    }

    return date;
  }

 
  async handleCheckoutCompleted(session) {
    console.log('\n── handleCheckoutCompleted ──');

    const { planType, userId } = session.metadata || {};

    if (!userId || !planType) {
      console.error('❌ Missing metadata in checkout session');
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.error('❌ Invalid userId:', userId);
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      console.error('❌ User not found:', userId);
      return;
    }

    console.log('👤 User found:', user.email);

    let currentPeriodEnd = null;

    if (session.subscription) {
      const stripeSub = await stripe.subscriptions.retrieve(
        session.subscription
      );

      currentPeriodEnd = this.getSafeDateFromUnix(
        stripeSub.current_period_end
      );
    }

    const newRole = PLAN_TO_ROLE[planType] || 'FREE';

    user.stripeCustomerId = session.customer;
    user.subscription.subscriptionId = session.subscription;
    user.subscription.plan = planType;
    user.subscription.status = 'active';
    user.subscription.cancelAtPeriodEnd = false;

    if (currentPeriodEnd) {
      user.subscription.currentPeriodEnd = currentPeriodEnd;
    }

    user.role = newRole;

    await user.save();

    console.log(`✅ User upgraded to ${planType}`);
  }


  async handleSubscriptionCreated(subscription) {
    const user = await User.findOne({
      stripeCustomerId: subscription.customer
    });

    if (!user) {
      console.error('❌ User not found for customer:', subscription.customer);
      return;
    }

    if (!user.subscription.subscriptionId) {
      user.subscription.subscriptionId = subscription.id;
      user.subscription.status = subscription.status;

      const date = this.getSafeDateFromUnix(
        subscription.current_period_end
      );

      if (date) {
        user.subscription.currentPeriodEnd = date;
      }

      await user.save();
      console.log('✅ Subscription created saved');
    }
  }


  async handleSubscriptionUpdated(subscription) {
    const user = await User.findOne({
      'subscription.subscriptionId': subscription.id
    });

    if (!user) {
      console.error('❌ User not found for subscription:', subscription.id);
      return;
    }

    user.subscription.status = subscription.status;
    user.subscription.cancelAtPeriodEnd =
      subscription.cancel_at_period_end;

    const date = this.getSafeDateFromUnix(
      subscription.current_period_end
    );

    if (date) {
      user.subscription.currentPeriodEnd = date;
    }

    if (subscription.status === 'active') {
      user.role =
        PLAN_TO_ROLE[user.subscription.plan] || 'FREE';
    }

    await user.save();
    console.log('✅ Subscription updated');
  }

  
  async handleSubscriptionDeleted(subscription) {
    const user = await User.findOne({
      'subscription.subscriptionId': subscription.id
    });

    if (!user) {
      console.error('❌ User not found for deleted subscription');
      return;
    }

    user.role = 'FREE';
    user.subscription.status = 'cancelled';
    user.subscription.plan = 'none';
    user.subscription.subscriptionId = null;
    user.subscription.currentPeriodEnd = null;
    user.subscription.cancelAtPeriodEnd = false;

    await user.save();

    console.log('✅ Subscription cancelled & role reset');
  }

  
  async handlePaymentSucceeded(invoice) {
    const subscriptionId =
      invoice.subscription ||
      invoice.parent?.subscription_details?.subscription;

    if (!subscriptionId) return;

    const user = await User.findOne({
      'subscription.subscriptionId': subscriptionId
    });

    if (!user) {
      console.error('❌ User not found for payment success');
      return;
    }

    const stripeSub = await stripe.subscriptions.retrieve(
      subscriptionId
    );

    const date = this.getSafeDateFromUnix(
      stripeSub.current_period_end
    );

    if (date) {
      user.subscription.currentPeriodEnd = date;
    }

    user.subscription.status = 'active';
    user.role =
      PLAN_TO_ROLE[user.subscription.plan] || 'FREE';

    await user.save();

    console.log('✅ Payment succeeded — subscription active');
  }

 
  async handlePaymentFailed(invoice) {
    const subscriptionId =
      invoice.subscription ||
      invoice.parent?.subscription_details?.subscription;

    if (!subscriptionId) return;

    const user = await User.findOne({
      'subscription.subscriptionId': subscriptionId
    });

    if (!user) {
      console.error('❌ User not found for payment failure');
      return;
    }

    user.subscription.status = 'past_due';
    await user.save();

    console.log('⚠️ Payment failed — user marked past_due');
  }
}

export default new WebhookController();