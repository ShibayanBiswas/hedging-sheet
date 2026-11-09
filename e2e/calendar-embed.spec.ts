import type { FrameLocator, Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

/**
 * A stand-in for SP Workstation: a page on another origin that frames this app, as the Workstation frames
 * https://hedging-sheet.vercel.app. Plain http, so WebKit frames the http test server too (embed.spec.ts is https and skips it).
 */
const PARENT = "http://embed.test";

// Chromium blocks a public origin framing localhost by default, as in embed.spec.ts.
test.use({ reducedMotion: "reduce", launchOptions: { args: ["--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests"] } });

async function framed(page: Page, app: string): Promise<FrameLocator> {
  await page.route(`${PARENT}/`, (route) =>
    route.fulfill({ contentType: "text/html", body: `<!doctype html><html><body style="margin:0"><iframe id="app" title="Hedging Sheet" src="${app}/" style="display:block;width:100vw;height:100vh;border:0"></iframe></body></html>` }),
  );
  await page.goto(`${PARENT}/`);
  const frame = page.frameLocator("#app");
  await expect(frame.getByTestId("input-spot")).not.toHaveValue("", { timeout: 30_000 });
  await expect(frame.getByTestId("input-dailyVol")).not.toHaveValue("", { timeout: 30_000 });
  return frame;
}

/** Blank Inputs with Underlying And Market filled, so Observation Expiries opens with the given count. */
async function blankWithExpiries(frame: FrameLocator, count: number) {
  await frame.getByTestId("mode-blank").click();
  await frame.getByTestId("confirm-switch-mode").click();
  await expect(frame.getByTestId("mode-blank")).toHaveAttribute("aria-selected", "true");
  await frame.getByTestId("input-underlying").selectOption("Sensex");
  await pickValuationDate(frame);
  await frame.getByTestId("input-spot").fill("76835.78");
  await frame.getByTestId("input-spot").blur();
  await frame.getByTestId("input-expiryCount").selectOption(String(count));
}

/** The empty Valuation Date's calendar opens on today's month with today marked; a pick fills the field. */
async function pickValuationDate(frame: FrameLocator) {
  const field = frame.getByTestId("input-valuationDate");
  await expect(field).toHaveValue("");
  await frame.getByRole("button", { name: "Open Calendar For Valuation Date" }).click();
  const calendar = frame.getByRole("dialog", { name: "Choose Valuation Date" });
  await expect(calendar.getByRole("grid")).toHaveAccessibleName("October 2026");
  await expect(calendar.getByRole("gridcell", { name: "Wednesday 28-Oct-2026" })).toHaveAttribute("aria-current", "date");
  await expect(calendar.getByRole("gridcell", { selected: true })).toHaveCount(0);
  await expectWhole(calendar);
  await calendar.getByRole("gridcell", { name: "Tuesday 27-Oct-2026" }).click();
  await expect(calendar).toHaveCount(0);
  await expect(field).toHaveValue("27-Oct-2026");
  await expect(field).toHaveAttribute("data-value", "2026-10-27");
}

const boxOf = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
};

/** The calendar sits wholly inside the frame's window and the frame never scrolls sideways; returns its box. */
async function expectWhole(calendar: Locator) {
  const m = await calendar.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const doc = document.documentElement;
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, vw: doc.clientWidth, vh: doc.clientHeight, pageWidth: doc.scrollWidth, scrolls: el.scrollHeight > el.clientHeight + 1 };
  });
  expect(m.top, "top edge inside the frame").toBeGreaterThanOrEqual(0);
  expect(m.left, "left edge inside the frame").toBeGreaterThanOrEqual(0);
  expect(m.bottom, "bottom edge inside the frame").toBeLessThanOrEqual(m.vh);
  expect(m.right, "right edge inside the frame").toBeLessThanOrEqual(m.vw);
  expect(m.pageWidth, "no sideways scroll").toBeLessThanOrEqual(m.vw);
  return m;
}

/** Scroll the frame so the element's top sits at y in its window. */
const scrollTo = (el: Locator, y: number) => el.evaluate((e, to) => window.scrollBy(0, e.getBoundingClientRect().top - to), y);

/** Open a calendar from the keyboard, without the focus scrolling the page. */
async function openByKeyboard(page: Page, button: Locator) {
  await button.evaluate((b: HTMLElement) => b.focus({ preventScroll: true }));
  await page.keyboard.press("Enter");
}

test.describe("Calendar inside SP Workstation's cross-origin frame", () => {
  test("Blank Inputs: the calendar picks the Valuation Date and the expiries, with snapping and the order rule kept", async ({ page, baseURL }) => {
    const frame = await framed(page, baseURL!);
    // The frame is cross-origin to its parent, where browsers refuse the native date picker that the old button opened.
    const refused = await frame.locator("body").evaluate(() => {
      const input = Object.assign(document.createElement("input"), { type: "date" });
      document.body.append(input);
      try {
        input.showPicker();
        return "opened";
      } catch (e) {
        return (e as Error).name;
      } finally {
        input.remove();
      }
    });
    expect(refused, "showPicker in a cross-origin frame").toBe("SecurityError");

    await blankWithExpiries(frame, 2);

    // Expiry 1 by the year and month choices: a Wednesday moves to the month's last Thursday.
    const open1 = frame.getByRole("button", { name: "Open Calendar For Expiry 1" });
    await open1.click();
    const calendar1 = frame.getByRole("dialog", { name: "Choose Expiry 1" });
    await expect(calendar1.getByRole("grid")).toHaveAccessibleName("October 2026");
    await calendar1.getByRole("combobox", { name: "Year" }).selectOption("2030");
    await calendar1.getByRole("combobox", { name: "Month" }).selectOption("April");
    await expect(calendar1.getByRole("grid")).toHaveAccessibleName("April 2030");
    await expectWhole(calendar1);
    await calendar1.getByRole("gridcell", { name: "Wednesday 10-Apr-2030" }).click();
    await expect(calendar1).toHaveCount(0);
    await expect(open1).toBeFocused();
    await expect(frame.getByTestId("input-expiryDates-0")).toHaveValue("25-Apr-2030");
    await expect(frame.getByTestId("input-expiryDates-0")).toHaveAttribute("data-value", "2030-04-25");
    await expect(frame.getByTestId("expiry-note-0")).toHaveText("Moved To The Last Thursday, 25-Apr-2030");

    // The calendar reopens on the field's month with its date selected.
    await open1.click();
    await expect(calendar1.getByRole("grid")).toHaveAccessibleName("April 2030");
    await expect(calendar1.getByRole("gridcell", { selected: true })).toHaveAccessibleName("Thursday 25-Apr-2030");
    // Only one calendar at a time, and a press outside closes it.
    await frame.getByRole("button", { name: "Open Calendar For Expiry 2" }).click();
    await expect(frame.getByRole("dialog")).toHaveCount(1);
    const calendar2 = frame.getByRole("dialog", { name: "Choose Expiry 2" });
    await expect(calendar2).toBeVisible();
    await frame.getByTestId("group-2").getByRole("heading").click();
    await expect(frame.getByRole("dialog")).toHaveCount(0);

    // Expiry 2 by the keyboard: a March pick falls before Expiry 1, so it reverts with the popup.
    const open2 = frame.getByRole("button", { name: "Open Calendar For Expiry 2" });
    await openByKeyboard(page, open2);
    await calendar2.getByRole("combobox", { name: "Year" }).selectOption("2030");
    await calendar2.getByRole("combobox", { name: "Month" }).selectOption("March");
    await calendar2.getByRole("gridcell", { name: "Thursday 28-Mar-2030" }).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(calendar2.getByRole("gridcell", { name: "Wednesday 27-Mar-2030" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(frame.getByTestId("desk-dialog").locator("#desk-dialog-title")).toHaveText("Expiry 2 Reverted");
    await expect(frame.getByTestId("desk-dialog")).toContainText("Expiry 2 must fall after Expiry 1.");
    await frame.getByTestId("desk-dialog-ok").click();
    await expect(frame.getByTestId("desk-dialog")).toHaveCount(0);
    await expect(frame.getByTestId("input-expiryDates-1")).toHaveValue("");

    // Then July: four Page Downs from 28-Mar-2030, Arrow Up a week, End to that Saturday, and Enter picks it; it moves to 25-Jul-2030.
    await openByKeyboard(page, open2);
    await calendar2.getByRole("combobox", { name: "Year" }).selectOption("2030");
    await calendar2.getByRole("combobox", { name: "Month" }).selectOption("March");
    await calendar2.getByRole("gridcell", { name: "Thursday 28-Mar-2030" }).focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press("PageDown");
    await expect(calendar2.getByRole("grid")).toHaveAccessibleName("July 2030");
    await expect(calendar2.getByRole("gridcell", { name: "Sunday 28-Jul-2030" })).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("End");
    await expect(calendar2.getByRole("gridcell", { name: "Saturday 27-Jul-2030" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(calendar2).toHaveCount(0);
    await expect(frame.getByTestId("input-expiryDates-1")).toHaveValue("25-Jul-2030");
    await expect(frame.getByTestId("expiry-note-1")).toHaveText("Moved To The Last Thursday, 25-Jul-2030");

    // Escape closes it and gives focus back to its button.
    await openByKeyboard(page, open2);
    await expect(calendar2).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(calendar2).toHaveCount(0);
    await expect(open2).toBeFocused();
  });

  test("at 390 px it opens below a field near the top, above one near the bottom, and stays whole as the frame gets short", async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const frame = await framed(page, baseURL!);
    await blankWithExpiries(frame, 6);

    // Expiry 1 just under the sticky header: room below, so it opens below.
    const header = await frame.getByTestId("site-header").evaluate((h) => h.getBoundingClientRect().bottom);
    const row1 = frame.getByTestId("input-expiryDates-0").locator("..");
    await scrollTo(row1, header + 8);
    await openByKeyboard(page, frame.getByRole("button", { name: "Open Calendar For Expiry 1" }));
    const calendar1 = frame.getByRole("dialog", { name: "Choose Expiry 1" });
    const below = await expectWhole(calendar1);
    expect(below.top, "below the field").toBeGreaterThanOrEqual((await row1.evaluate(boxOf)).bottom);
    await page.keyboard.press("Escape");
    await expect(calendar1).toHaveCount(0);

    // Expiry 6 just above the Run bar: no room below, so it opens above.
    const bar = await frame.locator(".hs-run-bar").evaluate((b) => b.getBoundingClientRect().top);
    const row6 = frame.getByTestId("input-expiryDates-5").locator("..");
    const height = await row6.evaluate((r) => r.getBoundingClientRect().height);
    await scrollTo(row6, bar - height - 8);
    await openByKeyboard(page, frame.getByRole("button", { name: "Open Calendar For Expiry 6" }));
    const calendar6 = frame.getByRole("dialog", { name: "Choose Expiry 6" });
    const above = await expectWhole(calendar6);
    expect(above.bottom, "above the field").toBeLessThanOrEqual((await row6.evaluate(boxOf)).top);

    // The Workstation shortens its frame: the calendar moves inside it, and in a frame shorter than itself it scrolls inside.
    await page.evaluate(() => void (document.getElementById("app")!.style.height = "420px"));
    await expect.poll(() => frame.locator("html").evaluate(() => document.documentElement.clientHeight)).toBe(420);
    await expectWhole(calendar6);
    await page.evaluate(() => void (document.getElementById("app")!.style.height = "300px"));
    await expect.poll(() => frame.locator("html").evaluate(() => document.documentElement.clientHeight)).toBe(300);
    expect((await expectWhole(calendar6)).scrolls, "a calendar taller than the frame scrolls inside itself").toBe(true);

    // It still picks: July 2031 from the choices, then a click on a day the calendar scrolls to.
    await calendar6.getByRole("combobox", { name: "Year" }).selectOption("2031");
    await calendar6.getByRole("combobox", { name: "Month" }).selectOption("July");
    await calendar6.getByRole("gridcell", { name: "Wednesday 16-Jul-2031" }).click();
    await expect(calendar6).toHaveCount(0);
    await expect(frame.getByTestId("input-expiryDates-5")).toHaveValue("31-Jul-2031");
  });
});
