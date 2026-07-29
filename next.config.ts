import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: {
    // Next.js normally prints the complete callback URL, including the
    // short-lived authorization code. Our safe OAuth logs show the flow
    // without exposing that credential.
    incomingRequests: {
      ignore: [/\/api\/auth\/[^/]+\/callback/],
    },
  },
};

export default nextConfig;
