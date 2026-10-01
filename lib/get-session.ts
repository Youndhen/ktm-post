import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
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

/**
 * For admin pages and layouts: sends anyone without a staff session away.
 * Every page under app/admin/(dashboard) must call this itself. Next skips a
 * layout when the client says it already has it, so a check that lives only
 * in the layout does not protect the pages below it.
 */
export async function requireStaffPage() {
  const session = await getServerSession();
  if (!session) redirect("/admin/login");
  if (!isStaff(session.user.role)) redirect("/");
  return session;
}
