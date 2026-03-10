import { stripe, SUBSCRIPTION_PLANS, PLAN_HIERARCHY } from '../config/stripe.js';
import User from '../models/User.js';
import dotenv from 'dotenv';
dotenv.config();

class SubscriptionController {

  // ─────────────────────────────────────────────────────────────────────────
  // GET /subscription/plans
  // ─────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  // POST /subscription/checkout
  // Creates a Stripe Checkout session for a NEW subscription.
  // ─────────────────────────────────────────────────────────────────────────
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

      if (planType === 'free') {
        return res.status(400).json({
          success: false,
          message: 'Cannot checkout for the free plan'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      if (user.subscription?.status === 'active') {
        const currentPlan    = user.subscription.plan;
        const currentLevel   = PLAN_HIERARCHY[currentPlan]  ?? -1;
        const requestedLevel = PLAN_HIERARCHY[planType]     ?? -1;

        if (requestedLevel === currentLevel) {
          return res.status(400).json({
            success: false,
            message: `You already have the ${currentPlan} plan active. It renews on ${user.subscription.currentPeriodEnd?.toDateString()}.`
          });
        }

        if (requestedLevel < currentLevel) {
          return res.status(400).json({
            success: false,
            message: `You cannot downgrade from ${currentPlan} to ${planType} while your plan is active. Cancel your current plan first and wait for the billing period to end.`
          });
        }

        if (requestedLevel > currentLevel) {
          return res.status(400).json({
            success: false,
            message: `You already have an active plan. To upgrade from ${currentPlan} to ${planType}, use the upgrade endpoint.`,
            action: 'USE_UPDATE_PLAN_ENDPOINT'
          });
        }
      }

      let customerId = user.stripeCustomerId;
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
        success_url: process.env.FRONTEND_URL || 'http://localhost:3000/',
        cancel_url:  process.env.FRONTEND_URL || 'http://localhost:3000/',
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

  // ─────────────────────────────────────────────────────────────────────────
  // GET /subscription/status
  // ─────────────────────────────────────────────────────────────────────────
  async getSubscriptionStatus(req, res) {
    try {
      const user = await User.findById(req.user._id)
        .select('subscription stripeCustomerId role usage');

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      user.resetMonthlyMessagesIfNeeded();
      await user.save();

      const limit = user.getMessageLimit();

      return res.json({
        success: true,
        subscription: {
          status:            user.subscription?.status           || 'none',
          plan:              user.subscription?.plan             || 'free',
          role:              user.role,
          currentPeriodEnd:  user.subscription?.currentPeriodEnd || null,
          cancelAtPeriodEnd: user.subscription?.cancelAtPeriodEnd || false
        },
        usage: {
          messagesSentThisMonth: user.usage.messagesSentThisMonth,
          monthlyLimit:  limit === -1 ? 'unlimited' : limit,
          remaining:     user.getRemainingMessages() === -1 ? 'unlimited' : user.getRemainingMessages(),
          resetDate: (() => {
            const d = new Date();
            return new Date(d.getFullYear(), d.getMonth() + 1, 1);
          })()
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

  // ─────────────────────────────────────────────────────────────────────────
  // POST /subscription/cancel
  // ─────────────────────────────────────────────────────────────────────────
  async cancelSubscription(req, res) {
    try {
      const user = await User.findById(req.user._id);

      if (!user?.subscription?.subscriptionId) {
        return res.status(400).json({
          success: false,
          message: 'No active subscription found'
        });
      }

      if (user.subscription.cancelAtPeriodEnd) {
        return res.status(400).json({
          success: false,
          message: 'Subscription is already scheduled for cancellation'
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
        message: 'Subscription will cancel at the end of the billing period. You keep access until then.',
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

  // ─────────────────────────────────────────────────────────────────────────
  // POST /subscription/resume
  // ─────────────────────────────────────────────────────────────────────────
  async resumeSubscription(req, res) {
    try {
      const user = await User.findById(req.user._id);

      if (!user?.subscription?.subscriptionId) {
        return res.status(400).json({
          success: false,
          message: 'No subscription found'
        });
      }

      if (!user.subscription.cancelAtPeriodEnd) {
        return res.status(400).json({
          success: false,
          message: 'Subscription is not scheduled for cancellation'
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
        message: 'Subscription resumed — it will no longer be cancelled.',
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

  // ─────────────────────────────────────────────────────────────────────────
  // PATCH /subscription/update-plan
  // Upgrades an existing active subscription to a higher plan.
  // ─────────────────────────────────────────────────────────────────────────
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
          message: 'No active subscription found. Please purchase a plan first.'
        });
      }

      const currentPlan    = user.subscription.plan;
      const currentLevel   = PLAN_HIERARCHY[currentPlan]  ?? -1;
      const requestedLevel = PLAN_HIERARCHY[planType]     ?? -1;

      if (requestedLevel <= currentLevel) {
        return res.status(400).json({
          success: false,
          message: requestedLevel === currentLevel
            ? `You are already on the ${planType} plan.`
            : `Downgrading via this endpoint is not supported. Cancel your plan and subscribe to the lower plan at the end of the billing period.`
        });
      }

      const stripeSub = await stripe.subscriptions.retrieve(
        user.subscription.subscriptionId
      );

      const updated = await stripe.subscriptions.update(
        user.subscription.subscriptionId,
        {
          items: [{
            id: stripeSub.items.data[0].id,
            price: SUBSCRIPTION_PLANS[planType].priceId
          }],
          proration_behavior: 'always_invoice'
        }
      );

      // ── Safely resolve currentPeriodEnd ──────────────────────────────────
      // 1. Use Stripe's value if present
      // 2. Fall back to existing saved value
      // 3. Last resort: 30 days from now
      const periodEnd =
        (updated.current_period_end
          ? new Date(updated.current_period_end * 1000)
          : null) ||
        user.subscription.currentPeriodEnd ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      user.subscription.plan             = planType;
      user.subscription.currentPeriodEnd = periodEnd;
      user.role                          = SUBSCRIPTION_PLANS[planType].role;
      await user.save();

      return res.json({
        success: true,
        message: `Plan upgraded to ${planType}. You have been charged the prorated difference.`,
        plan:             planType,
        role:             user.role,
        currentPeriodEnd: periodEnd
      });

    } catch (error) {
      console.error('Update Plan Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error updating plan',
        error: error.message
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POST /subscription/portal
  // ─────────────────────────────────────────────────────────────────────────
  async createPortalSession(req, res) {
    try {
      const user = await User.findById(req.user._id);

      if (!user?.stripeCustomerId) {
        return res.status(400).json({
          success: false,
          message: 'No Stripe customer found. You have not purchased a plan yet.'
        });
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer:   user.stripeCustomerId,
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