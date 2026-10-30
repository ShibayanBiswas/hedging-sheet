type DeviceKind = "phone" | "tablet" | "desktop";

export type Viewport = { name: string; width: number; height: number; kind: DeviceKind };

/** Every device view the desk is checked at, from a small phone to a 2560 px monitor. */
export const VIEWPORTS: Viewport[] = [
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
