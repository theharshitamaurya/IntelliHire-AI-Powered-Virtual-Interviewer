const QUEUE_KEY = "analytics_queue_v1";
const DEVICE_KEY = "analytics_device_id_v1";
const SESSION_KEY = "analytics_session_id_v1";
const DEFAULT_ANALYTICS_ENDPOINT =
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api") +
  "/analytics/batch";

function safeJSONParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

function nowISO() {
  return new Date().toISOString();
}

function uuid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `id_${Date.now()}_${Math.random().toString(16).slice(2)}`
  );
}

function readQueue() {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(QUEUE_KEY);
  const q = safeJSONParse(raw, []);
  return Array.isArray(q) ? q : [];
}

function writeQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function getOrCreateDeviceId() {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const id = uuid();
  localStorage.setItem(DEVICE_KEY, id);
  return id;
}

export function getOrCreateSessionId() {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const id = uuid();
  localStorage.setItem(SESSION_KEY, id);
  return id;
}

export function track(eventName, props = {}) {
  if (typeof window === "undefined") return;

  const deviceId = getOrCreateDeviceId();
  const sessionId = getOrCreateSessionId();

  const evt = {
    name: String(eventName),
    ts: nowISO(),
    deviceId,
    sessionId,
    props,
    url: window.location.href,
    ref: document.referrer || null,
  };

  const queue = readQueue();
  queue.push(evt);

  const MAX = 2000;
  const trimmed = queue.length > MAX ? queue.slice(queue.length - MAX) : queue;
  writeQueue(trimmed);
}

async function postJSON(url, body, { keepalive = false } = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive,
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json().catch(() => ({}));
}

export async function flush({
  endpoint = DEFAULT_ANALYTICS_ENDPOINT,
  useBeacon = false,
} = {}) {
  if (typeof window === "undefined") return;

  const queue = readQueue();
  if (queue.length === 0) return;

  const payload = {
    deviceId: getOrCreateDeviceId(),
    sessionId: getOrCreateSessionId(),
    events: queue,
  };

  if (useBeacon && navigator.sendBeacon) {
    const ok = navigator.sendBeacon(
      endpoint,
      new Blob([JSON.stringify(payload)], { type: "application/json" }),
    );
    if (ok) {
      localStorage.removeItem(QUEUE_KEY);
      return;
    }
  }

  await postJSON(endpoint, payload, { keepalive: true });
  localStorage.removeItem(QUEUE_KEY);
}

export function installAutoFlush({
  endpoint = DEFAULT_ANALYTICS_ENDPOINT,
  intervalMs = 15000,
} = {}) {
  if (typeof window === "undefined") return () => {};

  const timer = window.setInterval(() => {
    flush({ endpoint }).catch(() => {});
  }, intervalMs);

  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      flush({ endpoint, useBeacon: true }).catch(() => {});
    }
  };

  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
