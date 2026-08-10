import { describe, it, expect } from "vitest";
import { formatPhoneBR, isValidPhoneBR } from "./phone";

describe("phone (Brazilian phone formatting and validation)", () => {
  describe("formatPhoneBR", () => {
    describe("landline (10 digits)", () => {
      it("formats 10 digits as (XX) XXXX-XXXX", () => {
        expect(formatPhoneBR("1133334444")).toBe("(11) 3333-4444");
      });

      it("formats landline with mask already applied", () => {
        expect(formatPhoneBR("(11) 3333-4444")).toBe("(11) 3333-4444");
      });

      it("formats landline with partial mask", () => {
        expect(formatPhoneBR("11 3333 4444")).toBe("(11) 3333-4444");
      });

      it("formats landline with hyphens only", () => {
        expect(formatPhoneBR("11-3333-4444")).toBe("(11) 3333-4444");
      });

      it("formats landline with dots", () => {
        expect(formatPhoneBR("11.3333.4444")).toBe("(11) 3333-4444");
      });
    });

    describe("mobile (11 digits)", () => {
      it("formats 11 digits as (XX) XXXXX-XXXX", () => {
        expect(formatPhoneBR("11999998888")).toBe("(11) 99999-8888");
      });

      it("formats mobile with mask already applied", () => {
        expect(formatPhoneBR("(11) 99999-8888")).toBe("(11) 99999-8888");
      });

      it("formats mobile with partial mask", () => {
        expect(formatPhoneBR("11 99999 8888")).toBe("(11) 99999-8888");
      });

      it("formats mobile with hyphens only", () => {
        expect(formatPhoneBR("11-99999-8888")).toBe("(11) 99999-8888");
      });

      it("formats mobile with dots", () => {
        expect(formatPhoneBR("11.99999.8888")).toBe("(11) 99999-8888");
      });
    });

    describe("progressive formatting", () => {
      it("formats progressively up to 2 digits (area code start)", () => {
        expect(formatPhoneBR("1")).toBe("(1");
        expect(formatPhoneBR("11")).toBe("(11");
      });

      it("formats progressively 3-6 digits (area + first digits)", () => {
        expect(formatPhoneBR("113")).toBe("(11) 3");
        expect(formatPhoneBR("1133")).toBe("(11) 33");
        expect(formatPhoneBR("11333")).toBe("(11) 333");
        expect(formatPhoneBR("113333")).toBe("(11) 3333");
      });

      it("formats progressively 7-10 digits (landline complete or partial)", () => {
        expect(formatPhoneBR("1133334")).toBe("(11) 3333-4");
        expect(formatPhoneBR("11333344")).toBe("(11) 3333-44");
        expect(formatPhoneBR("113333444")).toBe("(11) 3333-444");
        expect(formatPhoneBR("1133334444")).toBe("(11) 3333-4444");
      });

      it("formats progressively 8-11 digits (landline then mobile pattern)", () => {
        // 8 digits: slice(0,2)=11, slice(2,6)=9999, slice(6)=98 → "(11) 9999-98"
        expect(formatPhoneBR("11999998")).toBe("(11) 9999-98");
        // 9 digits: slice(0,2)=11, slice(2,6)=9999, slice(6)=988 → "(11) 9999-988"
        expect(formatPhoneBR("119999988")).toBe("(11) 9999-988");
        // 10 digits: slice(0,2)=11, slice(2,6)=9999, slice(6)=9988 → "(11) 9999-9988"
        expect(formatPhoneBR("1199999988")).toBe("(11) 9999-9988");
        // 11 digits: slice(0,2)=11, slice(2,7)=99999, slice(7)=8888 → "(11) 99999-8888"
        expect(formatPhoneBR("11999998888")).toBe("(11) 99999-8888");
      });
    });

    describe("empty and short inputs", () => {
      it("returns empty string for empty input", () => {
        expect(formatPhoneBR("")).toBe("");
      });

      it("returns empty string for no digits", () => {
        expect(formatPhoneBR("()--")).toBe("");
      });

      it("formats single digit", () => {
        expect(formatPhoneBR("5")).toBe("(5");
      });

      it("formats two digits", () => {
        expect(formatPhoneBR("85")).toBe("(85");
      });
    });

    describe("non-numeric input", () => {
      it("strips non-numeric characters", () => {
        expect(formatPhoneBR("(11) 3333-4444")).toBe("(11) 3333-4444");
      });

      it("strips letters", () => {
        expect(formatPhoneBR("11ABC3333D4444")).toBe("(11) 3333-4444");
      });

      it("strips special characters", () => {
        expect(formatPhoneBR("11@#$%3333^4444")).toBe("(11) 3333-4444");
      });

      it("handles mixed valid and invalid input", () => {
        expect(formatPhoneBR("(11) 9999!9-88@88")).toBe("(11) 99999-8888");
      });
    });

    describe("overflow (> 11 digits)", () => {
      it("caps at 11 digits", () => {
        expect(formatPhoneBR("119999988881234567890")).toBe("(11) 99999-8888");
      });

      it("slices extra digits", () => {
        expect(formatPhoneBR("11999998888999")).toBe("(11) 99999-8888");
      });
    });

    describe("real-world examples", () => {
      it("formats São Paulo landline", () => {
        expect(formatPhoneBR("1133334444")).toBe("(11) 3333-4444");
      });

      it("formats Rio de Janeiro mobile", () => {
        expect(formatPhoneBR("21987654321")).toBe("(21) 98765-4321");
      });

      it("formats Brasília landline", () => {
        expect(formatPhoneBR("6133334444")).toBe("(61) 3333-4444");
      });

      it("formats messy input from form field", () => {
        expect(formatPhoneBR("(11) 99999-8888")).toBe("(11) 99999-8888");
      });

      it("formats pasted/copied with extra spaces", () => {
        expect(formatPhoneBR("  11 99999 8888  ")).toBe("(11) 99999-8888");
      });
    });
  });

  describe("isValidPhoneBR", () => {
    describe("valid landline (10 digits)", () => {
      it("validates 10-digit landline", () => {
        expect(isValidPhoneBR("1133334444")).toBe(true);
      });

      it("validates masked landline", () => {
        expect(isValidPhoneBR("(11) 3333-4444")).toBe(true);
      });

      it("validates landline with spaces", () => {
        expect(isValidPhoneBR("11 3333 4444")).toBe(true);
      });

      it("validates landline with dots", () => {
        expect(isValidPhoneBR("11.3333.4444")).toBe(true);
      });

      it("validates start of landline (area code)", () => {
        // Area codes: 11 (SP), 21 (RJ), 31 (MG), 41 (PR), 51 (RS), 61 (DF), 71 (BA), 81 (PE), 85 (CE), 92 (AM)
        expect(isValidPhoneBR("(11)")).toBe(false); // Incomplete
        expect(isValidPhoneBR("1133334444")).toBe(true); // Complete
      });
    });

    describe("valid mobile (11 digits)", () => {
      it("validates 11-digit mobile", () => {
        expect(isValidPhoneBR("11999998888")).toBe(true);
      });

      it("validates masked mobile", () => {
        expect(isValidPhoneBR("(11) 99999-8888")).toBe(true);
      });

      it("validates mobile with spaces", () => {
        expect(isValidPhoneBR("11 99999 8888")).toBe(true);
      });

      it("validates mobile with dots", () => {
        expect(isValidPhoneBR("11.99999.8888")).toBe(true);
      });
    });

    describe("invalid lengths", () => {
      it("rejects empty string", () => {
        expect(isValidPhoneBR("")).toBe(false);
      });

      it("rejects single digit", () => {
        expect(isValidPhoneBR("1")).toBe(false);
      });

      it("rejects 9 digits (too short)", () => {
        expect(isValidPhoneBR("113333444")).toBe(false);
      });

      it("rejects 12 digits (too long)", () => {
        expect(isValidPhoneBR("119999988881")).toBe(false);
      });

      it("rejects very long input", () => {
        expect(isValidPhoneBR("119999988881234567890")).toBe(false);
      });

      it("rejects more than 11 digits after cleanup", () => {
        expect(isValidPhoneBR("(11) 99999-88881234")).toBe(false);
      });
    });

    describe("non-numeric input", () => {
      it("strips mask and validates", () => {
        expect(isValidPhoneBR("(11) 3333-4444")).toBe(true); // Landline with mask
        expect(isValidPhoneBR("(11) 99999-8888")).toBe(true); // Mobile with mask
      });

      it("strips letters and validates", () => {
        expect(isValidPhoneBR("11ABC3333D4444")).toBe(true); // Valid after cleanup
      });

      it("strips special characters and validates", () => {
        expect(isValidPhoneBR("11@#3333$4444")).toBe(true); // Valid after cleanup
      });

      it("returns false if invalid after cleanup", () => {
        expect(isValidPhoneBR("11ABCDEFGHIJ")).toBe(false); // 2 + 10 non-numeric = too short
      });
    });

    describe("edge cases", () => {
      it("handles whitespace only", () => {
        expect(isValidPhoneBR("   ")).toBe(false);
      });

      it("handles all zeros", () => {
        expect(isValidPhoneBR("0000000000")).toBe(true); // 10 digits = structurally valid
      });

      it("handles all nines", () => {
        expect(isValidPhoneBR("99999999999")).toBe(true); // 11 digits = structurally valid
      });

      it("handles mixed zeros and nines", () => {
        expect(isValidPhoneBR("1100000000")).toBe(true); // 10 digits
        expect(isValidPhoneBR("11000000000")).toBe(true); // 11 digits
      });
    });

    describe("real-world validation scenarios", () => {
      it("validates São Paulo area (11)", () => {
        expect(isValidPhoneBR("1133334444")).toBe(true); // landline
        expect(isValidPhoneBR("11999998888")).toBe(true); // mobile
      });

      it("validates Rio de Janeiro area (21)", () => {
        expect(isValidPhoneBR("2133334444")).toBe(true); // landline
        expect(isValidPhoneBR("21987654321")).toBe(true); // mobile
      });

      it("validates all valid area codes", () => {
        // Common area codes: 11, 21, 31, 41, 51, 61, 71, 81, 85, 92
        expect(isValidPhoneBR("1133334444")).toBe(true);
        expect(isValidPhoneBR("2133334444")).toBe(true);
        expect(isValidPhoneBR("3133334444")).toBe(true);
        expect(isValidPhoneBR("4133334444")).toBe(true);
        expect(isValidPhoneBR("5133334444")).toBe(true);
        expect(isValidPhoneBR("6133334444")).toBe(true);
        expect(isValidPhoneBR("7133334444")).toBe(true);
        expect(isValidPhoneBR("8133334444")).toBe(true);
        expect(isValidPhoneBR("8533334444")).toBe(true);
        expect(isValidPhoneBR("9233334444")).toBe(true);
      });

      it("rejects incomplete form input", () => {
        expect(isValidPhoneBR("11")).toBe(false); // Just area code
        expect(isValidPhoneBR("11333")).toBe(false); // Incomplete
        expect(isValidPhoneBR("1133334")).toBe(false); // Still incomplete
      });
    });
  });
});
