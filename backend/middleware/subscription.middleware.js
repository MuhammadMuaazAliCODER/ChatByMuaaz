// middleware/subscription.middleware.js
const User = require('../models/User'); // Adjust path to your User model

// Check if user has an active subscription
const requireActiveSubscription = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user has active subscription
    if (user.subscriptionStatus !== 'active' && user.subscriptionStatus !== 'trialing') {
      return res.status(403).json({
        success: false,
        message: 'Active subscription required',
        subscriptionStatus: user.subscriptionStatus
      });
    }

    // Check if subscription has expired
    if (user.subscriptionEndDate && new Date(user.subscriptionEndDate) < new Date()) {
      return res.status(403).json({
        success: false,
        message: 'Subscription has expired',
        subscriptionStatus: 'expired'
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking subscription status',
      error: error.message
    });
  }
};

// Check if user has a specific plan or higher
const requirePlan = (requiredPlan) => {
  const planHierarchy = {
    'basic': 1,
    'pro': 2,
    'premium': 3
  };

  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const userPlanLevel = planHierarchy[user.subscriptionPlan] || 0;
      const requiredPlanLevel = planHierarchy[requiredPlan] || 0;

      if (userPlanLevel < requiredPlanLevel) {
        return res.status(403).json({
          success: false,
          message: `This feature requires ${requiredPlan} plan or higher`,
          currentPlan: user.subscriptionPlan,
          requiredPlan: requiredPlan
        });
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error checking plan access',
        error: error.message
      });
    }
  };
};

// Optional: Rate limiting based on subscription plan
const checkMessageLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Define limits per plan
    const messageLimits = {
      'none': 10,      // Free users
      'basic': 100,    // Basic plan
      'pro': -1,       // Unlimited
      'premium': -1    // Unlimited
    };

    const plan = user.subscriptionPlan || 'none';
    const limit = messageLimits[plan];

    // If unlimited (-1), skip check
    if (limit === -1) {
      return next();
    }

    // Check user's message count for today
    // You'll need to implement message counting logic
    // This is a placeholder example
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Assuming you have a Message model or message count field
    // const messageCount = await Message.countDocuments({
    //   userId: userId,
    //   createdAt: { $gte: today }
    // });
    
    // For now, we'll assume you pass this through
    const messageCount = user.dailyMessageCount || 0;

    if (messageCount >= limit) {
      return res.status(429).json({
        success: false,
        message: 'Daily message limit reached',
        limit: limit,
        plan: plan,
        upgradeRequired: true
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking message limit',
      error: error.message
    });
  }
};

module.exports = {
  requireActiveSubscription,
  requirePlan,
  checkMessageLimit
};