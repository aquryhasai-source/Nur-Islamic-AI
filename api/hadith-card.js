// Renders a shareable "Hadith of the Day" card as a PNG image.
// Public URL: https://nur-islamic-ai.vercel.app/api/hadith-card?text=...&ref=...
// Add &format=reel to get a vertical (1080x1920) render for the video Reel;
// omit it (or use any other value) for the original square (1080x1080) post image.
// Meta's Graph API fetches this URL directly when posting to Facebook/Instagram,
// and hadith-reel.js fetches the reel variant as the still frame for the video.
//
// Written with React.createElement (no JSX) so this plain .js file needs no
// JSX transform -- Vercel's zero-config Functions only recognize .js/.ts for
// non-Next.js projects, not .jsx/.tsx.

import { ImageResponse } from "@vercel/og";
import React from "react";

export const config = { runtime: "edge" };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get("text") || "";
  const ref = searchParams.get("ref") || "";
  const isReel = searchParams.get("format") === "reel";
  const dimensions = isReel ? { width: 1080, height: 1920 } : { width: 1080, height: 1080 };

  return new ImageResponse(
    React.createElement(
      "div",
      {
        style: {
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
        },
      },
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            fontSize: 34,
            color: "#c9a84c",
            letterSpacing: 4,
            marginBottom: 50,
            fontWeight: 700,
          },
        },
        "N\u016AR \u00B7 HADITH OF THE DAY",
      ),
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            fontSize: 46,
            lineHeight: 1.45,
            maxWidth: 880,
            fontWeight: 500,
          },
        },
        `"${text}"`,
      ),
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            fontSize: 30,
            color: "#c9a84c",
            marginTop: 55,
          },
        },
        `\u2014 ${ref}`,
      ),
    ),
    dimensions,
  );
}
