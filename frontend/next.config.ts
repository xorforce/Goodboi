import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // When bundled, the frontend is served from the same origin as the API
  // so no rewrite is needed. NEXT_PUBLIC_API_URL defaults to "" in production.
};

export default nextConfig;
