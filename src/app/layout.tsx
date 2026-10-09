import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Dev Team — Multi-Agent Orchestration",
  description:
    "Submit a development goal. Six specialized AI agents debate it, score the risk, and either auto-execute safe steps or escalate dangerous ones for human sign-off.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Clerk: wrap with ClerkProvider when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set.
  // Keeping layout free of hard dependency so builds succeed without Clerk keys.
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
