import { NextResponse } from "next/server";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";
import { checkSetupToken } from "@/lib/setup-token";

// One-time bootstrap of the first admin account.
//
// Sign-up is disabled in better-auth, so this creates the user and its
// credential account directly, the same way the admin users page does.
// It is a no-op (404) unless ADMIN_SETUP_TOKEN is set, needs that token in
// the x-setup-token header, and refuses once any user exists.
export async function POST(req: Request) {
  const tokenCheck = checkSetupToken(
    process.env.ADMIN_SETUP_TOKEN,
    req.headers.get("x-setup-token"),
  );
  if (tokenCheck === "disabled") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (tokenCheck === "invalid") {
    return NextResponse.json({ error: "Invalid setup token" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 },
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return NextResponse.json(
        {
          error:
            "Setup is closed. The administrator must create your account from the dashboard.",
        },
        { status: 403 },
      );
    }

    const hashedPassword = await hashPassword(password);
    // One transaction: a user row without its credential account would close
    // setup (a user exists) while leaving nobody able to sign in.
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, emailVerified: true, role: "admin" },
      });
      await tx.account.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password: hashedPassword,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("First admin setup error:", error);
    return NextResponse.json({ error: "Failed to create first admin" }, { status: 500 });
  }
}
