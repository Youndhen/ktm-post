export const STAFF_ROLES = ["admin", "editor"] as const;

export function isStaff(role: string | null | undefined): boolean {
  return role != null && (STAFF_ROLES as readonly string[]).includes(role);
}

/**
 * A staff role is not enough on its own: a suspended account keeps its role
 * and its existing session, so the ban flag has to be checked on every
 * request, not only at sign-in.
 */
export function isActiveStaff(user: {
  role?: string | null;
  banned?: boolean | null;
}): boolean {
  return isStaff(user.role) && !user.banned;
}
