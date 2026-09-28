// Builds the daily Hadith Reel: TTS narration (with reverb) muxed onto the
// vertical hadith-card image, padded to a minimum duration, uploaded to
// Vercel Blob. Returns { video_url } for the caller to post to Meta.
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
const GROQ_TTS_URL = "https://api.groq.com/openai/v1/audio/speech";
const TTS_MODEL = "canopylabs/orpheus-v1-english"; // playai-tts was decommissioned by Groq; this is the current model
const TTS_VOICE = "troy"; // English voices: autumn, diana, hannah, austin, daniel, troy -- austin was too upbeat; swap here if troy still isn't right
const MIN_DURATION = 5; // seconds -- clears Instagram's 3s Reels minimum with margin
const PAD_SECONDS = 2; // fixed silence added before and after the narration

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
  const voicePath = `/tmp/${tmpId}.wav`;
  const outputPath = `/tmp/${tmpId}.mp4`;

  try {
    // 1. Vertical hadith card -- same design as the static post, portrait crop
    const imageUrl = `${CARD_BASE_URL}?text=${encodeURIComponent(hadith_text)}&ref=${encodeURIComponent(reference)}&format=reel`;
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) throw new Error(`hadith-card fetch failed: ${imageRes.status}`);
    await writeFile(imagePath, Buffer.from(await imageRes.arrayBuffer()));

    // 2. TTS narration
    const script = hadith_text;
    const ttsRes = await fetch(GROQ_TTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        voice: TTS_VOICE,
        input: script,
        response_format: "wav",
      }),
    });
    if (!ttsRes.ok) {
      throw new Error(`Groq TTS failed: ${ttsRes.status} ${await ttsRes.text()}`);
    }
    await writeFile(voicePath, Buffer.from(await ttsRes.arrayBuffer()));

    // 3. Mux: loop the still image as video, add reverb/echo to the narration,
    // pad the audio with silence so the clip is never shorter than MIN_DURATION
    // (apad's whole_dur only extends -- it never truncates a longer narration).
    await runFfmpeg([
      "-y",
      "-loop", "1", "-i", imagePath,
      "-i", voicePath,
      "-filter_complex",
      `[1:a]adelay=${PAD_SECONDS * 1000}|${PAD_SECONDS * 1000}:all=1,aecho=0.7:0.6:40:0.15,apad=pad_dur=${PAD_SECONDS},apad=whole_dur=${MIN_DURATION}[a]`,
      "-map", "0:v", "-map", "[a]",
      "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p", "-r", "30",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
      "-shortest",
      outputPath,
    ]);

    // 4. Upload to Blob -- public, so Meta's servers can fetch it by URL
    const videoBuffer = await readFile(outputPath);
    const blob = await put(`reels/hadith-${hadith_id || tmpId}.mp4`, videoBuffer, {
      access: "public",
      contentType: "video/mp4",
      addRandomSuffix: true,
    });

    res.status(200).json({ video_url: blob.url });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  } finally {
    await Promise.allSettled([unlink(imagePath), unlink(voicePath), unlink(outputPath)]);
  }
}
