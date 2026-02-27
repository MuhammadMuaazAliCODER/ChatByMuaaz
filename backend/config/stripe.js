import dotenv from 'dotenv';
dotenv.config();
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRECT_KEY);

export const SUBSCRIPTION_PLANS = {
  free: {
    name: 'Free Plan',
    priceId: null,
    price: 0.00,
    role: 'FREE',
    features: ['10 messages/month', 'Basic support', '5 Friends']
  },
  basic: {
    name: 'Basic Plan',
    priceId: process.env.STRIPE_BASIC_PRICE_ID,
    price: 5.00,
    role: 'BASIC',
    features: ['100 messages/month', 'Standard support', '10 Friends']
  },
  pro: {
    name: 'Pro Plan',
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    price: 10.00,
    role: 'PRO',
    features: ['Unlimited messages', 'Priority support', 'Unlimited Friends']
  }
};

// Used to determine upgrade vs downgrade
export const PLAN_HIERARCHY = {
  free: 0,
  basic: 1,
  pro: 2
};

// Map plan key → user role
export const PLAN_TO_ROLE = {
  free: 'FREE',
  basic: 'BASIC',
  pro: 'PRO'
};