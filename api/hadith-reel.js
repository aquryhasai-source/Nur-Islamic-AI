// Builds the daily Hadith Reel: static vertical hadith-card image over a
// fixed-length ambient bed (melody + thunder + ocean waves), uploaded to
// Vercel Blob. Returns { video_url } for the caller to post to Meta.
//
// No narration/TTS -- the no-narration version was confirmed as the final
// design, so that path (and Groq TTS, reverb, ffprobe-based duration timing
// it needed) was removed rather than kept as unused branching. It's still in
// git history if ever wanted back.
//
// Called by the Supabase `post-daily-hadith-social` Edge Function -- it
// posts hadith_text/reference/hadith_id here, then takes the returned
// video_url and publishes it to Facebook/Instagram as a Reel.
//
// Node.js runtime (default for files in /api that don't set runtime:"edge")
// -- ffmpeg needs a real Node process and a native binary, not the Edge
// runtime that hadith-card.js uses.

import { put } from "@vercel/blob";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "node:child_process";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";

export const config = { maxDuration: 60 };

const CARD_BASE_URL = "https://nur-islamic-ai.vercel.app/api/hadith-card";
const MAIN_TRACK_URL = "https://nur-islamic-ai.vercel.app/audio/bg-melody.mp3";
const THUNDER_TRACK_URL = "https://nur-islamic-ai.vercel.app/audio/thunder.mp3";
const OCEAN_TRACK_URL = "https://nur-islamic-ai.vercel.app/audio/ocean-waves.mp3";

const DURATION = 10; // seconds, fixed
const FADE = 0.5; // seconds -- fade in/out on each track so there's no audible hard edge
const MAIN_VOLUME = 1.0;
const THUNDER_VOLUME = 0.7;
const OCEAN_VOLUME = 0.5;

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-1000)}`));
    });
  });
}

async function fetchToFile(url, path) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed (${url}): ${res.status}`);
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  const { hadith_text, reference, hadith_id } = req.body || {};
  if (!hadith_text || !reference) {
    res.status(400).json({ error: "hadith_text and reference are required" });
    return;
  }

  const tmpId = randomUUID();
  const imagePath = `/tmp/${tmpId}.png`;
  const mainPath = `/tmp/${tmpId}-main.mp3`;
  const thunderPath = `/tmp/${tmpId}-thunder.mp3`;
  const oceanPath = `/tmp/${tmpId}-ocean.mp3`;
  const outputPath = `/tmp/${tmpId}.mp4`;

  try {
    // 1. Vertical hadith card -- static, same design as the photo post
    const imageUrl = `${CARD_BASE_URL}?text=${encodeURIComponent(hadith_text)}&ref=${encodeURIComponent(reference)}&format=reel`;
    await fetchToFile(imageUrl, imagePath);

    // 2. Three-layer ambient bed -- all three are now full-length tracks,
    // each trimmed/faded identically
    await Promise.all([
      fetchToFile(MAIN_TRACK_URL, mainPath),
      fetchToFile(THUNDER_TRACK_URL, thunderPath),
      fetchToFile(OCEAN_TRACK_URL, oceanPath),
    ]);

    const layer = (inputIdx, label, volume) =>
      `[${inputIdx}:a]atrim=0:${DURATION},afade=t=in:st=0:d=${FADE},afade=t=out:st=${DURATION - FADE}:d=${FADE},volume=${volume}[${label}]`;

    const filterComplex =
      `${layer(1, "main", MAIN_VOLUME)};` +
      `${layer(2, "thunder", THUNDER_VOLUME)};` +
      `${layer(3, "ocean", OCEAN_VOLUME)};` +
      `[main][thunder][ocean]amix=inputs=3:duration=longest:dropout_transition=0[a]`;

    // 3. Mux: static image as video, fixed-duration 3-layer mix as audio
    await runFfmpeg([
      "-y",
      "-loop", "1", "-i", imagePath,
      "-i", mainPath,
      "-i", thunderPath,
      "-i", oceanPath,
      "-filter_complex", filterComplex,
      "-map", "0:v", "-map", "[a]",
      "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p", "-r", "30",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
      "-t", String(DURATION),
      outputPath,
    ]);

    // 4. Upload to Blob -- public, so Meta's servers can fetch it by URL
    const videoBuffer = await readFile(outputPath);
    const blob = await put(`reels/hadith-${hadith_id || tmpId}.mp4`, videoBuffer, {
      access: "public",
      contentType: "video/mp4",
      addRandomSuffix: true,
    });

    res.status(200).json({ video_url: blob.url, duration: DURATION });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  } finally {
    await Promise.allSettled([unlink(imagePath), unlink(mainPath), unlink(thunderPath), unlink(oceanPath), unlink(outputPath)]);
  }
}
