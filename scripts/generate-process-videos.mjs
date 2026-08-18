import { execFileSync } from "node:child_process";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const MODEL = "fal-ai/kling-video/v3/pro/image-to-video";
const RAW_ROOT = "https://raw.githubusercontent.com/themonsteredu/ai-nudle/main/public/process";
const OUTPUT_DIR = path.resolve("public/process/videos");
const scope = process.argv[2] ?? "noodle";
const key = process.env.FAL_KEY;

if (!key) throw new Error("FAL_KEY GitHub secret is required.");
if (!['noodle', 'all'].includes(scope)) throw new Error("Scope must be noodle or all.");
if (scope === "all" && process.env.CONFIRM_SPEND !== "GENERATE_ALL") {
  throw new Error("Full generation requires CONFIRM_SPEND=GENERATE_ALL.");
}

const jobs = {
  mix: "Locked-off documentary camera. Dry flour and measured ingredients pour steadily into the industrial mixer while the internal paddles rotate naturally. The stainless-steel machine remains structurally unchanged. Real factory physics, continuous single shot, no camera movement, no people, no text.",
  dough: "Locked-off documentary camera. The industrial kneading machine presses, folds, and turns the pale ramen dough with slow heavy mechanical force. Preserve the exact machine, lighting, and composition. Continuous realistic factory motion, no camera movement, no people, no text.",
  noodle: "Locked-off documentary camera. The metal rollers rotate continuously while the pale ramen dough sheet feeds through them. Fresh noodle strands emerge from beneath the cutting roller and travel smoothly downward toward the conveyor in one continuous direction. Preserve the exact machinery and composition. Realistic factory speed and physics, no camera movement, no zoom, no people, no text.",
  steam: "Locked-off documentary camera. Ramen noodle strands move steadily through the industrial steaming line while soft white steam rises and disperses naturally. Preserve the machinery and noodle shape. Continuous realistic production motion, no camera movement, no people, no text.",
  dry: "Locked-off documentary camera. Formed ramen noodles advance steadily through the drying or frying line as subtle heat shimmer moves upward. Preserve the equipment and product shape. Continuous realistic conveyor motion, no camera movement, no people, no text.",
  cool: "Locked-off documentary camera. Ramen noodle blocks move slowly along the conveyor while industrial cooling fans spin and airflow lightly moves loose noodle edges. Preserve the machinery and composition. Continuous realistic factory motion, no camera movement, no people, no text.",
  soup: "Locked-off documentary camera. Fine ramen seasoning powder is measured and dispensed in controlled portions while dried vegetable flakes move through the adjacent production equipment. Preserve every container and machine. Realistic continuous factory motion, no camera movement, no people, no text.",
  pack: "Locked-off documentary camera. Ramen cups move steadily along the conveyor while noodle blocks and sealed seasoning packets are placed into each container in sequence. Preserve the exact packaging equipment and composition. Continuous realistic motion, no camera movement, no people, no text.",
  check: "Locked-off documentary camera. Finished ramen packages advance through the quality inspection machine while the inspection sensor scans each package. Preserve the exact equipment and package appearance. Continuous realistic conveyor motion, no camera movement, no people, no text.",
};

const headers = { Authorization: `Key ${key}`, "Content-Type": "application/json" };
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function checkedJson(response, label) {
  const text = await response.text();
  if (!response.ok) throw new Error(`${label} failed (${response.status}): ${text}`);
  return JSON.parse(text);
}

async function generateVideo(tone, prompt) {
  console.log(`Submitting ${tone} to ${MODEL}`);
  const submitted = await checkedJson(await fetch(`https://queue.fal.run/${MODEL}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      start_image_url: `${RAW_ROOT}/${tone}.webp`,
      prompt,
      duration: "5",
      generate_audio: false,
    }),
  }), `${tone} submission`);

  while (true) {
    const status = await checkedJson(await fetch(submitted.status_url, { headers }), `${tone} status`);
    console.log(`${tone}: ${status.status}`);
    if (status.status === "COMPLETED") break;
    if (status.status === "FAILED") throw new Error(`${tone} generation failed.`);
    await sleep(10_000);
  }

  const result = await checkedJson(await fetch(submitted.response_url, { headers }), `${tone} result`);
  const videoUrl = result.video?.url;
  if (!videoUrl) throw new Error(`${tone} result did not contain a video URL.`);

  const sourcePath = path.join(OUTPUT_DIR, `${tone}.source.mp4`);
  const outputPath = path.join(OUTPUT_DIR, `${tone}.mp4`);
  const optimizedPath = path.join(OUTPUT_DIR, `${tone}.optimized.mp4`);
  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) throw new Error(`${tone} video download failed (${videoResponse.status}).`);
  await writeFile(sourcePath, Buffer.from(await videoResponse.arrayBuffer()));

  execFileSync("ffmpeg", [
    "-y", "-i", sourcePath, "-an", "-vf", `scale=1280:-2:force_original_aspect_ratio=decrease,fps=24${tone === "noodle" ? ",reverse" : ""}`,
    "-c:v", "libx264", "-preset", "medium", "-crf", "25", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", optimizedPath,
  ], { stdio: "inherit" });

  await rm(sourcePath, { force: true });
  await rm(outputPath, { force: true });
  await rename(optimizedPath, outputPath);
  console.log(`Saved ${outputPath}`);
}

await mkdir(OUTPUT_DIR, { recursive: true });
const selectedJobs = scope === "all" ? Object.entries(jobs) : [["noodle", jobs.noodle]];
for (const [tone, prompt] of selectedJobs) await generateVideo(tone, prompt);
