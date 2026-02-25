import { stripe, SUBSCRIPTION_PLANS } from '../config/stripe.js';
import User from '../models/User.js';
import dotenv from 'dotenv';
dotenv.config();

class SubscriptionController {

  // ===============================
  // Get All Available Plans
  // ===============================
  async getPlans(req, res) {
    try {
      return res.json({
        success: true,
        plans: SUBSCRIPTION_PLANS
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error fetching plans',
        error: error.message
      });
    }
  }

  // ===============================
  // Create Checkout Session
  // ===============================
  async createCheckoutSession(req, res) {
    try {
      const { planType } = req.body;
      const userId = req.user._id;

      if (!SUBSCRIPTION_PLANS[planType]) {
        return res.status(400).json({
          success: false,
          message: 'Invalid plan type'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      let customerId = user.stripeCustomerId;

      // Create Stripe customer if not exists
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId: user._id.toString() }
        });

        customerId = customer.id;
        user.stripeCustomerId = customerId;
        await user.save();
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: SUBSCRIPTION_PLANS[planType].priceId,
            quantity: 1
          }
        ],
        success_url: "http://localhost:3000/subscription/success?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "http://localhost:3000/subscription/cancel",
        metadata: {
          userId: user._id.toString(),
          planType
        }
      });

      return res.json({
        success: true,
        sessionId: session.id,
        url: session.url
      });

    } catch (error) {
      console.error('Checkout Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error creating checkout session',
        error: error.message
      });
    }
  }

  // ===============================
  // Get Subscription Status
  // ===============================
  async getSubscriptionStatus(req, res) {
    try {
      const user = await User.findById(req.user._id)
        .select('subscription stripeCustomerId');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      return res.json({
        success: true,
        subscription: {
          status: user.subscription?.status || 'none',
          plan: user.subscription?.plan || 'free',
          endDate: user.subscription?.currentPeriodEnd || null,
          cancelAtPeriodEnd: user.subscription?.cancelAtPeriodEnd || false
        }
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error fetching subscription',
        error: error.message
      });
    }
  }

  // ===============================
  // Cancel Subscription
  // ===============================
  async cancelSubscription(req, res) {
    try {
      const user = await User.findById(req.user._id);

      if (!user?.subscription?.subscriptionId) {
        return res.status(400).json({
          success: false,
          message: 'No active subscription found'
        });
      }

      const subscription = await stripe.subscriptions.update(
        user.subscription.subscriptionId,
        { cancel_at_period_end: true }
      );

      user.subscription.cancelAtPeriodEnd = true;
      await user.save();

      return res.json({
        success: true,
        message: 'Subscription will cancel at period end',
        cancelAt: new Date(subscription.current_period_end * 1000)
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error cancelling subscription',
        error: error.message
      });
    }
  }

  // ===============================
  // Resume Subscription
  // ===============================
  async resumeSubscription(req, res) {
    try {
      const user = await User.findById(req.user._id);

      if (!user?.subscription?.subscriptionId) {
        return res.status(400).json({
          success: false,
          message: 'No subscription found'
        });
      }

      const subscription = await stripe.subscriptions.update(
        user.subscription.subscriptionId,
        { cancel_at_period_end: false }
      );

      user.subscription.cancelAtPeriodEnd = false;
      user.subscription.status = subscription.status;
      await user.save();

      return res.json({
        success: true,
        message: 'Subscription resumed',
        status: subscription.status
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error resuming subscription',
        error: error.message
      });
    }
  }

  // ===============================
  // Update Subscription Plan
  // ===============================
  async updateSubscriptionPlan(req, res) {
    try {
      const { planType } = req.body;

      if (!SUBSCRIPTION_PLANS[planType]) {
        return res.status(400).json({
          success: false,
          message: 'Invalid plan type'
        });
      }

      const user = await User.findById(req.user._id);

      if (!user?.subscription?.subscriptionId) {
        return res.status(400).json({
          success: false,
          message: 'No active subscription'
        });
      }

      const subscription = await stripe.subscriptions.retrieve(
        user.subscription.subscriptionId
      );

      const updated = await stripe.subscriptions.update(
        user.subscription.subscriptionId,
        {
          items: [{
            id: subscription.items.data[0].id,
            price: SUBSCRIPTION_PLANS[planType].priceId
          }],
          proration_behavior: 'always_invoice'
        }
      );

      user.subscription.plan = planType;
      user.subscription.currentPeriodEnd = new Date(updated.current_period_end * 1000);
      await user.save();

      return res.json({
        success: true,
        message: 'Plan updated',
        currentPeriodEnd: new Date(updated.current_period_end * 1000)
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error updating plan',
        error: error.message
      });
    }
  }

  // ===============================
  // Create Billing Portal Session
  // ===============================
  async createPortalSession(req, res) {
    try {
      const user = await User.findById(req.user._id);

      if (!user?.stripeCustomerId) {
        return res.status(400).json({
          success: false,
          message: 'No Stripe customer found'
        });
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: process.env.FRONTEND_URL
      });

      return res.json({
        success: true,
        url: portalSession.url
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error creating portal session',
        error: error.message
      });
    }
  }
}

export default new SubscriptionController();