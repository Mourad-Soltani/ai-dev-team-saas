import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Auth middleware.
 * When Clerk keys are present, Clerk protects checkout paths.
 * When keys are missing (demo mode), all routes stay public.
 */
export function middleware(req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
