import express from 'express';
import webhookController from '../controllers/webhookController.js';

const router = express.Router();

// ⚠️  CRITICAL: Stripe webhooks require the RAW request body (not parsed JSON).
// This route must be registered BEFORE express.json() middleware in your app.js.
//
// In app.js do this:
//   import webhookRoutes from './routes/webhookRoutes.js';
//   app.use('/webhook', webhookRoutes);          ← BEFORE express.json()
//   app.use(express.json());                     ← after
//   app.use('/subscription', subscriptionRoutes);

router.post(
  '/stripe',
  express.raw({ type: 'application/json' }), // raw body for Stripe signature verification
  webhookController.handleWebhook.bind(webhookController)
);

export default router;