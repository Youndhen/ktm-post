import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { prisma } from "./prisma";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.ktmpost.com";

const devOrigins =
  process.env.NODE_ENV !== "production"
    ? [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
      ]
    : [];

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  trustedOrigins: Array.from(
    new Set([siteUrl, "https://ktmpost.com", "https://www.ktmpost.com", ...devOrigins]),
  ),
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    // Staff accounts are created from the admin users page. Nobody signs up.
    disableSignUp: true,
  },
  plugins: [
    admin({
      defaultRole: "editor",
      adminRole: "admin",
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
