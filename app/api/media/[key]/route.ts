import { getCloudflareEnv } from "@/lib/cloudflare-env";

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string }> },
) {
  const { key } = await context.params;
  if (!/^[a-zA-Z0-9._-]+$/.test(key)) {
    return new Response("Not found", { status: 404 });
  }
  const env = await getCloudflareEnv();
  const bucket = env.BUCKET;
  if (!bucket) return new Response("Not found", { status: 404 });
  const object = await bucket.get(key);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}
