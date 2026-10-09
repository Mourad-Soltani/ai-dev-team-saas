import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Dev Team — Multi-Agent Orchestration",
  description:
    "Submit a development goal. Six specialized AI agents debate it, score the risk, and either auto-execute safe steps or escalate the dangerous ones to you.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
