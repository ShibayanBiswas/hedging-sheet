import { describe, expect, it } from "vitest";

import { embedNavigationTarget } from "@/lib/embed-navigation";
import { NAV_ITEMS } from "@/lib/navigation";

const parent = { name: "parent window" };
const WORKSTATION = "https://sp-workstation.vercel.app";
const message = (path: unknown = "/pricer") => ({ type: "hedging-sheet:navigate", path });
const event = (over: Partial<{ source: unknown; origin: string; data: unknown }> = {}) => ({ source: parent, origin: WORKSTATION, data: message(), ...over }) as unknown as Pick<MessageEvent, "source" | "origin" | "data">;

describe("embed navigation", () => {
  it("accepts every route in lib/navigation.ts from the Workstation", () => {
    for (const { href } of NAV_ITEMS) expect(embedNavigationTarget(event({ data: message(href) }), parent, true)).toBe(href);
  });

  it.each(["http://localhost:3000", "http://127.0.0.1:3000"])("accepts the Workstation's local dev origin %s only outside production builds", (origin) => {
    expect(embedNavigationTarget(event({ origin }), parent, false)).toBe("/pricer");
    expect(embedNavigationTarget(event({ origin }), parent, true)).toBeNull();
  });

  it("accepts the live Workstation outside production builds too", () => {
    expect(embedNavigationTarget(event({ origin: WORKSTATION }), parent, false)).toBe("/pricer");
  });

  it.each([
    "https://evil.example",
    "https://sp-workstation.vercel.app.evil.example",
    "https://sp-workstation-git-main.vercel.app",
    "http://sp-workstation.vercel.app",
    "https://SP-WORKSTATION.vercel.app",
    "https://sp-workstation.vercel.app/",
    "http://localhost:3001",
    "http://localhost",
    "https://localhost:3000",
    "http://127.0.0.1:3001",
    "https://127.0.0.1:3000",
    "null",
    "",
  ])("rejects the origin %s, in development too", (origin) => {
    expect(embedNavigationTarget(event({ origin }), parent, true)).toBeNull();
    expect(embedNavigationTarget(event({ origin }), parent, false)).toBeNull();
  });

  it.each([
    ["another window", { name: "another window" }],
    ["no source", null],
    ["nothing", undefined],
  ])("rejects a message from %s", (_name, source) => {
    expect(embedNavigationTarget(event({ source }), parent, true)).toBeNull();
  });

  it("rejects a page that is not framed: its parent is null, and a null source does not match it", () => {
    expect(embedNavigationTarget(event({ source: null }), null, true)).toBeNull();
  });

  it.each([
    "/pricer/",
    "/pricer?x=1",
    "/pricer#top",
    "pricer",
    "/PRICER",
    "/api/health",
    "/dashboard/module/hedging-sheet/pricer",
    "//evil.example",
    "https://hedging-sheet.vercel.app/pricer",
    "javascript:alert(1)",
    "",
  ])("rejects the path %s", (path) => {
    expect(embedNavigationTarget(event({ data: message(path) }), parent, true)).toBeNull();
  });

  it.each([
    ["a number path", message(7)],
    ["no path", { type: "hedging-sheet:navigate" }],
    ["another type", { type: "other", path: "/pricer" }],
    ["no type", { path: "/pricer" }],
    ["a string", "/pricer"],
    ["null", null],
    ["undefined", undefined],
    ["an array", ["/pricer"]],
  ])("rejects %s as the message", (_name, data) => {
    expect(embedNavigationTarget(event({ data }), parent, true)).toBeNull();
  });
});
