import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PAGE_ACCESS_TOKEN = Deno.env.get("META_PAGE_ACCESS_TOKEN")!;
const PAGE_ID = Deno.env.get("META_PAGE_ID")!;
const IG_USER_ID = Deno.env.get("META_IG_USER_ID")!;
const REEL_URL = "https://nurislamicai.app/api/hadith-reel";
const GRAPH = "https://graph.facebook.com/v21.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Only our own pg_cron job may call this function (secret checked in the database).
async function authorised(req: Request): Promise<boolean> {
  const got = req.headers.get("x-cron-secret") ?? "";
  if (got.length < 32) return false;
  const { data, error } = await supabase.rpc("check_cron_secret", { p_secret: got });
  return !error && data === true;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Instagram Reels: create container -> poll status_code -> publish
async function postInstagramReel(videoUrl: string, caption: string) {
  const createRes = await fetch(`${GRAPH}/${IG_USER_ID}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_type: "REELS",
      video_url: videoUrl,
      caption,
      access_token: PAGE_ACCESS_TOKEN,
    }),
  });
  const createData = await createRes.json();
  if (!createData.id) {
    return { error: "container creation failed", detail: createData };
  }

  const containerId = createData.id;
  for (let i = 0; i < 20; i++) {
    await sleep(5000);
    const statusRes = await fetch(
      `${GRAPH}/${containerId}?fields=status_code&access_token=${PAGE_ACCESS_TOKEN}`,
    );
    const statusData = await statusRes.json();
    if (statusData.status_code === "FINISHED") {
      const publishRes = await fetch(`${GRAPH}/${IG_USER_ID}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: containerId, access_token: PAGE_ACCESS_TOKEN }),
      });
      return await publishRes.json();
    }
    if (statusData.status_code === "ERROR" || statusData.status_code === "EXPIRED") {
      return { error: "container processing failed", detail: statusData };
    }
  }
  return { error: "timed out waiting for Instagram container to finish processing" };
}

// Facebook Reels: start upload session -> upload via file_url -> finish/publish
async function postFacebookReel(videoUrl: string, description: string) {
  const startRes = await fetch(
    `${GRAPH}/${PAGE_ID}/video_reels?upload_phase=start&access_token=${PAGE_ACCESS_TOKEN}`,
    { method: "POST" },
  );
  const startData = await startRes.json();
  if (!startData.video_id) {
    return { error: "start phase failed", detail: startData };
  }

  const uploadRes = await fetch(
    `https://rupload.facebook.com/video-upload/${startData.video_id}`,
    {
      method: "POST",
      headers: {
        Authorization: `OAuth ${PAGE_ACCESS_TOKEN}`,
        file_url: videoUrl,
      },
    },
  );
  const uploadData = await uploadRes.json();
  if (!uploadData.success) {
    return { error: "upload phase failed", detail: uploadData };
  }

  const finishRes = await fetch(`${GRAPH}/${PAGE_ID}/video_reels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      video_id: startData.video_id,
      upload_phase: "finish",
      video_state: "PUBLISHED",
      description,
      access_token: PAGE_ACCESS_TOKEN,
    }),
  });
  return await finishRes.json();
}

Deno.serve(async (req) => {
  if (!(await authorised(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Light housekeeping so the dedup table doesn't grow forever
    await supabase
      .from("social_posts_sent")
      .delete()
      .lt("post_date", new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10));

    const { data: hadiths, error: countErr } = await supabase
      .from("daily_hadiths")
      .select("id, hadith_text, reference")
      .order("id");
    if (countErr || !hadiths || hadiths.length === 0) {
      throw new Error("Could not load hadiths: " + (countErr?.message ?? "empty table"));
    }

    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
    );
    const hadith = hadiths[dayOfYear % hadiths.length];

    // Atomic claim: if this insert fails (duplicate key), today's post has already been made/claimed
    const postDate = new Date().toISOString().slice(0, 10);
    const { error: claimErr } = await supabase
      .from("social_posts_sent")
      .insert({ post_date: postDate, hadith_id: hadith.id });
    if (claimErr) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "already posted today", post_date: postDate }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // Shared secret for the Vercel reel endpoint (stored in Vault; Vercel holds the same value).
    const { data: internalSecret } = await supabase.rpc("get_internal_secret");

    // Build the Reel (static hadith card + ambient audio) via the Vercel function
    const reelRes = await fetch(REEL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-nur-secret": typeof internalSecret === "string" ? internalSecret : "",
      },
      body: JSON.stringify({
        hadith_text: hadith.hadith_text,
        reference: hadith.reference,
        hadith_id: hadith.id,
      }),
    });
    const reelData = await reelRes.json();
    if (!reelData.video_url) {
      console.error("reel generation failed:", JSON.stringify(reelData));
      return new Response(
        JSON.stringify({ error: "reel generation failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
    const videoUrl = reelData.video_url;
    const caption = `${hadith.hadith_text}\n\n— ${hadith.reference}\n\n#Hadith #Islam #DailyHadith #NurIslamicAI`;

    const results: Record<string, unknown> = {};

    try {
      results.facebook = await postFacebookReel(videoUrl, caption);
    } catch (err) {
      results.facebook = { error: String(err) };
    }

    try {
      results.instagram = await postInstagramReel(videoUrl, caption);
    } catch (err) {
      results.instagram = { error: String(err) };
    }

    return new Response(
      JSON.stringify({ hadith_id: hadith.id, video_url: videoUrl, results }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("post-daily-hadith-social error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
