import { stripe } from '../config/stripe.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

class WebhookController {
  async handleWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object);
          break;
        // case 'customer.subscription.created':
        //   await this.handleSubscriptionCreated(event.data.object);
        //   break;
        // case 'customer.subscription.updated':
        //   await this.handleSubscriptionUpdated(event.data.object);
        //   break;
        // case 'customer.subscription.deleted':
        //   await this.handleSubscriptionDeleted(event.data.object);
        //   break;
        // case 'invoice.payment_succeeded':
        //   await this.handlePaymentSucceeded(event.data.object);
        //   break;
        // case 'invoice.payment_failed':
        //   await this.handlePaymentFailed(event.data.object);
        //   break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return res.json({ received: true });
    } catch (error) {
      console.error('Webhook handling error:', error);
      return res.status(500).json({ error: 'Webhook handler failed' });
    }
  }

  async handleCheckoutCompleted(session) {
    console.log('Checkout completed:', session.id, 'Metadata:', session.metadata);
    console.log(session);

    const { planType, userId } = session.metadata || {};
    console.log(planType, userId);
    if (!userId) return console.error('Missing userId in metadata');

    try {
      const user = await User.findById(new mongoose.Types.ObjectId(userId));
      if (!user) return console.error('User not found:', userId);

      user.stripeCustomerId = session.customer;
      user.subscription.subscriptionId = session.subscription;
      user.subscription.plan = planType;
      user.subscription.status = 'active';

      await user.save();
      console.log(`User ${userId} activated plan: ${planType}`);
    } catch (error) {
      console.error('handleCheckoutCompleted error:', error);
    }
  }

  async handleSubscriptionCreated(subscription) {
    try {
      const user = await User.findOne({ stripeCustomerId: subscription.customer });
      if (!user) return console.error('User not found for customer');

      user.subscription.subscriptionId = subscription.id;
      user.subscription.status = subscription.status;
      user.subscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);

      await user.save();
      console.log(`Subscription saved for user ${user._id}`);
    } catch (error) {
      console.error('handleSubscriptionCreated error:', error);
    }
  }

  async handleSubscriptionUpdated(subscription) {
    try {
      const user = await User.findOne({ 'subscription.subscriptionId': subscription.id });
      if (!user) return console.error('User not found');

      user.subscription.status = subscription.status;
      user.subscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
      user.subscription.cancelAtPeriodEnd = subscription.cancel_at_period_end;

      await user.save();
      console.log(`Subscription updated for ${user._id}`);
    } catch (error) {
      console.error('handleSubscriptionUpdated error:', error);
    }
  }

  async handleSubscriptionDeleted(subscription) {
    try {
      const user = await User.findOne({ 'subscription.subscriptionId': subscription.id });
      if (!user) return console.error('User not found');

      user.subscription.status = 'cancelled';
      user.subscription.plan = 'none';
      user.subscription.currentPeriodEnd = new Date();
      user.subscription.cancelAtPeriodEnd = false;

      await user.save();
      console.log(`Subscription cancelled for ${user._id}`);
    } catch (error) {
      console.error('handleSubscriptionDeleted error:', error);
    }
  }

  async handlePaymentSucceeded(invoice) {
    if (!invoice.parent?.subscription_details?.subscription) return;

    let subscription_id = invoice.parent?.subscription_details?.subscription;

    console.log(invoice)
    try {
      const user = await User.findOne({ 'subscription.subscriptionId': subscription_id });
      if (!user) return console.error('User not found');

      const subscription = await stripe.subscriptions.retrieve(subscription_id);

      user.subscription.status = 'active';
      user.subscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);

      await user.save();
      console.log(`Payment success for ${user._id}`);
    } catch (error) {
      console.error('handlePaymentSucceeded error:', error);
    }
  }

  async handlePaymentFailed(invoice) {
    if (!invoice.subscription) return;

    try {
      const user = await User.findOne({ 'subscription.subscriptionId': invoice.subscription });
      if (!user) return console.error('User not found');

      user.subscription.status = 'past_due';
      await user.save();
      console.log(`Marked past_due for ${user._id}`);
    } catch (error) {
      console.error('handlePaymentFailed error:', error);
    }
  }
}

export default new WebhookController();


