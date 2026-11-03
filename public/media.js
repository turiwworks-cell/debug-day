// Photos and videos on a task, kept in the person's own Google Drive.
// The planner only stores a small link to each file ({ id, name, mime, size });
// the file itself lives in a "Debug Day" folder in Drive. The app asks only for
// the drive.file permission, so it can see the files it made and nothing else.
// Every view reads the same block.media list, so Board, Plan and Lanes agree.

const DRIVE = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const FOLDER_NAME = "Debug Day";
const FOLDER_KEY = "debug-day:media-folder";
const LINKED_KEY = "debug-day:media-linked";
const TOKEN_KEY = "debug-day:media-token";
const MAX_ITEMS = 30;

function text(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function store(kind) {
  try {
    return kind === "session" ? sessionStorage : localStorage;
  } catch {
    return null;
  }
}
function readStore(kind, key) {
  try {
    return store(kind)?.getItem(key) || "";
  } catch {
    return "";
  }
}
function writeStore(kind, key, value) {
  try {
    if (value) store(kind)?.setItem(key, value);
    else store(kind)?.removeItem(key);
  } catch {}
}

const dim = (v) => (Number.isSafeInteger(v) && v > 0 && v <= 100000 ? v : 0);
// Keeps only well-formed links. Unknown or broken entries are dropped.
export function DDmediaList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set(),
    out = [];
  for (const raw of value) {
    const item = raw || {},
      id = text(item.id, 200);
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    const mime = text(item.mime, 100),
      size = Number(item.size);
    out.push({
      id,
      name: text(item.name, 200) || "file",
      mime: /^[\w.+-]+\/[\w.+-]+$/.test(mime) ? mime : "",
      size: Number.isSafeInteger(size) && size >= 0 ? size : 0,
      // A picture's own width and height in pixels, when known (photo cards on the Board).
      ...(dim(item.w) && dim(item.h) ? { w: dim(item.w), h: dim(item.h) } : {}),
    });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}
// How a photo note reads where only words fit (search, the Day review): its file name.
export function DDmediaTitle(note) {
  const first = DDmediaList(note?.media)[0];
  return first ? (first.mime.startsWith("video/") ? "🎬 " : first.mime.startsWith("image/") ? "🖼️ " : "📄 ") + first.name : "";
}
export function DDmediaKind(item) {
  const mime = item?.mime || "";
  return mime.startsWith("video/") ? "video" : mime.startsWith("image/") ? "image" : "file";
}
export function DDmediaViewUrl(item) {
  return "https://drive.google.com/file/d/" + encodeURIComponent(item.id) + "/view";
}
export function DDmediaSize(bytes, language) {
  const fa = language === "fa";
  if (!bytes) return "";
  const units = fa ? ["بایت", "ک.ب", "م.ب", "گ.ب"] : ["B", "KB", "MB", "GB"];
  let n = bytes,
    i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return (n >= 10 || i === 0 ? Math.round(n) : n.toFixed(1)) + " " + units[i];
}

// ---- Google Drive connection ----
let configPromise = null,
  gisPromise = null,
  tokenClient = null,
  token = null,
  tokenExpiry = 0;
const metaCache = new Map();

export function DDmediaConfig(fetcher = globalThis.fetch) {
  if (!configPromise)
    configPromise = Promise.resolve()
      .then(() => fetcher("/api/media-config"))
      .then((r) => (r && r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((c) => ({ clientId: text(c && c.googleClientId, 200) }));
  return configPromise;
}
function savedToken() {
  if (token && Date.now() < tokenExpiry - 60000) return token;
  try {
    const saved = JSON.parse(readStore("session", TOKEN_KEY) || "null");
    if (saved && typeof saved.token === "string" && Date.now() < saved.expiry - 60000) {
      token = saved.token;
      tokenExpiry = saved.expiry;
      return token;
    }
  } catch {}
  return null;
}
export function DDmediaConnected() {
  return !!savedToken();
}
function loadGis() {
  if (globalThis.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisPromise)
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        gisPromise = null;
        reject(Error("google-unreachable"));
      };
      document.head.appendChild(s);
    });
  return gisPromise;
}
// Must run from a click: Google opens a small window to confirm.
async function connect() {
  const existing = savedToken();
  if (existing) return existing;
  const { clientId } = await DDmediaConfig();
  if (!clientId) throw Error("not-set-up");
  await loadGis();
  return new Promise((resolve, reject) => {
    tokenClient = globalThis.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (r) => {
        if (!r || r.error || !r.access_token) return reject(Error(r?.error || "denied"));
        token = r.access_token;
        tokenExpiry = Date.now() + (Number(r.expires_in) || 3600) * 1000;
        writeStore("session", TOKEN_KEY, JSON.stringify({ token, expiry: tokenExpiry }));
        writeStore("local", LINKED_KEY, "1");
        resolve(token);
      },
      error_callback: (e) => reject(Error(e?.type || "denied")),
    });
    tokenClient.requestAccessToken({ prompt: readStore("local", LINKED_KEY) ? "" : "consent" });
  });
}
async function drive(url, options = {}) {
  const t = savedToken();
  if (!t) throw Error("not-connected");
  const r = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: "Bearer " + t },
  });
  if (r.status === 401) {
    token = null;
    writeStore("session", TOKEN_KEY, "");
    throw Error("not-connected");
  }
  if (!r.ok) throw Error("drive-" + r.status);
  return r;
}
async function folderId() {
  const saved = readStore("local", FOLDER_KEY);
  if (saved) {
    try {
      const r = await drive(DRIVE + "/" + encodeURIComponent(saved) + "?fields=id,trashed");
      const f = await r.json();
      if (f && f.id && !f.trashed) return f.id;
    } catch (e) {
      if (e.message === "not-connected") throw e;
    }
  }
  const q = encodeURIComponent(
    "name='" + FOLDER_NAME + "' and mimeType='application/vnd.google-apps.folder' and trashed=false",
  );
  const found = await (await drive(DRIVE + "?q=" + q + "&fields=files(id)&pageSize=1")).json();
  let id = found?.files?.[0]?.id;
  if (!id) {
    const made = await (
      await drive(DRIVE + "?fields=id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
      })
    ).json();
    id = made.id;
  }
  writeStore("local", FOLDER_KEY, id);
  return id;
}
// Resumable upload, so large videos work and progress can be shown.
async function upload(file, onProgress) {
  const parent = await folderId();
  const start = await drive(UPLOAD + "?uploadType=resumable&fields=id,name,mimeType,size", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": file.type || "application/octet-stream",
      "X-Upload-Content-Length": String(file.size),
    },
    body: JSON.stringify({ name: file.name, parents: [parent] }),
  });
  const session = start.headers.get("Location");
  if (!session) throw Error("drive-upload");
  const result = await new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", session);
    x.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    x.onload = () => {
      if (x.status >= 200 && x.status < 300) {
        try {
          resolve(JSON.parse(x.responseText));
        } catch {
          reject(Error("drive-upload"));
        }
      } else reject(Error("drive-" + x.status));
    };
    x.onerror = () => reject(Error("offline"));
    x.send(file);
  });
  return DDmediaList([
    { id: result.id, name: result.name || file.name, mime: result.mimeType || file.type, size: Number(result.size) || file.size },
  ])[0];
}
async function thumbnail(id, px = 320) {
  const key = id + "@" + px;
  if (metaCache.has(key)) return metaCache.get(key);
  const p = drive(DRIVE + "/" + encodeURIComponent(id) + "?fields=thumbnailLink")
    .then((r) => r.json())
    .then((m) => (m && typeof m.thumbnailLink === "string" ? m.thumbnailLink.replace(/=s\d+$/, "=s" + px) : ""))
    .catch(() => {
      metaCache.delete(key);
      return "";
    });
  metaCache.set(key, p);
  return p;
}
// For the Board's photo cards (board-photos.js): the same connection and upload.
export const DDmediaConnect = () => connect();
export const DDmediaUpload = (file, onProgress = () => {}) => upload(file, onProgress);
export const DDmediaThumb = (id, px) => thumbnail(id, px);
export const DDmediaMessage = (code, language) => message(code, language);

function message(code, language) {
  const fa = language === "fa";
  const m = {
    "not-set-up": fa
      ? "گوگل درایو هنوز وصل نشده. Client ID باید در تنظیمات Cloudflare گذاشته شود."
      : "Google Drive isn't set up yet. Add the Client ID in Cloudflare settings.",
    offline: fa ? "برای فرستادن عکس و ویدیو اینترنت لازم است." : "Sending photos and videos needs the internet.",
    "google-unreachable": fa ? "به گوگل وصل نشد. کمی بعد دوباره امتحان کن." : "Couldn't reach Google. Try again in a bit.",
    denied: fa ? "اجازهٔ درایو داده نشد." : "Drive permission wasn't given.",
    popup_closed: fa ? "پنجرهٔ گوگل بسته شد." : "The Google window was closed.",
  };
  return m[code] || (fa ? "فرستادن به درایو نشد. دوباره امتحان کن." : "Couldn't save to Drive. Try again.");
}

function MediaTile({ React: R, item, language, connected, disabled, onRemove }) {
  const h = R.createElement,
    fa = language === "fa",
    kind = DDmediaKind(item),
    [src, setSrc] = R.useState("");
  R.useEffect(() => {
    let live = true;
    setSrc("");
    if (connected && kind !== "file") thumbnail(item.id).then((s) => live && setSrc(s));
    return () => {
      live = false;
    };
  }, [item.id, connected]);
  const icon = kind === "video" ? "🎬" : kind === "image" ? "🖼️" : "📄";
  return h(
    "li",
    { className: "dd-media-tile", "data-kind": kind },
    h(
      "a",
      {
        href: DDmediaViewUrl(item),
        target: "_blank",
        rel: "noopener noreferrer",
        title: (fa ? "باز کردن در درایو: " : "Open in Drive: ") + item.name,
      },
      src
        ? h("img", { src, alt: item.name, loading: "lazy", referrerPolicy: "no-referrer", onError: () => setSrc("") })
        : h("span", { className: "dd-media-icon", "aria-hidden": true }, icon),
      kind === "video" && src ? h("span", { className: "dd-media-play", "aria-hidden": true }, "▶") : null,
      h("span", { className: "dd-media-name", dir: "auto" }, item.name),
    ),
    h(
      "button",
      {
        type: "button",
        disabled,
        className: "dd-media-remove",
        "aria-label": (fa ? "برداشتن از این کار (در درایو می‌ماند): " : "Remove from this task (stays in Drive): ") + item.name,
        title: fa ? "برداشتن از این کار؛ فایل در درایو می‌ماند" : "Remove from this task; the file stays in your Drive",
        onClick: onRemove,
      },
      "×",
    ),
  );
}

export function DDTaskMedia({ React: R, task, language, disabled = false, onChange }) {
  const h = R.createElement,
    fa = language === "fa",
    media = DDmediaList(task?.media),
    latest = R.useRef(media),
    input = R.useRef(null),
    [connected, setConnected] = R.useState(DDmediaConnected),
    [busy, setBusy] = R.useState(null),
    [note, setNote] = R.useState("");
  latest.current = media;
  R.useEffect(() => setNote(""), [task?.id]);
  const send = async (files) => {
    if (!files.length || disabled) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return setNote(message("offline", language));
    setNote("");
    try {
      await connect();
      setConnected(true);
      for (let i = 0; i < files.length; i++) {
        if (latest.current.length >= MAX_ITEMS) break;
        const file = files[i];
        setBusy({ name: file.name, at: i + 1, of: files.length, part: 0 });
        const item = await upload(file, (part) => setBusy({ name: file.name, at: i + 1, of: files.length, part }));
        if (item) {
          latest.current = DDmediaList([...latest.current, item]);
          onChange({ media: latest.current });
        }
      }
    } catch (e) {
      if (e.message === "not-connected") setConnected(false);
      setNote(message(e.message, language));
    } finally {
      setBusy(null);
    }
  };
  return h(
    "div",
    { className: "dd-task-media", role: "group", "aria-label": fa ? "عکس و ویدیو" : "Photos & videos" },
    media.length
      ? h(
          "ul",
          { className: "dd-media-list" },
          media.map((item) =>
            h(MediaTile, {
              key: item.id,
              React: R,
              item,
              language,
              connected,
              disabled: disabled || !!busy,
              onRemove: () => onChange({ media: latest.current.filter((m) => m.id !== item.id) }),
            }),
          ),
        )
      : null,
    h("input", {
      ref: input,
      type: "file",
      accept: "image/*,video/*",
      multiple: true,
      hidden: true,
      onChange: (e) => {
        const files = [...(e.target.files || [])];
        e.target.value = "";
        send(files);
      },
    }),
    h(
      "div",
      { className: "dd-media-actions" },
      h(
        "button",
        {
          type: "button",
          className: "btn",
          disabled: disabled || !!busy || media.length >= MAX_ITEMS,
          onClick: () => input.current && input.current.click(),
        },
        fa ? "＋ عکس یا ویدیو" : "＋ Photo or video",
      ),
      media.length && !connected && !busy
        ? h(
            "button",
            {
              type: "button",
              className: "dd-media-link",
              onClick: () =>
                connect()
                  .then(() => setConnected(true))
                  .catch((e) => setNote(message(e.message, language))),
            },
            fa ? "نمایش پیش‌نمایش‌ها" : "Show previews",
          )
        : null,
      h(
        "small",
        { className: "dd-media-help" },
        busy
          ? (fa ? "در حال فرستادن به درایو " : "Saving to Drive ") +
              (busy.of > 1 ? busy.at + "/" + busy.of + " · " : "") +
              Math.round(busy.part * 100) +
              "%"
          : note || (fa ? "در پوشهٔ «Debug Day» گوگل درایو خودت" : "Kept in a “Debug Day” folder in your Google Drive"),
      ),
    ),
  );
}

export const DDmediaStyles = `
.dd-task-media{display:grid;gap:6px;margin-top:8px}
.dd-media-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:6px}
.dd-media-tile{position:relative;border-radius:10px;overflow:hidden;background:var(--wash,rgba(127,127,127,.12))}
.dd-media-tile a{display:grid;place-items:center;aspect-ratio:1;color:inherit;text-decoration:none}
.dd-media-tile img{width:100%;height:100%;object-fit:cover;display:block}
.dd-media-icon{font-size:26px}
.dd-media-play{position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-size:20px;text-shadow:0 1px 4px rgba(0,0,0,.6);pointer-events:none}
.dd-media-name{position:absolute;inset:auto 0 0 0;padding:2px 6px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:rgba(0,0,0,.5);color:#fff}
.dd-media-remove{position:absolute;top:4px;inset-inline-end:4px;width:24px;height:24px;border-radius:12px;border:0;background:rgba(0,0,0,.55);color:#fff;cursor:pointer;line-height:1}
.dd-media-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.dd-media-link{border:0;background:none;color:inherit;text-decoration:underline;cursor:pointer;padding:0;font:inherit}
.dd-media-help{opacity:.75}
.dd-media-count{white-space:nowrap}
`;
export function DDinstallMediaStyles() {
  if (typeof document === "undefined" || document.getElementById("dd-media-styles")) return;
  const s = document.createElement("style");
  s.id = "dd-media-styles";
  s.textContent = DDmediaStyles;
  document.head.appendChild(s);
}
