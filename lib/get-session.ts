import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isStaff } from "@/lib/staff";

export async function getServerSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

/**
 * For server actions and admin-only code paths. A session alone is not
 * enough: the user must hold a staff role (admin or editor).
 */
export async function requireStaffSession() {
  const session = await getServerSession();
  if (!session) throw new Error("Unauthorized");
  if (!isStaff(session.user.role)) throw new Error("Forbidden");
  return session;
}
