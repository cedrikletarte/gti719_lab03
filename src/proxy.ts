import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";

export function proxy(request: NextRequest) {
  const session = readSession(request.cookies);
  if (!session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "auth_required");
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/profile/:path*"],
};
