import User from '../models/User.js';

// ─────────────────────────────────────────────────────────────────────────────
// checkMessageLimit middleware
//
// Attach to any route that sends a message.
// Checks monthly quota via user.getMessageLimit() which uses getEffectiveRole()
// so both old users (un-synced role) and new users are handled correctly.
//
// Usage in routes:
//   router.post('/', authenticateToken, checkMessageLimit, sendMessage);
//
// Usage in controller (call AFTER message is saved):
//   if (req.countMessage) await req.countMessage();
// ─────────────────────────────────────────────────────────────────────────────
export const checkMessageLimit = async (req, res, next) => {
  try {
    // Re-fetch fresh user from DB (req.user from auth middleware may be a stale JWT payload)
    const user = await User.findById(req.user._id).select('role usage subscription');

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    // Run monthly reset check before reading the counter
    user.resetMonthlyMessagesIfNeeded();

    if (!user.canSendMessage()) {
      const limit = user.getMessageLimit();
      const effectiveRole = user.getEffectiveRole();

      // Calculate reset date (1st of next month)
      const now = new Date();
      const resetsOn = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      return res.status(429).json({
        success: false,
        limitReached: true,
        message: `You have used all ${limit} messages in your ${effectiveRole} plan this month.`,
        usage: {
          plan: user.subscription?.plan || 'free',
          role: effectiveRole,
          limit,
          used: user.usage.messagesSentThisMonth,
          remaining: 0,
          resetsOn
        },
        upgrade: {
          message: 'Upgrade your plan to send more messages.',
          options: {
            basic: '100 messages/month — $5/month',
            pro: 'Unlimited messages — $10/month'
          }
        }
      });
    }

    // Attach countMessage to req — call it in your controller after the message is saved
    req.countMessage = async () => {
      user.incrementMessageCount();
      await user.save();
    };

    // Attach usage summary so controller can include it in the response if desired
    const remaining = user.getRemainingMessages();
    req.usageInfo = {
      plan: user.subscription?.plan || 'free',
      role: user.getEffectiveRole(),
      limit: user.getMessageLimit() === -1 ? 'unlimited' : user.getMessageLimit(),
      used: user.usage.messagesSentThisMonth,
      remaining: remaining === -1 ? 'unlimited' : remaining
    };

    next();
  } catch (error) {
    console.error('checkMessageLimit error:', error);
    return res.status(500).json({ success: false, message: 'Error checking message limit' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// requirePlan middleware
//
// Gates an entire route behind a minimum plan level.
// Uses getEffectiveRole() so old un-migrated users still get correct access.
//
// Usage:
//   router.get('/pro-only', authenticate, requirePlan('pro'), controller);
//   router.get('/basic-up', authenticate, requirePlan('basic'), controller);
// ─────────────────────────────────────────────────────────────────────────────
const PLAN_HIERARCHY = { free: 0, basic: 1, pro: 2 };
const ROLE_TO_PLAN   = { FREE: 'free', BASIC: 'basic', PRO: 'pro' };

export const requirePlan = (minimumPlan) => {
  return async (req, res, next) => {
    try {
      // Re-fetch fresh user — same reason as above
      const user = await User.findById(req.user._id).select('role subscription');
      if (!user) return res.status(401).json({ success: false, message: 'User not found' });

      const effectiveRole = user.getEffectiveRole();
      const userPlan      = ROLE_TO_PLAN[effectiveRole] || 'free';
      const userLevel     = PLAN_HIERARCHY[userPlan] ?? 0;
      const requiredLevel = PLAN_HIERARCHY[minimumPlan] ?? 0;

      if (userLevel < requiredLevel) {
        return res.status(403).json({
          success: false,
          message: `This feature requires the ${minimumPlan} plan. You are on the ${userPlan} plan.`,
          requiredPlan: minimumPlan,
          currentPlan: userPlan,
          upgradeRequired: true
        });
      }

      next();
    } catch (error) {
      console.error('requirePlan error:', error);
      return res.status(500).json({ success: false, message: 'Authorization check failed' });
    }
  };
};