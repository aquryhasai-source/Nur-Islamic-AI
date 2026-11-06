import { useState, useEffect } from "react";

// ── City search ────────────────────────────────────────────────────────────────
// Type-ahead city suggestions. A bundled list of major cities answers instantly (and offline);
// Open-Meteo's geocoder fills in everything else. A place is { name, region, country, lat, lon, label }.

// [name, country, lat, lon] — major cities, weighted to where most NUR users are.
const RAW = [
  ["Makkah","Saudi Arabia",21.4225,39.8262],["Madinah","Saudi Arabia",24.4686,39.6142],["Riyadh","Saudi Arabia",24.6877,46.7219],
  ["Jeddah","Saudi Arabia",21.4858,39.1925],["Dammam","Saudi Arabia",26.4207,50.0888],["Dubai","United Arab Emirates",25.2048,55.2708],
  ["Abu Dhabi","United Arab Emirates",24.4539,54.3773],["Sharjah","United Arab Emirates",25.3463,55.4209],["Doha","Qatar",25.2854,51.531],
  ["Kuwait City","Kuwait",29.3759,47.9774],["Manama","Bahrain",26.2235,50.5876],["Muscat","Oman",23.588,58.3829],
  ["Sana'a","Yemen",15.3694,44.191],["Amman","Jordan",31.9454,35.9284],["Jerusalem","Palestine",31.7683,35.2137],
  ["Gaza","Palestine",31.5017,34.4668],["Beirut","Lebanon",33.8938,35.5018],["Damascus","Syria",33.5138,36.2765],
  ["Aleppo","Syria",36.2021,37.1343],["Baghdad","Iraq",33.3152,44.3661],["Basra","Iraq",30.5085,47.7835],
  ["Karbala","Iraq",32.616,44.0249],["Tehran","Iran",35.6892,51.389],["Mashhad","Iran",36.2605,59.6168],
  ["Isfahan","Iran",32.6546,51.668],["Shiraz","Iran",29.5918,52.5837],["Istanbul","Turkey",41.0082,28.9784],
  ["Ankara","Turkey",39.9334,32.8597],["Izmir","Turkey",38.4237,27.1428],["Konya","Turkey",37.8746,32.4932],
  ["Bursa","Turkey",40.1885,29.061],["Cairo","Egypt",30.0444,31.2357],["Alexandria","Egypt",31.2001,29.9187],
  ["Giza","Egypt",30.0131,31.2089],["Khartoum","Sudan",15.5007,32.5599],["Tripoli","Libya",32.8872,13.1913],
  ["Tunis","Tunisia",36.8065,10.1815],["Algiers","Algeria",36.7538,3.0588],["Casablanca","Morocco",33.5731,-7.5898],
  ["Rabat","Morocco",34.0209,-6.8416],["Marrakesh","Morocco",31.6295,-7.9811],["Fez","Morocco",34.0331,-5.0003],
  ["Dakar","Senegal",14.7167,-17.4677],["Lagos","Nigeria",6.5244,3.3792],["Kano","Nigeria",12.0022,8.592],
  ["Abuja","Nigeria",9.0765,7.3986],["Accra","Ghana",5.6037,-0.187],["Nairobi","Kenya",-1.2921,36.8219],
  ["Mombasa","Kenya",-4.0435,39.6682],["Mogadishu","Somalia",2.0469,45.3182],["Addis Ababa","Ethiopia",9.0054,38.7636],
  ["Dar es Salaam","Tanzania",-6.7924,39.2083],["Johannesburg","South Africa",-26.2041,28.0473],["Cape Town","South Africa",-33.9249,18.4241],
  ["Durban","South Africa",-29.8587,31.0218],["Karachi","Pakistan",24.8607,67.0011],["Lahore","Pakistan",31.5204,74.3587],
  ["Islamabad","Pakistan",33.6844,73.0479],["Rawalpindi","Pakistan",33.5651,73.0169],["Faisalabad","Pakistan",31.4504,73.135],
  ["Multan","Pakistan",30.1575,71.5249],["Peshawar","Pakistan",34.0151,71.5249],["Quetta","Pakistan",30.1798,66.975],
  ["Hyderabad","India",17.385,78.4867],["Hyderabad","Pakistan",25.396,68.3578],["Delhi","India",28.6139,77.209],
  ["Mumbai","India",19.076,72.8777],["Lucknow","India",26.8467,80.9462],["Kolkata","India",22.5726,88.3639],
  ["Chennai","India",13.0827,80.2707],["Bengaluru","India",12.9716,77.5946],["Ahmedabad","India",23.0225,72.5714],
  ["Srinagar","India",34.0837,74.7973],["Bhopal","India",23.2599,77.4126],["Dhaka","Bangladesh",23.8103,90.4125],
  ["Chittagong","Bangladesh",22.3569,91.7832],["Kabul","Afghanistan",34.5553,69.2075],["Kandahar","Afghanistan",31.6289,65.7372],
  ["Colombo","Sri Lanka",6.9271,79.8612],["Male","Maldives",4.1755,73.5093],["Kathmandu","Nepal",27.7172,85.324],
  ["Tashkent","Uzbekistan",41.2995,69.2401],["Samarkand","Uzbekistan",39.627,66.975],["Almaty","Kazakhstan",43.222,76.8512],
  ["Baku","Azerbaijan",40.4093,49.8671],["Kuala Lumpur","Malaysia",3.139,101.6869],["Singapore","Singapore",1.3521,103.8198],
  ["Jakarta","Indonesia",-6.2088,106.8456],["Surabaya","Indonesia",-7.2575,112.7521],["Bandung","Indonesia",-6.9175,107.6191],
  ["Manila","Philippines",14.5995,120.9842],["Bangkok","Thailand",13.7563,100.5018],["Bandar Seri Begawan","Brunei",4.9031,114.9398],
  ["London","United Kingdom",51.5074,-0.1278],["Birmingham","United Kingdom",52.4862,-1.8904],["Manchester","United Kingdom",53.4808,-2.2426],
  ["Bradford","United Kingdom",53.796,-1.7594],["Glasgow","United Kingdom",55.8642,-4.2518],["Paris","France",48.8566,2.3522],
  ["Marseille","France",43.2965,5.3698],["Berlin","Germany",52.52,13.405],["Frankfurt","Germany",50.1109,8.6821],
  ["Amsterdam","Netherlands",52.3676,4.9041],["Brussels","Belgium",50.8503,4.3517],["Madrid","Spain",40.4168,-3.7038],
  ["Rome","Italy",41.9028,12.4964],["Sarajevo","Bosnia and Herzegovina",43.8563,18.4131],["Tirana","Albania",41.3275,19.8187],
  ["Pristina","Kosovo",42.6629,21.1655],["Moscow","Russia",55.7558,37.6173],["Kazan","Russia",55.7887,49.1221],
  ["Stockholm","Sweden",59.3293,18.0686],["Oslo","Norway",59.9139,10.7522],["Copenhagen","Denmark",55.6761,12.5683],
  ["Dublin","Ireland",53.3498,-6.2603],["New York","United States",40.7128,-74.006],["Los Angeles","United States",34.0522,-118.2437],
  ["Chicago","United States",41.8781,-87.6298],["Houston","United States",29.7604,-95.3698],["Dallas","United States",32.7767,-96.797],
  ["Detroit","United States",42.3314,-83.0458],["Washington","United States",38.9072,-77.0369],["Atlanta","United States",33.749,-84.388],
  ["San Francisco","United States",37.7749,-122.4194],["Toronto","Canada",43.6532,-79.3832],["Montreal","Canada",45.5017,-73.5673],
  ["Vancouver","Canada",49.2827,-123.1207],["Calgary","Canada",51.0447,-114.0719],["Mexico City","Mexico",19.4326,-99.1332],
  ["Sao Paulo","Brazil",-23.5505,-46.6333],["Buenos Aires","Argentina",-34.6037,-58.3816],["Sydney","Australia",-33.8688,151.2093],
  ["Melbourne","Australia",-37.8136,144.9631],["Perth","Australia",-31.9505,115.8605],["Auckland","New Zealand",-36.8509,174.7645],
  ["Tokyo","Japan",35.6762,139.6503],["Seoul","South Korea",37.5665,126.978],["Beijing","China",39.9042,116.4074],
  ["Shanghai","China",31.2304,121.4737],["Hong Kong","Hong Kong",22.3193,114.1694],
];

const norm = s => (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’'`]/g, "").trim();

const LOCAL = RAW.map(([name, country, lat, lon]) => ({ name, region: "", country, lat, lon, label: `${name}, ${country}`, key: norm(name), ckey: norm(country) }));

export function cityLabel({ name, region, country }) {
  const parts = [name];
  if (region && region !== name) parts.push(region);
  if (country) parts.push(country);
  return parts.join(", ");
}

// Matches on the city name (prefix first, then word-start) and on "City, Country" typed in full.
export function localMatches(query, limit = 6) {
  const raw = (query || "").trim();
  if (!raw) return [];
  const [qa, qb = ""] = raw.split(",").map(norm);
  if (!qa) return [];
  const starts = [], words = [];
  for (const c of LOCAL) {
    if (qb && !c.ckey.startsWith(qb)) continue;
    if (c.key.startsWith(qa)) starts.push(c);
    else if (qa.length > 2 && c.key.split(/[\s-]+/).some(w => w.startsWith(qa))) words.push(c);
  }
  return [...starts, ...words].slice(0, limit);
}

const cache = new Map();

// Open-Meteo geocoder (free, no key). Resolves to [] on any failure.
export async function searchCities(query, { signal, limit = 8 } = {}) {
  const raw = (query || "").trim();
  if (raw.length < 2) return [];
  // "Hyderabad, India" → search the city part, then keep results whose country/region matches the rest
  const [namePart, ...restParts] = raw.split(",");
  const name = namePart.trim();
  const rest = norm(restParts.join(" "));
  const ck = `${norm(name)}|${rest}`;
  if (cache.has(ck)) return cache.get(ck);
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=${rest ? 20 : 10}&language=en&format=json`, { signal });
    const d = await r.json();
    let out = (d.results || [])
      .filter(x => x.latitude != null && x.longitude != null)
      .map(x => {
        const p = { name: x.name, region: x.admin1 || "", country: x.country || "", lat: x.latitude, lon: x.longitude };
        return { ...p, label: cityLabel(p) };
      });
    if (rest) {
      const f = out.filter(p => norm(p.country).startsWith(rest) || norm(p.region).startsWith(rest) || norm(p.country).includes(rest));
      if (f.length) out = f;
    }
    out = out.slice(0, limit);
    cache.set(ck, out);
    return out;
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    return [];
  }
}

// Best single match for free text (used by the Go button / Enter with nothing highlighted).
export async function resolveCity(query) {
  const local = localMatches(query, 1)[0];
  const remote = await searchCities(query, { limit: 1 }).catch(() => []);
  return local || remote[0] || null;
}

function dedupe(list) {
  const out = [];
  for (const p of list) {
    const dup = out.some(o => norm(o.name) === norm(p.name) && norm(o.country) === norm(p.country)
      && Math.abs(o.lat - p.lat) < 0.5 && Math.abs(o.lon - p.lon) < 0.5);
    if (!dup) out.push(p);
  }
  return out;
}

// Debounced suggestions: instant local hits first, then merged with live results.
export function useCitySuggestions(query, enabled = true) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const q = (query || "").trim();
    if (!enabled || q.length < 1) { setItems([]); setBusy(false); setDone(false); return; }
    const local = localMatches(q, 6);
    setItems(local); setDone(false);
    if (q.length < 2) { setBusy(false); return; }
    setBusy(true);
    const ac = new AbortController();
    const t = setTimeout(async () => {
      try {
        const remote = await searchCities(q, { signal: ac.signal });
        setItems(dedupe([...local, ...remote]).slice(0, 8));
        setDone(true); setBusy(false);
      } catch { /* aborted by a newer keystroke */ }
    }, 220);
    return () => { clearTimeout(t); ac.abort(); };
  }, [query, enabled]);
  return { items, busy, done };
}
