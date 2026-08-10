import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
import { translateDbError } from "./db-error";

describe("translateDbError", () => {
  describe("unique_violation (code 23505)", () => {
    it("translates Postgres unique_violation to CONFLICT error", () => {
      const pgError = { code: "23505", message: "duplicate key value violates unique constraint" };
      const result = translateDbError(pgError, "fallback message");

      expect(result).toBeInstanceOf(TRPCError);
      expect(result.code).toBe("CONFLICT");
      expect(result.message).toBe("Já existe um registro com esses dados (SKU/slug duplicado).");
    });

    it("ignores fallback message for 23505", () => {
      const pgError = { code: "23505" };
      const result = translateDbError(pgError, "this should be ignored");

      expect(result.code).toBe("CONFLICT");
      expect(result.message).not.toBe("this should be ignored");
    });
  });

  describe("other error codes", () => {
    it("translates unknown code to INTERNAL_SERVER_ERROR with fallback", () => {
      const pgError = { code: "42P01" }; // table does not exist
      const fallbackMsg = "Table not found";
      const result = translateDbError(pgError, fallbackMsg);

      expect(result).toBeInstanceOf(TRPCError);
      expect(result.code).toBe("INTERNAL_SERVER_ERROR");
      expect(result.message).toBe(fallbackMsg);
    });

    it("uses fallback for foreign key violation (23503)", () => {
      const pgError = { code: "23503", message: "foreign key constraint violated" };
      const fallbackMsg = "Referenced record not found";
      const result = translateDbError(pgError, fallbackMsg);

      expect(result.code).toBe("INTERNAL_SERVER_ERROR");
      expect(result.message).toBe(fallbackMsg);
    });

    it("uses fallback for check constraint violation (23514)", () => {
      const pgError = { code: "23514", message: "new row for relation violates check constraint" };
      const fallbackMsg = "Value out of range";
      const result = translateDbError(pgError, fallbackMsg);

      expect(result.code).toBe("INTERNAL_SERVER_ERROR");
      expect(result.message).toBe(fallbackMsg);
    });
  });

  describe("non-object errors", () => {
    it("handles null error", () => {
      const result = translateDbError(null, "null error occurred");

      expect(result).toBeInstanceOf(TRPCError);
      expect(result.code).toBe("INTERNAL_SERVER_ERROR");
      expect(result.message).toBe("null error occurred");
    });

    it("handles undefined error", () => {
      const result = translateDbError(undefined, "undefined error occurred");

      expect(result).toBeInstanceOf(TRPCError);
      expect(result.code).toBe("INTERNAL_SERVER_ERROR");
      expect(result.message).toBe("undefined error occurred");
    });

    it("handles string error", () => {
      const result = translateDbError("some error string", "fallback message");

      expect(result).toBeInstanceOf(TRPCError);
      expect(result.code).toBe("INTERNAL_SERVER_ERROR");
      expect(result.message).toBe("fallback message");
    });

    it("handles Error instance without code", () => {
      const error = new Error("database error");
      const result = translateDbError(error, "error instance fallback");

      expect(result).toBeInstanceOf(TRPCError);
      expect(result.code).toBe("INTERNAL_SERVER_ERROR");
      expect(result.message).toBe("error instance fallback");
    });

    it("handles object without code property", () => {
      const error = { message: "some message", stack: "..." };
      const result = translateDbError(error, "no code fallback");

      expect(result).toBeInstanceOf(TRPCError);
      expect(result.code).toBe("INTERNAL_SERVER_ERROR");
      expect(result.message).toBe("no code fallback");
    });
  });

  describe("error details leakage prevention", () => {
    it("does not leak constraint name in CONFLICT error", () => {
      const pgError = {
        code: "23505",
        message: "duplicate key value violates unique constraint products_sku_key",
        constraint: "products_sku_key",
      };
      const result = translateDbError(pgError, "fallback");

      // Result message should be generic, not exposing constraint name
      expect(result.message).toBe("Já existe um registro com esses dados (SKU/slug duplicado).");
      expect(result.message).not.toContain("products_sku_key");
    });

    it("does not leak stack trace in error result", () => {
      const pgError = {
        code: "23505",
        stack: "Error: at Function...",
      };
      const result = translateDbError(pgError, "fallback");

      // TRPC error should not contain original stack
      expect(JSON.stringify(result)).not.toContain("Function");
    });

    it("uses generic fallback for INTERNAL_SERVER_ERROR codes", () => {
      const pgError = { code: "UNKNOWN_ERROR", message: "detailed internal error" };
      const fallback = "Generic error message";
      const result = translateDbError(pgError, fallback);

      expect(result.message).toBe(fallback);
      expect(result.message).not.toContain("detailed");
    });
  });

  describe("edge cases", () => {
    it("handles code as null", () => {
      const pgError = { code: null };
      const result = translateDbError(pgError, "null code fallback");

      expect(result.code).toBe("INTERNAL_SERVER_ERROR");
      expect(result.message).toBe("null code fallback");
    });

    it("handles code as undefined", () => {
      const pgError = { code: undefined };
      const result = translateDbError(pgError, "undefined code fallback");

      expect(result.code).toBe("INTERNAL_SERVER_ERROR");
      expect(result.message).toBe("undefined code fallback");
    });

    it("handles empty fallback message", () => {
      const pgError = { code: "UNKNOWN" };
      const result = translateDbError(pgError, "");

      expect(result).toBeInstanceOf(TRPCError);
      expect(result.message).toBe("");
    });
  });
});
