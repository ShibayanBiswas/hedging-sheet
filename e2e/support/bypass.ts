import type { APIRequestContext, BrowserContext } from "@playwright/test";

import { bypassHeaders, bypassTarget } from "../../scripts/bypass-target";

const BASE = process.env.BASE_URL;
const SECRET = BASE && bypassTarget(BASE) === "trusted" ? process.env.VERCEL_AUTOMATION_BYPASS_SECRET : undefined;

/** Adds the bypass headers to the page's requests to the deployment, and to nothing else it loads. */
export async function attachBypass(context: BrowserContext, base = BASE, secret = SECRET) {
  if (!base || !secret) return;
  await context.route("**/*", async (route) => {
    const request = route.request();
    const extra = bypassHeaders(request.url(), base, secret);
    if (Object.keys(extra).length === 0) return route.fallback();
    // Not route.fallback({ headers }): those headers stay on a redirect to another site. A redirect handed back to the
    // browser is followed without them; the bypass cookie covers one that stays on the deployment.
    const response = await route.fetch({ headers: { ...request.headers(), ...extra }, maxRedirects: 0 }).catch(() => null);
    await (response ? route.fulfill({ response }) : route.abort());
  });
}

const SENDS = ["get", "post", "put", "patch", "delete", "head"];

/** The same for the request fixture, which has no routes: each call gets the headers by its own URL, and follows no redirect. */
export function withBypass(request: APIRequestContext, base = BASE, secret = SECRET): APIRequestContext {
  if (!base || !secret) return request;
  return new Proxy(request, {
    get(target, name) {
      const value = Reflect.get(target, name) as unknown;
      if (typeof value !== "function") return value;
      if (typeof name !== "string" || !SENDS.includes(name)) return value.bind(target);
      return (url: string, options: { headers?: Record<string, string> } = {}) =>
        value.call(target, url, { maxRedirects: 0, ...options, headers: { ...options.headers, ...bypassHeaders(url, base, secret) } });
    },
  });
}
