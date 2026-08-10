import { describe, it, expect } from "vitest";
import { erpSyncJobId } from "./job-id";

describe("erpSyncJobId", () => {
  it("generates ID with erp-sync prefix", () => {
    const id = erpSyncJobId(new Date("2026-08-09T15:30:45Z"));
    expect(id).toMatch(/^erp-sync:/);
  });

  it("generates same ID for same minute (UTC)", () => {
    const date1 = new Date("2026-08-09T15:30:00Z");
    const date2 = new Date("2026-08-09T15:30:45Z");
    const date3 = new Date("2026-08-09T15:30:59Z");

    const id1 = erpSyncJobId(date1);
    const id2 = erpSyncJobId(date2);
    const id3 = erpSyncJobId(date3);

    expect(id1).toBe(id2);
    expect(id2).toBe(id3);
  });

  it("generates different ID for different minutes", () => {
    const date1 = new Date("2026-08-09T15:30:00Z");
    const date2 = new Date("2026-08-09T15:31:00Z");

    const id1 = erpSyncJobId(date1);
    const id2 = erpSyncJobId(date2);

    expect(id1).not.toBe(id2);
  });

  it("generates different ID for different hours", () => {
    const date1 = new Date("2026-08-09T15:00:00Z");
    const date2 = new Date("2026-08-09T16:00:00Z");

    const id1 = erpSyncJobId(date1);
    const id2 = erpSyncJobId(date2);

    expect(id1).not.toBe(id2);
  });

  it("generates different ID for different days", () => {
    const date1 = new Date("2026-08-09T15:30:00Z");
    const date2 = new Date("2026-08-10T15:30:00Z");

    const id1 = erpSyncJobId(date1);
    const id2 = erpSyncJobId(date2);

    expect(id1).not.toBe(id2);
  });

  it("generates different ID for different months", () => {
    const date1 = new Date("2026-08-09T15:30:00Z");
    const date2 = new Date("2026-09-09T15:30:00Z");

    const id1 = erpSyncJobId(date1);
    const id2 = erpSyncJobId(date2);

    expect(id1).not.toBe(id2);
  });

  it("generates different ID for different years", () => {
    const date1 = new Date("2026-08-09T15:30:00Z");
    const date2 = new Date("2027-08-09T15:30:00Z");

    const id1 = erpSyncJobId(date1);
    const id2 = erpSyncJobId(date2);

    expect(id1).not.toBe(id2);
  });

  it("pads single-digit month/day/hour/minute with zero", () => {
    const date = new Date("2026-01-05T09:07:00Z");
    const id = erpSyncJobId(date);

    // Expected: erp-sync:202601050907 (YYYYMMDDHHMM — 12 digits total)
    // Month 01, Day 05, Hour 09, Minute 07
    expect(id).toBe("erp-sync:202601050907");
  });

  it("uses UTC time (not local)", () => {
    // This test verifies UTC is used by checking with a known UTC time
    const utcDate = new Date("2026-08-09T23:59:00Z");
    const id = erpSyncJobId(utcDate);

    // The hour should be 23 (not affected by local timezone)
    expect(id).toContain("2026080923");
  });

  it("uses default current time when no date provided", () => {
    const id = erpSyncJobId();

    // The ID should have the correct format
    const match = id.match(/erp-sync:(\d{12})/);
    expect(match).toBeTruthy();
  });
});
