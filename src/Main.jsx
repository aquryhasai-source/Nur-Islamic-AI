import React from "react";
import { createRoot } from "react-dom/client";
import "./theme.css";
import NurApp from "./NurApp.jsx";
import Landing from "./Landing.jsx";

// "/" is the public homepage; "/app" is the app. Two cases still open the app
// directly so nothing that already points at it breaks:
//   • #privacy / #terms (and other page hashes) on "/" — existing shared links
//   • an installed PWA (standalone window) opened at "/" — older installs
const path = window.location.pathname.replace(/\/+$/, "");
const hash = window.location.hash.replace("#", "");
const PAGE_HASHES = ["profile","bookmarks","qibla","calendar","recent","getpro","support","about","prayers","feedback","privacy","terms"];
const standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone;
const showApp = path.startsWith("/app") || PAGE_HASHES.includes(hash) || standalone;

createRoot(document.getElementById("root")).render(showApp ? <NurApp /> : <Landing />);
