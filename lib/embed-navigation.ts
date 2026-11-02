import { NAV_ITEMS } from "@/lib/navigation";

/**
 * SP Workstation frames this app and asks it to change tab with postMessage, so a sidebar click no longer reloads the frame
 * and wipes the run. Nothing else may steer it: the message must come from the parent window, from one exact origin, and
 * name one exact route of this app.
 */
const EMBED_MESSAGE = "hedging-sheet:navigate";
const PARENT_ORIGIN = "https://sp-workstation.vercel.app";
/** npm run dev in the SP Workstation repo; its run.ps1 and .env.example use port 3000. Never accepted in a production build. */
const LOCAL_PARENT_ORIGIN = "http://localhost:3000";

const ROUTES = new Set(NAV_ITEMS.map((item) => item.href));

type EmbedEvent = Pick<MessageEvent, "source" | "origin" | "data">;

/** The route to open for a message, or null when the message is not one to act on. */
export function embedNavigationTarget(event: EmbedEvent, parent: unknown, production: boolean): string | null {
  if (event.source === null || event.source !== parent) return null;
  if (event.origin !== PARENT_ORIGIN && (production || event.origin !== LOCAL_PARENT_ORIGIN)) return null;
  const data: unknown = event.data;
  if (typeof data !== "object" || data === null) return null;
  const { type, path } = data as { type?: unknown; path?: unknown };
  if (type !== EMBED_MESSAGE || typeof path !== "string" || !ROUTES.has(path)) return null;
  return path;
}
