// Read-only Are.na API adapter. Planner authentication is checked by worker.js.
// Fixed API paths and redirect:error prevent forwarding the token to other hosts.
import { DDarenaMedia } from "../public/arena.js";
const reply = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers },
});
export async function arenaRead(request, env, fetcher = fetch) {
  if (request.method !== "GET") return reply({ error: "Use GET" }, 405);
  const p = new URL(request.url).searchParams, op = p.get("op"), id = p.get("id") || "";
  const page = Number(p.get("page") || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) return reply({ error: "Invalid page" }, 400);
  let path;
  const query = new URLSearchParams({ per: "24", page: String(page) });
  if (op === "search") {
    const q = (p.get("query") || "").trim(), type = p.get("type") || "Image";
    if (!q || q.length > 500 || !["Image", "Channel"].includes(type)) return reply({ error: "Invalid search" }, 400);
    if (!env.ARENA_ACCESS_TOKEN) return reply({ error: "Are.na search is not configured" }, 503);
    path = "/v3/search"; query.set("query", q); query.set("type", type);
  } else if (op === "block" && /^[1-9]\d{0,15}$/.test(id)) path = "/v3/blocks/" + id;
  else if (op === "channel" && /^[\w-]{1,200}$/.test(id)) path = "/v3/channels/" + encodeURIComponent(id) + "/contents";
  else return reply({ error: "Invalid Are.na request" }, 400);
  try {
    const r = await fetcher("https://api.are.na" + path + "?" + query, {
      method: "GET", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { Accept: "application/json", ...(env.ARENA_ACCESS_TOKEN ? { Authorization: "Bearer " + env.ARENA_ACCESS_TOKEN } : {}) },
    });
    if (!r.ok) {
      const status = [401, 403, 404, 429].includes(r.status) ? r.status : 502;
      const retry = r.headers.get("Retry-After");
      return reply({ error: "Are.na request failed" }, status, retry && /^\d{1,6}$/.test(retry) ? { "Retry-After": retry } : {});
    }
    const data = await r.json(), rows = op === "block" ? [data.data || data] : data.data;
    if (!Array.isArray(rows)) return reply({ error: "Invalid Are.na response" }, 502);
    // Return only display metadata. No token, arbitrary HTML or image bytes.
    const out = rows.slice(0, 24).flatMap((b) => {
      const m = DDarenaMedia(b);
      if (m) return [{ id: b.id, type: "Image", title: m.name, image: { width: m.w, height: m.h, src: m.original, medium: { src: m.src } } }];
      if (b.base_type === "Channel" && Number.isSafeInteger(b.id) && /^[\w-]{1,200}$/.test(b.slug)) return [{ id: b.id, base_type: "Channel", slug: b.slug, title: String(b.title || b.slug).slice(0, 200) }];
      return [];
    });
    return reply({ data: out, meta: { has_more_pages: op !== "block" && data.meta?.has_more_pages === true } });
  } catch { return reply({ error: "Could not reach Are.na" }, 502); }
}
