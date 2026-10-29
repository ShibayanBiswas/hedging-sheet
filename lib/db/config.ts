/**
 * MongoDB connection settings from the environment: MONGODB_URI, or MONGODB_HOST with optional credential parts.
 * Only production may use the production database; previews, development deployments and tests get their own.
 */
export type MongoConfig = {
  uri: string;
  dbName: string;
};

type Env = Record<string, string | undefined>;

export const PRODUCTION_DB = "hedging_sheet";

export function resolveDbName(env: Env = process.env): string {
  const explicit = env.MONGODB_DB?.trim() || "";
  const vercelEnv = env.VERCEL_ENV?.trim() || "";
  if (vercelEnv && vercelEnv !== "production") {
    return explicit && explicit !== PRODUCTION_DB ? explicit : `${PRODUCTION_DB}_${vercelEnv}`;
  }
  if (env.NODE_ENV === "test" || env.TEST_MODE === "mock") {
    return explicit && explicit !== PRODUCTION_DB ? explicit : `${PRODUCTION_DB}_test`;
  }
  return explicit || PRODUCTION_DB;
}

export function resolveMongoConfig(env: Env = process.env): MongoConfig | null {
  const dbName = resolveDbName(env);
  const directUri = env.MONGODB_URI?.trim();
  if (directUri) return { uri: directUri, dbName };

  const host = env.MONGODB_HOST?.trim();
  if (!host) return null;

  const user = env.MONGODB_USER?.trim();
  const password = env.MONGODB_PASSWORD ?? "";
  const authSource = env.MONGODB_AUTH_SOURCE?.trim();
  const credentials = user ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}@` : "";

  const params = new URLSearchParams();
  params.set("retryWrites", "true");
  params.set("w", "majority");
  if (authSource) params.set("authSource", authSource);
  if (env.MONGODB_TLS === "true") params.set("tls", "true");

  const useSrv = env.MONGODB_SRV === "true" || host.includes(".mongodb.net");
  const scheme = useSrv ? "mongodb+srv" : "mongodb";
  const port = !useSrv && env.MONGODB_PORT?.trim() ? `:${env.MONGODB_PORT.trim()}` : "";
  return { uri: `${scheme}://${credentials}${host}${port}/${dbName}?${params.toString()}`, dbName };
}
