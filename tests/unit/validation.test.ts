import { describe, expect, it } from "bun:test";
import { validateTitle, validateUrl } from "../../src/lib/validation.js";
import { ErrorCode } from "../../src/lib/errors.js";

describe("Validation Unit Tests", () => {
  describe("validateTitle", () => {
    it("should accept valid trimmed titles", () => {
      expect(validateTitle("My Bookmark")).toBe("My Bookmark");
      expect(validateTitle("  Spaced Bookmark  ")).toBe("Spaced Bookmark");
    });

    it("should reject empty string with BAD_USER_INPUT", () => {
      try {
        validateTitle("");
        expect.unreachable("Should have thrown");
      } catch (error: unknown) {
        expect(error).toBeDefined();
        const err = error as { extensions?: { code?: string }; message?: string };
        expect(err.extensions?.code).toBe(ErrorCode.BAD_USER_INPUT);
        expect(err.message).toContain("cannot be empty");
      }
    });

    it("should reject whitespace-only string with BAD_USER_INPUT", () => {
      try {
        validateTitle("     ");
        expect.unreachable("Should have thrown");
      } catch (error: unknown) {
        expect(error).toBeDefined();
        const err = error as { extensions?: { code?: string }; message?: string };
        expect(err.extensions?.code).toBe(ErrorCode.BAD_USER_INPUT);
      }
    });
  });

  describe("validateUrl", () => {
    it("should accept valid http and https URLs", () => {
      expect(validateUrl("https://graphql.org")).toBe("https://graphql.org/");
      expect(validateUrl("http://example.com/path?q=1")).toBe("http://example.com/path?q=1");
    });

    it("should reject empty URL", () => {
      try {
        validateUrl("");
        expect.unreachable("Should have thrown");
      } catch (error: unknown) {
        expect(error).toBeDefined();
        const err = error as { extensions?: { code?: string }; message?: string };
        expect(err.extensions?.code).toBe(ErrorCode.BAD_USER_INPUT);
      }
    });

    it("should reject malformed URLs", () => {
      try {
        validateUrl("not_a_valid_url");
        expect.unreachable("Should have thrown");
      } catch (error: unknown) {
        expect(error).toBeDefined();
        const err = error as { extensions?: { code?: string }; message?: string };
        expect(err.extensions?.code).toBe(ErrorCode.BAD_USER_INPUT);
        expect(err.message).toContain("Invalid or malformed URL");
      }
    });

    it("should reject non-http(s) protocols such as ftp: or javascript:", () => {
      try {
        validateUrl("ftp://files.example.com");
        expect.unreachable("Should have thrown");
      } catch (error: unknown) {
        expect(error).toBeDefined();
        const err = error as { extensions?: { code?: string }; message?: string };
        expect(err.extensions?.code).toBe(ErrorCode.BAD_USER_INPUT);
        expect(err.message).toContain("protocol");
      }
    });
  });
});
