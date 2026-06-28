import { describe, expect, it } from "vitest";
import { createAccountSchema, createReelSchema, updateReelSchema } from "@/lib/reel-schema";
import { deriveVideoPath, exampleVideoUrl, formatBytes, isMutableStatus } from "@/lib/utils";

describe("reel schema", () => {
  it("normalizes a valid scheduled reel", () => {
    const result = createReelSchema.parse({
      accountId: "7f9af1bb-1b53-4466-a924-061cb01a53b1",
      title: " Venon Clip 1 ",
      videoUrl: exampleVideoUrl,
      caption: " Big scene caption ",
      scheduledAt: "2026-04-15T10:00:00.000Z"
    });

    expect(result.title).toBe("Venon Clip 1");
    expect(result.videoPath).toBe("venon-clip-1.mp4");
    expect(result.caption).toBe("Big scene caption");
    expect(result.scheduledAt).toBe("2026-04-15T10:00:00.000Z");
  });

  it("rejects unsafe video URLs", () => {
    expect(() =>
      createReelSchema.parse({
        accountId: "7f9af1bb-1b53-4466-a924-061cb01a53b1",
        title: "Clip",
        videoUrl: "http://example.com/reel.mp4",
        caption: "Caption",
        scheduledAt: "2026-04-15T10:00:00.000Z"
      })
    ).toThrow();
  });

  it("allows partial updates", () => {
    const result = updateReelSchema.parse({
      caption: "Updated caption"
    });

    expect(result.caption).toBe("Updated caption");
  });
});

describe("account schema", () => {
  it("normalizes token expiry", () => {
    const result = createAccountSchema.parse({
      label: "SeriesPart.Hub",
      igUserId: "17841400000000000",
      accessToken: "EAAB_valid_test_token_value",
      tokenExpiresAt: "2026-04-15T10:00:00.000Z"
    });

    expect(result.tokenExpiresAt).toBe("2026-04-15T10:00:00.000Z");
  });
});

describe("utils", () => {
  it("derives Supabase storage paths", () => {
    expect(deriveVideoPath(exampleVideoUrl)).toBe("venon-clip-1.mp4");
  });

  it("marks only editable statuses mutable", () => {
    expect(isMutableStatus("scheduled")).toBe(true);
    expect(isMutableStatus("failed")).toBe(true);
    expect(isMutableStatus("posted")).toBe(false);
    expect(isMutableStatus("posting")).toBe(false);
  });

  it("formats bucket sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(655.95 * 1024 * 1024)).toBe("656 MB");
  });
});
