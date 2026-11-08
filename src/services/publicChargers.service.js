// src/services/publicChargers.service.js
// -----------------------------------------------------------------------------
//  Public EV charging points (jo hamare app ke nahi hain) — 2 jagah se:
//   1. OpenStreetMap (Overpass API)   → free, koi key nahi
//   2. Open Charge Map                → free, par OCM_API_KEY chahiye (.env)
//  Dono ka data ek format me laate hain, duplicate hatate hain, aur
//  30 minute cache karte hain (taaki baar baar API na maare).
// -----------------------------------------------------------------------------

const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const OCM_URL = "https://api.openchargemap.io/v3/poi/";
const USER_AGENT = "StayNearEV/1.0 (EV charging finder)";
const CACHE_TTL_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 15000;

const cache = new Map(); // key → { at, data }

// ---------- helpers ----------
const toRad = (d) => (d * Math.PI) / 180;
export const distanceKm = (aLat, aLng, bLat, bLng) => {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

const fetchWithTimeout = async (url, options = {}) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
};

const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
};

// OSM socket tag → readable naam
const OSM_SOCKETS = {
  type2: "Type 2",
  type2_combo: "CCS2",
  ccs: "CCS2",
  chademo: "CHAdeMO",
  type1: "Type 1",
  type1_combo: "CCS1",
  gb_t: "GB/T",
  "bharat_ac001": "Bharat AC001",
  "bharat_dc001": "Bharat DC001",
  schuko: "Schuko",
  "type3c": "Type 3C",
  tesla_supercharger: "Tesla",
  tesla_destination: "Tesla",
  "cee_blue": "CEE (blue)",
  "domestic": "Domestic plug",
};

// ---------- 1. OpenStreetMap ----------
const normalizeOsm = (el) => {
  const tags = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;

  const connectors = [];
  for (const [key, value] of Object.entries(tags)) {
    const m = key.match(/^socket:([a-z0-9_]+)$/i);
    if (!m) continue;
    const type = OSM_SOCKETS[m[1].toLowerCase()] || m[1].replace(/_/g, " ");
    const count = parseInt(value, 10);
    const power = num(tags[`socket:${m[1]}:output`]);
    connectors.push({
      type,
      quantity: Number.isFinite(count) && count > 0 ? count : null,
      powerKW: power,
    });
  }

  const addr = [tags["addr:housenumber"], tags["addr:street"], tags["addr:suburb"], tags["addr:city"]]
    .filter(Boolean)
    .join(", ");

  return {
    id: `osm:${el.type}/${el.id}`,
    source: "OpenStreetMap",
    name: tags.name || tags.brand || tags.operator || tags.network || "EV charging point",
    operator: tags.operator || tags.brand || tags.network || null,
    address: addr || null,
    latitude: lat,
    longitude: lng,
    connectors,
    maxPowerKW: connectors.reduce((m, c) => Math.max(m, c.powerKW || 0), 0) || null,
    capacity: num(tags.capacity),
    isOperational: tags.disused === "yes" ? false : null,
    openingHours: tags.opening_hours || null,
    fee: tags.fee || null,
    url: tags.website || null,
  };
};

const fetchOsm = async (lat, lng, radiusKm) => {
  const r = Math.round(radiusKm * 1000);
  const query = `[out:json][timeout:25];(node["amenity"="charging_station"](around:${r},${lat},${lng});way["amenity"="charging_station"](around:${r},${lat},${lng}););out center tags 300;`;

  let lastErr;
  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": USER_AGENT },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const data = await res.json();
      return (data.elements || []).map(normalizeOsm).filter(Boolean);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Overpass failed");
};

// ---------- 2. Open Charge Map ----------
const normalizeOcm = (p) => {
  const a = p.AddressInfo || {};
  if (a.Latitude == null || a.Longitude == null) return null;

  const connectors = (p.Connections || []).map((c) => ({
    type: c.ConnectionType?.Title || c.ConnectionType?.FormalName || "Unknown",
    quantity: c.Quantity || null,
    powerKW: c.PowerKW || null,
  }));

  const address = [a.AddressLine1, a.AddressLine2, a.Town, a.StateOrProvince].filter(Boolean).join(", ");
  const status = p.StatusType;

  return {
    id: `ocm:${p.ID}`,
    source: "Open Charge Map",
    name: a.Title || p.OperatorInfo?.Title || "EV charging point",
    operator: p.OperatorInfo?.Title && !/unknown/i.test(p.OperatorInfo.Title) ? p.OperatorInfo.Title : null,
    address: address || null,
    latitude: a.Latitude,
    longitude: a.Longitude,
    connectors,
    maxPowerKW: connectors.reduce((m, c) => Math.max(m, c.powerKW || 0), 0) || null,
    capacity: p.NumberOfPoints || null,
    isOperational: status ? status.IsOperational !== false : null,
    openingHours: a.AccessComments || null,
    fee: p.UsageCost || null,
    url: a.RelatedURL || null,
  };
};

const fetchOcm = async (lat, lng, radiusKm) => {
  const key = process.env.OCM_API_KEY;
  if (!key) return [];
  const params = new URLSearchParams({
    output: "json",
    latitude: String(lat),
    longitude: String(lng),
    distance: String(radiusKm),
    distanceunit: "KM",
    maxresults: "200",
    compact: "false",
    verbose: "false",
  });
  const res = await fetchWithTimeout(`${OCM_URL}?${params}`, {
    headers: { "X-API-Key": key, "user-agent": USER_AGENT, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Open Charge Map ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map(normalizeOcm).filter(Boolean);
};

// ---------- merge: 60m ke andar dono me same charger ho to ek hi rakho ----------
const mergeLists = (ocm, osm) => {
  const out = [...ocm];
  for (const o of osm) {
    const dup = out.find((x) => distanceKm(x.latitude, x.longitude, o.latitude, o.longitude) < 0.06);
    if (dup) {
      // OCM ke paas details zyada hoti hain; jo missing ho wo OSM se bhar do
      dup.operator ||= o.operator;
      dup.address ||= o.address;
      dup.openingHours ||= o.openingHours;
      if (!dup.connectors.length && o.connectors.length) {
        dup.connectors = o.connectors;
        dup.maxPowerKW ||= o.maxPowerKW;
      }
      dup.sources = Array.from(new Set([...(dup.sources || [dup.source]), o.source]));
      continue;
    }
    out.push(o);
  }
  return out;
};

// ---------- main ----------
export const findPublicChargers = async ({ lat, lng, radiusKm }) => {
  // ~1km grid par cache — paas paas ki searches same cache use karein
  const key = `${lat.toFixed(2)},${lng.toFixed(2)},${radiusKm}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return { ...hit.data, cached: true };

  const [osmRes, ocmRes] = await Promise.allSettled([
    fetchOsm(lat, lng, radiusKm),
    fetchOcm(lat, lng, radiusKm),
  ]);

  const osm = osmRes.status === "fulfilled" ? osmRes.value : [];
  const ocm = ocmRes.status === "fulfilled" ? ocmRes.value : [];
  const errors = [];
  if (osmRes.status === "rejected") errors.push(`OpenStreetMap: ${osmRes.reason?.message}`);
  if (ocmRes.status === "rejected") errors.push(`Open Charge Map: ${ocmRes.reason?.message}`);
  if (errors.length) console.warn("⚠️ Public chargers:", errors.join(" | "));

  const chargers = mergeLists(ocm, osm)
    .map((c) => ({ ...c, distanceKm: Math.round(distanceKm(lat, lng, c.latitude, c.longitude) * 100) / 100 }))
    .filter((c) => c.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const data = {
    chargers,
    sources: {
      openStreetMap: osmRes.status === "fulfilled" ? osm.length : "error",
      openChargeMap: !process.env.OCM_API_KEY ? "no key" : ocmRes.status === "fulfilled" ? ocm.length : "error",
    },
  };

  // Kam se kam ek asli source chala ho tabhi cache karo
  // (OCM ki key hi na ho to uska "khaali" result gina nahi jaata)
  const ocmWorked = ocmRes.status === "fulfilled" && Boolean(process.env.OCM_API_KEY);
  if (osmRes.status === "fulfilled" || ocmWorked) {
    cache.set(key, { at: Date.now(), data });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
  } else {
    const err = new Error("Could not load public chargers right now");
    err.status = 502;
    throw err;
  }

  return { ...data, cached: false };
};
