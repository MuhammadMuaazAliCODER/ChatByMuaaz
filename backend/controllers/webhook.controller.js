import { stripe, PLAN_TO_ROLE } from '../config/stripe.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

class WebhookController {

  async handleWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // ── Debug: confirm raw body is arriving correctly ────────────────────────
    console.log('\n📦 Stripe webhook hit');
    console.log('   Body type    :', Buffer.isBuffer(req.body) ? `✅ Buffer (${req.body.length} bytes)` : `❌ ${typeof req.body} — raw body was lost!`);
    console.log('   Signature    :', sig ? '✅ present' : '❌ MISSING');
    console.log('   Secret set   :', webhookSecret ? '✅ yes' : '❌ STRIPE_WEBHOOK_SECRET missing in .env');

    if (!Buffer.isBuffer(req.body)) {
      console.error('❌ FATAL: req.body is not a Buffer.');
      console.error('   Fix: Make sure in app.js the line:');
      console.error('     app.use("/webhook", webhookRoutes)');
      console.error('   comes BEFORE:');
      console.error('     app.use(express.json())');
      return res.status(400).send('Webhook Error: Raw body not received. Check middleware order in app.js.');
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('❌ Signature verification failed:', err.message);
      console.error('   Make sure STRIPE_WEBHOOK_SECRET in .env matches:');
      console.error('   • Local dev  → the whsec_ printed by "stripe listen --forward-to ..."');
      console.error('   • Production → Stripe Dashboard → Webhooks → your endpoint → Signing secret');
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
          console.log(`ℹ️  Unhandled event type: ${event.type}`);
      }

      return res.json({ received: true });
    } catch (error) {
      console.error('❌ Webhook handler error:', error.message, error.stack);
      return res.status(500).json({ error: 'Webhook handler failed' });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // checkout.session.completed
  // Main activation: sets plan, role, subscriptionId in DB
  // ─────────────────────────────────────────────────────────────────────────
  async handleCheckoutCompleted(session) {
    console.log('\n─── handleCheckoutCompleted ───');
    console.log('Session ID  :', session.id);
    console.log('Customer    :', session.customer);
    console.log('Subscription:', session.subscription);
    console.log('Metadata    :', JSON.stringify(session.metadata));

    const { planType, userId } = session.metadata || {};

    if (!userId) return console.error('❌ Missing userId in session.metadata — check createCheckoutSession sets metadata correctly');
    if (!planType) return console.error('❌ Missing planType in session.metadata');
    if (!mongoose.Types.ObjectId.isValid(userId)) return console.error('❌ userId is not a valid ObjectId:', userId);

    try {
      const user = await User.findById(userId);
      if (!user) return console.error('❌ No user found with _id:', userId);

      console.log('👤 User found:', user.email, '| current role:', user.role);

      // Fetch full subscription from Stripe to get currentPeriodEnd
      let currentPeriodEnd = null;
      if (session.subscription) {
        const stripeSub = await stripe.subscriptions.retrieve(session.subscription);
        currentPeriodEnd = new Date(stripeSub.current_period_end * 1000);
      }

      const newRole = PLAN_TO_ROLE[planType] || 'FREE';

      user.stripeCustomerId               = session.customer;
      user.subscription.subscriptionId    = session.subscription;
      user.subscription.plan              = planType;
      user.subscription.status            = 'active';
      user.subscription.currentPeriodEnd  = currentPeriodEnd;
      user.subscription.cancelAtPeriodEnd = false;
      user.role                           = newRole; // ← gates all features

      await user.save();
      console.log(`✅ DB updated — plan: ${planType} | role: ${newRole} | periodEnd: ${currentPeriodEnd}`);

    } catch (error) {
      console.error('❌ handleCheckoutCompleted DB error:', error.message);
      console.error(error.stack);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  async handleSubscriptionCreated(subscription) {
    try {
      const user = await User.findOne({ stripeCustomerId: subscription.customer });
      if (!user) return console.error('❌ handleSubscriptionCreated: user not found for customer:', subscription.customer);

      // Only fill in if checkout.session.completed hasn't already done it
      if (!user.subscription.subscriptionId) {
        user.subscription.subscriptionId   = subscription.id;
        user.subscription.status           = subscription.status;
        user.subscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
        await user.save();
        console.log(`✅ Subscription created for user ${user._id}`);
      }
    } catch (error) {
      console.error('❌ handleSubscriptionCreated error:', error.message);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  async handleSubscriptionUpdated(subscription) {
    try {
      const user = await User.findOne({ 'subscription.subscriptionId': subscription.id });
      if (!user) return console.error('❌ handleSubscriptionUpdated: user not found for sub:', subscription.id);

      user.subscription.status            = subscription.status;
      user.subscription.currentPeriodEnd  = new Date(subscription.current_period_end * 1000);
      user.subscription.cancelAtPeriodEnd = subscription.cancel_at_period_end;

      if (subscription.status === 'active') {
        user.role = PLAN_TO_ROLE[user.subscription.plan] || 'FREE';
      }

      await user.save();
      console.log(`✅ Subscription updated for user ${user._id} — status: ${subscription.status}`);
    } catch (error) {
      console.error('❌ handleSubscriptionUpdated error:', error.message);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  async handleSubscriptionDeleted(subscription) {
    try {
      const user = await User.findOne({ 'subscription.subscriptionId': subscription.id });
      if (!user) return console.error('❌ handleSubscriptionDeleted: user not found for sub:', subscription.id);

      user.role                           = 'FREE';
      user.subscription.status            = 'cancelled';
      user.subscription.plan              = 'none';
      user.subscription.subscriptionId    = null;
      user.subscription.currentPeriodEnd  = new Date();
      user.subscription.cancelAtPeriodEnd = false;

      await user.save();
      console.log(`✅ Subscription deleted — user ${user._id} role reset to FREE`);
    } catch (error) {
      console.error('❌ handleSubscriptionDeleted error:', error.message);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  async handlePaymentSucceeded(invoice) {
    const subscriptionId =
      invoice.subscription ||
      invoice.parent?.subscription_details?.subscription;

    if (!subscriptionId) return;

    try {
      const user = await User.findOne({ 'subscription.subscriptionId': subscriptionId });
      if (!user) return console.error('❌ handlePaymentSucceeded: user not found for sub:', subscriptionId);

      const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
      user.subscription.status           = 'active';
      user.subscription.currentPeriodEnd = new Date(stripeSub.current_period_end * 1000);
      user.role = PLAN_TO_ROLE[user.subscription.plan] || 'FREE';

      await user.save();
      console.log(`✅ Payment succeeded for user ${user._id}`);
    } catch (error) {
      console.error('❌ handlePaymentSucceeded error:', error.message);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  async handlePaymentFailed(invoice) {
    const subscriptionId =
      invoice.subscription ||
      invoice.parent?.subscription_details?.subscription;

    if (!subscriptionId) return;

    try {
      const user = await User.findOne({ 'subscription.subscriptionId': subscriptionId });
      if (!user) return console.error('❌ handlePaymentFailed: user not found for sub:', subscriptionId);

      user.subscription.status = 'past_due';
      await user.save();
      console.log(`⚠️  Payment failed — user ${user._id} marked past_due`);
    } catch (error) {
      console.error('❌ handlePaymentFailed error:', error.message);
    }
  }
}

export default new WebhookController();