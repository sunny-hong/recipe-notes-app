import { describe, it, expect } from "bun:test";

import { validateImageFile, getResizeDimensions, MAX_IMAGE_PX } from "../utils/image";

// ---------------------------------------------------------------------------
// validateImageFile
// ---------------------------------------------------------------------------

describe("validateImageFile", () => {
  it("returns null for a valid image under 10 MB", () => {
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    expect(validateImageFile(file)).toBeNull();
  });

  it("returns an error for a non-image file type", () => {
    const file = new File(["data"], "doc.pdf", { type: "application/pdf" });
    expect(validateImageFile(file)).toBe("File must be an image");
  });

  it("returns an error for a file with no type", () => {
    const file = new File(["data"], "unknown");
    expect(validateImageFile(file)).toBe("File must be an image");
  });

  it("returns an error for a file over 10 MB", () => {
    const file = new File([], "big.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 10 * 1024 * 1024 + 1 });
    expect(validateImageFile(file)).toBe("Image must be under 10 MB");
  });

  it("accepts a file exactly at the 10 MB limit", () => {
    const file = new File([], "edge.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 10 * 1024 * 1024 });
    expect(validateImageFile(file)).toBeNull();
  });

  it("accepts common image MIME types", () => {
    const types = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];
    for (const type of types) {
      const file = new File(["data"], "img", { type });
      expect(validateImageFile(file)).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// getResizeDimensions
// ---------------------------------------------------------------------------

describe("getResizeDimensions", () => {
  it("does not resize an image already within bounds", () => {
    expect(getResizeDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("does not resize an image exactly at the limit", () => {
    expect(getResizeDimensions(MAX_IMAGE_PX, MAX_IMAGE_PX)).toEqual({
      width: MAX_IMAGE_PX,
      height: MAX_IMAGE_PX,
    });
  });

  it("scales down a landscape image — width capped, height proportional", () => {
    expect(getResizeDimensions(2800, 1400)).toEqual({ width: 1400, height: 700 });
  });

  it("scales down a portrait image — height capped, width proportional", () => {
    expect(getResizeDimensions(1400, 2800)).toEqual({ width: 700, height: 1400 });
  });

  it("scales down a square image — both sides become the max", () => {
    expect(getResizeDimensions(2800, 2800)).toEqual({ width: 1400, height: 1400 });
  });

  it("rounds fractional pixels after scaling", () => {
    // 3000 × 2000 → width 1400, height = round(2000/3000 * 1400) = round(933.33) = 933
    expect(getResizeDimensions(3000, 2000)).toEqual({ width: 1400, height: 933 });
  });

  it("handles a very tall portrait correctly", () => {
    // 100 × 5000 → height 1400, width = round(100/5000 * 1400) = round(28) = 28
    expect(getResizeDimensions(100, 5000)).toEqual({ width: 28, height: 1400 });
  });

  it("respects a custom max value", () => {
    expect(getResizeDimensions(2000, 1000, 500)).toEqual({ width: 500, height: 250 });
  });
});
