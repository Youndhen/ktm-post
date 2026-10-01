import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, validateUpload } from "@/lib/upload-validation";

describe("validateUpload", () => {
  it("accepts a small jpeg", () => {
    expect(validateUpload({ size: 1024, type: "image/jpeg" })).toEqual({ ok: true });
  });
  it("rejects files over the limit with 413", () => {
    const r = validateUpload({ size: MAX_UPLOAD_BYTES + 1, type: "image/png" });
    expect(r).toMatchObject({ ok: false, status: 413 });
  });
  it("accepts exactly the limit", () => {
    expect(validateUpload({ size: MAX_UPLOAD_BYTES, type: "image/webp" })).toEqual({ ok: true });
  });
  it("rejects non-image and svg types with 415", () => {
    expect(validateUpload({ size: 10, type: "application/pdf" })).toMatchObject({ ok: false, status: 415 });
    expect(validateUpload({ size: 10, type: "image/svg+xml" })).toMatchObject({ ok: false, status: 415 });
    expect(validateUpload({ size: 10, type: "" })).toMatchObject({ ok: false, status: 415 });
  });
  it("checks size before type so an oversized pdf reports 413", () => {
    expect(validateUpload({ size: MAX_UPLOAD_BYTES + 1, type: "application/pdf" })).toMatchObject({ status: 413 });
  });
});
