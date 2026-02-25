// config/stripe.config.js
import dotenv from 'dotenv';
dotenv.config();
import Stripe from 'stripe';

export const stripe = Stripe(process.env.STRIPE_SECRECT_KEY);

// Define your subscription plans
export const SUBSCRIPTION_PLANS = {
  free:{
     name: 'Free Plan',
    priceId: null,
    price: 0.00,
    features: ['50 messages/day', 'Basic support', '5 Friends']
  },
  basic: {
    name: 'Basic Plan',
    priceId: process.env.STRIPE_BASIC_PRICE_ID,
    price: 5.00,
    features: ['100 messages/day', 'Basic support', '10 Friends']
  },
  pro: {
    name: 'Pro Plan',
    priceId: process.env.STRIPE_PRO_PRICE_ID, // Replace with your Stripe Price ID
    price: 10.00,
    features: ['Unlimited messages', 'Priority support', 'Unilimited Friends']
  }
};

// module.exports = {
//   stripe,
//   SUBSCRIPTION_PLANS
// };