// @ts-nocheck - Test file using mocked/partial Session objects
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Session } from "next-auth";
import { hasPermission, ForbiddenError, requirePermission } from "./rbac";
import * as authModule from "@/core/auth";

// Mock the auth function
vi.mock("@/core/auth", () => ({
  auth: vi.fn(),
}));

describe("rbac (Role-Based Access Control)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("hasPermission", () => {
    describe("admin role bypass", () => {
      it("allows admin user to access any resource:action", () => {
        const adminSession: Session = {
          user: {
            id: "user1",
            name: "Admin User",
            email: "admin@example.com",
            roles: ["admin"],
            permissions: [],
          },
        };

        expect(hasPermission(adminSession, "product", "create")).toBe(true);
        expect(hasPermission(adminSession, "product", "delete")).toBe(true);
        expect(hasPermission(adminSession, "category", "publish")).toBe(true);
        expect(hasPermission(adminSession, "anything", "anything")).toBe(true);
      });

      it("allows admin even without explicit permissions", () => {
        const adminSession: Session = {
          user: {
            id: "user1",
            name: "Admin User",
            email: "admin@example.com",
            roles: ["admin"],
            permissions: null,
          },
        };

        expect(hasPermission(adminSession, "product", "delete")).toBe(true);
      });

      it("allows admin even with empty permissions", () => {
        const adminSession: Session = {
          user: {
            id: "user1",
            name: "Admin User",
            email: "admin@example.com",
            roles: ["admin"],
            permissions: [],
          },
        };

        expect(hasPermission(adminSession, "product", "publish")).toBe(true);
      });

      it("allows admin with multiple roles", () => {
        const adminSession: Session = {
          user: {
            id: "user1",
            name: "Admin User",
            email: "admin@example.com",
            roles: ["editor", "admin", "viewer"],
            permissions: ["product:read"],
          },
        };

        expect(hasPermission(adminSession, "product", "delete")).toBe(true);
      });
    });

    describe("exact permission matching", () => {
      it("allows user with exact permission match", () => {
        // @ts-expect-error Test object doesn't strictly match Session interface
      const session: Session = {
          user: {
            id: "user2",
            name: "Editor",
            email: "editor@example.com",
            roles: ["editor"],
            permissions: ["product:create", "product:read"],
          },
        };

        expect(hasPermission(session, "product", "create")).toBe(true);
        expect(hasPermission(session, "product", "read")).toBe(true);
      });

      it("denies user without permission", () => {
        // @ts-expect-error Test object doesn't strictly match Session interface
      const session: Session = {
          user: {
            id: "user2",
            name: "Editor",
            email: "editor@example.com",
            roles: ["editor"],
            permissions: ["product:read"],
          },
        };

        expect(hasPermission(session, "product", "create")).toBe(false);
        expect(hasPermission(session, "product", "delete")).toBe(false);
        expect(hasPermission(session, "category", "read")).toBe(false);
      });

      it("requires exact resource:action format", () => {
        // @ts-expect-error Test object doesn't strictly match Session interface
      const session: Session = {
          user: {
            id: "user2",
            name: "Editor",
            email: "editor@example.com",
            roles: [],
            permissions: ["product:create"],
          },
        };

        expect(hasPermission(session, "product", "create")).toBe(true);
        expect(hasPermission(session, "products", "create")).toBe(false); // Plural
        expect(hasPermission(session, "product", "creates")).toBe(false); // Wrong action
      });

      it("is case-sensitive for resource:action", () => {
        // @ts-expect-error Test object doesn't strictly match Session interface
      const session: Session = {
          user: {
            id: "user2",
            name: "Editor",
            email: "editor@example.com",
            roles: [],
            permissions: ["Product:Create"],
          },
        };

        expect(hasPermission(session, "Product", "Create")).toBe(true);
        expect(hasPermission(session, "product", "create")).toBe(false); // Lowercase
        expect(hasPermission(session, "PRODUCT", "CREATE")).toBe(false); // Uppercase
      });
    });

    describe("null/undefined session", () => {
      it("denies null session", () => {
        expect(hasPermission(null, "product", "read")).toBe(false);
      });

      it("denies undefined session", () => {
        expect(hasPermission(undefined, "product", "read")).toBe(false);
      });
    });

    describe("null/undefined user in session", () => {
      it("denies session with null user", () => {
        // @ts-expect-error Test object doesn't strictly match Session interface
      const session: Session = {
          user: null,
        };

        expect(hasPermission(session, "product", "read")).toBe(false);
      });

      it("denies session with undefined user", () => {
        // @ts-expect-error Test object doesn't strictly match Session interface
      const session: Session = {
          user: undefined,
        };

        expect(hasPermission(session, "product", "read")).toBe(false);
      });
    });

    describe("null/undefined permissions array", () => {
      it("denies user with null permissions", () => {
        // @ts-expect-error Test object doesn't strictly match Session interface
      const session: Session = {
          user: {
            id: "user2",
            name: "User",
            email: "user@example.com",
            roles: ["viewer"],
            permissions: null,
          },
        };

        expect(hasPermission(session, "product", "read")).toBe(false);
      });

      it("denies user with undefined permissions", () => {
        // @ts-expect-error Test object doesn't strictly match Session interface
      const session: Session = {
          user: {
            id: "user2",
            name: "User",
            email: "user@example.com",
            roles: ["viewer"],
            permissions: undefined,
          },
        };

        expect(hasPermission(session, "product", "read")).toBe(false);
      });

      it("denies user with empty permissions array", () => {
        // @ts-expect-error Test object doesn't strictly match Session interface
      const session: Session = {
          user: {
            id: "user2",
            name: "User",
            email: "user@example.com",
            roles: ["viewer"],
            permissions: [],
          },
        };

        expect(hasPermission(session, "product", "read")).toBe(false);
      });
    });

    describe("null/undefined roles array", () => {
      it("handles user with null roles (not admin)", () => {
        // @ts-expect-error Test object doesn't strictly match Session interface
      const session: Session = {
          user: {
            id: "user2",
            name: "User",
            email: "user@example.com",
            roles: null,
            permissions: ["product:read"],
          },
        };

        expect(hasPermission(session, "product", "read")).toBe(true);
        expect(hasPermission(session, "product", "create")).toBe(false);
      });

      it("handles user with undefined roles (not admin)", () => {
        // @ts-expect-error Test object doesn't strictly match Session interface
      const session: Session = {
          user: {
            id: "user2",
            name: "User",
            email: "user@example.com",
            roles: undefined,
            permissions: ["product:read"],
          },
        };

        expect(hasPermission(session, "product", "read")).toBe(true);
      });
    });

    describe("real-world scenarios", () => {
      it("allows editor with multiple permissions", () => {
        // @ts-expect-error Test object doesn't strictly match Session interface
      const session: Session = {
          user: {
            id: "user3",
            name: "Editor",
            email: "editor@example.com",
            roles: ["editor"],
            permissions: [
              "product:create",
              "product:read",
              "product:update",
              "product:publish",
              "category:read",
              "category:update",
            ],
          },
        };

        expect(hasPermission(session, "product", "publish")).toBe(true);
        expect(hasPermission(session, "product", "delete")).toBe(false);
      });

      it("allows viewer with read-only access", () => {
        // @ts-expect-error Test object doesn't strictly match Session interface
      const session: Session = {
          user: {
            id: "user4",
            name: "Viewer",
            email: "viewer@example.com",
            roles: ["viewer"],
            permissions: ["product:read", "category:read"],
          },
        };

        expect(hasPermission(session, "product", "read")).toBe(true);
        expect(hasPermission(session, "product", "create")).toBe(false);
      });
    });
  });

  describe("ForbiddenError", () => {
    it("creates error with default message", () => {
      const error = new ForbiddenError();
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("ForbiddenError");
      expect(error.message).toBe("Acesso negado.");
    });

    it("creates error with custom message", () => {
      const error = new ForbiddenError("Custom access denied message");
      expect(error.name).toBe("ForbiddenError");
      expect(error.message).toBe("Custom access denied message");
    });

    it("extends Error class", () => {
      const error = new ForbiddenError("Test");
      expect(error instanceof Error).toBe(true);
    });
  });

  describe("requirePermission", () => {
    it("returns session when user has permission", async () => {
      // @ts-expect-error Test object doesn't strictly match Session interface
      const mockSession: Session = {
        user: {
          id: "user1",
          name: "Admin",
          email: "admin@example.com",
          roles: ["admin"],
          permissions: [],
        },
      };

      vi.mocked(authModule.auth).mockResolvedValueOnce(mockSession);

      const result = await requirePermission("product", "create");
      expect(result).toBe(mockSession);
    });

    it("throws ForbiddenError when session is null", async () => {
      vi.mocked(authModule.auth).mockResolvedValueOnce(null);

      await expect(requirePermission("product", "create")).rejects.toThrow(ForbiddenError);
      await expect(requirePermission("product", "create")).rejects.toThrow(
        "Sessão não encontrada."
      );
    });

    it("throws ForbiddenError when user is null", async () => {
      // @ts-expect-error Test object doesn't strictly match Session interface
      const mockSession: Session = {
        user: null,
      };

      vi.mocked(authModule.auth).mockResolvedValueOnce(mockSession);

      await expect(requirePermission("product", "create")).rejects.toThrow(ForbiddenError);
      await expect(requirePermission("product", "create")).rejects.toThrow(
        "Sessão não encontrada."
      );
    });

    it("throws ForbiddenError when user lacks permission", async () => {
      // @ts-expect-error Test object doesn't strictly match Session interface
      const mockSession: Session = {
        user: {
          id: "user1",
          name: "User",
          email: "user@example.com",
          roles: ["viewer"],
          permissions: ["product:read"],
        },
      };

      vi.mocked(authModule.auth).mockResolvedValue(mockSession);

      // Verify the error is thrown
      await expect(requirePermission("product", "delete")).rejects.toThrow(ForbiddenError);

      // Verify the error message includes the resource:action
      vi.mocked(authModule.auth).mockResolvedValue(mockSession);
      try {
        await requirePermission("product", "delete");
      } catch (err) {
        if (err instanceof ForbiddenError) {
          expect(err.message).toContain('Permissão negada para "product:delete".');
        }
      }
    });

    it("returns session when user is admin", async () => {
      // @ts-expect-error Test object doesn't strictly match Session interface
      const mockSession: Session = {
        user: {
          id: "user1",
          name: "Admin",
          email: "admin@example.com",
          roles: ["admin"],
          permissions: [],
        },
      };

      vi.mocked(authModule.auth).mockResolvedValueOnce(mockSession);

      const result = await requirePermission("anything", "anything");
      expect(result).toBe(mockSession);
    });

    it("includes resource:action in error message", async () => {
      // @ts-expect-error Test object doesn't strictly match Session interface
      const mockSession: Session = {
        user: {
          id: "user1",
          name: "User",
          email: "user@example.com",
          roles: [],
          permissions: [],
        },
      };

      vi.mocked(authModule.auth).mockResolvedValueOnce(mockSession);

      try {
        await requirePermission("category", "publish");
        throw new Error("Should have thrown");
      } catch (error) {
        if (error instanceof ForbiddenError) {
          expect(error.message).toContain("category:publish");
        }
      }
    });

    it("calls auth() to get session", async () => {
      // @ts-expect-error Test object doesn't strictly match Session interface
      const mockSession: Session = {
        user: {
          id: "user1",
          name: "Admin",
          email: "admin@example.com",
          roles: ["admin"],
          permissions: [],
        },
      };

      vi.mocked(authModule.auth).mockResolvedValueOnce(mockSession);

      await requirePermission("product", "read");
      expect(authModule.auth).toHaveBeenCalledTimes(1);
    });

    it("handles permission check with null permissions", async () => {
      // @ts-expect-error Test object doesn't strictly match Session interface
      const mockSession: Session = {
        user: {
          id: "user1",
          name: "User",
          email: "user@example.com",
          roles: [],
          permissions: null,
        },
      };

      vi.mocked(authModule.auth).mockResolvedValueOnce(mockSession);

      await expect(requirePermission("product", "read")).rejects.toThrow(ForbiddenError);
    });
  });
});
