import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { prisma } from "./prisma";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "https://ktmpost.com",
    "https://www.ktmpost.com",
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.ktmpost.com",
  ],
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    // Hotfix: public sign-up granted every new account the editor role.
    // Staff accounts are created from the admin users page only.
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
