import { timingSafeEqual } from "node:crypto";

export type SetupTokenCheck = "disabled" | "invalid" | "ok";

/**
 * Compare the configured ADMIN_SETUP_TOKEN with the value a request sent.
 * "disabled" means the feature is off (no token configured) and the route
 * should behave as if it does not exist.
 */
export function checkSetupToken(
  configured: string | undefined,
  provided: string | null,
): SetupTokenCheck {
  const expected = configured?.trim() ?? "";
  if (!expected) return "disabled";
  if (!provided) return "invalid";
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return "invalid";
  return timingSafeEqual(a, b) ? "ok" : "invalid";
}
