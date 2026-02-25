/**
 * Centralized role definitions and utilities.
 *
 * New roles: app_admin, location_admin, manager, user
 * Legacy roles are normalized via normalizeRole().
 */

export type AppRole = "app_admin" | "location_admin" | "manager" | "user";

/** Maps any legacy or new role string to the canonical new role */
export function normalizeRole(role: string | undefined | null): AppRole {
  switch (role) {
    case "corporate_admin":
    case "app_admin":
      return "app_admin";
    case "gm":
    case "hr_admin":
    case "location_admin":
      return "location_admin";
    case "sales_manager":
    case "manager":
      return "manager";
    case "associate":
    case "user":
    default:
      return "user";
  }
}

/** Display labels for each role */
export const roleLabels: Record<string, string> = {
  app_admin: "App Admin",
  location_admin: "Location Admin",
  manager: "Manager",
  user: "Associate",
  // Legacy fallbacks for display in history/records
  corporate_admin: "App Admin",
  gm: "General Manager",
  hr_admin: "HR Admin",
  sales_manager: "Sales Manager",
  associate: "Associate",
};

/** Badge color variants for each role */
export const roleColors: Record<string, string> = {
  app_admin: "outline",
  location_admin: "default",
  manager: "default",
  user: "secondary",
  // Legacy
  corporate_admin: "outline",
  gm: "default",
  hr_admin: "outline",
  sales_manager: "default",
  associate: "secondary",
};

/** Check helpers */
export const isAdmin = (role: string | undefined | null) =>
  normalizeRole(role) === "app_admin";
export const isLocationAdmin = (role: string | undefined | null) =>
  normalizeRole(role) === "location_admin";
export const isManager = (role: string | undefined | null) =>
  normalizeRole(role) === "manager";
export const isUser = (role: string | undefined | null) =>
  normalizeRole(role) === "user";
export const isManagerOrAbove = (role: string | undefined | null) =>
  ["app_admin", "location_admin", "manager"].includes(normalizeRole(role));
export const isLocationAdminOrAbove = (role: string | undefined | null) =>
  ["app_admin", "location_admin"].includes(normalizeRole(role));

/** Returns the roles a given role is allowed to create/invite */
export function getAllowedRoles(myRole: string): AppRole[] {
  const normalized = normalizeRole(myRole);
  switch (normalized) {
    case "app_admin":
      return ["user", "manager", "location_admin"];
    case "location_admin":
      return ["user", "manager"];
    case "manager":
      return ["user"];
    default:
      return [];
  }
}
