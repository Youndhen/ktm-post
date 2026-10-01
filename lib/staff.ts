export const STAFF_ROLES = ["admin", "editor"] as const;

export function isStaff(role: string | null | undefined): boolean {
  return role != null && (STAFF_ROLES as readonly string[]).includes(role);
}
