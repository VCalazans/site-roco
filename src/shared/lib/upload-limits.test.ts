import { describe, it, expect } from "vitest";
import {
  getAllowedContentTypes,
  getUploadLimit,
  isContentTypeAllowed,
  getMaxBytes,
  getExtension,
  isSizeWithinLimit,
  type UploadField,
} from "./upload-limits";

describe("upload-limits", () => {
  describe("getAllowedContentTypes", () => {
    it("returns tuple with video types for heroVideo field", () => {
      const types = getAllowedContentTypes("heroVideo");
      expect(types).toContain("video/mp4");
      expect(types).toContain("video/webm");
      expect(types.length).toBe(2);
    });

    it("returns tuple with image types for heroPoster field", () => {
      const types = getAllowedContentTypes("heroPoster");
      expect(types).toContain("image/jpeg");
      expect(types).toContain("image/png");
      expect(types).toContain("image/webp");
      expect(types.length).toBe(3);
    });

    it("returns tuple with mixed types for material field", () => {
      const types = getAllowedContentTypes("material");
      expect(types).toContain("application/pdf");
      expect(types).toContain("video/mp4");
      expect(types).toContain("video/webm");
      expect(types).toContain("image/jpeg");
      expect(types).toContain("image/png");
      expect(types).toContain("image/webp");
      // Office e ZIP entraram em 2026-08-24: a lista original barrava
      // justamente os formatos mais comuns do material comercial
      // (política em Word, tabela de preços em Excel, apresentação em
      // PowerPoint, kit de artes em ZIP).
      expect(types).toContain(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      expect(types).toContain(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      expect(types).toContain(
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      );
      expect(types).toContain("application/msword");
      expect(types).toContain("application/vnd.ms-excel");
      expect(types).toContain("application/vnd.ms-powerpoint");
      expect(types).toContain("application/zip");
      expect(types).toContain("application/x-zip-compressed");
      expect(types.length).toBe(14);
    });

    it("returns first element as required by tuple type [string, ...string[]]", () => {
      const types = getAllowedContentTypes("heroVideo");
      expect(types.length).toBeGreaterThan(0);
      expect(typeof types[0]).toBe("string");
    });
  });

  describe("getUploadLimit", () => {
    describe("heroVideo field", () => {
      it("returns limit for mp4", () => {
        const limit = getUploadLimit("heroVideo", "video/mp4");
        expect(limit).not.toBeNull();
        expect(limit?.extension).toBe("mp4");
        expect(limit?.maxBytes).toBe(200 * 1024 * 1024);
      });

      it("returns limit for webm", () => {
        const limit = getUploadLimit("heroVideo", "video/webm");
        expect(limit?.extension).toBe("webm");
        expect(limit?.maxBytes).toBe(200 * 1024 * 1024);
      });

      it("returns null for unsupported type (image/jpeg)", () => {
        const limit = getUploadLimit("heroVideo", "image/jpeg");
        expect(limit).toBeNull();
      });

      it("returns null for unsupported type (application/pdf)", () => {
        const limit = getUploadLimit("heroVideo", "application/pdf");
        expect(limit).toBeNull();
      });
    });

    describe("heroPoster field", () => {
      it("returns limit for jpeg", () => {
        const limit = getUploadLimit("heroPoster", "image/jpeg");
        expect(limit?.extension).toBe("jpg");
        expect(limit?.maxBytes).toBe(10 * 1024 * 1024);
      });

      it("returns limit for png", () => {
        const limit = getUploadLimit("heroPoster", "image/png");
        expect(limit?.extension).toBe("png");
        expect(limit?.maxBytes).toBe(10 * 1024 * 1024);
      });

      it("returns limit for webp", () => {
        const limit = getUploadLimit("heroPoster", "image/webp");
        expect(limit?.extension).toBe("webp");
        expect(limit?.maxBytes).toBe(10 * 1024 * 1024);
      });

      it("returns null for video types", () => {
        expect(getUploadLimit("heroPoster", "video/mp4")).toBeNull();
        expect(getUploadLimit("heroPoster", "video/webm")).toBeNull();
      });

      it("returns null for pdf", () => {
        expect(getUploadLimit("heroPoster", "application/pdf")).toBeNull();
      });
    });

    describe("material field", () => {
      it("returns limit for pdf", () => {
        const limit = getUploadLimit("material", "application/pdf");
        expect(limit?.extension).toBe("pdf");
        expect(limit?.maxBytes).toBe(50 * 1024 * 1024);
      });

      it("returns limit for mp4 video (200MB)", () => {
        const limit = getUploadLimit("material", "video/mp4");
        expect(limit?.extension).toBe("mp4");
        expect(limit?.maxBytes).toBe(200 * 1024 * 1024);
      });

      it("returns limit for webm video (200MB)", () => {
        const limit = getUploadLimit("material", "video/webm");
        expect(limit?.extension).toBe("webm");
        expect(limit?.maxBytes).toBe(200 * 1024 * 1024);
      });

      it("returns limit for jpeg image (20MB)", () => {
        const limit = getUploadLimit("material", "image/jpeg");
        expect(limit?.extension).toBe("jpg");
        expect(limit?.maxBytes).toBe(20 * 1024 * 1024);
      });

      it("returns limit for png image (20MB)", () => {
        const limit = getUploadLimit("material", "image/png");
        expect(limit?.extension).toBe("png");
        expect(limit?.maxBytes).toBe(20 * 1024 * 1024);
      });

      it("returns limit for webp image (20MB)", () => {
        const limit = getUploadLimit("material", "image/webp");
        expect(limit?.extension).toBe("webp");
        expect(limit?.maxBytes).toBe(20 * 1024 * 1024);
      });

      it("returns null for unknown type", () => {
        expect(getUploadLimit("material", "audio/mpeg")).toBeNull();
      });
    });
  });

  describe("isContentTypeAllowed", () => {
    describe("type differences across fields", () => {
      it("image/jpeg is allowed in heroPoster", () => {
        expect(isContentTypeAllowed("heroPoster", "image/jpeg")).toBe(true);
      });

      it("image/jpeg is NOT allowed in heroVideo", () => {
        expect(isContentTypeAllowed("heroVideo", "image/jpeg")).toBe(false);
      });

      it("image/jpeg is allowed in material", () => {
        expect(isContentTypeAllowed("material", "image/jpeg")).toBe(true);
      });

      it("video/mp4 is allowed in heroVideo", () => {
        expect(isContentTypeAllowed("heroVideo", "video/mp4")).toBe(true);
      });

      it("video/mp4 is NOT allowed in heroPoster", () => {
        expect(isContentTypeAllowed("heroPoster", "video/mp4")).toBe(false);
      });

      it("video/mp4 is allowed in material", () => {
        expect(isContentTypeAllowed("material", "video/mp4")).toBe(true);
      });

      it("application/pdf is NOT allowed in heroVideo", () => {
        expect(isContentTypeAllowed("heroVideo", "application/pdf")).toBe(false);
      });

      it("application/pdf is NOT allowed in heroPoster", () => {
        expect(isContentTypeAllowed("heroPoster", "application/pdf")).toBe(false);
      });

      it("application/pdf is allowed in material", () => {
        expect(isContentTypeAllowed("material", "application/pdf")).toBe(true);
      });
    });

    describe("unknown types", () => {
      it("rejects unknown type in heroVideo", () => {
        expect(isContentTypeAllowed("heroVideo", "audio/mpeg")).toBe(false);
      });

      it("rejects unknown type in heroPoster", () => {
        expect(isContentTypeAllowed("heroPoster", "audio/mpeg")).toBe(false);
      });

      it("rejects unknown type in material", () => {
        expect(isContentTypeAllowed("material", "audio/mpeg")).toBe(false);
      });

      it("rejects empty string", () => {
        expect(isContentTypeAllowed("heroVideo", "")).toBe(false);
      });
    });

    describe("case sensitivity", () => {
      it("rejects capitalized mime type (Image/Jpeg)", () => {
        expect(isContentTypeAllowed("heroPoster", "Image/Jpeg")).toBe(false);
      });

      it("rejects mixed case mime type (image/JPEG)", () => {
        expect(isContentTypeAllowed("heroPoster", "image/JPEG")).toBe(false);
      });
    });
  });

  describe("getMaxBytes", () => {
    describe("valid types", () => {
      it("returns 200MB for heroVideo mp4", () => {
        expect(getMaxBytes("heroVideo", "video/mp4")).toBe(200 * 1024 * 1024);
      });

      it("returns 10MB for heroPoster jpeg", () => {
        expect(getMaxBytes("heroPoster", "image/jpeg")).toBe(10 * 1024 * 1024);
      });

      it("returns 50MB for material pdf", () => {
        expect(getMaxBytes("material", "application/pdf")).toBe(50 * 1024 * 1024);
      });

      it("returns 50MB for material office documents", () => {
        expect(
          getMaxBytes(
            "material",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          )
        ).toBe(50 * 1024 * 1024);
      });

      it("returns 200MB for material video (mp4)", () => {
        expect(getMaxBytes("material", "video/mp4")).toBe(200 * 1024 * 1024);
      });

      it("returns 20MB for material image (jpeg)", () => {
        expect(getMaxBytes("material", "image/jpeg")).toBe(20 * 1024 * 1024);
      });
    });

    describe("invalid types", () => {
      it("returns null for unsupported type in heroVideo", () => {
        expect(getMaxBytes("heroVideo", "image/jpeg")).toBeNull();
      });

      it("returns null for unsupported type in heroPoster", () => {
        expect(getMaxBytes("heroPoster", "video/mp4")).toBeNull();
      });

      it("returns null for unknown type", () => {
        expect(getMaxBytes("material", "audio/mpeg")).toBeNull();
      });

      it("returns null for empty string", () => {
        expect(getMaxBytes("heroVideo", "")).toBeNull();
      });
    });
  });

  describe("getExtension", () => {
    describe("valid types", () => {
      it("returns mp4 for heroVideo video/mp4", () => {
        expect(getExtension("heroVideo", "video/mp4")).toBe("mp4");
      });

      it("returns webm for heroVideo video/webm", () => {
        expect(getExtension("heroVideo", "video/webm")).toBe("webm");
      });

      it("returns jpg for heroPoster image/jpeg", () => {
        expect(getExtension("heroPoster", "image/jpeg")).toBe("jpg");
      });

      it("returns png for heroPoster image/png", () => {
        expect(getExtension("heroPoster", "image/png")).toBe("png");
      });

      it("returns webp for heroPoster image/webp", () => {
        expect(getExtension("heroPoster", "image/webp")).toBe("webp");
      });

      it("returns pdf for material application/pdf", () => {
        expect(getExtension("material", "application/pdf")).toBe("pdf");
      });

      it("returns jpg for material image/jpeg", () => {
        expect(getExtension("material", "image/jpeg")).toBe("jpg");
      });
    });

    describe("invalid types", () => {
      it("returns null for unsupported type in heroVideo", () => {
        expect(getExtension("heroVideo", "image/jpeg")).toBeNull();
      });

      it("returns null for unsupported type in heroPoster", () => {
        expect(getExtension("heroPoster", "video/mp4")).toBeNull();
      });

      it("returns null for unknown type", () => {
        expect(getExtension("material", "audio/mpeg")).toBeNull();
      });

      it("returns null for empty string", () => {
        expect(getExtension("heroVideo", "")).toBeNull();
      });
    });
  });

  describe("isSizeWithinLimit", () => {
    describe("heroVideo field (200MB max)", () => {
      it("accepts size exactly at limit (200MB)", () => {
        const max = 200 * 1024 * 1024;
        expect(isSizeWithinLimit("heroVideo", "video/mp4", max)).toBe(true);
      });

      it("accepts size 1 byte under limit", () => {
        const max = 200 * 1024 * 1024;
        expect(isSizeWithinLimit("heroVideo", "video/mp4", max - 1)).toBe(true);
      });

      it("rejects size 1 byte over limit", () => {
        const max = 200 * 1024 * 1024;
        expect(isSizeWithinLimit("heroVideo", "video/mp4", max + 1)).toBe(false);
      });

      it("rejects 0 bytes", () => {
        expect(isSizeWithinLimit("heroVideo", "video/mp4", 0)).toBe(false);
      });

      it("rejects negative size", () => {
        expect(isSizeWithinLimit("heroVideo", "video/mp4", -1)).toBe(false);
      });

      it("accepts 1 byte (minimum valid size)", () => {
        expect(isSizeWithinLimit("heroVideo", "video/mp4", 1)).toBe(true);
      });

      it("accepts large size under limit", () => {
        expect(isSizeWithinLimit("heroVideo", "video/mp4", 100 * 1024 * 1024)).toBe(true);
      });
    });

    describe("heroPoster field (10MB max)", () => {
      it("accepts size exactly at limit (10MB)", () => {
        const max = 10 * 1024 * 1024;
        expect(isSizeWithinLimit("heroPoster", "image/jpeg", max)).toBe(true);
      });

      it("rejects size 1 byte over limit", () => {
        const max = 10 * 1024 * 1024;
        expect(isSizeWithinLimit("heroPoster", "image/jpeg", max + 1)).toBe(false);
      });

      it("rejects 0 bytes", () => {
        expect(isSizeWithinLimit("heroPoster", "image/jpeg", 0)).toBe(false);
      });

      it("accepts 1 byte", () => {
        expect(isSizeWithinLimit("heroPoster", "image/jpeg", 1)).toBe(true);
      });
    });

    describe("material field - different limits by type", () => {
      it("pdf: accepts size at limit (20MB)", () => {
        const max = 20 * 1024 * 1024;
        expect(isSizeWithinLimit("material", "application/pdf", max)).toBe(true);
      });

      it("pdf: rejects size over limit", () => {
        const max = 50 * 1024 * 1024;
        expect(isSizeWithinLimit("material", "application/pdf", max + 1)).toBe(false);
        // O teto antigo (20 MB) barrava catálogo comercial com fotos; hoje passa.
        expect(isSizeWithinLimit("material", "application/pdf", 25 * 1024 * 1024)).toBe(true);
      });

      it("mp4 video: accepts size at limit (200MB)", () => {
        const max = 200 * 1024 * 1024;
        expect(isSizeWithinLimit("material", "video/mp4", max)).toBe(true);
      });

      it("mp4 video: rejects size over limit (200MB)", () => {
        const max = 200 * 1024 * 1024;
        expect(isSizeWithinLimit("material", "video/mp4", max + 1)).toBe(false);
      });

      it("webm video: accepts at limit (200MB)", () => {
        const max = 200 * 1024 * 1024;
        expect(isSizeWithinLimit("material", "video/webm", max)).toBe(true);
      });

      it("jpeg image: accepts at limit (20MB)", () => {
        const max = 20 * 1024 * 1024;
        expect(isSizeWithinLimit("material", "image/jpeg", max)).toBe(true);
      });

      it("jpeg image: rejects over limit", () => {
        const max = 20 * 1024 * 1024;
        expect(isSizeWithinLimit("material", "image/jpeg", max + 1)).toBe(false);
      });

      it("png image: accepts at limit (20MB)", () => {
        const max = 20 * 1024 * 1024;
        expect(isSizeWithinLimit("material", "image/png", max)).toBe(true);
      });

      it("webp image: accepts at limit (20MB)", () => {
        const max = 20 * 1024 * 1024;
        expect(isSizeWithinLimit("material", "image/webp", max)).toBe(true);
      });
    });

    describe("unknown type handling", () => {
      it("rejects unknown type regardless of size", () => {
        expect(isSizeWithinLimit("heroVideo", "audio/mpeg", 100)).toBe(false);
      });

      it("rejects unknown type even at 1 byte", () => {
        expect(isSizeWithinLimit("heroVideo", "audio/mpeg", 1)).toBe(false);
      });

      it("rejects unknown type at 0 bytes (not allowed anyway)", () => {
        expect(isSizeWithinLimit("heroVideo", "audio/mpeg", 0)).toBe(false);
      });
    });

    describe("edge cases", () => {
      it("handles very large valid size", () => {
        const size = 50 * 1024 * 1024; // 50MB, under heroVideo 200MB
        expect(isSizeWithinLimit("heroVideo", "video/mp4", size)).toBe(true);
      });

      it("handles fractional-like size (still integer)", () => {
        expect(isSizeWithinLimit("heroVideo", "video/mp4", 1024)).toBe(true);
      });

      it("rejects when contentType unsupported in field but size is fine", () => {
        // jpeg in heroVideo: size is fine, but type is wrong
        expect(isSizeWithinLimit("heroVideo", "image/jpeg", 1024)).toBe(false);
      });
    });
  });

  describe("integration tests - realistic scenarios", () => {
    it("complete flow: check type allowed → get limit → check size", () => {
      const field: UploadField = "heroPoster";
      const contentType = "image/jpeg";
      const sizeBytes = 5 * 1024 * 1024; // 5MB

      const isAllowed = isContentTypeAllowed(field, contentType);
      expect(isAllowed).toBe(true);

      const limit = getUploadLimit(field, contentType);
      expect(limit).not.toBeNull();
      expect(limit?.extension).toBe("jpg");

      const withinLimit = isSizeWithinLimit(field, contentType, sizeBytes);
      expect(withinLimit).toBe(true);
    });

    it("complete flow: type not allowed fails early", () => {
      const field: UploadField = "heroPoster";
      const contentType = "video/mp4";
      const sizeBytes = 5 * 1024 * 1024;

      const isAllowed = isContentTypeAllowed(field, contentType);
      expect(isAllowed).toBe(false);

      const withinLimit = isSizeWithinLimit(field, contentType, sizeBytes);
      expect(withinLimit).toBe(false);
    });

    it("complete flow: type allowed but size exceeds limit", () => {
      const field: UploadField = "heroPoster";
      const contentType = "image/jpeg";
      const sizeBytes = 15 * 1024 * 1024; // 15MB, over 10MB limit

      const isAllowed = isContentTypeAllowed(field, contentType);
      expect(isAllowed).toBe(true);

      const withinLimit = isSizeWithinLimit(field, contentType, sizeBytes);
      expect(withinLimit).toBe(false);
    });

    it("material pdf upload: all checks pass", () => {
      const field: UploadField = "material";
      const contentType = "application/pdf";
      const sizeBytes = 15 * 1024 * 1024; // 15MB, under 50MB limit

      expect(isContentTypeAllowed(field, contentType)).toBe(true);
      expect(getExtension(field, contentType)).toBe("pdf");
      expect(getMaxBytes(field, contentType)).toBe(50 * 1024 * 1024);
      expect(isSizeWithinLimit(field, contentType, sizeBytes)).toBe(true);
    });

    it("material spreadsheet upload: all checks pass", () => {
      const field: UploadField = "material";
      const contentType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const sizeBytes = 4 * 1024 * 1024;

      expect(isContentTypeAllowed(field, contentType)).toBe(true);
      expect(getExtension(field, contentType)).toBe("xlsx");
      expect(getMaxBytes(field, contentType)).toBe(50 * 1024 * 1024);
      expect(isSizeWithinLimit(field, contentType, sizeBytes)).toBe(true);
    });

    it("material video upload: all checks pass", () => {
      const field: UploadField = "material";
      const contentType = "video/webm";
      const sizeBytes = 150 * 1024 * 1024; // 150MB, under 200MB limit

      expect(isContentTypeAllowed(field, contentType)).toBe(true);
      expect(getExtension(field, contentType)).toBe("webm");
      expect(getMaxBytes(field, contentType)).toBe(200 * 1024 * 1024);
      expect(isSizeWithinLimit(field, contentType, sizeBytes)).toBe(true);
    });
  });
});
