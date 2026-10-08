/** Keep local previews on the local backend, including production static builds. */
export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL || "";
  if (typeof window === "undefined") return configured;
  const local = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const fallback = local && window.location.port.startsWith("300") ? "http://localhost:8000" : "";
  if (local && configured) {
    const host = new URL(configured, window.location.origin).hostname;
    if (!["localhost", "127.0.0.1"].includes(host)) return fallback;
  }
  return configured || fallback;
}
