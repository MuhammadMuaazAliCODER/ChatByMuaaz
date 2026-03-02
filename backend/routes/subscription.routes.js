import express from "express";
import subscriptionController from "../controllers/subscription.controller.js";
import authenticate from "../middleware/auth.middleware.js";
const router = express.Router();
import webhookController from '../controllers/webhook.controller.js';


router.get(
  "/plans",
  subscriptionController.getPlans.bind(subscriptionController),
);

router.get(
  "/status",
  authenticate,
  subscriptionController.getSubscriptionStatus.bind(subscriptionController),
);

router.post(
  "/checkout",
  authenticate,
  subscriptionController.createCheckoutSession.bind(subscriptionController),
);

router.patch(
  "/update-plan",
  authenticate,
  subscriptionController.updateSubscriptionPlan.bind(subscriptionController),
);

router.post(
  "/cancel",
  authenticate,
  subscriptionController.cancelSubscription.bind(subscriptionController),
);

router.post(
  "/resume",
  authenticate,
  subscriptionController.resumeSubscription.bind(subscriptionController),
);

router.post(
  "/portal",
  authenticate,
  subscriptionController.createPortalSession.bind(subscriptionController),
);

router.post(
  '/webhook',
  express.raw({ type: 'application/json' }), // raw body for Stripe signature verification
  webhookController.handleWebhook.bind(webhookController)
);


export default router;
