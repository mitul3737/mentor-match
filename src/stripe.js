// Stripe Connect — mentors are connected accounts; the platform keeps a fee.
// TEST MODE ONLY. The app refuses to start with a live key.
import Stripe from "stripe";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const key = process.env.STRIPE_SECRET_KEY || "";
export const stripeEnabled = key.startsWith("sk_test_");
const stripe = stripeEnabled ? new Stripe(key) : null;

// Local store of mentorId -> connected account id (fine for v1; move to DynamoDB later).
const STORE = new URL("../data/accounts.json", import.meta.url);
const load = () => (existsSync(STORE) ? JSON.parse(readFileSync(STORE, "utf8")) : {});
const save = (data) => writeFileSync(STORE, JSON.stringify(data, null, 2));

export function connectedAccountFor(mentorId) {
  return load()[mentorId] || null;
}

// Step 1: create an Express connected account for a mentor and return an onboarding link.
export async function onboardMentor(mentor, appUrl) {
  const accounts = load();
  let accountId = accounts[mentor.id];
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      metadata: { mentorId: mentor.id, mentorName: mentor.name },
    });
    accountId = account.id;
    accounts[mentor.id] = accountId;
    save(accounts);
  }
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/onboard.html?retry=${mentor.id}`,
    return_url: `${appUrl}/onboard.html?done=${mentor.id}`,
    type: "account_onboarding",
  });
  return link.url;
}

export async function accountStatus(accountId) {
  const acct = await stripe.accounts.retrieve(accountId);
  return { chargesEnabled: acct.charges_enabled, detailsSubmitted: acct.details_submitted };
}

// Step 2: a learner books a session — destination charge with an application fee.
export async function createBookingCheckout(mentor, accountId, appUrl) {
  const amount = Math.round(mentor.priceUsd * 100);
  const feePercent = Number(process.env.PLATFORM_FEE_PERCENT || 10);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amount,
          product_data: { name: `1:1 session with ${mentor.name}` },
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: Math.round((amount * feePercent) / 100),
      transfer_data: { destination: accountId },
    },
    success_url: `${appUrl}/?paid=${mentor.id}`,
    cancel_url: `${appUrl}/?cancelled=${mentor.id}`,
  });
  return session.url;
}
