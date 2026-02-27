import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePicture: { type: String, default: '' },
  online: { type: Boolean, default: false },

  // ─── Auth & Verification ───────────────────────────────────────────────────
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationOTP: { type: String },
  emailVerificationExpires: { type: Date },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorOTP: { type: String },
  twoFactorOTPExpires: { type: Date },
  passwordChangeOTP: { type: String },
  passwordChangeOTPExpires: { type: Date },
  passwordResetOTP: { type: String },
  passwordResetOTPExpires: { type: Date },
  usernameChangeOTP: { type: String },
  usernameChangeOTPExpires: { type: Date },
  pendingUsername: { type: String },

  // ─── Role & Stripe ─────────────────────────────────────────────────────────
  // role is the single source of truth for feature gating.
  // It is set by the webhook when a plan is purchased/cancelled.
  role: {
    type: String,
    enum: ['FREE', 'BASIC', 'PRO'],
    default: 'FREE'
  },
  stripeCustomerId: { type: String, default: null },

  // ─── Subscription (billing info only) ─────────────────────────────────────
  subscription: {
    subscriptionId: { type: String, default: null },
    status: {
      type: String,
      enum: [
        'none', 'active', 'trialing', 'past_due',
        'canceled', 'cancelled', 'incomplete',
        'incomplete_expired', 'unpaid', null
      ],
      default: 'none'
    },
    plan: {
      type: String,
      enum: ['none', 'free', 'basic', 'pro', null],
      default: 'none'
    },
    currentPeriodEnd: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false }
  },

  // ─── Monthly Usage Tracking ────────────────────────────────────────────────
  usage: {
    messagesSentThisMonth: { type: Number, default: 0 },
    lastMessageReset: { type: Date, default: Date.now },
    friendsCount: { type: Number, default: 0 }
  }

}, { timestamps: true });

// ─── Methods ──────────────────────────────────────────────────────────────────

/**
 * Returns the effective plan as a string ('FREE', 'BASIC', 'PRO').
 *
 * This is the fix for old users:
 * If user.role is still 'FREE' but subscription.plan is 'pro' or 'basic'
 * AND the subscription is active, we treat them as their plan level.
 * This prevents old users who weren't migrated from hitting free limits.
 */
userSchema.methods.getEffectiveRole = function () {
  // If role is already upgraded, trust it
  if (this.role !== 'FREE') return this.role;

  // Fallback: check if they have an active subscription in DB
  // (covers old users created before the role sync was added)
  const planToRole = { basic: 'BASIC', pro: 'PRO', free: 'FREE' };
  const isActive = ['active', 'trialing'].includes(this.subscription?.status);

  if (isActive && this.subscription?.plan && this.subscription.plan !== 'none') {
    return planToRole[this.subscription.plan] || 'FREE';
  }

  return 'FREE';
};

/**
 * Resets the monthly message counter if we're now in a different calendar month.
 * Must be called before reading or writing messagesSentThisMonth.
 */
userSchema.methods.resetMonthlyMessagesIfNeeded = function () {
  const now = new Date();
  const lastReset = new Date(this.usage.lastMessageReset);

  const isDifferentMonth =
    now.getMonth() !== lastReset.getMonth() ||
    now.getFullYear() !== lastReset.getFullYear();

  if (isDifferentMonth) {
    this.usage.messagesSentThisMonth = 0;
    this.usage.lastMessageReset = now;
  }
};

/**
 * Returns the monthly message limit for this user.
 * -1 = unlimited.
 * Uses getEffectiveRole() so old users with un-synced role still get correct limits.
 */
userSchema.methods.getMessageLimit = function () {
  const limits = {
    FREE: 10,
    BASIC: 100,
    PRO: -1   // unlimited
  };
  return limits[this.getEffectiveRole()] ?? 10;
};

/**
 * Returns true if the user can send another message this month.
 */
userSchema.methods.canSendMessage = function () {
  this.resetMonthlyMessagesIfNeeded();
  const limit = this.getMessageLimit();
  if (limit === -1) return true;
  return this.usage.messagesSentThisMonth < limit;
};

/**
 * Increments the monthly message counter.
 * Call AFTER the message is saved successfully.
 */
userSchema.methods.incrementMessageCount = function () {
  this.resetMonthlyMessagesIfNeeded();
  this.usage.messagesSentThisMonth += 1;
};

/**
 * Returns messages remaining this month. -1 = unlimited.
 */
userSchema.methods.getRemainingMessages = function () {
  this.resetMonthlyMessagesIfNeeded();
  const limit = this.getMessageLimit();
  if (limit === -1) return -1;
  return Math.max(0, limit - this.usage.messagesSentThisMonth);
};

/**
 * Returns true if the subscription is usable (active or trialing).
 */
userSchema.methods.hasActiveSubscription = function () {
  return ['active', 'trialing'].includes(this.subscription?.status);
};

/**
 * Returns true if user meets or exceeds a minimum plan level.
 * Usage: user.hasPlanAccess('basic')
 */
userSchema.methods.hasPlanAccess = function (requiredPlan) {
  const hierarchy = { free: 0, basic: 1, pro: 2 };
  const roleToplan = { FREE: 'free', BASIC: 'basic', PRO: 'pro' };
  const userPlan = roleToplan[this.getEffectiveRole()] || 'free';
  return (hierarchy[userPlan] ?? 0) >= (hierarchy[requiredPlan] ?? 0);
};

const User = mongoose.model('User', userSchema);
export default User;