import express from 'express';
import subscriptionController from '../controllers/subscription.controller.js';
import webhookController from '../controllers/webhook.controller.js';
import authenticateUser from '../middleware/auth.middleware.js';

const router = express.Router();

// Public route
router.get('/plans', subscriptionController.getPlans);

// Stripe Webhook (RAW BODY)
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  webhookController.handleWebhook.bind(webhookController)
);

// Protected routes
router.post(
  '/create-checkout-session',
  authenticateUser,
  subscriptionController.createCheckoutSession
);

router.get(
  '/status',
  authenticateUser,
  subscriptionController.getSubscriptionStatus
);

router.post(
  '/cancel',
  authenticateUser,
  subscriptionController.cancelSubscription
);

router.post(
  '/resume',
  authenticateUser,
  subscriptionController.resumeSubscription
);

router.post(
  '/update-plan',
  authenticateUser,
  subscriptionController.updateSubscriptionPlan
);

router.post(
  '/create-portal-session',
  authenticateUser,
  subscriptionController.createPortalSession
);

export default router;