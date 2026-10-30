import{DDstickySnap}from"./stickies.js";
// Pure board operations. View preferences stay on this device; object styles sync with the day.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;
const clone = (value) => structuredClone(value);
const id = () => crypto.randomUUID();
export const DDstickyColors = [
    "#FFFFFF",
    "#E6E6E6",
    "#B3EFBD",
    "#B3F4EF",
    "#A8DAFF",
    "#D3BDFF",
    "#FFA8DB",
    "#FFAFA3",
    "#FFD3A8",
    "#FFE299",
  ];
export const DDboardCore = {
  zoomSteps: [0.05, 0.1, 0.125, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8],
  stickyColors: DDstickyColors,
  colors: [
    "#1E1E1E",
    "#757575",
    "#B3B3B3",
    "#FFFFFF",
    "#66D575",
    "#5AD8CC",
    "#3DADFF",
    "#874FFF",
    "#F849C1",
    "#FF7556",
    "#FF9E42",
    "#FFC943",
  ],
  // Shortcuts follow the physical key, so Persian and other layouts work too.
  shortcutKey(event) {
    const key = String(event?.key || "");
    if (/^[\x20-\x7e]$/.test(key)) return key.toLowerCase();
    const code = String(event?.code || "");
    if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
    if (/^Digit\d$/.test(code)) return code.slice(5);
    if (key === "؟") return "?";
    return key.length === 1 ? key.toLowerCase() : key;
  },
  digits(value) {
    return String(value)
      .replace(/[۰-۹٠-٩]/g, (char) => String(char.charCodeAt(0) % 16))
      .replace(/[٫,]/g, ".");
  },
  zoom(value) {
    return clamp(finite(value, 1), 0.05, 8);
  },
  zoomStep(value, direction) {
    const levels = this.zoomSteps;
    return direction > 0
      ? (levels.find((n) => n > value + 0.0001) ?? 8)
      : ([...levels].reverse().find((n) => n < value - 0.0001) ?? 0.05);
  },
  zoomInput(value) {
    const text = this.digits(value).trim().replace(/[%٪]$/, "").trim();
    return /^\d+(?:\.\d+)?$/.test(text) ? this.zoom(+text / 100) : null;
  },
  zoomAt(camera, value, point) {
    const z = this.zoom(value),
      old = this.zoom(camera.z);
    return {
      x: point.x - ((point.x - camera.x) / old) * z,
      y: point.y - ((point.y - camera.y) / old) * z,
      z,
    };
  },
  bounds(nodes) {
    if (!nodes.length) return { x: 0, y: 0, w: 400, h: 300 };
    const x = Math.min(...nodes.map((n) => n.x)),
      y = Math.min(...nodes.map((n) => n.y));
    return {
      x,
      y,
      w: Math.max(...nodes.map((n) => n.x + n.w)) - x,
      h: Math.max(...nodes.map((n) => n.y + n.h)) - y,
    };
  },
  fit(nodes, width, height, options = {}) {
    const b = this.bounds(nodes),
      left = options.left ?? 40,
      right = options.right ?? 40,
      top = options.top ?? 42,
      bottom = options.bottom ?? 100,
      aw = Math.max(80, width - left - right),
      ah = Math.max(80, height - top - bottom),
      z = this.zoom(
        Math.min(
          options.maxZoom ?? 1.6,
          aw / Math.max(1, b.w),
          ah / Math.max(1, b.h),
        ),
      );
    return {
      x: left + (aw - b.w * z) / 2 - b.x * z,
      y: top + (ah - b.h * z) / 2 - b.y * z,
      z,
    };
  },
  color(value) {
    if (typeof value !== "string") return null;
    let hex = value.trim().replace(/^#/, "");
    if (/^[\da-f]{3,4}$/i.test(hex)) hex = [...hex].map((c) => c + c).join("");
    if (!/^(?:[\da-f]{6}|[\da-f]{8})$/i.test(hex)) return null;
    return {
      hex: "#" + hex.slice(0, 6).toUpperCase(),
      alpha: hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : undefined,
    };
  },
  rgb(hex) {
    const color = this.color(hex)?.hex || "#FFFFFF";
    return [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  },
  fromRGB(rgb) {
    return (
      "#" +
      rgb
        .map((n) =>
          clamp(Math.round(finite(n)), 0, 255)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")
        .toUpperCase()
    );
  },
  hsv(hex) {
    const [r, g, b] = this.rgb(hex).map((n) => n / 255),
      v = Math.max(r, g, b),
      d = v - Math.min(r, g, b);
    let h = !d
      ? 0
      : v === r
        ? ((g - b) / d) % 6
        : v === g
          ? (b - r) / d + 2
          : (r - g) / d + 4;
    return { h: (h * 60 + 360) % 360, s: v ? d / v : 0, v };
  },
  fromHSV({ h, s, v }) {
    h = ((finite(h) % 360) + 360) % 360;
    s = clamp(finite(s), 0, 1);
    v = clamp(finite(v), 0, 1);
    const c = v * s,
      x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
      m = v - c,
      channels =
        h < 60
          ? [c, x, 0]
          : h < 120
            ? [x, c, 0]
            : h < 180
              ? [0, c, x]
              : h < 240
                ? [0, x, c]
                : h < 300
                  ? [x, 0, c]
                  : [c, 0, x];
    return this.fromRGB(channels.map((n) => (n + m) * 255));
  },
  contrast(hex) {
    const [r, g, b] = this.rgb(hex).map((n) => {
      n /= 255;
      return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.36 ? "#1E1E1E" : "#FFFFFF";
  },
  rgba(hex, opacity = 1) {
    return (
      "rgba(" +
      this.rgb(hex).join(",") +
      "," +
      clamp(finite(opacity, 1), 0, 1) +
      ")"
    );
  },
  local(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
    } catch {
      return fallback;
    }
  },
  remember(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
  appearance() {
    const raw = this.local("debug-day:board-appearance", {}),
      p = raw && typeof raw === "object" ? raw : {};
    return {
      gridOpacity: clamp(finite(p.gridOpacity, 16), 0, 100),
      gridSize: clamp(finite(p.gridSize, 24), 8, 80),
      gridColor: this.color(p.gridColor)?.hex || "#9292A3",
      wheelZoom: !!p.wheelZoom,
      guides: p.guides !== false,
      rightDragPan: !!p.rightDragPan,
      stickyColor: this.color(p.stickyColor)?.hex || "#FFE299",
    };
  },
  recent(color) {
    const list = this.local("debug-day:board-colors", []);
    if (!color)
      return Array.isArray(list)
        ? list.filter((c) => this.color(c)).slice(0, 12)
        : [];
    const next = [color, ...this.recent().filter((c) => c !== color)].slice(
      0,
      12,
    );
    this.remember("debug-day:board-colors", next);
    return next;
  },
  style(raw = {}) {
    const p = raw && typeof raw === "object" ? raw : {},
      next = {};
    for (const key of ["fill", "textColor"])
      if (this.color(p[key])) next[key] = this.color(p[key]).hex;
    if (Number.isFinite(p.opacity)) next.opacity = clamp(p.opacity, 0, 1);
    if (Number.isFinite(p.width)) next.width = clamp(p.width, 64, 4000);
    if (Number.isFinite(p.height)) next.height = clamp(p.height, 64, 1800);
    // Scaled stickies carry their text with them, so allow small and large type.
    if (Number.isFinite(p.textSize)) next.textSize = clamp(p.textSize, 4, 400);
    if (["start", "center", "end"].includes(p.textAlign))
      next.textAlign = p.textAlign;
    return next;
  },
  styles(raw) {
    return Object.fromEntries(
      Object.entries(raw && typeof raw === "object" ? raw : {})
        .filter(([ref]) => typeof ref === "string" && ref.length < 200)
        .slice(0, 5000)
        .map(([ref, value]) => [ref, this.style(value)]),
    );
  },
  setStyle(day, nodes, patch) {
    patch = { ...patch };
    if (patch.fill !== null && Object.hasOwn(patch, "fill")) {
      const parsed = this.color(patch.fill);
      if (parsed) {
        patch.fill = parsed.hex;
        if (parsed.alpha !== undefined) patch.opacity = parsed.alpha;
      } else delete patch.fill;
    }
    let changed = false;
    const next = clone(day),
      board = next.canvas?.board4 || {},
      locked = new Set(board.locked || []),
      styles = { ...board.styles };
    const requestedPatch=patch;
    for (const node of nodes) {
      let patch={...requestedPatch};
      if (locked.has(node.id)) continue;
      if(node.kind === "sticky" && Number.isFinite(patch.width)) {
        const item=node.lifeId?next.__life?.items.find(i=>i.id===node.lifeId):next.notes.find(i=>i.id===node.noteId);
        patch.width=DDstickySnap(patch.width,item?.baseW||240);
      }
      if (node.lifeId && next.__life) {
        const it = next.__life.items.find((i) => i.id === node.lifeId);
        if (!it) continue;
        if (Object.hasOwn(patch,"fill")) it.color = patch.fill || "#FFE299";
        if (Number.isFinite(patch.width)) it.w = clamp(patch.width,64,20000);
        if (Number.isFinite(patch.height)) it.h = clamp(patch.height,64,20000);
        it.style = { ...it.style, ...this.style(patch) };
        delete it.style.fill; delete it.style.width; delete it.style.height;
        changed = true;
        continue;
      }
      const current = { ...styles[node.id] },
        value = { ...current };
      for (const [key, item] of Object.entries(patch)) {
        if (item === null) delete value[key];
        else value[key] = item;
      }
      const clean = this.style(value);
      if (JSON.stringify(current) !== JSON.stringify(clean)) {
        styles[node.id] = clean;
        changed = true;
      }
      if (Object.hasOwn(patch, "fill")) {
        const item = node.noteId
          ? next.notes.find((n) => n.id === node.noteId)
          : node.kind === "block"
            ? next.blocks.find((n) => n.id === node.blockId)
            : node.bugId
              ? next.bugs.find((n) => n.id === node.bugId)
              : null;
        if (item) {
          if (patch.fill === null) {
            if (node.noteId) item.color = "#FFE299";
            else delete item.color;
          } else item.color = patch.fill;
          styles[node.id] ||= {};
          delete styles[node.id].fill;
          changed = true;
        }
      }
    }
    if (!changed) return day;
    next.canvas = { ...next.canvas, board4: { ...board, styles } };
    return next;
  },
  place(day, nodes, positions, mode) {
    const next = clone(day),
      board = next.canvas?.board4 || {},
      layout = { ...board.layouts?.[mode] },
      locked = new Set(board.locked || []);
    let changed = false;
    for (const node of nodes) {
      const p = positions[node.id];
      if (
        !p ||
        node.memberOf ||
        locked.has(node.id) ||
        (node.x === p.x && node.y === p.y)
      )
        continue;
      const x = clamp(finite(p.x, node.x), -100000, 100000),
        y = clamp(finite(p.y, node.y), -100000, 100000);
      if (node.lifeId && next.__life) {
        if (nodes.some((n) => n.id === node.parentId)) continue;
        const it = next.__life.items.find((i) => i.id === node.lifeId);
        if (it) { it.x += x - node.x; it.y += y - node.y; changed = true; }
        continue;
      }
      if (node.noteId && mode !== "lanes") {
        const note = next.notes.find((n) => n.id === node.noteId);
        if (note) {
          note.x = x;
          note.y = y;
          changed = true;
        }
      } else {
        layout[node.id] = { x, y };
        changed = true;
      }
    }
    if (!changed) return day;
    next.canvas = {
      ...next.canvas,
      board4: { ...board, layouts: { ...board.layouts, [mode]: layout } },
    };
    return next;
  },
  arrange(nodes, operation) {
    if (nodes.length < 2) return {};
    const b = this.bounds(nodes),
      positions = {};
    if (operation === "distribute-x" || operation === "distribute-y") {
      if (nodes.length < 3) return {};
      const axis = operation.endsWith("x") ? "x" : "y",
        size = axis === "x" ? "w" : "h",
        sorted = [...nodes].sort((a, b) => a[axis] - b[axis]),
        start = sorted[0][axis],
        end = sorted.at(-1)[axis] + sorted.at(-1)[size],
        gap =
          (end - start - sorted.reduce((sum, n) => sum + n[size], 0)) /
          (nodes.length - 1);
      let cursor = start;
      for (const node of sorted) {
        positions[node.id] = { x: node.x, y: node.y, [axis]: cursor };
        cursor += node[size] + gap;
      }
      return positions;
    }
    for (const n of nodes) {
      let x = n.x,
        y = n.y;
      if (operation === "left") x = b.x;
      if (operation === "center-x") x = b.x + (b.w - n.w) / 2;
      if (operation === "right") x = b.x + b.w - n.w;
      if (operation === "top") y = b.y;
      if (operation === "center-y") y = b.y + (b.h - n.h) / 2;
      if (operation === "bottom") y = b.y + b.h - n.h;
      positions[n.id] = { x, y };
    }
    return positions;
  },
  guides(nodes, moving, starts, delta, zoom) {
    const selected = new Set(moving),
      a = nodes
        .filter((n) => selected.has(n.id))
        .map((n) => ({ ...n, ...starts[n.id] })),
      others = nodes.filter((n) => !selected.has(n.id) && n.kind !== "frame");
    if (!a.length) return { ...delta, lines: [] };
    const bounds = this.bounds(a),
      threshold = 5 / zoom;
    let dx = delta.x,
      dy = delta.y,
      bestX = threshold,
      bestY = threshold,
      lineX,
      lineY;
    for (const n of others) {
      for (const x of [n.x, n.x + n.w / 2, n.x + n.w])
        for (const own of [
          bounds.x,
          bounds.x + bounds.w / 2,
          bounds.x + bounds.w,
        ]) {
          const distance = x - own - delta.x;
          if (Math.abs(distance) < bestX) {
            bestX = Math.abs(distance);
            dx = delta.x + distance;
            lineX = {
              axis: "x",
              position: x,
              from: Math.min(bounds.y + delta.y, n.y) - 16,
              to: Math.max(bounds.y + delta.y + bounds.h, n.y + n.h) + 16,
            };
          }
        }
      for (const y of [n.y, n.y + n.h / 2, n.y + n.h])
        for (const own of [
          bounds.y,
          bounds.y + bounds.h / 2,
          bounds.y + bounds.h,
        ]) {
          const distance = y - own - delta.y;
          if (Math.abs(distance) < bestY) {
            bestY = Math.abs(distance);
            dy = delta.y + distance;
            lineY = {
              axis: "y",
              position: y,
              from: Math.min(bounds.x + delta.x, n.x) - 16,
              to: Math.max(bounds.x + delta.x + bounds.w, n.x + n.w) + 16,
            };
          }
        }
    }
    return { x: dx, y: dy, lines: [lineX, lineY].filter(Boolean) };
  },
  reorder(day, allIds, selected, direction) {
    const next = clone(day),
      board = next.canvas?.board4 || {},
      ids = [...new Set([...(board.stack || []), ...allIds])].filter((id) =>
        allIds.includes(id),
      ),
      chosen = new Set(selected);
    let order;
    if (direction === "front")
      order = [
        ...ids.filter((n) => !chosen.has(n)),
        ...ids.filter((n) => chosen.has(n)),
      ];
    else if (direction === "back")
      order = [
        ...ids.filter((n) => chosen.has(n)),
        ...ids.filter((n) => !chosen.has(n)),
      ];
    else {
      order = [...ids];
      const indices = order
        .map((id, i) => (chosen.has(id) ? i : -1))
        .filter((i) => i >= 0);
      if (direction === "forward") indices.reverse();
      for (const i of indices) {
        const j = i + (direction === "forward" ? 1 : -1);
        if (j >= 0 && j < order.length && !chosen.has(order[j]))
          [order[i], order[j]] = [order[j], order[i]];
      }
    }
    if (JSON.stringify(order) === JSON.stringify(board.stack || [])) return day;
    next.canvas = { ...next.canvas, board4: { ...board, stack: order } };
    return next;
  },
  cleanRefs(day, refs) {
    const board = day.canvas?.board4;
    if (!board) return;
    const gone = new Set(refs);
    board.links = (board.links || []).filter(
      (l) => !gone.has(l.from) && !gone.has(l.to),
    );
    for (const positions of Object.values(board.layouts || {}))
      for (const ref of refs) delete positions[ref];
    for (const field of ["styles", "overrides"])
      for (const [key, value] of Object.entries(board[field] || {}))
        if (
          gone.has(key) ||
          gone.has(value?.from) ||
          gone.has(value?.to) ||
          refs.some(
            (ref) => key.includes(ref + "->") || key.endsWith("->" + ref),
          )
        )
          delete board[field][key];
    for (const field of ["locked", "hidden", "stack"])
      if (Array.isArray(board[field]))
        board[field] = board[field].filter(
          (ref) =>
            !gone.has(ref) &&
            !refs.some(
              (id) => ref.includes(id + "->") || ref.endsWith("->" + id),
            ),
        );
    for (const [key, list] of Object.entries(board.groups || {})) {
      board.groups[key] = list.filter((ref) => !gone.has(ref));
      if (board.groups[key].length < 2) delete board.groups[key];
    }
  },
  remove(day, nodes) {
    const locked = new Set(day.canvas?.board4?.locked || []),
      items = nodes.filter((n) => !locked.has(n.id)),
      blocks = new Set(
        items.filter((n) => n.kind === "block").map((n) => n.blockId),
      ),
      notes = new Set(items.filter((n) => n.noteId).map((n) => n.noteId)),
      bugs = new Set(items.filter((n) => n.bugId).map((n) => n.bugId)),
      subtasks = items.filter((n) => n.kind === "subtask"),
      refs = new Set();
    const collect = (list, block) => {
      for (const sub of list || []) {
        refs.add("sub:" + block + ":" + sub.id);
        collect(sub.children, block);
      }
    };
    for (const block of day.blocks)
      if (blocks.has(block.id)) {
        refs.add("b:" + block.id);
        collect(block.subtasks, block.id);
      }
    const trim = (list, block) =>
      (list || [])
        .filter((sub) => {
          if (subtasks.some((n) => n.blockId === block && n.subId === sub.id)) {
            refs.add("sub:" + block + ":" + sub.id);
            collect(sub.children, block);
            return false;
          }
          return true;
        })
        .map((sub) => ({ ...sub, children: trim(sub.children, block) }));
    const next = clone(day);
    // A deleted section takes its contents with it (FigJam). Locked contents stay,
    // in place, under the nearest parent that is left.
    if (next.__life) for (const node of items.filter((n) => n.lifeId)) {
      const list = next.__life.items, gone = new Set([node.lifeId]);
      if (!list.some((i) => i.id === node.lifeId)) continue;
      for (let grew = true; grew; ) {
        grew = false;
        for (const i of list) if (!gone.has(i.id) && gone.has(i.parent) && !locked.has("life:" + i.id)) (gone.add(i.id), (grew = true));
      }
      const byId = new Map(list.map((i) => [i.id, i]));
      next.__life.items = list.filter((i) => !gone.has(i.id)).map((i) => {
        if (!gone.has(i.parent)) return i;
        let x = i.x, y = i.y, p = byId.get(i.parent), hops = 0;
        while (p && gone.has(p.id) && hops++ < 60) ((x += p.x), (y += p.y), (p = byId.get(p.parent)));
        return { ...i, parent: p ? p.id : "", x, y };
      });
      for (const id of gone) refs.add("life:" + id);
      next.__life.links = (next.__life.links || []).filter((l) => !refs.has(l.from) && !refs.has(l.to));
    }
    next.blocks = next.blocks
      .filter((b) => !blocks.has(b.id))
      .map((b) => ({ ...b, subtasks: trim(b.subtasks, b.id) }));
    next.notes = next.notes.filter((n) => !notes.has(n.id));
    next.bugs = next.bugs.filter((n) => !bugs.has(n.id));
    for (const n of items) if (n.noteId || n.bugId) refs.add(n.id);
    if (!refs.size) return day;
    this.cleanRefs(next, [...refs]);
    return next;
  },
  copy(day, nodes, edges, selected, mode = "mindmap") {
    if (day.__life) {
      const missing = day.__life.items.filter((i) => !nodes.some((n) => n.lifeId === i.id));
      nodes = [...nodes, ...missing.map((i) => {
        let x=i.x,y=i.y,p=i.parent,hops=0;
        while(p&&hops++<60){const parent=day.__life.items.find((k)=>k.id===p);if(!parent)break;x+=parent.x;y+=parent.y;p=parent.parent;}
        return {id:"life:"+i.id,lifeId:i.id,kind:i.type==="section"?"life-section":"sticky",parentId:i.parent?"life:"+i.parent:null,x:x+(day.__lifeFrame?.x||0),y:y+(day.__lifeFrame?.y||0)};
      })];
    }
    const chosen = new Set(selected),
      items = [],
      seen = new Set(),
      styles = day.canvas?.board4?.styles || {},
      skipChildren = (list, block) => {
        for (const sub of list || []) {
          seen.add("sub:" + block + ":" + sub.id);
          skipChildren(sub.children, block);
        }
      };
    // Expand section selections once, preserving relative hierarchy in the payload.
    let grew = true;
    while (grew) { grew = false; for (const n of nodes) if (n.lifeId && chosen.has(n.parentId) && !chosen.has(n.id)) { chosen.add(n.id); grew = true; } }
    for (const n of nodes.filter(
      (n) => chosen.has(n.id) && n.kind === "block",
    )) {
      const data = day.blocks.find((b) => b.id === n.blockId);
      if (!data) continue;
      skipChildren(data.subtasks, data.id);
      items.push({
        kind: "block",
        ref: n.id,
        data: clone(data),
        x: n.x,
        y: n.y,
        style: clone(styles[n.id] || {}),
      });
    }
    for (const n of nodes.filter(
      (n) => chosen.has(n.id) && n.kind !== "block",
    )) {
      if (seen.has(n.id)) continue;
      let ancestor = n.parentId;
      const ancestors = new Set();
      while (ancestor && !ancestors.has(ancestor)) {
        ancestors.add(ancestor);
        if (chosen.has(ancestor) && /^(b:|sub:)/.test(ancestor)) break;
        ancestor = nodes.find((item) => item.id === ancestor)?.parentId;
      }
      if (ancestor && chosen.has(ancestor)) continue;
      let data;
      if (n.lifeId) data = day.__life?.items.find((i) => i.id === n.lifeId);
      else if (n.noteId) data = day.notes.find((v) => v.id === n.noteId);
      else if (n.bugId) data = day.bugs.find((v) => v.id === n.bugId);
      else if (n.kind === "subtask") {
        const b = day.blocks.find((v) => v.id === n.blockId),
          find = (list) => {
            for (const sub of list || []) {
              if (sub.id === n.subId) return sub;
              const result = find(sub.children);
              if (result) return result;
            }
          };
        const sub = find(b?.subtasks);
        if (sub) {
          skipChildren(sub.children, b.id);
          data = {
            ...clone(b),
            name: sub.text,
            done: sub.done,
            subtasks: clone(sub.children || []),
          };
        }
      }
      if (data)
        items.push({
          kind: n.lifeId ? "life" : n.kind === "subtask" ? "block" : n.kind,
          ref: n.id,
          data: clone(data),
          x: n.x,
          y: n.y,
          style: clone(styles[n.id] || {}),
        });
    }
    if (!items.length) return null;
    const box = this.bounds(
        items.map((item) => ({ x: item.x, y: item.y, w: 1, h: 1 })),
      ),
      valid = new Set([...items.map((n) => n.ref), ...seen]);
    return {
      version: 1,
      items: items
        .slice(0, 500)
        .map((item) => ({ ...item, x: item.x - box.x, y: item.y - box.y })),
      links: edges
        .filter((l) => valid.has(l.from) && valid.has(l.to) && !l.automatic)
        .map((l) => clone(l)),
      text: items
        .map((item) => item.data.name || item.data.text || "")
        .join("\n"),
      styles: Object.fromEntries(
        Object.entries(styles).filter(([ref]) => valid.has(ref)),
      ),
      positions: Object.fromEntries(
        Object.entries({
          ...day.canvas?.board4?.layouts?.[mode],
          ...Object.fromEntries(nodes.map((n) => [n.id, { x: n.x, y: n.y }])),
        }).filter(([ref]) => valid.has(ref)),
      ),
      groups: Object.values(day.canvas?.board4?.groups || {}).filter(
        (refs) => Array.isArray(refs) && refs.every((ref) => valid.has(ref)),
      ),
      origin: { x: box.x, y: box.y },
    };
  },
  clipboard(value) {
    if (
      !value ||
      typeof value !== "object" ||
      value.version !== 1 ||
      !Array.isArray(value.items) ||
      !value.items.length ||
      value.items.length > 500
    )
      return null;
    let count = 0;
    const validSteps = (list, depth = 0) =>
      Array.isArray(list) &&
      depth < 30 &&
      list.every((sub) => {
        if (
          ++count > 5000 ||
          !sub ||
          typeof sub.id !== "string" ||
          typeof sub.text !== "string"
        )
          return false;
        return validSteps(sub.children || [], depth + 1);
      });
    if (
      value.links !== undefined &&
      (!Array.isArray(value.links) || value.links.length > 2000)
    )
      return null;
    if (
      (value.links || []).some(
        (link) =>
          !link ||
          typeof link.from !== "string" ||
          typeof link.to !== "string" ||
          (link.bend &&
            (!Number.isFinite(link.bend.x) || !Number.isFinite(link.bend.y))),
      )
    )
      return null;
    for (const item of value.items)
      if (
        !["block", "sticky", "emoji", "bug", "life"].includes(item.kind) ||
        !item.data ||
        typeof item.data !== "object" ||
        typeof item.ref !== "string" ||
        !/^(b:|sub:|sticky:|bug:|life:)[\w:-]+$/.test(item.ref) ||
        typeof item.data.id !== "string" ||
        (item.kind === "life" && (!["section","sticky"].includes(item.data.type) || !Number.isFinite(item.data.w) || !Number.isFinite(item.data.h) || item.data.w < 60 || item.data.h < 40 || item.data.w > 20000 || item.data.h > 20000)) ||
        (item.kind === "block"
          ? typeof item.data.name !== "string" ||
            !validSteps(item.data.subtasks || [])
          : typeof item.data.text !== "string") ||
        !Number.isFinite(item.x) ||
        !Number.isFinite(item.y)
      )
        return null;
    return value;
  },
  paste(day, payload, point, mode, newId = id) {
    payload = this.clipboard(payload);
    if (!payload) return { day, refs: [] };
    point = {
      x: clamp(finite(point?.x), -100000, 100000),
      y: clamp(finite(point?.y), -100000, 100000),
    };
    const next = clone(day),
      board = { ...next.canvas?.board4 },
      positions = { ...board.layouts?.[mode] },
      styles = { ...board.styles },
      mapping = Object.create(null),
      refs = [];
    const steps = (list, oldBlock, newBlock) =>
      (list || []).map((sub) => {
        const next = clone(sub);
        next.id = newId();
        mapping["sub:" + oldBlock + ":" + sub.id] =
          "sub:" + newBlock + ":" + next.id;
        next.children = steps(sub.children, oldBlock, newBlock);
        return next;
      });
    for (const item of payload.items) {
      const data = clone(item.data),
        newKey = newId();
      if (data.kind === "sticky" || data.type === "sticky") data.at = new Date().toLocaleDateString("en-CA");
      let ref;
      if (item.kind === "life" && next.__life) {
        data.id = newKey;
        data.x = point.x + item.x - (day.__lifeFrame?.x || 0);
        data.y = point.y + item.y - (day.__lifeFrame?.y || 0);
        next.__life.items.push(data);
        ref = "life:" + newKey;
      } else if (item.kind === "block") {
        const old = data.id;
        data.id = newKey;
        data.subtasks = steps(data.subtasks, old, newKey);
        delete data.bx;
        delete data.by;
        next.blocks.push(data);
        ref = "b:" + newKey;
        positions[ref] = { x: point.x + item.x, y: point.y + item.y };
      } else if (item.kind === "bug") {
        data.id = newKey;
        data.blockId = "";
        next.bugs.push(data);
        ref = "bug:" + newKey;
        positions[ref] = { x: point.x + item.x, y: point.y + item.y };
      } else {
        data.id = newKey;
        data.x = point.x + item.x;
        data.y = point.y + item.y;
        next.notes.push(data);
        ref = "sticky:" + newKey;
      }
      mapping[item.ref] = ref;
      styles[ref] = this.style(item.style);
      refs.push(ref);
    }
    if (next.__life) for (const item of payload.items.filter((i) => i.kind === "life")) {
      const made = next.__life.items.find((i) => "life:" + i.id === mapping[item.ref]);
      if (!made) continue;
      const parent = mapping["life:" + item.data.parent];
      if (parent) { made.parent = parent.slice(5); made.x = item.data.x; made.y = item.data.y; }
      else made.parent = "";
    }
    for (const [oldRef, newRef] of Object.entries(mapping))
      if (payload.styles?.[oldRef])
        styles[newRef] = this.style(payload.styles[oldRef]);
    for (const [oldRef, newRef] of Object.entries(mapping)) {
      const p = payload.positions?.[oldRef];
      if (
        p &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        !newRef.startsWith("sticky:")
      )
        positions[newRef] = {
          x: point.x + p.x - (payload.origin?.x || 0),
          y: point.y + p.y - (payload.origin?.y || 0),
        };
    }
    const groups = { ...board.groups };
    for (const group of Array.isArray(payload.groups) ? payload.groups : [])
      if (
        Array.isArray(group) &&
        group.length > 1 &&
        group.every((ref) => mapping[ref])
      )
        groups[newId()] = group.map((ref) => mapping[ref]);
    const links = [...(board.links || [])];
    for (const link of payload.links || [])
      if (mapping[link.from] && mapping[link.to]) {
        const nextLink = {
          ...clone(link),
          id: "link:" + newId(),
          from: mapping[link.from],
          to: mapping[link.to],
        };
        if (nextLink.bend)
          nextLink.bend = {
            x: point.x + nextLink.bend.x - (payload.origin?.x || 0),
            y: point.y + nextLink.bend.y - (payload.origin?.y || 0),
          };
        links.push(nextLink);
      }
    for (const item of payload.items)
      if (
        item.kind === "bug" &&
        item.data.blockId &&
        mapping["b:" + item.data.blockId]
      ) {
        const ref = mapping[item.ref],
          bug = next.bugs.find((b) => "bug:" + b.id === ref);
        bug.blockId = mapping["b:" + item.data.blockId].slice(2);
      }
    next.canvas = {
      ...next.canvas,
      board4: {
        ...board,
        styles,
        links,
        groups,
        layouts: { ...board.layouts, [mode]: positions },
        stack: [...(board.stack || []), ...refs],
      },
    };
    return { day: next, refs };
  },
};

