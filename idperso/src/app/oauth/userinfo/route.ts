import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/store/accessTokens";
import { findUserById } from "@/lib/users/store";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const record = getAccessToken(token);
  if (!record) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const user = findUserById(record.userId);
  if (!user) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  return NextResponse.json({
    sub: user.id,
    email: user.email,
    name: user.username,
    picture: null,
  });
}
