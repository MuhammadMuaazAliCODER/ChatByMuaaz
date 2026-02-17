import { stripe, SUBSCRIPTION_PLANS } from '../config/stripe.js';
import User from '../models/User.js';

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
      const userId = req.user.id;

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
        success_url: `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/subscription/cancel`,
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
      const user = await User.findById(req.user.id)
        .select('subscriptionStatus subscriptionPlan subscriptionEndDate subscriptionId stripeCustomerId');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      let subscriptionDetails = null;

      if (user.subscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(user.subscriptionId);

          subscriptionDetails = {
            status: subscription.status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end
          };
        } catch (err) {
          console.error('Stripe fetch error:', err.message);
        }
      }

      return res.json({
        success: true,
        subscription: {
          status: user.subscriptionStatus || 'none',
          plan: user.subscriptionPlan || 'free',
          endDate: user.subscriptionEndDate,
          details: subscriptionDetails
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
      const user = await User.findById(req.user.id);

      if (!user?.subscriptionId) {
        return res.status(400).json({
          success: false,
          message: 'No active subscription found'
        });
      }

      const subscription = await stripe.subscriptions.update(
        user.subscriptionId,
        { cancel_at_period_end: true }
      );

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
      const user = await User.findById(req.user.id);

      if (!user?.subscriptionId) {
        return res.status(400).json({
          success: false,
          message: 'No subscription found'
        });
      }

      const subscription = await stripe.subscriptions.update(
        user.subscriptionId,
        { cancel_at_period_end: false }
      );

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

      const user = await User.findById(req.user.id);

      if (!user?.subscriptionId) {
        return res.status(400).json({
          success: false,
          message: 'No active subscription'
        });
      }

      const subscription = await stripe.subscriptions.retrieve(user.subscriptionId);

      const updated = await stripe.subscriptions.update(
        user.subscriptionId,
        {
          items: [{
            id: subscription.items.data[0].id,
            price: SUBSCRIPTION_PLANS[planType].priceId
          }],
          proration_behavior: 'always_invoice'
        }
      );

      user.subscriptionPlan = planType;
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
      const user = await User.findById(req.user.id);

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
