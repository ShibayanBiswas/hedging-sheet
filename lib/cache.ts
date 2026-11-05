/**
 * Cache tags and helpers. Reference data is cached until a write expires its tag; daily history is
 * refreshed every few hours; the live spot is never cached. Outside a Next.js server, in scripts and
 * unit tests, reads go straight to the source and expiring is a no-op.
 */
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";

export const CACHE_TAGS = {
  /** The volatility surface and the surface parameters. */
  surface: "surface",
  /** Daily closes from Yahoo, all underlyings. */
  history: "history",
} as const;

export const historyTag = (underlying: "nifty" | "sensex") => `history:${underlying}`;

/** Daily history is refetched at most every three hours. */
export const HISTORY_REVALIDATE_SECONDS = 3 * 60 * 60;

const inNextServer = () => Boolean(process.env.NEXT_RUNTIME);

/** The Unwinding Calculator saves its surface without telling this app, so that read is refetched every five minutes. */
export const SHARED_SURFACE_REVALIDATE_SECONDS = 5 * 60;

export function cachedRead<A extends string[], R>(read: (...args: A) => Promise<R>, keyParts: string[], tags: string[], revalidate?: number): (...args: A) => Promise<R> {
  const cached = unstable_cache(read, keyParts, { tags, revalidate });
  return (...args: A) => (inNextServer() ? cached(...args) : read(...args));
}

/** Expires the tags at once, so the next read after a write is fresh rather than stale. */
export function expireTags(tags: string[], paths: string[] = []): void {
  if (!inNextServer()) return;
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
  for (const p of paths) revalidatePath(p, "layout");
}
