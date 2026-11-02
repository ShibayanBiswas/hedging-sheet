type DeviceKind = "phone" | "tablet" | "desktop";

export type Viewport = { name: string; width: number; height: number; kind: DeviceKind };

/** The full device list. Set E2E_FULL_WIDTHS=1 to run it; the default run uses three widths. */
const FULL_VIEWPORTS: Viewport[] = [
  { name: "small-phone", width: 320, height: 568, kind: "phone" },
  { name: "iphone-se", width: 375, height: 667, kind: "phone" },
  { name: "iphone-15", width: 393, height: 852, kind: "phone" },
  { name: "pixel-7", width: 412, height: 915, kind: "phone" },
  { name: "phone-landscape", width: 852, height: 393, kind: "phone" },
  { name: "ipad-mini", width: 768, height: 1024, kind: "tablet" },
  { name: "ipad-pro", width: 1024, height: 1366, kind: "tablet" },
  { name: "tablet-landscape", width: 1366, height: 1024, kind: "tablet" },
  { name: "laptop", width: 1280, height: 800, kind: "desktop" },
  { name: "desktop", width: 1440, height: 900, kind: "desktop" },
  { name: "full-hd", width: 1920, height: 1080, kind: "desktop" },
  { name: "wide", width: 2560, height: 1440, kind: "desktop" },
];

/** Phone, the width where every tab must fit, and the desk desktop. */
const DEFAULT_VIEWPORTS: Viewport[] = [
  { name: "phone", width: 390, height: 844, kind: "phone" },
  { name: "tablet", width: 1024, height: 1366, kind: "tablet" },
  { name: "desktop", width: 1440, height: 900, kind: "desktop" },
];

export const VIEWPORTS: Viewport[] = process.env.E2E_FULL_WIDTHS === "1" ? FULL_VIEWPORTS : DEFAULT_VIEWPORTS;

/** Context options for a viewport: phones and tablets are touch devices. */
export function contextFor(v: Viewport) {
  const touch = v.kind !== "desktop";
  return { viewport: { width: v.width, height: v.height }, hasTouch: touch, isMobile: v.kind === "phone" };
}

/** Token sizes in px, as in app/globals.css: min and max between a 320 px and a 2560 px viewport. */
export const TYPE_SCALE = {
  display: [28, 44],
  h1: [24, 34],
  h2: [20, 26],
  h3: [17, 21],
  body: [14, 16],
  table: [14, 14],
  "table-head": [11, 11],
  caption: [12, 13],
  hint: [12, 12],
} as const;

export const ICON_SIZES = { xs: 14, sm: 16, md: 20, lg: 24, xl: 32 } as const;
