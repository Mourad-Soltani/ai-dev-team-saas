import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      {
        error:
          "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_PRO in Vercel env.",
      },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const plan = (body.plan as string) || "pro";
    const priceId =
      plan === "team"
        ? process.env.STRIPE_PRICE_TEAM
        : process.env.STRIPE_PRICE_PRO;

    if (!priceId) {
      return NextResponse.json(
        { error: `Missing Stripe price ID for plan "${plan}"` },
        { status: 503 }
      );
    }

    const stripe = new Stripe(secret);
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://ai-dev-team-saas.vercel.app";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/?checkout=success&plan=${plan}`,
      cancel_url: `${appUrl}/pricing?checkout=cancel`,
      allow_promotion_codes: true,
      metadata: { plan },
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Checkout failed" },
      { status: 500 }
    );
  }
}
