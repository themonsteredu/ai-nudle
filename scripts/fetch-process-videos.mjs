import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const tones = ["mix", "dough", "noodle", "steam", "dry", "cool", "soup", "pack", "check"];
const rawRoot = "https://raw.githubusercontent.com/themonsteredu/ai-nudle/main/public/process/videos";
const outputDir = path.resolve(process.env.PROCESS_VIDEO_DIR ?? "public/process/videos");

await mkdir(outputDir, { recursive: true });

for (const tone of tones) {
  const outputPath = path.join(outputDir, `${tone}.mp4`);
  try {
    await access(outputPath);
    continue;
  } catch {
    // The deployment source uploader omits large generated videos. Fetch only
    // the videos that have already been approved and committed to GitHub.
  }

  const response = await fetch(`${rawRoot}/${tone}.mp4`);
  if (response.status === 404) continue;
  if (!response.ok) throw new Error(`Failed to fetch ${tone}.mp4 (${response.status}).`);

  await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
  console.log(`Fetched process video: ${tone}.mp4`);
}
