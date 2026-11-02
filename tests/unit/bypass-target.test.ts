// Real requests between two local servers, with a dummy value.
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bypassFetch, bypassHeaders, bypassTarget, scrubSecret } from "@/scripts/bypass-target";

describe("which hosts may receive the Vercel bypass secret", () => {
  it.each([
    "https://hedging-sheet.vercel.app",
    "https://hedging-sheet.vercel.app/",
    "https://HEDGING-SHEET.vercel.app",
    "https://hedging-sheet-q7whqmpjs-shibayan-biswas-projects.vercel.app",
    "https://HEDGING-SHEET-Q7WHQMPJS-shibayan-biswas-projects.vercel.app",
  ])("%s receives it", (url) => {
    expect(bypassTarget(url)).toBe("trusted");
  });

  it.each(["http://localhost:3000", "http://127.0.0.1:3006", "http://[::1]:3000"])("%s runs without it", (url) => {
    expect(bypassTarget(url)).toBe("local");
  });

  it.each([
    ["another team's URL", "https://hedging-sheet-abc-evil-shibayan-biswas-projects.vercel.app"],
    ["a team name ending in ours", "https://hedging-sheet-q7whqmpjs-evil-shibayan-biswas-projects.vercel.app"],
    ["a git branch form", "https://hedging-sheet-git-round-12-shibayan-biswas-projects.vercel.app"],
    ["a hash of another length", "https://hedging-sheet-q7whqmpj-shibayan-biswas-projects.vercel.app"],
    ["plain http", "http://hedging-sheet.vercel.app"],
    ["another project", "https://other-app.vercel.app"],
    ["another scope", "https://hedging-sheet-q7whqmpjs-someone-else.vercel.app"],
    ["no deployment part", "https://hedging-sheet--shibayan-biswas-projects.vercel.app"],
    ["a suffix on the host", "https://hedging-sheet.vercel.app.example.com"],
    ["a prefix on the host", "https://example-hedging-sheet.vercel.app"],
    ["a trailing dot", "https://hedging-sheet.vercel.app."],
    ["the name as a user", "https://hedging-sheet.vercel.app@evil.com"],
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

describe("which requests carry the bypass headers", () => {
  const base = "https://hedging-sheet.vercel.app";

  it.each([`${base}/api/health`, `${base}/`, "/api/health", `${base.toUpperCase()}/x`])("%s carries them", (url) => {
    expect(bypassHeaders(url, base, "dummy")).toEqual({ "x-vercel-protection-bypass": "dummy", "x-vercel-set-bypass-cookie": "true" });
  });

  it.each([
    "https://vercel.live/feedback.js",
    "https://cdn.hedging-sheet.vercel.app/x",
    "http://hedging-sheet.vercel.app/x",
    "https://hedging-sheet.vercel.app:8443/x",
    "https://hedging-sheet.vercel.app@evil.com/x",
    "//evil.com/x",
    "data:text/plain,x",
  ])("%s does not", (url) => {
    expect(bypassHeaders(url, base, "dummy")).toEqual({});
  });
});

describe("following redirects with the secret", () => {
  const seen: { deployment: (string | undefined)[]; other: (string | undefined)[] } = { deployment: [], other: [] };
  const header = (req: http.IncomingMessage) => req.headers["x-vercel-protection-bypass"] as string | undefined;
  const origin = (server: http.Server) => `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const other = http.createServer((req, res) => {
    seen.other.push(header(req));
    res.end("other site");
  });
  const deployment = http.createServer((req, res) => {
    seen.deployment.push(header(req));
    if (req.url === "/here") return void res.writeHead(302, { location: "/target" }).end();
    if (req.url === "/away") return void res.writeHead(302, { location: `${origin(other)}/stolen` }).end();
    if (req.url === "/loop") return void res.writeHead(302, { location: "/loop" }).end();
    res.end("deployment");
  });

  beforeAll(async () => {
    await Promise.all([other, deployment].map((s) => new Promise<void>((done) => s.listen(0, "127.0.0.1", done))));
  });
  afterAll(() => {
    other.close();
    deployment.close();
  });

  it("follows a redirect within the deployment, with the header on each request", async () => {
    seen.deployment = [];
    const res = await bypassFetch(`${origin(deployment)}/here`, origin(deployment), "dummy");
    expect(await res.text()).toBe("deployment");
    expect(seen.deployment).toEqual(["dummy", "dummy"]);
  });

  it("does not follow a redirect to another site, so it never sees the header", async () => {
    seen.other = [];
    const res = await bypassFetch(`${origin(deployment)}/away`, origin(deployment), "dummy");
    expect(res.status).toBe(302);
    expect(seen.other).toEqual([]);
  });

  it("sends nothing to another site asked for directly, or without a secret", async () => {
    seen.other = [];
    seen.deployment = [];
    await bypassFetch(`${origin(other)}/direct`, origin(deployment), "dummy");
    await bypassFetch(`${origin(deployment)}/target`, origin(deployment), undefined, { headers: { accept: "text/plain" } });
    expect(seen.other).toEqual([undefined]);
    expect(seen.deployment).toEqual([undefined]);
  });

  it("gives up on a redirect loop", async () => {
    const res = await bypassFetch(`${origin(deployment)}/loop`, origin(deployment), "dummy");
    expect(res.status).toBe(302);
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
