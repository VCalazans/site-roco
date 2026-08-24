import { describe, it, expect } from "vitest";
import {
  canDeleteRole,
  canEditRolePermissions,
  wouldSelfLockout,
  wouldRemoveLastAdmin,
  canGrantRole,
} from "./roles-guards";

describe("roles-guards", () => {
  describe("canDeleteRole", () => {
    describe("system roles", () => {
      it("blocks deletion of system role (admin)", () => {
        const result = canDeleteRole({ isSystem: true, assignedUserCount: 0 });
        expect(result).toEqual({ ok: false, reason: "system_role" });
      });

      it("blocks deletion of system role even with users assigned", () => {
        const result = canDeleteRole({ isSystem: true, assignedUserCount: 5 });
        expect(result).toEqual({ ok: false, reason: "system_role" });
      });

      it("blocks deletion of system role with many users", () => {
        const result = canDeleteRole({ isSystem: true, assignedUserCount: 100 });
        expect(result).toEqual({ ok: false, reason: "system_role" });
      });

      it("system_role reason takes precedence over has_users", () => {
        // When both conditions are true, system_role should be returned
        const result = canDeleteRole({ isSystem: true, assignedUserCount: 10 });
        expect(result.ok).toBe(false);
        if (result.ok) {
          throw new Error("expected result.ok to be false");
        }
        expect(result.reason).toBe("system_role");
      });
    });

    describe("custom roles with assigned users", () => {
      it("blocks deletion of custom role with users assigned", () => {
        const result = canDeleteRole({ isSystem: false, assignedUserCount: 1 });
        expect(result).toEqual({ ok: false, reason: "has_users" });
      });

      it("blocks deletion of custom role with many users assigned", () => {
        const result = canDeleteRole({ isSystem: false, assignedUserCount: 50 });
        expect(result).toEqual({ ok: false, reason: "has_users" });
      });
    });

    describe("custom roles without assigned users", () => {
      it("allows deletion of custom role without users", () => {
        const result = canDeleteRole({ isSystem: false, assignedUserCount: 0 });
        expect(result).toEqual({ ok: true });
      });
    });
  });

  describe("canEditRolePermissions", () => {
    it("blocks editing admin role permissions", () => {
      const result = canEditRolePermissions({ slug: "admin" });
      expect(result).toEqual({ ok: false, reason: "admin_role_locked" });
    });

    it("allows editing sales_manager role permissions", () => {
      const result = canEditRolePermissions({ slug: "sales_manager" });
      expect(result).toEqual({ ok: true });
    });

    it("allows editing representative role permissions", () => {
      const result = canEditRolePermissions({ slug: "representative" });
      expect(result).toEqual({ ok: true });
    });

    it("allows editing viewer role permissions", () => {
      const result = canEditRolePermissions({ slug: "viewer" });
      expect(result).toEqual({ ok: true });
    });

    it("allows editing custom role permissions", () => {
      const result = canEditRolePermissions({ slug: "custom_supervisor" });
      expect(result).toEqual({ ok: true });
    });

    it("allows editing custom role with arbitrary slug", () => {
      const result = canEditRolePermissions({ slug: "anything_except_admin" });
      expect(result).toEqual({ ok: true });
    });

    it("case-sensitive: Admin (capitalized) is allowed", () => {
      const result = canEditRolePermissions({ slug: "Admin" });
      expect(result).toEqual({ ok: true });
    });

    it("empty string slug (non-admin) is allowed", () => {
      const result = canEditRolePermissions({ slug: "" });
      expect(result).toEqual({ ok: true });
    });
  });

  describe("wouldSelfLockout", () => {
    describe("admin actor bypass", () => {
      it("never locks out when actor is admin", () => {
        const result = wouldSelfLockout({
          actorRoleSlugs: ["admin"],
          actorRoleIds: ["role-1"],
          editingRoleId: "role-1",
          newPermissionSlugs: [], // empty, would normally lock out
        });
        expect(result).toBe(false);
      });

      it("admin can edit any role without risk of lockout", () => {
        const result = wouldSelfLockout({
          actorRoleSlugs: ["admin", "viewer"],
          actorRoleIds: ["role-1", "role-2"],
          editingRoleId: "role-2",
          newPermissionSlugs: ["some:other:permission"],
        });
        expect(result).toBe(false);
      });
    });

    describe("non-admin editing other's role", () => {
      it("does not lock out when editing a role not owned by actor", () => {
        const result = wouldSelfLockout({
          actorRoleSlugs: ["sales_manager"],
          actorRoleIds: ["role-1", "role-2"],
          editingRoleId: "role-99", // not in actorRoleIds
          newPermissionSlugs: [], // empty
        });
        expect(result).toBe(false);
      });

      it("editing other's role is always safe regardless of permissions", () => {
        const result = wouldSelfLockout({
          actorRoleSlugs: ["representative"],
          actorRoleIds: ["role-1"],
          editingRoleId: "role-2", // different role
          newPermissionSlugs: ["products:read"], // has no roles:manage
        });
        expect(result).toBe(false);
      });
    });

    describe("non-admin editing own role - with roles:manage", () => {
      it("does not lock out when new permissions still include roles:manage", () => {
        const result = wouldSelfLockout({
          actorRoleSlugs: ["sales_manager"],
          actorRoleIds: ["role-1"],
          editingRoleId: "role-1",
          newPermissionSlugs: ["roles:manage", "products:read", "products:write"],
        });
        expect(result).toBe(false);
      });

      it("does not lock out when roles:manage is alone in permissions", () => {
        const result = wouldSelfLockout({
          actorRoleSlugs: ["sales_manager"],
          actorRoleIds: ["role-1"],
          editingRoleId: "role-1",
          newPermissionSlugs: ["roles:manage"],
        });
        expect(result).toBe(false);
      });
    });

    describe("non-admin editing own role - without roles:manage", () => {
      it("locks out when removing roles:manage from own role", () => {
        const result = wouldSelfLockout({
          actorRoleSlugs: ["sales_manager"],
          actorRoleIds: ["role-1"],
          editingRoleId: "role-1",
          newPermissionSlugs: ["products:read"],
        });
        expect(result).toBe(true);
      });

      it("locks out when new permissions are empty", () => {
        const result = wouldSelfLockout({
          actorRoleSlugs: ["representative"],
          actorRoleIds: ["role-1"],
          editingRoleId: "role-1",
          newPermissionSlugs: [],
        });
        expect(result).toBe(true);
      });

      it("locks out when removing roles:manage from multiple-slug role", () => {
        const result = wouldSelfLockout({
          actorRoleSlugs: ["products:manage", "roles:manage"],
          actorRoleIds: ["role-1"],
          editingRoleId: "role-1",
          newPermissionSlugs: ["products:manage"], // lost roles:manage
        });
        expect(result).toBe(true);
      });
    });

    describe("non-admin with multiple role IDs", () => {
      it("locks out only when editing ONE of multiple roles and losing roles:manage on that role", () => {
        // Actor has two roles; editing one of them
        const result = wouldSelfLockout({
          actorRoleSlugs: ["sales_manager"],
          actorRoleIds: ["role-1", "role-2"],
          editingRoleId: "role-1", // editing one
          newPermissionSlugs: ["products:read"], // no roles:manage on this role
        });
        expect(result).toBe(true);
      });

      it("does not lock out when editing a role not in actorRoleIds, even with multiple roles owned", () => {
        const result = wouldSelfLockout({
          actorRoleSlugs: ["sales_manager"],
          actorRoleIds: ["role-1", "role-2"],
          editingRoleId: "role-3", // not owned
          newPermissionSlugs: [],
        });
        expect(result).toBe(false);
      });

      it("does not lock out when editing one of multiple roles and permissions still have roles:manage", () => {
        const result = wouldSelfLockout({
          actorRoleSlugs: ["sales_manager"],
          actorRoleIds: ["role-1", "role-2"],
          editingRoleId: "role-1",
          newPermissionSlugs: ["roles:manage", "products:read"],
        });
        expect(result).toBe(false);
      });
    });

    describe("edge cases", () => {
      it("handles empty actorRoleIds", () => {
        // Non-admin with no roles, editing some role
        const result = wouldSelfLockout({
          actorRoleSlugs: [],
          actorRoleIds: [],
          editingRoleId: "role-1",
          newPermissionSlugs: [],
        });
        expect(result).toBe(false);
      });

      it("handles roles:manage as part of complex permission string", () => {
        // Verify it's an exact match, not substring
        const result = wouldSelfLockout({
          actorRoleSlugs: ["sales_manager"],
          actorRoleIds: ["role-1"],
          editingRoleId: "role-1",
          newPermissionSlugs: ["roles:manage:special"], // NOT exactly "roles:manage"
        });
        expect(result).toBe(true); // Should lock out
      });
    });
  });

  describe("wouldRemoveLastAdmin", () => {
    describe("non-admin role target", () => {
      it("never blocks removing non-admin role regardless of count", () => {
        const result = wouldRemoveLastAdmin({
          targetRoleSlug: "sales_manager",
          currentActiveAdminCount: 0,
        });
        expect(result).toBe(false);
      });

      it("allows removing representative role when admin count is 0", () => {
        const result = wouldRemoveLastAdmin({
          targetRoleSlug: "representative",
          currentActiveAdminCount: 0,
        });
        expect(result).toBe(false);
      });

      it("allows removing viewer role", () => {
        const result = wouldRemoveLastAdmin({
          targetRoleSlug: "viewer",
          currentActiveAdminCount: 1,
        });
        expect(result).toBe(false);
      });

      it("allows removing custom role", () => {
        const result = wouldRemoveLastAdmin({
          targetRoleSlug: "custom_role",
          currentActiveAdminCount: 0,
        });
        expect(result).toBe(false);
      });
    });

    describe("admin role target - edge cases", () => {
      it("blocks removing last admin (count = 1)", () => {
        const result = wouldRemoveLastAdmin({
          targetRoleSlug: "admin",
          currentActiveAdminCount: 1,
        });
        expect(result).toBe(true);
      });

      it("blocks removing admin when count is 0 (sanity check)", () => {
        const result = wouldRemoveLastAdmin({
          targetRoleSlug: "admin",
          currentActiveAdminCount: 0,
        });
        expect(result).toBe(true);
      });

      it("allows removing admin when count is 2", () => {
        const result = wouldRemoveLastAdmin({
          targetRoleSlug: "admin",
          currentActiveAdminCount: 2,
        });
        expect(result).toBe(false);
      });

      it("allows removing admin when count is high", () => {
        const result = wouldRemoveLastAdmin({
          targetRoleSlug: "admin",
          currentActiveAdminCount: 100,
        });
        expect(result).toBe(false);
      });
    });

    describe("case sensitivity", () => {
      it("Admin (capitalized) is treated as non-admin slug", () => {
        const result = wouldRemoveLastAdmin({
          targetRoleSlug: "Admin",
          currentActiveAdminCount: 0,
        });
        expect(result).toBe(false);
      });
    });
  });

  describe("canGrantRole", () => {
    describe("non-admin target role", () => {
      it("always allows granting sales_manager role", () => {
        const result = canGrantRole({
          actorRoleSlugs: [],
          targetRoleSlug: "sales_manager",
        });
        expect(result).toEqual({ ok: true });
      });

      it("allows granting representative role to anyone", () => {
        const result = canGrantRole({
          actorRoleSlugs: ["viewer"],
          targetRoleSlug: "representative",
        });
        expect(result).toEqual({ ok: true });
      });

      it("allows granting viewer role even with empty actor roles", () => {
        const result = canGrantRole({
          actorRoleSlugs: [],
          targetRoleSlug: "viewer",
        });
        expect(result).toEqual({ ok: true });
      });

      it("allows granting custom role", () => {
        const result = canGrantRole({
          actorRoleSlugs: ["sales_manager"],
          targetRoleSlug: "custom_supervisor",
        });
        expect(result).toEqual({ ok: true });
      });
    });

    describe("admin role target - actor is admin", () => {
      it("allows admin to grant admin role", () => {
        const result = canGrantRole({
          actorRoleSlugs: ["admin"],
          targetRoleSlug: "admin",
        });
        expect(result).toEqual({ ok: true });
      });

      it("allows admin to grant admin role even with other roles", () => {
        const result = canGrantRole({
          actorRoleSlugs: ["admin", "sales_manager", "viewer"],
          targetRoleSlug: "admin",
        });
        expect(result).toEqual({ ok: true });
      });
    });

    describe("admin role target - actor is not admin", () => {
      it("blocks sales_manager from granting admin role", () => {
        const result = canGrantRole({
          actorRoleSlugs: ["sales_manager"],
          targetRoleSlug: "admin",
        });
        expect(result).toEqual({ ok: false, reason: "requires_admin_actor" });
      });

      it("blocks representative from granting admin role", () => {
        const result = canGrantRole({
          actorRoleSlugs: ["representative"],
          targetRoleSlug: "admin",
        });
        expect(result).toEqual({ ok: false, reason: "requires_admin_actor" });
      });

      it("blocks viewer from granting admin role", () => {
        const result = canGrantRole({
          actorRoleSlugs: ["viewer"],
          targetRoleSlug: "admin",
        });
        expect(result).toEqual({ ok: false, reason: "requires_admin_actor" });
      });

      it("blocks actor with multiple roles (but no admin) from granting admin", () => {
        const result = canGrantRole({
          actorRoleSlugs: ["sales_manager", "viewer", "representative"],
          targetRoleSlug: "admin",
        });
        expect(result).toEqual({ ok: false, reason: "requires_admin_actor" });
      });

      it("blocks actor with empty roles from granting admin", () => {
        const result = canGrantRole({
          actorRoleSlugs: [],
          targetRoleSlug: "admin",
        });
        expect(result).toEqual({ ok: false, reason: "requires_admin_actor" });
      });
    });

    describe("edge cases", () => {
      it("case-sensitive: Admin (capitalized) requires actor to have admin", () => {
        const result = canGrantRole({
          actorRoleSlugs: ["sales_manager"],
          targetRoleSlug: "Admin",
        });
        // "Admin" !== "admin", so it's treated as a non-admin role
        expect(result).toEqual({ ok: true });
      });

      it("actor with admin in middle of roles list can grant admin", () => {
        const result = canGrantRole({
          actorRoleSlugs: ["viewer", "admin", "sales_manager"],
          targetRoleSlug: "admin",
        });
        expect(result).toEqual({ ok: true });
      });
    });
  });
});
