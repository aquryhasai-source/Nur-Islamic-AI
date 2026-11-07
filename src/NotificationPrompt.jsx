// NUR Islamic AI — global "enable notifications" banner
// Shows only when: permission is still "default" (never asked), the user
// has actually engaged with the app (sent at least one message), and they
// haven't dismissed it before. Never re-prompts after a denial or dismissal.

import { useState, useEffect } from "react";
import { KEYS } from "./utils.js";
import { Icon } from "./Icons.jsx";
import { subscribeToPush, getPushPermissionState } from "./lib/pushNotifications.js";
import { trackEvent, trackError } from "./analytics.js";

export default function NotificationPrompt({ hasEngaged, lightMode, textSize }) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(KEYS.NOTIF_PROMPT_DISMISSED) === "true";
    const state = getPushPermissionState();
    setVisible(!dismissed && state === "default" && hasEngaged);
  }, [hasEngaged]);

  const dismiss = () => {
    localStorage.setItem(KEYS.NOTIF_PROMPT_DISMISSED, "true");
    setVisible(false);
  };

  const enable = async () => {
    setLoading(true);
    try {
      await subscribeToPush();
      trackEvent("notifications_enabled_banner");
    } catch (err) {
      trackError(err.message, "enable_notifications_banner");
    }
    setLoading(false);
    dismiss(); // either way, don't keep nagging — Profile page remains available if denied
  };

  if (!visible) return null;

  const gold = "var(--gold)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
        padding: "10px 14px",
        background: `color-mix(in srgb,${gold} 8%,transparent)`,
        borderBottom: `1px solid color-mix(in srgb,${gold} 20%,transparent)`,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          color: "var(--text)",
          fontSize: `${12 * textSize}px`,
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        Get a daily Hadith each morning <Icon n="spark" size={12}/>
      </span>
      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
        <button
          onClick={enable}
          disabled={loading}
          style={{
            background: gold,
            border: "none",
            borderRadius: "8px",
            padding: "6px 12px",
            color: "var(--onGold)",
            fontWeight: 700,
            fontSize: `${11 * textSize}px`,
            cursor: loading ? "default" : "pointer",
            fontFamily:"inherit",
          }}
        >
          {loading ? "…" : "Enable"}
        </button>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          style={{
            background: "none",
            border: "none",
            color: gold,
            fontSize: "16px",
            cursor: "pointer",
            padding: "0 4px",
            display: "inline-flex",
          }}
        >
          <Icon n="close" size={16}/>
        </button>
      </div>
    </div>
  );
}
