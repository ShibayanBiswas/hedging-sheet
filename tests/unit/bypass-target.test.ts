import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { bypassTarget, scrubSecret } from "@/scripts/bypass-target";

describe("which hosts may receive the Vercel bypass secret", () => {
  it.each([
    "https://hedging-sheet.vercel.app",
    "https://hedging-sheet.vercel.app/",
    "https://HEDGING-SHEET.vercel.app",
    "https://hedging-sheet-a1b2c3d4e-shibayan-biswas-projects.vercel.app",
    "https://hedging-sheet-git-round-12-shibayan-biswas-projects.vercel.app",
  ])("%s receives it", (url) => {
    expect(bypassTarget(url)).toBe("trusted");
  });

  it.each(["http://localhost:3000", "http://127.0.0.1:3006", "http://[::1]:3000"])("%s runs without it", (url) => {
    expect(bypassTarget(url)).toBe("local");
  });

  it.each([
    ["plain http", "http://hedging-sheet.vercel.app"],
    ["another project", "https://other-app.vercel.app"],
    ["another scope", "https://hedging-sheet-abc-someone-else.vercel.app"],
    ["no deployment part", "https://hedging-sheet--shibayan-biswas-projects.vercel.app"],
    ["a suffix on the host", "https://hedging-sheet.vercel.app.example.com"],
    ["a prefix on the host", "https://example-hedging-sheet.vercel.app"],
    ["a trailing dot", "https://hedging-sheet.vercel.app."],
    ["the name as a user", "https://hedging-sheet.vercel.app@example.com"],
    ["a user on the host", "https://user:pass@hedging-sheet.vercel.app"],
    ["another port", "https://hedging-sheet.vercel.app:8443"],
    ["localhost over https", "https://localhost:3000"],
    ["the name in the path", "https://example.com/hedging-sheet.vercel.app"],
    ["not a URL", "hedging-sheet.vercel.app"],
    ["empty", ""],
  ])("%s is refused", (_, url) => {
    expect(bypassTarget(url)).toBe("refused");
  });
});

describe("cleaning a report folder", () => {
  it("takes the secret and the bypass cookie out of every file, and leaves other bytes as they were", () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "scrub-"));
    fs.mkdirSync(path.join(folder, "traces", "a-test"), { recursive: true });
    const junit = path.join(folder, "junit-e2e.xml");
    const context = path.join(folder, "traces", "a-test", "error-context.md");
    const summary = path.join(folder, "summary.md");
    const shot = path.join(folder, "traces", "a-test", "shot.png");
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0xfe, 0x80]);
    fs.writeFileSync(junit, "- x-vercel-protection-bypass: s3cret\n- x-vercel-protection-bypass: s3cret\n");
    fs.writeFileSync(context, "set-cookie: _vercel_jwt=abc.def.ghi; Path=/\n");
    fs.writeFileSync(summary, "Bypass Header: Sent\n");
    fs.writeFileSync(shot, bytes);

    expect(scrubSecret(folder, "s3cret")).toBe(2);

    expect(fs.readFileSync(junit, "utf8")).toBe("- x-vercel-protection-bypass: [redacted]\n- x-vercel-protection-bypass: [redacted]\n");
    expect(fs.readFileSync(context, "utf8")).toBe("set-cookie: _vercel_jwt=[redacted]; Path=/\n");
    expect(fs.readFileSync(summary, "utf8")).toBe("Bypass Header: Sent\n");
    expect(fs.readFileSync(shot).equals(bytes)).toBe(true);
    fs.rmSync(folder, { recursive: true });
  });
});
