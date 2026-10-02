import type { AnyD1Database } from "drizzle-orm/d1";

export type CloudflareObject = {
  body: BodyInit | null;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
};

export type CloudflareBucket = {
  get(key: string): Promise<CloudflareObject | null>;
  put(key: string, value: unknown, options?: unknown): Promise<unknown>;
};

type CloudflareWorkersModule = {
  env: {
    DB?: AnyD1Database;
    BUCKET?: CloudflareBucket;
  };
};

export async function getCloudflareEnv() {
  const workersModule = await import(/* webpackIgnore: true */ "cloudflare:workers") as CloudflareWorkersModule;
  return workersModule.env;
}
