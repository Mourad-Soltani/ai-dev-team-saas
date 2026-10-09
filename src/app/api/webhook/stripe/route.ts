import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !whSecret) {
    return NextResponse.json(
      { error: "Stripe webhook not configured" },
      { status: 503 }
    );
  }

  const stripe = new Stripe(secret);
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") || "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, whSecret);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Webhook signature failed: ${
          err instanceof Error ? err.message : "unknown"
        }`,
      },
      { status: 400 }
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log("[stripe] checkout.session.completed", {
        customer: session.customer,
        plan: session.metadata?.plan,
        subscription: session.subscription,
      });
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      console.log(`[stripe] ${event.type}`, {
        customer: sub.customer,
        status: sub.status,
      });
      break;
    }
    default:
      console.log(`[stripe] unhandled: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
