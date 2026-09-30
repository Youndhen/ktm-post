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
  images: {
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
