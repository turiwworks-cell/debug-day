// Where every card on the Board sits, worked out from the day, the Feed and
// the saved places, and nothing else: it reads and never writes. The Board keeps
// the result in a memo and draws it. Moved out of board.js as it was (5.46.6),
// so the short names still come from the old bundle.
import { DDlifeBounds, DDlifeHead, DDlifeItems, DDlifeAbs, DDlifeVisible, DDlifeColor, DDlifeDescendants, DDlifeInFrame, DDlifeShown, DDsectionTint } from "./life-board.js";
import { DDstickyHeight } from "./stickies.js";
import { DDshapeClear, DDshapeHeight } from "./shapes.js";
import { DDdocSize } from "./documents.js";
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
  return function DDboardLayout({ day, allDays, setup, model, mode, room, ddNodeMatches, visibleKey, stickyHeights, language: DDlanguage }) {
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
    // Lay items out in rows inside a section frame; the frame grows to hold them.
    function framePlace(Y, ct, frame, items, place, CARD = 300) {
      const GAP = 18,
        PER_ROW = 4,
        PAD = 16,
        HEAD = 54,
        saved = ct[frame.id];
      frame.x = finite(saved?.x, frame.x);
      frame.y = finite(saved?.y, frame.y);
      const cols = Math.min(PER_ROW, Math.max(2, items.length));
      frame.w = PAD * 2 + cols * (CARD + GAP) - GAP;
      let col = 0,
        rowY = frame.y + HEAD,
        rowH = 0,
        right = frame.x + frame.w,
        bottom = frame.y + 150;
      Y.push(frame);
      for (const item of items) {
        const result = place(item, {
          x: frame.x + PAD + col * (CARD + GAP),
          y: rowY,
          frame,
        });
        if (!result) continue;
        if (!result.custom) {
          rowH = Math.max(rowH, result.h);
          if (++col >= cols) {
            col = 0;
            rowY += rowH + GAP;
            rowH = 0;
          }
        }
        right = Math.max(right, result.x + result.w + PAD);
        bottom = Math.max(bottom, result.y + result.h + PAD);
      }
      frame.w = right - frame.x;
      frame.h = Math.max(150, bottom - frame.y, rowY + rowH + PAD - frame.y);
      return frame.y + frame.h;
    }
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
    // Lanes: each lane is a section, and each card is a section holding its
    // steps and notes. Relations show by placement, so no lines.
    function lanesLayout(Y, ct, visible) {
      const CARD = 300,
        noteById = new Map((day.notes || []).map((n) => [n.id, n])),
        notesFor = new Map(),
        attachedNotes = new Set(),
        noteVisible = (n) =>
          !ddNodeMatches || ddNodeMatches.has("note:" + day.date + ":" + n.id);
      for (const link of model.links)
        for (const [a, b] of [
          [link.from, link.to],
          [link.to, link.from],
        ]) {
          const owner =
            /^b:(.+)$/.exec(a)?.[1] || /^sub:([^:]+):/.exec(a)?.[1];
          const note = b.startsWith("sticky:") && noteById.get(b.slice(7));
          if (!owner || !note || note.kind === "emoji" || !noteVisible(note))
            continue;
          if (!day.blocks.some((block) => block.id === owner)) continue;
          if (attachedNotes.has(note.id)) continue;
          attachedNotes.add(note.id);
          notesFor.set(owner, [...(notesFor.get(owner) || []), note]);
        }
      const stepH = (text, width) =>
        Math.min(
          150,
          38 +
            17 *
              Math.max(
                1,
                Math.ceil(
                  String(text || "").length / Math.max(14, (width - 52) / 7.3),
                ),
              ),
        );
      const noteH = (note,width=240) => {
        const m=stickyHeights.current.get("sticky:"+note.id);
        return DDstickyHeight(width,m&&m.w===width&&m.text===note.text?m.h:String(note.text||"").split("\n").reduce((sum,l)=>sum+Math.max(1,Math.ceil(l.length/25)),0)*24+80);
      };
      const cardSection = (block, x, y, laneId) => {
        // A task wears its section's colour (task-look.js, 5.54).
        const type = DDtaskLook(block, setup, lifeItems),
          ref = "b:" + block.id,
          stats = de(block.subtasks || []),
          inner = CARD - 20,
          members = [];
        let cy = y + 64 + 8;
        const steps = (items, depth) =>
          (items || []).forEach((item, index, list) => {
            const indent = Math.min(depth, 4) * 14,
              width = inner - indent,
              height = stepH(item.text, width);
            members.push({
              id: `sub:${block.id}:${item.id}`,
              kind: "subtask",
              title: item.text,
              subtitle: stepLabel(index, list.length, item.children),
              done: item.done,
              color: type.color,
              textColor: ee(type.color),
              blockId: block.id,
              subId: item.id,
              memberOf: ref,
              hasChildren: !!item.children?.length,
              expanded: item.expanded !== false,
              x: x + 10 + indent,
              y: cy,
              w: width,
              h: height,
            });
            cy += height + 6;
            if (item.expanded !== false && item.children?.length)
              steps(item.children, depth + 1);
          });
        if (block.expanded !== false) steps(block.subtasks, 0);
        for (const note of notesFor.get(block.id) || []) {
          const height = noteH(note,inner);
          members.push({
            id: "sticky:" + note.id,
            noteId: note.id,
            kind: "sticky",
            title: note.text || "",
            color: note.color || "#FFE27A",
            textColor: "#121211",
            memberOf: ref,
            x: x + 10,
            y: cy,
            w: inner,
            h: height,
          });
          cy += height + 8;
        }
        const height = members.length ? cy - y + 4 : 64;
        const nodes = [
          {
            id: "sec:" + block.id,
            kind: "section",
            title: "",
            color: type.color,
            textColor: ee(type.color),
            blockId: block.id,
            memberOf: ref,
            x,
            y,
            w: CARD,
            h: height,
          },
          {
            id: ref,
            kind: "block",
            title: block.name || DDUI("Untitled"),
            subtitle:
              // The card's icon and color already say the kind of work (5.43).
              measure.DDmeasureText(block, DDlanguage, w) +
              (stats.total
                ? ` \xB7 ${stats.done}/${stats.total} ${t("steps", "قدم")}`
                : "") +
              (DDenergyOf(block) ? " \xB7 " + DDenergyLabel(DDenergyOf(block), DDlanguage) : ""),
            min: measure.DDmeasureOf(block) === "time" ? block.min : 0,
            done: block.done,
            emoji: block.emo || type.emo,
            icon: type.icon,
            color: type.color,
            textColor: ee(type.color),
            blockId: block.id,
            laneId,
            pri: block.pri,
            tags: block.tags,
            from: block.from,
            hasChildren: !!block.subtasks?.length,
            expanded: block.expanded !== false,
            members: members.map((m) => m.id).concat("sec:" + block.id),
            x,
            y,
            w: CARD,
            h: 64,
          },
          ...members,
        ];
        return { nodes, h: height };
      };
      const placeFrame = (frame, items, place) =>
        framePlace(Y, ct, frame, items, place, CARD);
      const placeCard = (laneId) => (block, auto) => {
        if (!visible.has(block.id)) return null;
        const saved = ct["b:" + block.id] || day.canvas?.positions?.[block.id],
          x = finite(saved?.x, auto.x),
          y = finite(saved?.y, auto.y),
          section = cardSection(block, x, y, laneId);
        Y.push(...section.nodes);
        return { x, y, w: CARD, h: section.h, custom: !!saved };
      };
      let top = 48;
      const lanes = [
        ...setup.lanes,
        ...(day.blocks.some((block) => !isScheduled(block))
          ? [{ id: "", name: DDUI("Parked") }]
          : []),
      ];
      for (const lane of lanes) {
        const blocks = day.blocks.filter((block) =>
          lane.id ? block.lane === lane.id : !isScheduled(block),
        );
        const frame = {
          id: `lane:${lane.id || "parked"}`,
          kind: "frame",
          title: lane.name || DDUI("Lane"),
          subtitle: w(
            blocks.reduce((sum, block) => sum + measure.DDplanMinutes(block), 0),
          ),
          laneId: lane.id,
          color: "#4A4843",
          textColor: "#fff",
          x: setup.board?.[lane.id]?.x ?? 48,
          y: setup.board?.[lane.id]?.y ?? top,
          w: 0,
          h: 150,
        };
        top = Math.max(top, placeFrame(frame, blocks, placeCard(lane.id)) + 48);
      }
      const freeNotes = (day.notes || []).filter(
        (note) => note.kind !== "emoji" && noteVisible(note) && !attachedNotes.has(note.id),
      );
      if (freeNotes.length)
        top = placeFrame(
          {
            id: "section:notes",
            kind: "frame",
            section: "notes",
            title: t(
              "Notes",
              "یادداشت‌ها",
            ),
            subtitle: String(freeNotes.length),
            color: "#4A4843",
            textColor: "#fff",
            x: 48,
            y: top,
            w: 0,
            h: 150,
          },
          freeNotes,
          (note, auto) => {
            const saved = ct["sticky:" + note.id],
              emoji = note.kind === "emoji",
              node = {
                id: "sticky:" + note.id,
                noteId: note.id,
                kind: emoji ? "emoji" : "sticky",
                title: emoji ? playful.label(note.text) : note.text || "",
                symbol: emoji ? note.text : undefined,
                color: note.color || "#FFE27A",
                textColor: "#121211",
                sectionId: "notes",
                x: finite(saved?.x, auto.x),
                y: finite(saved?.y, auto.y),
                w: emoji
                  ? (model.styles["sticky:" + note.id]?.width ?? 64)
                  : (model.styles["sticky:" + note.id]?.width ?? CARD),
                h: emoji ? (model.styles["sticky:" + note.id]?.height ?? 64) : noteH(note),
              };
            Y.push(node);
            return { ...node, custom: !!saved };
          },
        ) + 48;
      lifeFrame(Y, ct, top, 48);
    }
    const Y = [],
      G = [],
      ct = model.layouts[mode] || {},
      St = new Set(visibleKey.split("|")),
      // Today's tree in the Engine starts where the Engine was moved to.
      shift = { x: 0, y: 0 },
      Tt = (Jt, Xn, On) => ({
        x: finite(ct[Jt]?.x, Xn + shift.x),
        y: finite(ct[Jt]?.y, On + shift.y),
      }),
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
              : (Jt += stepH + 14);
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
              x: 720 + (Pl - 1) * 296,
              y: (Ga + Math.max(Ga + stepH, Jt - 14)) / 2 - stepH / 2,
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
            : (Jt += 82);
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
            x: 410,
            y: (Ga + Math.max(Ga + 64, Jt - 18)) / 2 - 32,
            w: 264,
            h: 64,
          }),
            yn(Oa, Xa, Dl.color));
        }
        Jt === fa && (Jt += 84);
        Pt({
          id: Oa,
          kind: "lane",
          title: ma.name || DDUI("Parked"),
          subtitle: w(Pl.reduce((Fn, Ga) => Fn + measure.DDplanMinutes(Ga), 0)),
          laneId: ma.id,
          parentId: "day:root",
          color: "#4A4843",
          textColor: "#fff",
          x: 252,
          y: (fa + Jt) / 2 - 27,
          w: 126,
          h: 54,
        });
        (yn("day:root", Oa, "#85827A"), (Jt += 30));
      }
      // Order lines (5.51): dashed arrows from what comes first to what follows,
      // read from `after` on tasks and steps. Steps folded away show no line.
      for (const { from, to } of DDflowEdges(day))
        G.push({ id: `auto:after:${from}->${to}`, from, to, color: "var(--dd-order,#E0602F)", dashed: !0, arrow: !0, automatic: !0, after: !0, style: "curve" });
      ct["day:root"] || (Y[0].y = Math.max(60, Jt / 2 - 35) + shift.y);
      engineFrame(Y, shift);
      Object.assign(shift, { x: 0, y: 0, w: 0, h: 0 });
    } else lanesLayout(Y, ct, St);
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
        mode !== "lanes" && (!roomItem || onEngine(n)) &&
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
        at: Jt.at || day.date, baseW:Jt.baseW || 240, syncId: Jt.syncId || undefined, due: Jt.due || undefined,
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
        ...(mode === "lanes" ? [] : [
        ...G,
        ...model.links.map((Jt) => ({
          ...Jt,
          // A line you draw is dark ink until you colour it (FigJam).
          color: Jt.color || "var(--dd-wire,#4A4843)",
          automatic: !1,
        })),
      ]),
        ...(mode === "lanes" ? model.links.filter((l) => l.from.startsWith("life:") || l.to.startsWith("life:")) : []),
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
