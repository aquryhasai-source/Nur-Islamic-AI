// Renders a shareable "Hadith of the Day" card as a PNG image.
// Public URL: https://nur-islamic-ai.vercel.app/api/hadith-card?text=...&ref=...
// Meta's Graph API fetches this URL directly when posting to Facebook/Instagram.

import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get("text") || "";
  const ref = searchParams.get("ref") || "";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0d1f14",
          backgroundImage: "radial-gradient(circle at 50% 30%, #163726 0%, #0d1f14 70%)",
          color: "#f5e6c8",
          fontFamily: "sans-serif",
          padding: "90px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 34,
            color: "#c9a84c",
            letterSpacing: 4,
            marginBottom: 50,
            fontWeight: 700,
          }}
        >
          NŪR &nbsp;·&nbsp; HADITH OF THE DAY
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 46,
            lineHeight: 1.45,
            maxWidth: 880,
            fontWeight: 500,
          }}
        >
          "{text}"
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 30,
            color: "#c9a84c",
            marginTop: 55,
          }}
        >
          — {ref}
        </div>
      </div>
    ),
    { width: 1080, height: 1080 },
  );
}
