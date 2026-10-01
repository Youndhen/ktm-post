import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Pin the tracing root to this project. Without it Next walks up the
  // filesystem looking for a lockfile, finds the stray one in the home
  // directory, and nests .next/standalone under Desktop/ktmposts/ktm-post/
  // so that server.js is not where the Docker CMD expects it.
  outputFileTracingRoot: path.join(process.cwd()),
  staticPageGenerationTimeout: 120,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  images: {
    // One day. CloudFront's image cache policy uses the same default.
    minimumCacheTTL: 86400,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.ktmpost.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.onlinekhabar.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "assets-cdn-api.ekantipur.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "assets-cdn.ekantipur.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
