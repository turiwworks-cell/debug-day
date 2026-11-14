// Where every card on the Board sits, worked out from the day, the Feed and
// the saved places, and nothing else: it reads and never writes. The Board keeps
// the result in a memo and draws it. Moved out of board.js as it was (5.46.6),
// so the short names still come from the old bundle.
import { DDlifeBounds, DDlifeHead, DDlifeItems, DDlifeAbs, DDlifeVisible, DDlifeColor, DDlifeDescendants, DDlifeInFrame, DDlifeShown, DDsectionTint } from "./life-board.js";
import { DDstickyHeight } from "./stickies.js";
import { DDshapeClear, DDshapeHeight } from "./shapes.js";
import { DDdocSize } from "./documents.js";
import { DDtodoParse } from "./todos.js";
import { DDnotePhoto, DDphotoHeight } from "./board-photos.js";
import { DDenergyOf, DDenergyLabel } from "./energy.js";
import { DDflowEdges } from "./flow.js";
import { DDtaskLook } from "./task-look.js";
const life = { DDlifeBounds, DDlifeHead, DDlifeItems };

// Where the Engine was moved to. A new day starts where the last day left it.
export function DDengineShift(saved, allDays, today) {
  const ok = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y),
    pick = (p) => ({ x: p.x, y: p.y, ...(p.w > 0 ? { w: p.w } : {}), ...(p.h > 0 ? { h: p.h } : {}) });
  if (ok(saved?.["section:engine"])) return pick(saved["section:engine"]);
  const last = Object.entries(allDays || {})
    .filter(([date]) => date < today)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([, d]) => d.canvas?.board4?.layouts?.mindmap?.["section:engine"])
    .find(ok);
  return last ? pick(last) : { x: 0, y: 0 };
}

// Does a day note sit on the Engine (judged by the middle of a default note)?
// Those notes are the Engine's and show on every section's board too (5.53).
export function DDnoteOnEngine(engine, note) {
  if (!engine || !note) return false;
  const x = (Number.isFinite(note.x) ? note.x : 40) + 120, y = (Number.isFinite(note.y) ? note.y : 40) + 80;
  return x >= engine.x && x <= engine.x + engine.w && y >= engine.y && y <= engine.y + engine.h;
}
export function DDcreateBoardLayout(deps) {
  const { DDUI, DDbugColor, E, de, ee, ie, w, core, playful } = deps, measure = deps.measure;
  let stepTextContext;
  return function DDboardLayout({ day, allDays, setup, model, mode, tidy = false, room, ddNodeMatches, visibleKey, stickyHeights, language: DDlanguage }) {
    const t = (en, fa) => (DDlanguage === "fa" ? fa : en),
      finite = (Y, G = 0) =>
        Number.isFinite(Y) ? Math.max(-1e5, Math.min(1e5, Y)) : G,
      lifeItems = DDlifeItems(setup),
      laneIds = setup.lanes.map((Y) => Y.id),
      isScheduled = (Y) => laneIds.includes(Y.lane);
    // Steps wrap instead of hiding words, so their card grows with the text.
    const stepHeight = (text) => {
        // Word wrapping depends on the installed font, not just character count.
        stepTextContext ||= document.createElement("canvas").getContext("2d");
        if (!stepTextContext)
          return Math.min(150, 40 + 17 * Math.max(1, Math.ceil(String(text || "").length / 24)));
        const family = getComputedStyle(document.documentElement).getPropertyValue("--sans").trim()
          || getComputedStyle(document.body).fontFamily;
        stepTextContext.font = "550 12.5px " + family;
        let lines = 1, line = "";
        for (const word of String(text || "").split(/\s+/)) {
          const candidate = line ? line + " " + word : word;
          if (stepTextContext.measureText(candidate).width <= 204) {
            line = candidate;
            continue;
          }
          if (line) { lines++; line = ""; }
          for (const letter of word) {
            if (line && stepTextContext.measureText(line + letter).width > 204) {
              lines++; line = "";
            }
            line += letter;
          }
          if (lines >= 6) break;
        }
        return Math.min(150, 40 + 17 * lines);
      },
      stepLabel = (index, total, children) =>
        t("Step ", "قدم ") +
        (index + 1) +
        "/" +
        total +
        (children?.length
          ? " · " +
            children.filter((c) => c.done).length +
            "/" +
            children.length +
            t(" inside", " داخل")
          : "");
    // The Engine has its own section around today's tree, apart from Life. It
    // grows and shrinks with what is in it, and a note dropped inside becomes a task.
    function engineFrame(Y, size = {}) {
      const tree = Y.filter((n) => ["day", "lane", "block", "subtask", "bug"].includes(n.kind) && !n.lifeId);
      if (!tree.length || ddNodeMatches) return;
      const PAD = 48, HEAD = 24,
        x = Math.min(...tree.map((n) => n.x)) - PAD,
        y = Math.min(...tree.map((n) => n.y)) - PAD - HEAD,
        right = Math.max(...tree.map((n) => n.x + n.w)) + PAD,
        bottom = Math.max(...tree.map((n) => n.y + n.h)) + PAD,
        // It never gets smaller than today's tree; a size set by hand makes it roomier.
        autoW = Math.max(480, right - x),
        autoH = Math.max(240, bottom - y);
      Y.unshift({
        id: "section:engine",
        kind: "frame",
        section: "engine",
        title: t("Engine", "انجین"),
        subtitle: ie.format(E(day.date)),
        color: "#F05A28",
        textColor: "#fff",
        x,
        y,
        w: Math.max(autoW, size.w || 0),
        h: Math.max(autoH, size.h || 0),
        autoW,
        autoH,
      });
    }
    const engineShift = (saved) => DDengineShift(saved, allDays, day.date);
    function lifeFrame(Y) {
      if (ddNodeMatches) return;
      const b = life.DDlifeBounds(life.DDlifeItems(setup)),
        legacy = Object.entries(allDays || {}).sort(([a],[b])=>a.localeCompare(b)).map(([,d])=>d.canvas?.board4?.layouts?.mindmap?.["section:life"] || d.canvas?.board4?.layouts?.lanes?.["section:life"]).find((p)=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)),
        saved = { x: legacy?.x ?? 2400, y: legacy?.y ?? 80, ...setup.life?.frame },
        node = {
          id: "section:life",
          kind: "frame",
          section: "life",
          title: t("Feed", "فید"),
          subtitle: "",
          color: "#4A4843",
          textColor: "#fff",
          x: finite(saved?.x, 24),
          y: finite(saved?.y, 1200),
          w: Math.max(b.w, saved?.w || 0),
          h: Math.max(life.DDlifeHead + b.h, saved?.h || 0),
          autoW: b.w,
          autoH: life.DDlifeHead + b.h,
        };
      Y.push(node);
    }
    const Y = [],
      G = [],
      ct = model.layouts[mode] || {},
      St = new Set(visibleKey.split("|")),
      // Today's tree in the Engine starts where the Engine was moved to.
      shift = { x: 0, y: 0 },
      // Lanes (5.68) is this same tree, always tidy: tasks, steps and lanes
      // ignore where they were dragged to and sit close together.
      treeRef = (Jt) => /^(day:|lane:|b:|sub:)/.test(Jt),
      Tt = (Jt, Xn, On) => tidy && treeRef(Jt) ? { x: Xn + shift.x, y: On + shift.y } : ({
        x: finite(ct[Jt]?.x, Xn + shift.x),
        y: finite(ct[Jt]?.y, On + shift.y),
      }),
      gap = tidy ? { step: 8, card: 72, lane: 14, empty: 72 } : { step: 14, card: 82, lane: 30, empty: 84 },
      col = tidy ? { lane: 236, card: 384, step: 680, depth: 284 } : { lane: 252, card: 410, step: 720, depth: 296 },
      Pt = (Jt) => (Y.push({ ...Jt, ...Tt(Jt.id, Jt.x, Jt.y) }), Y.at(-1)),
      yn = (Jt, Xn, On, ra = !1) =>
        G.push({
          id: `auto:${Jt}->${Xn}`,
          from: Jt,
          to: Xn,
          color: On,
          dashed: ra,
          automatic: !0,
          style: "curve",
          // Tree lines stay thin so the order lines (and lines you draw) read first.
          width: 2,
        });
    if (mode === "mindmap") {
      let Jt = 56;
      Object.assign(shift, engineShift(ct));
      Pt({
        id: "day:root",
        kind: "day",
        title: t("Engine", "انجین") + " · " + ie.format(E(day.date)),
        subtitle:
          day.focus ||
          DDUI(
            "\u0628\u0631\u0646\u0627\u0645\u0647 \u0627\u0645\u0631\u0648\u0632",
          ),
        emoji: day.mood,
        color: "#121211",
        textColor: "#fff",
        x: 24,
        y: 220,
        w: 184,
        h: 70,
      });
      const On = (ma, Oa, fa, Pl, kl) => {
          (ma || []).forEach((Fn, index, list) => {
            const Ga = Jt,
              Xa = `sub:${fa.id}:${Fn.id}`,
              stepH = stepHeight(Fn.text);
            Fn.expanded !== !1 && Fn.children?.length
              ? On(Fn.children, Xa, fa, Pl + 1, kl)
              : (Jt += stepH + gap.step);
            Pt({
              id: Xa,
              kind: "subtask",
              title: Fn.text,
              subtitle: stepLabel(index, list.length, Fn.children),
              done: Fn.done,
              color: kl,
              textColor: ee(kl),
              blockId: fa.id,
              subId: Fn.id,
              parentId: Oa,
              x: col.step + (Pl - 1) * col.depth,
              y: (Ga + Math.max(Ga + stepH, Jt - gap.step)) / 2 - stepH / 2,
              w: 258,
              h: stepH,
              hasChildren: !!Fn.children?.length,
              expanded: Fn.expanded !== !1,
            });
            yn(Oa, Xa, kl);
          });
        },
        ra = [
          ...setup.lanes,
          ...(day.blocks.some((ma) => !isScheduled(ma))
            ? [{ id: "", name: "Parked" }]
            : []),
        ];
      for (const ma of ra) {
        const Oa = `lane:${ma.id || "parked"}`,
          fa = Jt,
          Pl = day.blocks.filter((Fn) =>
            ma.id ? Fn.lane === ma.id : !isScheduled(Fn),
          );
        for (const Fn of Pl) {
          if (!St.has(Fn.id)) continue;
          const Ga = Jt,
            Xa = `b:${Fn.id}`,
            Dl = DDtaskLook(Fn, setup, lifeItems);
          Fn.expanded !== !1 && Fn.subtasks?.length
            ? On(Fn.subtasks, Xa, Fn, 1, Dl.color)
            : (Jt += gap.card);
          const Pa = de(Fn.subtasks || []);
          (Pt({
            id: Xa,
            kind: "block",
            title: Fn.name || DDUI("Untitled"),
            subtitle:
              // The section tag on the card says where it belongs (5.54).
              measure.DDmeasureText(Fn, DDlanguage, w) +
              (Pa.total
                ? ` \xB7 ${Pa.done}/${Pa.total} ${t("steps", "\u0642\u062F\u0645")}`
                : "") +
              (DDenergyOf(Fn) ? " \xB7 " + DDenergyLabel(DDenergyOf(Fn), DDlanguage) : ""),
            min: measure.DDmeasureOf(Fn) === "time" ? Fn.min : 0,
            done: Fn.done,
            emoji: Fn.emo || Dl.emo,
            icon: Dl.icon,
            color: Dl.color,
            textColor: ee(Dl.color),
            blockId: Fn.id,
            laneId: Fn.lane,
            parentId: Oa,
            pri: Fn.pri,
            tags: Fn.tags,
            from: Fn.from,
            hasChildren: !!Fn.subtasks?.length,
            expanded: Fn.expanded !== !1,
            x: col.card,
            y: (Ga + Math.max(Ga + 64, Jt - gap.card + 64)) / 2 - 32,
            w: 264,
            h: 64,
          }),
            yn(Oa, Xa, Dl.color));
        }
        Jt === fa && (Jt += gap.empty);
        Pt({
          id: Oa,
          kind: "lane",
          title: ma.name || DDUI("Parked"),
          subtitle: w(Pl.reduce((Fn, Ga) => Fn + measure.DDplanMinutes(Ga), 0)),
          laneId: ma.id,
          parentId: "day:root",
          color: "#4A4843",
          textColor: "#fff",
          x: col.lane,
          y: (fa + Jt) / 2 - 27,
          w: 126,
          h: 54,
        });
        (yn("day:root", Oa, "#85827A"), (Jt += gap.lane));
      }
      // Order lines (5.51): dashed arrows from what comes first to what follows,
      // read from `after` on tasks and steps. Steps folded away show no line.
      for (const { from, to } of DDflowEdges(day))
        G.push({ id: `auto:after:${from}->${to}`, from, to, color: "var(--dd-order,#E0602F)", dashed: !0, arrow: !0, automatic: !0, after: !0, style: "curve" });
      (tidy || !ct["day:root"]) && (Y[0].y = Math.max(60, Jt / 2 - 35) + shift.y);
      engineFrame(Y, shift);
      Object.assign(shift, { x: 0, y: 0, w: 0, h: 0 });
    }
    if (mode === "mindmap") lifeFrame(Y);
    // A section's own board: only that section and what is inside it, placed
    // beside today's Engine. Same data as the main board, nothing is copied.
    const lf = Y.find((n) => n.section === "life"), items = DDlifeItems(setup),
      roomItem = mode === "mindmap" && lf && room && !ddNodeMatches ? items.find((i) => i.id === room && i.type === "section") : null,
      roomSet = roomItem ? DDlifeDescendants(items, roomItem.id) : null,
      roomVisible = (it) => {
        let p = it.id === roomItem.id ? "" : it.parent, hops = 0;
        while (p && hops++ < 60) {
          const s = items.find((i) => i.id === p);
          if (!s || s.collapsed) return false;
          if (p === roomItem.id) return true;
          p = s.parent;
        }
        return true;
      };
    // How deep a section sits (itself and every section around it). One walk up
    // the parents, instead of searching every section's insides for each one.
    const byId = new Map(items.map((i) => [i.id, i])),
      ddNestDepth = (id) => { const seen = new Set(); let cur = byId.get(id); while (cur && !seen.has(cur.id)) { seen.add(cur.id); cur = cur.parent ? byId.get(cur.parent) : null; } return seen.size; };
    let roomShift = null;
    if (roomItem) {
      // Beside the Engine on a wide screen, under it on a phone.
      const engineArea = Y.find((n) => n.section === "engine"), a = DDlifeAbs(items, roomItem.id),
        narrow = globalThis.matchMedia?.("(max-width: 700px)").matches, was = { x: lf.x, y: lf.y };
      lf.x = (engineArea ? (narrow ? engineArea.x : engineArea.x + engineArea.w + 160) : 60) - a.x;
      lf.y = (engineArea ? (narrow ? engineArea.y + engineArea.h + 160 : engineArea.y) : 60) - DDlifeHead - a.y;
      // Lines between Feed things keep their shape here: their bends move with them.
      roomShift = { x: lf.x - was.x, y: lf.y - was.y };
      for (let i = Y.length - 1; i >= 0; i--)
        if (Y[i] === lf || ["habits", "feelings", "notes"].includes(Y[i].section || Y[i].sectionId)) Y.splice(i, 1);
    }
    // Notes on the Engine are the Engine's: they stay there in every section's
    // board too (5.53). Other day notes belong to the main board.
    const engineBox = roomItem ? Y.find((n) => n.section === "engine") : null,
      onEngine = (n) => DDnoteOnEngine(engineBox, n);
    for (const Jt of (day.notes || []).filter(
      (n) =>
        n.kind !== "emoji" &&
        (!roomItem || onEngine(n)) &&
        (!ddNodeMatches ||
          ddNodeMatches.has("note:" + day.date + ":" + n.id)),
    ))
      Y.push({
        id: `sticky:${Jt.id}`,
        noteId: Jt.id,
        kind: Jt.kind === "emoji" ? "emoji" : "sticky",
        title: Jt.kind === "emoji" ? playful.label(Jt.text) : Jt.text || "",
        symbol: Jt.kind === "emoji" ? Jt.text : undefined,
        color: Jt.color || "#FFE27A",
        textColor: "#121211",
        x: finite(Jt.x, 40),
        y: finite(Jt.y, 40),
        at: Jt.at || day.date, baseW:Jt.baseW || 240, syncId: Jt.syncId || undefined, due: Jt.due || undefined, cameFrom: Jt.kind !== "emoji" && Jt.from || undefined,
        w: Jt.kind === "emoji" ? 64 : 240,
        h: Jt.kind === "emoji" ? 64 : 160,
      });
    // A section's own board shows everything in it; any other board shows only
    // what sits inside each frame (search shows every match).
    if (lf) for (const it of items.filter((i) => roomItem ? roomSet.has(i.id) && roomVisible(i) && DDlifeShown(items, i, roomItem.id) : DDlifeVisible(items, i) && (ddNodeMatches || DDlifeShown(items, i)))) {
      const a = DDlifeAbs(items, it.id), color = it.type === "section" ? DDsectionTint(items, it.id).fill : DDlifeColor(items, it);
      Y.push({ id: "life:" + it.id, lifeId: it.id, lifeSection: it.type === "section", kind: it.type === "section" ? "life-section" : "sticky", room: roomItem?.id === it.id || undefined, boardOnly: (roomItem && it.parent === roomItem.id && !DDlifeInFrame(items, it)) || undefined,
        title: it.text || (it.type === "section" ? t("Section","سکشن") : ""), color, textColor: it.style?.plain || DDshapeClear(it.style) ? "var(--ink)" : core.contrast(color), ownColor: (it.type === "section" && !!it.parent && !!it.ownColor && !!it.color) || undefined, collapsed: it.collapsed, parentId: it.parent ? "life:" + it.parent : null,
        x: lf.x + a.x, y: lf.y + DDlifeHead + a.y, w: it.w, h: it.collapsed ? 38 : it.h,
        at: it.at, baseW:it.baseW || 240, syncId: it.syncId || undefined, due: it.due || undefined,
        ...it.style, opacity: it.style?.opacity ?? 1, stack: it.type === "section" ? 2 + ddNestDepth(it.id) : 20 });
    }
    for (const n of Y) {
      if (n.lifeId) continue;
      const style = model.styles[n.id] || {};
      Object.assign(n, style, {
        opacity: style.opacity ?? 1,
        locked: model.locked.includes(n.id),
      });
      if (style.fill) {
        n.color = style.fill;
        n.textColor = core.contrast(style.fill);
      }
      if (n.kind === "sticky" || n.kind === "frame") n.textColor = core.contrast(n.color);
      if (style.textColor) n.textColor = style.textColor;
      // A text object has no paper, so its words take the board's ink.
      else if (n.plain || DDshapeClear(style)) n.textColor = "var(--ink)";
      if (n.noteId && !n.memberOf) {
        n.w = style.width ?? n.w;
        n.h = style.height ?? n.h;
      }
      n.stack = 15 + Math.max(0, model.stack.indexOf(n.id) + 1);
    }
    // A photo note is as tall as its picture plus its caption (5.38).
    const photoOf = new Map();
    for (const x of day.notes || []) { const ph = DDnotePhoto(x); if (ph) photoOf.set("sticky:" + x.id, ph); }
    for (const x of items) { const ph = x.type === "sticky" && DDnotePhoto(x); if (ph) photoOf.set("life:" + x.id, ph); }
    for(const n of Y) if(n.kind === "sticky") {
      if (photoOf.has(n.id)) { n.photo = photoOf.get(n.id); n.h = DDphotoHeight(n.w, n.photo, n.title); continue; }
      const measured=stickyHeights.current.get(n.id);
      const fresh=measured && measured.w===n.w && measured.text===n.title && measured.size===(n.textSize||16);
      // A shape keeps the size you gave it and grows taller only while its words need it (FigJam).
      if (n.shape) { n.h = DDshapeHeight(n.shape, n.h, fresh ? measured.h : 0); continue; }
      // A document keeps the size of its card; as an icon it is always the same size (5.63).
      if (n.doc) { if (n.docView === "icon") { n.w = DDdocSize.icon.width; n.h = DDdocSize.icon.height; } continue; }
      // A to-do list is as tall as its tasks (5.65).
      if (n.todo) { const p = DDtodoParse(n.title); n.h = Math.max(56, fresh ? measured.h : (p.items.length || 1) * 27 + (p.title !== null ? 30 : 0) + 24); continue; }
      // A text object hugs its words (5.61): its width is the most it may take,
      // and its box is only as wide and as tall as the words in it.
      if (n.plain) {
        n.fitMax = n.w;
        if (n.fixed) { n.h = Math.max(20, fresh ? measured.h : n.title.split("\n").length * (n.textSize || 16) * 1.4 + 6); continue; }
        if (fresh && measured.cw > 0) n.w = Math.max(24, Math.min(n.w, measured.cw));
        n.h = Math.max(20, fresh ? measured.h : n.title.split("\n").length * (n.textSize || 16) * 1.4 + 6);
        continue;
      }
      // A text object is as tall as its words; a note stays at least square.
      n.h=n.plain ? Math.max(32, fresh ? measured.h : n.title.split("\n").length*(n.textSize||16)*1.5+12) : DDstickyHeight(n.w, fresh ? measured.h : (n.title.split("\n").length*24+72));
    }
    for(let pass=0;pass<20;pass++) { let changed=false; for(const n of Y) if(n.parentId && !n.boardOnly) { const parent=Y.find(p=>p.id===n.parentId);if(parent?.lifeSection&&!parent.collapsed&&n.y+n.h+24>parent.y+parent.h){parent.h=n.y+n.h+24-parent.y;changed=true;} } if(!changed)break; }
    const An = new Map(Y.map((Jt) => [Jt.id, Jt])),
      Kt = new Set(model.hidden),
      Dn = [
        ...(setup.life?.links || []),
        ...G,
        ...model.links.map((Jt) => ({
          ...Jt,
          // A line you draw is dark ink until you colour it (FigJam).
          color: Jt.color || "var(--dd-wire,#4A4843)",
          automatic: !1,
        })),
      ]
        .map((Jt) => ({ ...Jt, ...(model.overrides[Jt.id] || {}), from: Jt.from, to: Jt.to }))
        .filter(
          (Jt) =>
            (!Kt.has(Jt.id) || Jt.automatic) &&
            Jt.from !== Jt.to &&
            An.has(Jt.from) &&
            An.has(Jt.to),
        );
    // The Life area itself is not drawn in a section's board, but its corner
    // is still where Life coordinates start.
    if (roomItem) An.set(lf.id, lf);
    return { nodes: Y, map: An, edges: Dn, automatic: G, room: roomItem ? roomItem.id : null, roomShift };
  };
}
