import { describe, expect, it } from "vitest";

import { orphanBrowsers, parseProcessList } from "../../e2e/global-teardown";

const CHROME = "chrome.exe C:\\Users\\me\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win\\chrome.exe";
const SHELL = "chrome-headless-shell.exe C:\\Users\\me\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1248\\chrome-headless-shell.exe";
const OWN_CHROME = "chrome.exe C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

describe("Playwright teardown on Windows", () => {
  it("ends a Playwright browser whose parent has gone", () => {
    const list = [
      { pid: 10, ppid: 999, command: CHROME },
      { pid: 11, ppid: 998, command: SHELL },
    ];
    expect(orphanBrowsers(list, "win32")).toEqual([10, 11]);
  });

  it("leaves a Playwright browser with a live parent, such as another session's", () => {
    const list = [
      { pid: 5, ppid: 1, command: "node.exe C:\\Program Files\\nodejs\\node.exe" },
      { pid: 10, ppid: 5, command: CHROME },
      { pid: 11, ppid: 10, command: CHROME },
    ];
    expect(orphanBrowsers(list, "win32")).toEqual([]);
  });

  it("never picks a person's own Chrome or any other program, orphaned or not", () => {
    const list = [
      { pid: 20, ppid: 999, command: OWN_CHROME },
      { pid: 21, ppid: 999, command: "node.exe C:\\Program Files\\nodejs\\node.exe" },
      { pid: 22, ppid: 999, command: "mongod-x64-win32-8.2.6.exe C:\\Users\\me\\.cache\\mongodb-binaries\\mongod-x64-win32-8.2.6.exe" },
    ];
    expect(orphanBrowsers(list, "win32")).toEqual([]);
  });
});

describe("Playwright teardown elsewhere", () => {
  const linuxBrowser = "/home/me/.cache/ms-playwright/chromium-1248/chrome-linux/chrome --headless";

  it("ends a browser adopted by process 1 and leaves one with a live parent", () => {
    const list = [
      { pid: 30, ppid: 1, command: linuxBrowser },
      { pid: 31, ppid: 500, command: linuxBrowser },
      { pid: 500, ppid: 1, command: "node playwright" },
    ];
    expect(orphanBrowsers(list, "linux")).toEqual([30]);
  });

  it("does not treat a missing parent as an orphan, only process 1", () => {
    expect(orphanBrowsers([{ pid: 30, ppid: 777, command: linuxBrowser }], "darwin")).toEqual([]);
  });
});

describe("parseProcessList", () => {
  it("reads process id, parent id and the rest of the line, from either source", () => {
    const out = ["  10   5 chrome.exe C:\\Program Files\\x y\\chrome.exe\r", "30 1 /usr/bin/chrome --headless", "", "not a process line"].join("\n");
    expect(parseProcessList(out)).toEqual([
      { pid: 10, ppid: 5, command: "chrome.exe C:\\Program Files\\x y\\chrome.exe" },
      { pid: 30, ppid: 1, command: "/usr/bin/chrome --headless" },
    ]);
  });
});
