import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/session";

export function proxy(request: NextRequest) {
  const session = readSession(request.cookies);
  if (!session) {
    console.warn(`[Session] Accès refusé à ${request.nextUrl.pathname} : aucune session valide`);
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "auth_required");
    return NextResponse.redirect(url);
  }
  console.info(
    `[Session] Accès autorisé à ${request.nextUrl.pathname} avec la session ${session.provider}`
  );
  return NextResponse.next();
}

export const config = {
  matcher: ["/profile/:path*"],
};
