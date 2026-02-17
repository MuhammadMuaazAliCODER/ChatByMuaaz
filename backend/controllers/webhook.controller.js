// controllers/webhook.controller.js
import { stripe } from '../config/stripe.js';
import User from '../models/User.js';

class WebhookController {

  // Main webhook handler
  async handleWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        webhookSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

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
          console.log(`Unhandled event type: ${event.type}`);
      }

      return res.json({ received: true });

    } catch (error) {
      console.error('Webhook handling error:', error);
      return res.status(500).json({ error: 'Webhook handler failed' });
    }
  }

  // ----------------------------
  // CHECKOUT COMPLETED
  // ----------------------------
  async handleCheckoutCompleted(session) {
    console.log('Checkout completed:', session.id);

    const { userId, planType } = session.metadata || {};

    if (!userId) {
      console.error('Missing userId in metadata');
      return;
    }

    try {
      const user = await User.findById(userId);
      if (!user) return console.error('User not found:', userId);

      user.stripeCustomerId = session.customer;
      user.subscriptionPlan = planType;
      user.subscriptionStatus = 'active';

      await user.save();

      console.log(`User ${userId} activated plan: ${planType}`);
    } catch (error) {
      console.error('handleCheckoutCompleted error:', error);
    }
  }

  // ----------------------------
  // SUBSCRIPTION CREATED
  // ----------------------------
  async handleSubscriptionCreated(subscription) {
    console.log('Subscription created:', subscription.id);

    try {
      const user = await User.findOne({
        stripeCustomerId: subscription.customer
      });

      if (!user) return console.error('User not found for customer');

      user.subscriptionId = subscription.id;
      user.subscriptionStatus = subscription.status;
      user.subscriptionEndDate =
        new Date(subscription.current_period_end * 1000);

      await user.save();

      console.log(`Subscription saved for user ${user._id}`);
    } catch (error) {
      console.error('handleSubscriptionCreated error:', error);
    }
  }

  // ----------------------------
  // SUBSCRIPTION UPDATED
  // ----------------------------
  async handleSubscriptionUpdated(subscription) {
    console.log('Subscription updated:', subscription.id);

    try {
      const user = await User.findOne({
        subscriptionId: subscription.id
      });

      if (!user) return console.error('User not found');

      user.subscriptionStatus = subscription.status;
      user.subscriptionEndDate =
        new Date(subscription.current_period_end * 1000);

      if (subscription.cancel_at_period_end) {
        user.subscriptionStatus = 'active';
      }

      await user.save();

      console.log(`Subscription updated for ${user._id}`);
    } catch (error) {
      console.error('handleSubscriptionUpdated error:', error);
    }
  }

  // ----------------------------
  // SUBSCRIPTION DELETED
  // ----------------------------
  async handleSubscriptionDeleted(subscription) {
    console.log('Subscription deleted:', subscription.id);

    try {
      const user = await User.findOne({
        subscriptionId: subscription.id
      });

      if (!user) return console.error('User not found');

      user.subscriptionStatus = 'cancelled';
      user.subscriptionPlan = 'free';
      user.subscriptionEndDate = new Date();

      await user.save();

      console.log(`Subscription cancelled for ${user._id}`);
    } catch (error) {
      console.error('handleSubscriptionDeleted error:', error);
    }
  }

  // ----------------------------
  // PAYMENT SUCCEEDED
  // ----------------------------
  async handlePaymentSucceeded(invoice) {
    console.log('Payment succeeded:', invoice.id);

    if (!invoice.subscription) return;

    try {
      const user = await User.findOne({
        subscriptionId: invoice.subscription
      });

      if (!user) return console.error('User not found');

      user.subscriptionStatus = 'active';

      const subscription =
        await stripe.subscriptions.retrieve(invoice.subscription);

      user.subscriptionEndDate =
        new Date(subscription.current_period_end * 1000);

      await user.save();

      console.log(`Payment success for ${user._id}`);
    } catch (error) {
      console.error('handlePaymentSucceeded error:', error);
    }
  }

  // ----------------------------
  // PAYMENT FAILED
  // ----------------------------
  async handlePaymentFailed(invoice) {
    console.log('Payment failed:', invoice.id);

    if (!invoice.subscription) return;

    try {
      const user = await User.findOne({
        subscriptionId: invoice.subscription
      });

      if (!user) return console.error('User not found');

      user.subscriptionStatus = 'past_due';
      await user.save();

      console.log(`Marked past_due for ${user._id}`);
    } catch (error) {
      console.error('handlePaymentFailed error:', error);
    }
  }
}

export default new WebhookController();
