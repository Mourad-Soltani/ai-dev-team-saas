export type PlanId = "free" | "pro" | "team";

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number;
  runsPerDay: number; // -1 = unlimited
  historyDays: number;
  seats: number;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    runsPerDay: 5,
    historyDays: 1,
    seats: 1,
    features: [
      "5 runs per day",
      "Risk gates & consensus",
      "Approve / reject escalations",
      "1-day run history (browser)",
    ],
    cta: "Current plan",
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 49,
    runsPerDay: -1,
    historyDays: 90,
    seats: 1,
    features: [
      "Unlimited runs",
      "90-day run history",
      "Priority support",
      "Slack escalation webhook",
      "Export audit log",
    ],
    cta: "Upgrade to Pro",
    highlighted: true,
  },
  {
    id: "team",
    name: "Team",
    priceMonthly: 149,
    runsPerDay: -1,
    historyDays: 365,
    seats: 5,
    features: [
      "Everything in Pro",
      "5 seats",
      "Shared escalation inbox",
      "SSO-ready (roadmap)",
      "Dedicated support",
    ],
    cta: "Upgrade to Team",
  },
];

export function getPlan(id: PlanId | string | undefined): Plan {
  return PLANS.find((p) => p.id === id) || PLANS[0];
}
