import { getDb } from "@/db";
import { mediaAssets } from "@/db/schema";
import { isTeacherRequest } from "@/lib/teacher-auth";
import { createId } from "@/lib/ids";
import { ensureDatabase } from "@/lib/db-init";
import { getCloudflareEnv } from "@/lib/cloudflare-env";

const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  if (!isTeacherRequest(request)) {
    return Response.json({ error: "교사 인증이 필요합니다." }, { status: 401 });
  }

  try {
    await ensureDatabase();
    const env = await getCloudflareEnv();
    const bucket = env.BUCKET;
    if (!bucket) throw new Error("Cloudflare R2 binding is unavailable.");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "이미지 파일을 선택해 주세요." }, { status: 400 });
    }
    const extension = ALLOWED_TYPES.get(file.type);
    if (!extension) {
      return Response.json({ error: "JPG, PNG, WEBP만 업로드할 수 있습니다." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: "이미지는 4MB 이하로 올려 주세요." }, { status: 400 });
    }

    const key = `${createId("ingredient")}.${extension}`;
    await bucket.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { originalName: file.name },
    });
    const db = await getDb();
    await db.insert(mediaAssets).values({
      key,
      fileName: file.name,
      contentType: file.type,
    });
    return Response.json({ url: `/api/media/${key}` }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "이미지 업로드에 실패했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}
