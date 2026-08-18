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

const runtimeImport = new Function(
  "specifier",
  "return import(specifier)",
) as (specifier: string) => Promise<CloudflareWorkersModule>;

export async function getCloudflareEnv() {
  const workersModule = await runtimeImport("cloudflare:workers");
  return workersModule.env;
}
