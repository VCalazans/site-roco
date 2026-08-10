import { describe, it, expect } from "vitest";
import { can, ADMIN_ROLE_SLUG, type PortalPermissionUser } from "./permissions";

describe("permissions (client can() helper)", () => {
  describe("admin role bypass", () => {
    it("allows admin user to access any resource:action", () => {
      const adminUser = {
        roles: [ADMIN_ROLE_SLUG],
        permissions: [],
      };

      expect(can(adminUser, "product", "create")).toBe(true);
      expect(can(adminUser, "product", "read")).toBe(true);
      expect(can(adminUser, "product", "update")).toBe(true);
      expect(can(adminUser, "product", "delete")).toBe(true);
      expect(can(adminUser, "category", "publish")).toBe(true);
      expect(can(adminUser, "anything", "anything")).toBe(true);
    });

    it("allows admin even without explicit permissions", () => {
      const adminUser = {
        roles: [ADMIN_ROLE_SLUG],
        permissions: null,
      };

      expect(can(adminUser, "product", "delete")).toBe(true);
    });

    it("allows admin even with empty permissions array", () => {
      const adminUser = {
        roles: [ADMIN_ROLE_SLUG],
        permissions: [],
      };

      expect(can(adminUser, "product", "publish")).toBe(true);
    });

    it("allows admin with multiple roles including admin", () => {
      const adminUser = {
        roles: ["editor", ADMIN_ROLE_SLUG, "viewer"],
        permissions: ["product:read"],
      };

      expect(can(adminUser, "product", "delete")).toBe(true);
    });
  });

  describe("exact permission matching", () => {
    it("allows user with exact permission match", () => {
      const user = {
        roles: [],
        permissions: ["product:create", "product:read"],
      };

      expect(can(user, "product", "create")).toBe(true);
      expect(can(user, "product", "read")).toBe(true);
    });

    it("denies user without matching permission", () => {
      const user = {
        roles: [],
        permissions: ["product:create"],
      };

      expect(can(user, "product", "delete")).toBe(false);
      expect(can(user, "product", "update")).toBe(false);
      expect(can(user, "category", "create")).toBe(false);
    });

    it("requires exact resource:action format", () => {
      const user = {
        roles: [],
        permissions: ["product:create"],
      };

      expect(can(user, "product", "create")).toBe(true);
      expect(can(user, "products", "create")).toBe(false); // Plural mismatch
      expect(can(user, "product", "creates")).toBe(false); // Action mismatch
    });

    it("is case sensitive for resource:action", () => {
      const user = {
        roles: [],
        permissions: ["Product:Create"],
      };

      expect(can(user, "Product", "Create")).toBe(true);
      expect(can(user, "product", "create")).toBe(false); // Lowercase mismatch
      expect(can(user, "PRODUCT", "CREATE")).toBe(false); // Uppercase mismatch
    });
  });

  describe("null/undefined user", () => {
    it("denies null user", () => {
      expect(can(null, "product", "read")).toBe(false);
    });

    it("denies undefined user", () => {
      expect(can(undefined, "product", "read")).toBe(false);
    });
  });

  describe("empty/missing permissions array", () => {
    it("denies user with empty permissions array (no admin)", () => {
      const user = {
        roles: ["editor"],
        permissions: [],
      };

      expect(can(user, "product", "create")).toBe(false);
    });

    it("denies user with null permissions (no admin)", () => {
      const user = {
        roles: ["editor"],
        permissions: null,
      };

      expect(can(user, "product", "create")).toBe(false);
    });

    it("denies user with undefined permissions (no admin)", () => {
      const user = {
        roles: ["editor"],
        permissions: undefined,
      };

      expect(can(user, "product", "create")).toBe(false);
    });

    it("denies user without roles/permissions properties", () => {
      const user: PortalPermissionUser = {};

      expect(can(user, "product", "create")).toBe(false);
    });
  });

  describe("empty/missing roles array", () => {
    it("denies user with empty roles (no admin role)", () => {
      const user = {
        roles: [],
        permissions: ["product:create"],
      };

      expect(can(user, "product", "create")).toBe(true);
      expect(can(user, "product", "delete")).toBe(false);
    });

    it("denies user with null roles (no admin role)", () => {
      const user = {
        roles: null,
        permissions: ["product:create"],
      };

      expect(can(user, "product", "create")).toBe(true);
    });

    it("denies user with undefined roles (no admin role)", () => {
      const user = {
        roles: undefined,
        permissions: ["product:create"],
      };

      expect(can(user, "product", "create")).toBe(true);
    });
  });

  describe("multiple permissions", () => {
    it("matches one permission from many", () => {
      const user = {
        roles: [],
        permissions: [
          "product:read",
          "product:create",
          "category:read",
          "category:update",
        ],
      };

      expect(can(user, "product", "read")).toBe(true);
      expect(can(user, "product", "create")).toBe(true);
      expect(can(user, "category", "read")).toBe(true);
      expect(can(user, "category", "update")).toBe(true);
    });

    it("denies unlisted permissions from many", () => {
      const user = {
        roles: [],
        permissions: [
          "product:read",
          "product:create",
          "category:read",
        ],
      };

      expect(can(user, "product", "delete")).toBe(false);
      expect(can(user, "category", "delete")).toBe(false);
    });
  });

  describe("real-world scenarios", () => {
    it("allows editor to publish products", () => {
      const editorUser = {
        roles: ["editor"],
        permissions: ["product:create", "product:read", "product:update", "product:publish"],
      };

      expect(can(editorUser, "product", "publish")).toBe(true);
      expect(can(editorUser, "product", "delete")).toBe(false);
    });

    it("allows viewer to only read", () => {
      const viewerUser = {
        roles: ["viewer"],
        permissions: ["product:read", "category:read"],
      };

      expect(can(viewerUser, "product", "read")).toBe(true);
      expect(can(viewerUser, "product", "create")).toBe(false);
      expect(can(viewerUser, "product", "update")).toBe(false);
    });

    it("allows moderate with limited deletion rights", () => {
      const moderatorUser = {
        roles: ["moderator"],
        permissions: [
          "product:read",
          "product:update",
          "product:delete",
          "category:read",
          "category:update",
        ],
      };

      expect(can(moderatorUser, "product", "read")).toBe(true);
      expect(can(moderatorUser, "product", "update")).toBe(true);
      expect(can(moderatorUser, "product", "delete")).toBe(true);
      expect(can(moderatorUser, "product", "create")).toBe(false);
    });
  });

  describe("permission format edge cases", () => {
    it("allows exact match with extra colons in permission", () => {
      const user = {
        roles: [],
        permissions: ["product:create:detailed"],
      };

      expect(can(user, "product", "create")).toBe(false); // Different format
      expect(can(user, "product:create", "detailed")).toBe(true); // Exact match: "product:create:detailed"
    });

    it("allows empty resource or action if permission exists", () => {
      const user = {
        roles: [],
        permissions: [":action", "resource:"],
      };

      expect(can(user, "", "action")).toBe(true); // Matches ":action"
      expect(can(user, "resource", "")).toBe(true); // Matches "resource:"
    });

    it("exact matches permissions without trimming whitespace", () => {
      const user = {
        roles: [],
        permissions: ["product: create"], // Space after colon
      };

      expect(can(user, "product", "create")).toBe(false); // No match: "product:create" ≠ "product: create"
      expect(can(user, "product: create", " create")).toBe(false); // No match: "product: create: create" ≠ "product: create"
      expect(can(user, "product:", "create")).toBe(false); // No match: "product::create" ≠ "product: create"
    });
  });

  describe("ADMIN_ROLE_SLUG constant", () => {
    it("exports correct admin role slug", () => {
      expect(ADMIN_ROLE_SLUG).toBe("admin");
    });

    it("is used consistently in admin bypass logic", () => {
      const userWithAdminRole = {
        roles: [ADMIN_ROLE_SLUG],
        permissions: [],
      };

      expect(can(userWithAdminRole, "anything", "anything")).toBe(true);
    });
  });
});
