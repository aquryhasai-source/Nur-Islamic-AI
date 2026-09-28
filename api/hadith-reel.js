// Builds the daily Hadith Reel: static vertical hadith-card image, with a
// continuous background ambient bed (rain/thunder) under either TTS
// narration (with reverb) or nothing at all, uploaded to Vercel Blob.
// Returns { video_url } for the caller to post to Meta.
//
// Called by the Supabase `post-daily-hadith-social` Edge Function -- it
// posts hadith_text/reference/hadith_id here (with_narration defaults to
// true for the real daily post), then takes the returned video_url and
// publishes it to Facebook/Instagram as a Reel. with_narration: false is a
// preview/comparison mode -- it's never used by the production cron.
//
// Node.js runtime (default for files in /api that don't set runtime:"edge")
// -- ffmpeg needs a real Node process and a native binary, not the Edge
// runtime that hadith-card.js uses.

import { put } from "@vercel/blob";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import { spawn } from "node:child_process";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";

export const config = { maxDuration: 60 };

const CARD_BASE_URL = "https://nur-islamic-ai.vercel.app/api/hadith-card";
const BG_TRACK_URL = "https://nur-islamic-ai.vercel.app/audio/bg-rain-thunder.mp3"; // 30s trimmed ambient loop, rain/thunder already baked in -- no separate SFX needed
const GROQ_TTS_URL = "https://api.groq.com/openai/v1/audio/speech";
const TTS_MODEL = "canopylabs/orpheus-v1-english"; // playai-tts was decommissioned by Groq; this is the current model
const TTS_VOICE = "troy"; // English voices: autumn, diana, hannah, austin, daniel, troy -- austin was too upbeat; swap here if troy still isn't right
const MIN_DURATION = 5; // seconds -- floor so a very short narration still clears Instagram's 3s Reels minimum
const PAD_SECONDS = 2; // silence held before and after the narration (filled by the continuous background bed, not dead air)
const NO_NARRATION_DURATION = 12; // seconds -- fixed length for the narration-off preview
const BG_FADE = 0.5; // seconds -- fade in/out on the background bed so the loop has no audible hard edge
const BG_VOLUME_WITH_NARRATION = 0.15; // sits under the voice
const BG_VOLUME_NO_NARRATION = 0.5; // sole audio in this mode, a bit more present

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

function probeDuration(filePath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffprobeStatic.path, [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    let out = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve(parseFloat(out.trim()));
      else reject(new Error(`ffprobe exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  const { hadith_text, reference, hadith_id, with_narration = true } = req.body || {};
  if (!hadith_text || !reference) {
    res.status(400).json({ error: "hadith_text and reference are required" });
    return;
  }

  const tmpId = randomUUID();
  const imagePath = `/tmp/${tmpId}.png`;
  const voicePath = `/tmp/${tmpId}-voice.wav`;
  const bgPath = `/tmp/${tmpId}-bg.mp3`;
  const outputPath = `/tmp/${tmpId}.mp4`;

  try {
    // 1. Vertical hadith card -- static, same design as the photo post
    const imageUrl = `${CARD_BASE_URL}?text=${encodeURIComponent(hadith_text)}&ref=${encodeURIComponent(reference)}&format=reel`;
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) throw new Error(`hadith-card fetch failed: ${imageRes.status}`);
    await writeFile(imagePath, Buffer.from(await imageRes.arrayBuffer()));

    // 2. Background ambient bed -- always fetched, plays continuously either way
    const bgRes = await fetch(BG_TRACK_URL);
    if (!bgRes.ok) throw new Error(`background track fetch failed: ${bgRes.status}`);
    await writeFile(bgPath, Buffer.from(await bgRes.arrayBuffer()));

    let finalDuration;
    let filterComplex;
    const inputArgs = ["-loop", "1", "-i", imagePath];

    if (with_narration) {
      // 3a. TTS narration
      const ttsRes = await fetch(GROQ_TTS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: TTS_MODEL,
          voice: TTS_VOICE,
          input: hadith_text,
          response_format: "wav",
        }),
      });
      if (!ttsRes.ok) {
        throw new Error(`Groq TTS failed: ${ttsRes.status} ${await ttsRes.text()}`);
      }
      await writeFile(voicePath, Buffer.from(await ttsRes.arrayBuffer()));

      const rawVoiceDur = await probeDuration(voicePath);
      finalDuration = Math.max(rawVoiceDur + PAD_SECONDS * 2, MIN_DURATION);

      inputArgs.push("-i", voicePath, "-i", bgPath);
      // Voice: lead-in silence, bare-minimum reverb, padded out to finalDuration
      // (which already accounts for the trailing PAD_SECONDS).
      // Background: trimmed to finalDuration, faded at both edges so there's no
      // hard cut, mixed in quietly under the narration.
      filterComplex =
        `[1:a]adelay=${PAD_SECONDS * 1000}|${PAD_SECONDS * 1000}:all=1,aecho=0.7:0.6:40:0.15,apad=whole_dur=${finalDuration}[voice];` +
        `[2:a]atrim=0:${finalDuration},afade=t=in:st=0:d=${BG_FADE},afade=t=out:st=${finalDuration - BG_FADE}:d=${BG_FADE},volume=${BG_VOLUME_WITH_NARRATION}[bg];` +
        `[voice][bg]amix=inputs=2:duration=longest:dropout_transition=0[a]`;
    } else {
      // 3b. No narration -- fixed-length preview, background bed only
      finalDuration = NO_NARRATION_DURATION;
      inputArgs.push("-i", bgPath);
      filterComplex =
        `[1:a]atrim=0:${finalDuration},afade=t=in:st=0:d=${BG_FADE},afade=t=out:st=${finalDuration - BG_FADE}:d=${BG_FADE},volume=${BG_VOLUME_NO_NARRATION}[a]`;
    }

    // 4. Mux: static image as video, mixed audio bed as computed above
    await runFfmpeg([
      "-y",
      ...inputArgs,
      "-filter_complex", filterComplex,
      "-map", "0:v", "-map", "[a]",
      "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p", "-r", "30",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
      "-t", String(finalDuration),
      outputPath,
    ]);

    // 5. Upload to Blob -- public, so Meta's servers can fetch it by URL
    const videoBuffer = await readFile(outputPath);
    const blob = await put(`reels/hadith-${hadith_id || tmpId}.mp4`, videoBuffer, {
      access: "public",
      contentType: "video/mp4",
      addRandomSuffix: true,
    });

    res.status(200).json({ video_url: blob.url, duration: finalDuration, with_narration });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  } finally {
    await Promise.allSettled([unlink(imagePath), unlink(voicePath), unlink(bgPath), unlink(outputPath)]);
  }
}
