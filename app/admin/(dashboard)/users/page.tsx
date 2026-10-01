import { prisma } from "@/lib/prisma";
import { requireStaffPage } from "@/lib/get-session";
import UserManager from "./UserManager";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await requireStaffPage();

  if (session.user.role !== "admin") {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center max-w-lg mx-auto">
        <h2 className="text-base font-bold text-red-800">Access Restricted</h2>
        <p className="text-xs text-red-600 mt-2">
          Only administrators can access and manage team user accounts and roles.
        </p>
      </div>
    );
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { posts: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="admin-page-header">
        <h1>Users & Roles (प्रयोगकर्ता र भूमिका)</h1>
        <p>Manage journalists, editors, and administrators with role-based access control</p>
      </div>

      <UserManager users={users} currentUserId={session.user.id} />
    </div>
  );
}
