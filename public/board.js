import { DDcompletion, DDTaskMetadata, DDTaskTags, DDpriorityLabel, DDprogressLabel } from "./planner.js";
import { DDreconcileDay, DDrelation, DDconnectRelation, DDdisconnectRelation, DDrewireRelation } from "./relations.js";
import { DDconnectionGeometry } from "./connections.js";
import {
  DDcreateLifeBoard,
  DDlifeAbs,
  DDlifeAdd,
  DDlifeBounds,
  DDlifeHead,
  DDlifeItems,
  DDlifeParentAt,
} from "./life-board.js";
const life = { DDcreateLifeBoard, DDlifeAbs, DDlifeAdd, DDlifeBounds, DDlifeHead, DDlifeItems, DDlifeParentAt };
// Board interaction engine. Legacy planner adapters are injected once by the app.
export function DDcreateBoard(deps) {
  const {
    B,
    C,
    DDUI,
    DDbugColor,
    DDprefs,
    DDreadBoardView,
    DDsaveBoardView,
    DDsetTaskDone,
    DDtoggleSubtask,
    E,
    S,
    _,
    de,
    ee,
    ie,
    w,
    z,
  } = deps;
  const { core, controls, playful } = deps;
  const measure = deps.measure;
  let sharedClipboard = null;
  const LifeBoard = life.DDcreateLifeBoard(_);
  let stepTextContext;
  return function BoardWorkspace({
    day: day,
    days: allDays,
    setup: setup,
    selectedBlockId: selectedBlockId,
    onSelectBlock: onSelectBlock,
    onUpdateDay: onUpdateDay,
    onUpdateSetup: onUpdateSetup,
    onToast: onToast,
    matchesFilter: matchesFilter,
    nodeMatches: ddNodeMatches,
    searchNode: ddSearchNode,
    onExitIsolation: ddExitIsolation,
  }) {
    const DDlanguage = deps.language(),
      t = (en, fa) => (DDlanguage === "fa" ? fa : en);
    const {
        useState: useState,
        useRef: useRef,
        useMemo: useMemo,
        useEffect: useEffect,
        useLayoutEffect: useLayoutEffect,
      } = _,
      copy = (Y) => JSON.parse(JSON.stringify(Y)),
      finite = (Y, G = 0) =>
        Number.isFinite(Y) ? Math.max(-1e5, Math.min(1e5, Y)) : G,
      clean = (Y) => (
        (Y = Y && typeof Y == "object" ? Y : {}),
        {
          version: 1,
          mode: Y.mode === "lanes" ? "lanes" : "mindmap",
          layouts: Y.layouts && typeof Y.layouts == "object" ? Y.layouts : {},
          links: Array.isArray(Y.links)
            ? Y.links
                .filter(
                  (G) =>
                    G &&
                    typeof G.id == "string" &&
                    typeof G.from == "string" &&
                    typeof G.to == "string",
                )
                .slice(0, 2e3)
            : [],
          hidden: Array.isArray(Y.hidden)
            ? Y.hidden.filter((G) => typeof G == "string")
            : [],
          overrides:
            Y.overrides && typeof Y.overrides == "object" ? Y.overrides : {},
          locked: Array.isArray(Y.locked) ? Y.locked : [],
          groups: Y.groups && typeof Y.groups == "object" ? Y.groups : {},
          styles: core.styles(Y.styles),
          stack: Array.isArray(Y.stack)
            ? Y.stack.filter((ref) => typeof ref === "string").slice(0, 5000)
            : [],
          camera:
            Y.camera && Number.isFinite(Y.camera.z)
              ? {
                  x: finite(Y.camera.x),
                  y: finite(Y.camera.y),
                  z: core.zoom(Y.camera.z),
                }
              : { x: 24, y: 72, z: 0.8 },
        }
      ),
      model = clean(DDreadBoardView(day.date, DDreconcileDay(day, null, setup).canvas?.board4)),
      prefs = DDprefs(setup.preferences),
      [mode, setMode] = useState(model.mode),
      [tool, setTool] = useState("select"),
      [selected, setSelected] = useState(new Set()),
      [wireId, setWireId] = useState(null),
      [wireSelection, setWireSelection] = useState(null),
      [editing, setEditing] = useState(null),
      [child, setChild] = useState(null),
      [focus, setFocus] = useState(!1),
      [grid, setGrid] = useState(() =>
        core.local("debug-day:board-grid", prefs.boardGrid),
      ),
      [snap, setSnap] = useState(() =>
        core.local("debug-day:board-snap", prefs.boardSnap),
      ),
      [showMap, setShowMap] = useState(() =>
        core.local("debug-day:board-map", prefs.boardMinimap),
      ),
      [appearance, setAppearance] = useState(() => core.appearance()),
      [viewPanel, setViewPanel] = useState(false),
      [properties, setProperties] = useState(false),
      [stickerPicker, setStickerPicker] = useState(null),
      [details, setDetails] = useState(
        () => !globalThis.matchMedia?.("(max-width: 700px)").matches,
      ),
      noteDraft = useRef(null),
      appearanceRef = useRef(appearance),
      guideSvg = useRef(null),
      clipboard = useRef(sharedClipboard),
      pendingContext = useRef(null),
      suppressContext = useRef(false),
      stylePreview = useRef(false),
      [search, setSearch] = useState(null),
      [help, setHelp] = useState(!1),
      [menu, setMenu] = useState(null),
      [connecting, setConnecting] = useState(null),
      [tick, setTick] = useState(0),
      [status, setStatus] = useState(""),
      [inspector, setInspector] = useState(!0),
      viewport = useRef(null),
      world = useRef(null),
      root = useRef(null),
      zoomLabel = useRef(null),
      mapSvg = useRef(null),
      marquee = useRef(null),
      draftPath = useRef(null),
      elementRefs = useRef(new Map()),
      wireRefs = useRef(new Map()),
      cam = useRef(model.camera),
      cameraRAF = useRef(0),
      moveRAF = useRef(0),
      cameraTimer = useRef(0),
      latestMove = useRef(null),
      gesture = useRef(null),
      touches = useRef(new Map()),
      pinch = useRef(null),
      space = useRef(!1),
      preview = useRef(new Map()),
      pointerWire = useRef(null),
      history = useRef({ past: [], future: [] }),
      dayRef = useRef(day),
      ownUpdate = useRef(null),
      propsRef = useRef({
        day: day,
        setup: setup,
        onSelectBlock: onSelectBlock,
        onUpdateDay: onUpdateDay,
        onToast: onToast,
      }),
      api = useRef(null),
      editingRef = useRef(null),
      lastTap = useRef(null),
      lastNodeTap = useRef(0),
      mounted = useRef(!0),
      lastNudge = useRef(0),
      noteSession = useRef(null);
    ((propsRef.current = {
      day: day,
      setup: setup,
      onSelectBlock: onSelectBlock,
      onUpdateDay: onUpdateDay,
      onUpdateSetup: onUpdateSetup,
      onToast: onToast,
    }),
      (editingRef.current = editing),
      (appearanceRef.current = appearance));
    useEffect(() => {
      if (!status) return;
      const timer = setTimeout(() => setStatus(""), 2600);
      return () => clearTimeout(timer);
    }, [status]);
    const typeFor = (Y) =>
        setup.types.find((G) => G.id === Y) || {
          id: Y,
          name: "Other",
          color: "#8E8A80",
          icon: "dot",
        },
      laneIds = setup.lanes.map((Y) => Y.id),
      isScheduled = (Y) => laneIds.includes(Y.lane),
      locked = new Set(model.locked),
      selectedWires = new Set(
        wireSelection && wireSelection.sel === selected
          ? wireSelection.ids
          : [],
      ),
      visibleKey = day.blocks
        .filter((Y) => !matchesFilter || matchesFilter(Y))
        .map((Y) => Y.id)
        .join("|");
    function remember(Y) {
      const G = history.current;
      (G.past.push({ day: copy(Y), bytes: JSON.stringify(Y).length }),
        (G.future = []));
      let ct = G.past.reduce((ot, St) => ot + St.bytes, 0);
      for (; G.past.length > 50 || (ct > 24e6 && G.past.length > 1); )
        ct -= G.past.shift().bytes;
    }
    function commit(Y, G, ct = {}) {
      const ot = dayRef.current,
        St = DDreconcileDay(Y(copy(ot)), ot, propsRef.current.setup);
      !St ||
        JSON.stringify(St) === JSON.stringify(ot) ||
        (ct.history !== !1 && remember(ot),
        (dayRef.current = St),
        (ownUpdate.current = St),
        propsRef.current.onUpdateDay(() => St),
        setTick((Tt) => Tt + 1),
        G && setStatus(G));
    }
    function boardChange(Y, G, ct) {
      commit(
        (ot) => (
          (ot.canvas = {
            ...(ot.canvas || {}),
            board4: Y(clean(ot.canvas?.board4)),
          }),
          ot
        ),
        G,
        ct,
      );
    }
    function undo(Y = !1) {
      (finishEdit(), cancelGesture());
      const G = history.current,
        ct = Y ? G.future : G.past,
        ot = Y ? G.past : G.future,
        St = ct.pop();
      if (!St) return;
      if (St.life) {
        const current = copy(life.DDlifeItems(propsRef.current.setup));
        ot.push({ life: current, bytes: JSON.stringify(current).length });
        propsRef.current.setup = { ...propsRef.current.setup, life: { v: 1, items: copy(St.life) } };
        propsRef.current.onUpdateSetup?.((s) => ({ ...s, life: { v: 1, items: copy(St.life) } }));
        setTick((n) => n + 1);
        return;
      }
      const Tt = copy(dayRef.current);
      (ot.push({ day: Tt, bytes: JSON.stringify(Tt).length }),
        (dayRef.current = copy(St.day)),
        (ownUpdate.current = dayRef.current),
        propsRef.current.onUpdateDay(() => dayRef.current),
        setSelected(new Set()),
        setWireId(null),
        setConnecting(null),
        setTick((Pt) => Pt + 1),
        setStatus(
          Y
            ? "\u0627\u0646\u062C\u0627\u0645 \u0645\u062C\u062F\u062F"
            : "\u0628\u0627\u0632\u06AF\u0634\u062A \u062A\u063A\u06CC\u06CC\u0631",
        ));
    }
    useLayoutEffect(() => {
      (day !== dayRef.current &&
        (day !== ownUpdate.current &&
          JSON.stringify(day) !== JSON.stringify(dayRef.current) &&
          remember(dayRef.current),
        (dayRef.current = day)),
        (ownUpdate.current = null));
    }, [day]);
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
    const feelingTopic = (bug) => {
      const topic = (deps.feelingTopics || []).find(([id]) => id === bug.category);
      return topic ? t(topic[1], topic[2]) : DDUI("Feeling");
    };
    // The Life section is the same on every day: it is kept in setup, not in the day.
    function lifeChange(change) {
      const before = life.DDlifeItems(propsRef.current.setup), next = change(before);
      if (JSON.stringify(before) === JSON.stringify(next)) return;
      const stack = history.current;
      stack.past.push({ life: copy(before), bytes: JSON.stringify(before).length });
      stack.future = [];
      while (stack.past.length > 50) stack.past.shift();
      propsRef.current.setup = { ...propsRef.current.setup, life: { v: 1, items: next } };
      propsRef.current.onUpdateSetup?.((s) => ({ ...s, life: { v: 1, items: next } }));
    }
    function lifeFrame(Y, ct, top, left) {
      if (ddNodeMatches) return top;
      const b = life.DDlifeBounds(life.DDlifeItems(setup)),
        saved = ct["section:life"],
        node = {
          id: "section:life",
          kind: "frame",
          section: "life",
          title: "🌿 " + t("Life", "زندگی"),
          subtitle: t("Same on every day", "روی همهٔ روزها یکسان است"),
          color: "#4A4843",
          textColor: "#fff",
          x: finite(saved?.x, left),
          y: finite(saved?.y, top),
          w: b.w,
          h: life.DDlifeHead + b.h,
        };
      Y.push(node);
      return node.y + node.h + 48;
    }
    // Feelings and Habits have their own sections on the board, in both modes.
    // Whatever changes here is the same data Plan and Lanes show.
    function sideSections(Y, ct, attachedBugs, top, left) {
      const CARD = 280,
        bugVisible = (n) =>
          !ddNodeMatches || ddNodeMatches.has("bug:" + day.date + ":" + n.id),
        linked = new Set(model.links.flatMap((l) => [l.from, l.to])),
        freeBugs = (day.bugs || []).filter(
          (bug) =>
            bugVisible(bug) &&
            !attachedBugs.has(bug.id) &&
            (!bug.fixed || linked.has("bug:" + bug.id)),
        ),
        // A saved spot counts while it is still in or after its section.
        near = (saved, auto) =>
          saved && saved.x >= auto.frame.x - 40 && saved.y >= auto.frame.y + 20
            ? saved
            : null;
      freeBugs.forEach((bug) => attachedBugs.add(bug.id));
      if (freeBugs.length || !ddNodeMatches)
        top =
          framePlace(
            Y,
            ct,
            {
              id: "section:feelings",
              kind: "frame",
              section: "feelings",
              title: "💭 " + t("Feelings", "احساسات"),
              subtitle: freeBugs.length
                ? String(freeBugs.length)
                : t(
                    "Press + to note how you feel. Drop one on a card to link it.",
                    "با + حس‌ات را بنویس. روی کارت بیندازی، به آن وصل می‌شود.",
                  ),
              color: "#4A4843",
              textColor: "#fff",
              x: left,
              y: top,
              w: 0,
              h: 150,
            },
            freeBugs,
            (bug, auto) => {
              const saved = near(ct["bug:" + bug.id], auto),
                node = {
                  id: "bug:" + bug.id,
                  kind: "bug",
                  title: bug.text,
                  subtitle: feelingTopic(bug),
                  bugId: bug.id,
                  done: !!bug.fixed,
                  sectionId: "feelings",
                  color: DDbugColor(bug),
                  textColor: "#fff",
                  x: finite(saved?.x, auto.x),
                  y: finite(saved?.y, auto.y),
                  w: CARD,
                  h: 52,
                };
              Y.push(node);
              return { ...node, custom: !!saved };
            },
            CARD,
          ) + 48;
      if (ddNodeMatches || !deps.habits) return top;
      const H = deps.habits,
        levels = H.DDhabitLevels(setup.preferences?.habitLevels),
        habits = setup.habits || [];
      return (
        framePlace(
          Y,
          ct,
          {
            id: "section:habits",
            kind: "frame",
            section: "habits",
            title: "🌱 " + t("Habits", "عادت‌ها"),
            subtitle: habits.length
              ? habits.filter((h) => H.DDhabitEntry(day, h.id).done).length +
                "/" +
                habits.length +
                t(" today", " امروز")
              : t(
                  "Press + or drop a card here to make it a habit.",
                  "با + یا انداختن یک کارت اینجا، عادت بساز.",
                ),
            color: "#4A4843",
            textColor: "#fff",
            x: left,
            y: top,
            w: 0,
            h: 150,
          },
          habits,
          (habit, auto) => {
            const saved = near(ct["habit:" + habit.id], auto),
              entry = H.DDhabitEntry(day, habit.id),
              node = {
                id: "habit:" + habit.id,
                kind: "habit",
                habitId: habit.id,
                title: habit.name,
                subtitle: H.DDhabitText(entry, levels, DDlanguage),
                emoji: habit.emo,
                icon: "leaf",
                done: entry.done,
                level: H.DDhabitLevel(entry, levels),
                sectionId: "habits",
                color: habit.color,
                textColor: ee(habit.color),
                x: finite(saved?.x, auto.x),
                y: finite(saved?.y, auto.y),
                w: CARD,
                h: 52,
              };
            Y.push(node);
            return { ...node, custom: !!saved };
          },
          CARD,
        ) + 48
      );
    }
    // Lanes: each lane is a section, and each card is a section holding its
    // steps, feelings and notes. Relations show by placement, so no lines.
    function lanesLayout(Y, ct, attachedBugs, visible) {
      const CARD = 300,
        GAP = 18,
        PER_ROW = 4,
        PAD = 16,
        HEAD = 54,
        noteById = new Map((day.notes || []).map((n) => [n.id, n])),
        notesFor = new Map(),
        attachedNotes = new Set(),
        noteVisible = (n) =>
          !ddNodeMatches || ddNodeMatches.has("note:" + day.date + ":" + n.id),
        bugVisible = (n) =>
          !ddNodeMatches || ddNodeMatches.has("bug:" + day.date + ":" + n.id);
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
      const feelingsFor = (block) =>
        (day.bugs || []).filter(
          (bug) =>
            !bug.fixed &&
            bugVisible(bug) &&
            !attachedBugs.has(bug.id) &&
            (bug.blockId === block.id ||
              (!bug.blockId &&
                bug.on &&
                bug.on.toLowerCase() === (block.name || "").toLowerCase())),
        );
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
      const noteH = (note) =>
        model.styles["sticky:" + note.id]?.height ??
        Math.min(
          260,
          Math.max(
            96,
            62 +
              24 *
                String(note.text || " ")
                  .split("\n")
                  .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 34)), 0),
          ),
        );
      // A card section: the block header with its members stacked under it.
      const cardSection = (block, x, y, laneId) => {
        const type = block.color
            ? { ...typeFor(block.type), color: block.color }
            : typeFor(block.type),
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
        for (const bug of feelingsFor(block)) {
          attachedBugs.add(bug.id);
          members.push({
            id: "bug:" + bug.id,
            kind: "bug",
            title: bug.text,
            subtitle: feelingTopic(bug),
            bugId: bug.id,
            blockId: block.id,
            memberOf: ref,
            color: DDbugColor(bug),
            textColor: "#fff",
            x: x + 10,
            y: cy,
            w: inner,
            h: 52,
          });
          cy += 58;
        }
        for (const note of notesFor.get(block.id) || []) {
          const height = noteH(note);
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
              measure.DDmeasureText(block, DDlanguage, w) +
              " \xB7 " +
              DDUI(type.name) +
              (stats.total
                ? ` \xB7 ${stats.done}/${stats.total} ${t("steps", "قدم")}`
                : ""),
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
      top = sideSections(Y, ct, attachedBugs, top, 48);
      const freeNotes = (day.notes || []).filter(
        (note) => noteVisible(note) && !attachedNotes.has(note.id),
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
    const layout = useMemo(() => {
        const Y = [],
          G = [],
          ct = model.layouts[mode] || {},
          ot = new Set(),
          St = new Set(visibleKey.split("|")),
          Tt = (Jt, Xn, On) => ({
            x: finite(ct[Jt]?.x, Xn),
            y: finite(ct[Jt]?.y, On),
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
            });
        if (mode === "mindmap") {
          let Jt = 56;
          const Xn = [];
          Pt({
            id: "day:root",
            kind: "day",
            title: ie.format(E(day.date)),
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
                const Dl = Pt({
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
                Dl = Fn.color
                  ? { ...typeFor(Fn.type), color: Fn.color }
                  : typeFor(Fn.type);
              Fn.expanded !== !1 && Fn.subtasks?.length
                ? On(Fn.subtasks, Xa, Fn, 1, Dl.color)
                : (Jt += 82);
              for (const ba of (day.bugs || []).filter(
                (n) =>
                  !ddNodeMatches ||
                  ddNodeMatches.has("bug:" + day.date + ":" + n.id),
              )) {
                if (
                  ba.fixed ||
                  ot.has(ba.id) ||
                  !(
                    ba.blockId === Fn.id ||
                    (!ba.blockId &&
                      ba.on &&
                      ba.on.toLowerCase() === Fn.name.toLowerCase())
                  )
                )
                  continue;
                ot.add(ba.id);
                const va = `bug:${ba.id}`;
                (Pt({
                  id: va,
                  kind: "bug",
                  title: ba.text,
                  subtitle: feelingTopic(ba),
                  bugId: ba.id,
                  blockId: Fn.id,
                  parentId: Xa,
                  color: DDbugColor(ba),
                  textColor: "#fff",
                  x: 720,
                  y: Jt,
                  w: 238,
                  h: 52,
                }),
                  yn(Xa, va, "#D9434A", !0),
                  (Jt += 66));
              }
              const Pa = de(Fn.subtasks || []);
              (Pt({
                id: Xa,
                kind: "block",
                title: Fn.name || DDUI("Untitled"),
                subtitle:
                  measure.DDmeasureText(Fn, DDlanguage, w) +
                  " \xB7 " +
                  DDUI(Dl.name) +
                  (Pa.total
                    ? ` \xB7 ${Pa.done}/${Pa.total} ${t("steps", "\u0642\u062F\u0645")}`
                    : ""),
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
            const kl = Pt({
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
            (Xn.push(kl), yn("day:root", Oa, "#85827A"), (Jt += 30));
          }
          ct["day:root"] || (Y[0].y = Math.max(60, Jt / 2 - 35));
        } else lanesLayout(Y, ct, ot, St, Pt);
        if (mode === "mindmap")
          lifeFrame(
            Y,
            ct,
            sideSections(
              Y,
              ct,
              ot,
              Math.max(60, ...Y.map((n) => n.y + n.h)) + 56,
              24,
            ),
            24,
          );
        for (const Jt of (day.notes || []).filter(
          (n) =>
            mode !== "lanes" &&
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
            w: Jt.kind === "emoji" ? 64 : 220,
            h: Jt.kind === "emoji" ? 64 : 160,
          });
        for (const n of Y) {
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
          if (n.noteId && !n.memberOf) {
            n.w = style.width ?? n.w;
            n.h = style.height ?? n.h;
          }
          n.stack = 15 + Math.max(0, model.stack.indexOf(n.id) + 1);
        }
        const An = new Map(Y.map((Jt) => [Jt.id, Jt])),
          Kt = new Set(model.hidden),
          Dn = (mode === "lanes" ? [] : [
            ...G,
            ...model.links.map((Jt) => ({
              ...Jt,
              color: Jt.color || "var(--now)",
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
            ));
        return { nodes: Y, map: An, edges: Dn, automatic: G };
      }, [
        day.blocks,
        day.bugs,
        day.notes,
        day.habits,
        setup.habits,
        setup.preferences?.habitLevels,
        day.focus,
        day.mood,
        day.date,
        setup.types,
        setup.lanes,
        setup.board,
        setup.preferences?.language,
        mode,
        visibleKey,
        day.canvas,
        ddNodeMatches,
      ]),
      layoutRef = useRef(layout);
    layoutRef.current = layout;
    const selectedWire = layout.edges.find((Y) => Y.id === wireId),
      selectedNode =
        selected.size === 1 ? layout.map.get([...selected][0]) : null;
    function nodeBounds(Y = layout.nodes) {
      if (!Y.length) return { x: 0, y: 0, w: 500, h: 350 };
      const G = Math.min(...Y.map((ot) => ot.x)),
        ct = Math.min(...Y.map((ot) => ot.y));
      return {
        x: G,
        y: ct,
        w: Math.max(...Y.map((ot) => ot.x + ot.w)) - G,
        h: Math.max(...Y.map((ot) => ot.y + ot.h)) - ct,
      };
    }
    const bounds = nodeBounds();
    function nodeFor(Y) {
      const G = layoutRef.current.map.get(Y);
      return G ? { ...G, ...(preview.current.get(Y) || {}) } : null;
    }
    function portPoint(Y, G) {
      return G === "top"
        ? { x: Y.x + Y.w / 2, y: Y.y }
        : G === "bottom"
          ? { x: Y.x + Y.w / 2, y: Y.y + Y.h }
          : G === "left"
            ? { x: Y.x, y: Y.y + Y.h / 2 }
            : { x: Y.x + Y.w, y: Y.y + Y.h / 2 };
    }
    function wireGeometry(wire) {
      const a = nodeFor(wire.from), b = nodeFor(wire.to);
      if (!a || !b) return null;
      const drag = pointerWire.current;
      const geometry = DDconnectionGeometry(a, b, drag?.id === wire.id && drag.end === "bend" ? { ...wire, bend: drag.point } : wire, layoutRef.current.nodes.map((n) => nodeFor(n.id)));
      if (geometry && drag?.id === wire.id && ["from", "to"].includes(drag.end)) {
        if (drag.end === "from") geometry.p = drag.point; else geometry.q = drag.point;
        geometry.d = `M${geometry.p.x} ${geometry.p.y}L${geometry.q.x} ${geometry.q.y}`;
        geometry.mid = { x: (geometry.p.x + geometry.q.x) / 2, y: (geometry.p.y + geometry.q.y) / 2 };
      }
      return geometry;
    }
    function paintWires() {
      for (const Y of layoutRef.current.edges) {
        const G = wireGeometry(Y),
          ct = wireRefs.current.get(Y.id);
        if (!G || !ct) continue;
        for (const St of ct.querySelectorAll("path[data-wire-path]"))
          St.setAttribute("d", G.d);
        for (const [St, Tt] of [
          ["from", G.p],
          ["to", G.q],
          ["bend", G.mid],
        ]) {
          const Pt = ct.querySelector(`[data-end="${St}"]`);
          Pt &&
            Pt.setAttribute(
              "transform",
              `translate(${Tt.x} ${Tt.y}) scale(${1 / cam.current.z})`,
            );
        }
        const ot = ct.querySelector("[data-wire-label]");
        ot &&
          ot.setAttribute(
            "transform",
            `translate(${G.mid.x} ${G.mid.y - 12 / cam.current.z}) scale(${1 / cam.current.z})`,
          );
      }
    }
    function paintCamera() {
      cameraRAF.current = 0;
      const Y = viewport.current,
        G = cam.current;
      if (!Y || !world.current) return;
      ((world.current.style.transform = `translate3d(${G.x}px,${G.y}px,0) scale(${G.z})`),
        Y.style.setProperty("--b4-inverse", 1 / G.z),
        Y.classList.toggle("b4-overview", G.z < 0.7),
        Y.classList.toggle("b4-small", G.z < 0.95));
      let ct = appearanceRef.current.gridSize;
      Y.style.setProperty(
        "--b6-dot",
        core.rgba(
          appearanceRef.current.gridColor,
          appearanceRef.current.gridOpacity / 100,
        ),
      );
      if (Y.dataset.zoom !== String(G.z)) {
        Y.dataset.zoom = String(G.z);
        Y.dispatchEvent(
          new CustomEvent("debug-day-camera", { detail: { ...G } }),
        );
      }
      for (; ct * G.z < 15; ) ct *= 2;
      ((Y.style.backgroundSize = `${ct * G.z}px ${ct * G.z}px`),
        (Y.style.backgroundPosition = `${G.x}px ${G.y}px`),
        zoomLabel.current &&
          (zoomLabel.current.textContent = Math.round(G.z * 100) + "%"));
      const ot = mapSvg.current?.querySelector("[data-map-camera]");
      (ot &&
        (ot.setAttribute("x", -G.x / G.z),
        ot.setAttribute("y", -G.y / G.z),
        ot.setAttribute("width", Y.clientWidth / G.z),
        ot.setAttribute("height", Y.clientHeight / G.z)),
        paintWires());
    }
    function queueCamera() {
      cameraRAF.current ||
        (cameraRAF.current = requestAnimationFrame(paintCamera));
    }
    function saveCamera() {
      clearTimeout(cameraTimer.current);
      DDsaveBoardView(dayRef.current.date, { ...cam.current }, mode);
    }
    function scheduleCamera() {
      (clearTimeout(cameraTimer.current),
        (cameraTimer.current = setTimeout(() => {
          gesture.current || saveCamera();
        }, 220)));
    }
    function toWorld(Y, G) {
      const ct = viewport.current.getBoundingClientRect(),
        ot = cam.current;
      return { x: (Y - ct.left - ot.x) / ot.z, y: (G - ct.top - ot.y) / ot.z };
    }
    function setZoom(value, clientX, clientY) {
      const el = viewport.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      cam.current = core.zoomAt(cam.current, value, {
        x: clientX == null ? el.clientWidth / 2 : clientX - rect.left,
        y: clientY == null ? el.clientHeight / 2 : clientY - rect.top,
      });
      queueCamera();
      scheduleCamera();
    }
    function fit(selection = false) {
      const el = viewport.current;
      if (!el) return;
      const nodes =
        selection && selected.size
          ? layout.nodes.filter((n) => selected.has(n.id))
          : layout.nodes.filter((n) => n.section !== "life" || layout.nodes.length === 1);
      cam.current = core.fit(nodes, el.clientWidth, el.clientHeight, {
        left: 36,
        right: 36,
        top: 48,
        bottom: el.clientWidth < 700 ? 132 : 100,
        maxZoom: selection ? 1.6 : 1.05,
      });
      queueCamera();
      scheduleCamera();
    }
    function selectOne(Y) {
      (setSelected(new Set([Y])), setWireId(null));
      const G = layout.map.get(Y);
      G?.blockId && onSelectBlock?.(G.blockId);
    }
    function groupFor(Y) {
      return (
        Object.values(model.groups).find(
          (ct) => Array.isArray(ct) && ct.includes(Y),
        ) || [Y]
      );
    }
    function nodeDown(Y, G, ddMove = false) {
      if (
        Y.button === 2 ||
        Y.target.closest("input,textarea,select,[data-port],[data-resize]") ||
        (Y.target.closest("button") && !ddMove)
      )
        return;
      lastNodeTap.current = Date.now();
      Y.preventDefault();
      Y.stopPropagation();
      finishEdit();
      setMenu(null);
      if (tool === "section")
        return (addLifeSection(toWorld(Y.clientX, Y.clientY)), setTool("select"));
      if (space.current || (tool === "hand" && !ddMove) || Y.button === 1)
        return startPan(Y);
      // Empty section space is for navigating; only its title bar moves it.
      if (G.kind === "frame" && Y.target === Y.currentTarget) return startPan(Y);
      const ddConnect = tool === "connector" && !ddMove && !Y.shiftKey;
      if (ddMove) {
        setConnecting(null);
        setTool("select");
      }
      let ct = new Set(selected);
      if (ddConnect) ct = new Set([G.id]);
      else if (Y.shiftKey)
        for (const ref of groupFor(G.id))
          ct.has(ref) ? ct.delete(ref) : ct.add(ref);
      else if (!ct.has(G.id)) ct = new Set(groupFor(G.id));
      setSelected(ct);
      setWireId(null);
      G.blockId && onSelectBlock?.(G.blockId);
      if (!ct.has(G.id) || locked.has(G.id)) return;
      const moving = new Set(ct);
      if (G.kind === "frame")
        for (const node of layout.nodes)
          if (
            node.id !== G.id &&
            (G.section
              ? node.sectionId === G.section
              : node.kind === "block" && node.laneId === G.laneId)
          )
            moving.add(node.id);
      // In lanes a card moves with everything inside it; a step moves its card.
      if (mode === "lanes")
        for (const ref of [...moving]) {
          const node = layout.map.get(ref);
          const owner =
            node?.kind === "block"
              ? node
              : node?.kind === "subtask" && node.memberOf
                ? layout.map.get(node.memberOf)
                : null;
          if (!owner) continue;
          if (node !== owner) moving.delete(ref);
          moving.add(owner.id);
          for (const member of owner.members || []) moving.add(member);
        }
      const refs = [...moving].filter(
        (ref) => layout.map.has(ref) && !locked.has(ref),
      );
      gesture.current = {
        kind: "move",
        pointerId: Y.pointerId,
        sx: Y.clientX,
        sy: Y.clientY,
        refs,
        starts: Object.fromEntries(
          refs.map((ref) => {
            const node = layout.map.get(ref);
            return [ref, { x: node.x, y: node.y }];
          }),
        ),
        moved: false,
        frame: G.kind === "frame",
        tapRef: G.id,
        shift: Y.shiftKey,
        connect: ddConnect,
        connectFrom: connecting,
      };
      viewport.current.setPointerCapture(Y.pointerId);
      viewport.current.focus({ preventScroll: true });
    }
    function startPan(Y) {
      ((gesture.current = {
        kind: "pan",
        pointerId: Y.pointerId,
        sx: Y.clientX,
        sy: Y.clientY,
        camera: { ...cam.current },
        moved: !1,
      }),
        viewport.current.setPointerCapture(Y.pointerId),
        viewport.current.focus({ preventScroll: !0 }));
    }
    function wireDown(Y, G, ct) {
      if (Y.button !== 0) return;
      (Y.preventDefault(),
        Y.stopPropagation(),
        finishEdit(),
        setSelected(new Set()),
        setWireId(G.id),
        setInspector(!0),
        setMenu(null));
      const ot = wireGeometry(G);
      ((gesture.current = {
        kind: ct === "from" || ct === "to" ? "rewire" : "wire",
        end: ct || "bend",
        link: G,
        sx: Y.clientX,
        sy: Y.clientY,
        start: toWorld(Y.clientX, Y.clientY),
        bend: ot.mid,
        pointerId: Y.pointerId,
        moved: !1,
      }),
        viewport.current.setPointerCapture(Y.pointerId),
        viewport.current.focus({ preventScroll: !0 }));
    }
    function portDown(Y, G, ct) {
      if (Y.button !== 0) return;
      (Y.preventDefault(),
        Y.stopPropagation(),
        setSelected(new Set([G.id])),
        setWireId(null),
        (gesture.current = {
          kind: "newlink",
          from: G.id,
          port: ct,
          sx: Y.clientX,
          sy: Y.clientY,
          start: portPoint(G, ct),
          pointerId: Y.pointerId,
          moved: !1,
        }),
        viewport.current.setPointerCapture(Y.pointerId));
    }
    function nodeAt(Y, G) {
      const ct = layout.nodes.filter(
        (ot) =>
          ot.id !== G &&
          Y.x >= ot.x - 10 / cam.current.z &&
          Y.x <= ot.x + ot.w + 10 / cam.current.z &&
          Y.y >= ot.y - 10 / cam.current.z &&
          Y.y <= ot.y + ot.h + 10 / cam.current.z,
      );
      return ct.filter((ot) => ot.kind !== "frame").at(-1) || ct.at(-1);
    }
    function nearestPort(Y, G) {
      return [
        ["left", Math.abs(G.x - Y.x)],
        ["right", Math.abs(G.x - Y.x - Y.w)],
        ["top", Math.abs(G.y - Y.y)],
        ["bottom", Math.abs(G.y - Y.y - Y.h)],
      ].sort((ct, ot) => ct[1] - ot[1])[0][0];
    }
    function paintGesture(Y) {
      const G = gesture.current;
      if (!G || G.pointerId !== Y.pointerId) return;
      const ct = Y.clientX - G.sx,
        ot = Y.clientY - G.sy,
        St = Y.pointerType === "touch" ? 7 : 4;
      if ((Math.hypot(ct, ot) >= St && (G.moved = !0), !G.moved)) return;
      const Tt = toWorld(Y.clientX, Y.clientY);
      if (G.kind === "pan") {
        ((cam.current = {
          ...G.camera,
          x: G.camera.x + ct,
          y: G.camera.y + ot,
        }),
          queueCamera());
        return;
      }
      if (G.kind === "move") {
        let Pt = ct / cam.current.z,
          yn = ot / cam.current.z;
        if (
          (Y.shiftKey && (Math.abs(Pt) > Math.abs(yn) ? (yn = 0) : (Pt = 0)),
          snap)
        ) {
          const An = G.starts[G.refs[0]],
            step = appearanceRef.current.gridSize;
          An &&
            ((Pt = Math.round((An.x + Pt) / step) * step - An.x),
            (yn = Math.round((An.y + yn) / step) * step - An.y));
        }
        if (appearanceRef.current.guides && !Y.shiftKey) {
          const guides = core.guides(
            layout.nodes,
            G.refs,
            G.starts,
            { x: Pt, y: yn },
            cam.current.z,
          );
          Pt = guides.x;
          yn = guides.y;
          if (guideSvg.current)
            guideSvg.current.innerHTML = guides.lines
              .map((line) =>
                line.axis === "x"
                  ? `<line x1="${line.position}" y1="${line.from}" x2="${line.position}" y2="${line.to}"/>`
                  : `<line x1="${line.from}" y1="${line.position}" x2="${line.to}" y2="${line.position}"/>`,
              )
              .join("");
        }
        for (const An of G.refs) {
          const Kt = G.starts[An],
            Dn = { x: Kt.x + Pt, y: Kt.y + yn };
          preview.current.set(An, Dn);
          const Jt = elementRefs.current.get(An);
          Jt && (Jt.style.transform = `translate3d(${Pt}px,${yn}px,0)`);
        }
        paintWires();
        return;
      }
      if (G.kind === "note-resize") {
        const edge = G.edge || "se",
          dx = ct / cam.current.z,
          dy = ot / cam.current.z;
        let width =
            G.width + (edge.includes("e") ? dx : edge.includes("w") ? -dx : 0),
          height =
            G.height + (edge.includes("s") ? dy : edge.includes("n") ? -dy : 0);
        if (Y.shiftKey && edge.length === 2) {
          const scale = Math.max(width / G.width, height / G.height);
          width = G.width * scale;
          height = G.height * scale;
        }
        width = Math.round(Math.max(144, Math.min(1200, width)));
        height = Math.round(Math.max(96, Math.min(1800, height)));
        const x = G.x + (edge.includes("w") ? G.width - width : 0),
          y = G.y + (edge.includes("n") ? G.height - height : 0);
        G.size = { width, height };
        G.position = { x, y };
        const el = elementRefs.current.get(G.ref);
        if (el) {
          el.style.width = width + "px";
          el.style.height = height + "px";
          el.style.transform = `translate3d(${x - G.x}px,${y - G.y}px,0)`;
          el.dataset.size = width + " \u00d7 " + height;
        }
        preview.current.set(G.ref, { x, y, w: width, h: height });
        paintWires();
        return;
      }
      if (G.kind === "resize") {
        G.min = Math.max(
          15,
          Math.min(720, S(G.startMin + ct / (3 * cam.current.z))),
        );
        const Pt = elementRefs.current.get(G.ref);
        if (Pt) {
          Pt.style.width = 136 + G.min * 3 + "px";
          const yn = Pt.querySelector("[data-duration]");
          yn && (yn.textContent = w(G.min));
        }
        return;
      }
      if (G.kind === "wire" || G.kind === "rewire") {
        ((pointerWire.current = {
          id: G.link.id,
          end: G.end,
          point:
            G.kind === "wire"
              ? {
                  x: G.bend.x + ct / cam.current.z,
                  y: G.bend.y + ot / cam.current.z,
                }
              : Tt,
        }),
          paintWires(),
          showPreview(
            G.kind === "rewire"
              ? nodeAt(Tt, G.link[G.end === "from" ? "to" : "from"])?.id
              : null,
          ));
        return;
      }
      if (G.kind === "newlink") {
        ((draftPath.current.style.display = "block"),
          draftPath.current.setAttribute(
            "d",
            `M${G.start.x} ${G.start.y}L${Tt.x} ${Tt.y}`,
          ),
          showPreview(nodeAt(Tt, G.from)?.id));
        return;
      }
      if (G.kind === "marquee") {
        const Pt = {
          x: Math.min(G.start.x, Tt.x),
          y: Math.min(G.start.y, Tt.y),
          w: Math.abs(Tt.x - G.start.x),
          h: Math.abs(Tt.y - G.start.y),
        };
        ((G.box = Pt),
          marquee.current &&
            ((marquee.current.style.display = "block"),
            Object.assign(marquee.current.style, {
              left: Pt.x + "px",
              top: Pt.y + "px",
              width: Pt.w + "px",
              height: Pt.h + "px",
            })));
        return;
      }
    }
    function showPreview(Y) {
      for (const [G, ct] of elementRefs.current)
        ct.classList.toggle("b4-drop-target", G === Y);
    }
    function clearPreview() {
      if (guideSvg.current) guideSvg.current.replaceChildren();
      for (const [Y, G] of elementRefs.current) {
        ((G.style.transform = ""), G.classList.remove("b4-drop-target"));
        const ct = layout.map.get(Y);
        if (ct) {
          G.style.width = ct.w + "px";
          G.style.height = ct.h + "px";
        }
        const ot = G.querySelector("[data-duration]");
        ot && ct?.min && (ot.textContent = w(ct.min));
      }
      (preview.current.clear(),
        (pointerWire.current = null),
        draftPath.current && (draftPath.current.style.display = "none"),
        marquee.current && (marquee.current.style.display = "none"),
        paintWires());
    }
    function cancelGesture() {
      root.current?.querySelector(".dd-life")?.dispatchEvent(new Event("dd-life-cancel"));
      pendingContext.current = null;
      (moveRAF.current && cancelAnimationFrame(moveRAF.current),
        (moveRAF.current = 0),
        (latestMove.current = null));
      const Y = gesture.current;
      if (
        ((gesture.current = null),
        Y?.kind === "pan" && ((cam.current = Y.camera), queueCamera()),
        Y)
      )
        try {
          viewport.current.releasePointerCapture(Y.pointerId);
        } catch {}
      (clearPreview(),
        (pinch.current = null),
        touches.current.clear(),
        setStatus(""));
    }
    function endGesture(Y, G = !1) {
      const ct = gesture.current;
      if (!(!ct || ct.pointerId !== Y.pointerId)) {
        (moveRAF.current && cancelAnimationFrame(moveRAF.current),
          (moveRAF.current = 0),
          G || paintGesture(Y),
          (gesture.current = null));
        try {
          viewport.current.releasePointerCapture(Y.pointerId);
        } catch {}
        if (G) {
          clearPreview();
          return;
        }
        if (ct.kind === "pan") {
          const context = pendingContext.current;
          pendingContext.current = null;
          if (ct.right && ct.moved) {
            setMenu(null);
            suppressContext.current = true;
            setTimeout(() => {
              suppressContext.current = false;
            }, 180);
          }
          (ct.moved && saveCamera(), clearPreview());
          if (ct.right && !ct.moved && context)
            openContext(
              {
                target: viewport.current,
                currentTarget: viewport.current,
                clientX: context.clientX,
                clientY: context.clientY,
                preventDefault() {},
                stopPropagation() {},
              },
              context.target,
            );
          return;
        }
        if (ct.kind === "note-resize") {
          const el = elementRefs.current.get(ct.ref);
          if (el) delete el.dataset.size;
        }
        if (ct.kind === "note-resize" && ct.moved) {
          const n = layout.map.get(ct.ref);
          if (n && ct.size)
            commit(
              (d) => {
                let next = core.setStyle(d, [n], n.memberOf ? { height: ct.size.height } : ct.size);
                if (
                  !n.memberOf &&
                  ct.position &&
                  (ct.position.x !== n.x || ct.position.y !== n.y)
                )
                  next = core.place(next, [n], { [n.id]: ct.position }, mode);
                return next;
              },
              t("Note resized", "اندازهٔ نوت تغییر کرد"),
            );
        } else if (ct.kind === "move" && ct.moved) {
          setConnecting(null);
          if (ct.connect) setTool("select");
          const ot = Object.fromEntries(preview.current),
            St = layout.nodes.filter(
              (Tt) => Tt.kind === "frame" && !Tt.section,
            ),
            within = (pos, node, area) =>
              area &&
              pos.x + node.w / 2 >= area.x &&
              pos.x + node.w / 2 <= area.x + area.w &&
              pos.y + node.h / 2 >= area.y &&
              pos.y + node.h / 2 <= area.y + area.h,
            habitsArea = layout.map.get("section:habits"),
            feelingsArea = layout.map.get("section:feelings"),
            // Cards dropped into the Habits section become habits.
            toHabits = ct.frame
              ? []
              : ct.refs
                  .map((ref) => layout.map.get(ref))
                  .filter(
                    (n) =>
                      n?.kind === "block" &&
                      ot[n.id] &&
                      !locked.has(n.id) &&
                      within(ot[n.id], n, habitsArea),
                  ),
            habitRefs = new Set(toHabits.map((n) => n.id));
          commit((Tt) => {
            const Pt = clean(Tt.canvas?.board4),
              yn = { ...(Pt.layouts[mode] || {}) };
            for (const [An, Kt] of Object.entries(ot)) {
              const Dn = layout.map.get(An);
              if (!Dn || habitRefs.has(An)) continue;
              if (habitRefs.has(Dn.memberOf)) continue;
              if (Dn.kind === "habit") {
                yn[An] = Kt;
                continue;
              }
              // Mind map: a feeling dropped on a card links to it; dropped
              // into Feelings it lets go of its card.
              if (mode !== "lanes" && Dn.kind === "bug" && !ct.frame) {
                const card = layout.nodes.find(
                    (n) => n.kind === "block" && !ot[n.id] && within(Kt, Dn, n),
                  ),
                  bug = Tt.bugs.find((b) => b.id === Dn.bugId);
                if (bug && card && bug.blockId !== card.blockId) {
                  bug.blockId = card.blockId;
                  bug.on = "";
                  delete yn[An];
                  continue;
                }
                if (bug && !card && Dn.blockId && within(Kt, Dn, feelingsArea)) {
                  bug.blockId = "";
                  bug.on = "";
                  yn[An] = Kt;
                  continue;
                }
              }
              if (mode === "lanes" && (Dn.memberOf || Dn.sectionId)) {
                if (Dn.kind === "section" || Dn.kind === "subtask") continue;
                if (Dn.memberOf && ot[Dn.memberOf]) continue;
                // A note or feeling dropped on a card joins it; dragged out, it leaves.
                const center = { x: Kt.x + Dn.w / 2, y: Kt.y + Dn.h / 2 },
                  target = layout.nodes.find(
                    (n) =>
                      n.kind === "section" &&
                      !ot[n.id] &&
                      center.x >= n.x &&
                      center.x <= n.x + n.w &&
                      center.y >= n.y &&
                      center.y <= n.y + n.h,
                  ),
                  targetBlock = target?.blockId,
                  current = Dn.memberOf ? Dn.memberOf.slice(2) : null;
                if (targetBlock && targetBlock === current) continue;
                if (Dn.kind === "bug") {
                  const bug = Tt.bugs.find((b) => b.id === Dn.bugId);
                  if (bug) {
                    bug.blockId = targetBlock || "";
                    if (!targetBlock) bug.on = "";
                  }
                } else if (Dn.noteId) {
                  const blockRefs = (id) => (ref) =>
                    ref === "b:" + id || ref.startsWith("sub:" + id + ":");
                  if (current)
                    Pt.links = Pt.links.filter(
                      (l) =>
                        !(
                          (l.from === An && blockRefs(current)(l.to)) ||
                          (l.to === An && blockRefs(current)(l.from))
                        ),
                    );
                  if (targetBlock)
                    Pt.links = [
                      ...Pt.links,
                      {
                        id: "link:" + C(),
                        from: "b:" + targetBlock,
                        to: An,
                        style: "curve",
                        arrow: !1,
                        label: "",
                        color: "#7A5FF5",
                      },
                    ];
                }
                if (targetBlock) delete yn[An];
                else yn[An] = Kt;
                continue;
              }
              if (Dn.memberOf) continue;
              if (Dn.noteId && mode !== "lanes") {
                const Jt = Tt.notes.find((Xn) => Xn.id === Dn.noteId);
                Jt && ((Jt.x = Kt.x), (Jt.y = Kt.y));
              } else yn[An] = Kt;
            }
            if (mode === "mindmap" && !ct.frame) {
              for (const ref of ct.refs) {
                const node = layout.map.get(ref), pos = ot[ref];
                if (node?.kind !== "block" || !pos || habitRefs.has(ref)) continue;
                const lane = layout.nodes.find((n) => n.kind === "lane" && !ot[n.id] && pos.x < n.x + n.w && pos.x + node.w > n.x && pos.y < n.y + n.h && pos.y + node.h > n.y);
                const block = Tt.blocks.find((b) => b.id === node.blockId);
                if (lane && block && (block.lane || "") !== (lane.laneId || "")) {
                  block.lane = lane.laneId || "";
                  for (const ref of [node.id, ...(node.members || [])]) delete yn[ref];
                }
              }
            }
            if (mode === "lanes" && !ct.frame)
              for (const An of ct.refs) {
                const Kt = layout.map.get(An),
                  Dn = ot[An];
                if (Kt?.kind !== "block" || !Dn || habitRefs.has(An)) continue;
                const Jt = St.find(
                    (On) =>
                      Dn.x + Kt.w / 2 >= On.x &&
                      Dn.x + Kt.w / 2 <= On.x + On.w &&
                      Dn.y + Kt.h / 2 >= On.y &&
                      Dn.y + Kt.h / 2 <= On.y + On.h,
                  ),
                  Xn = Tt.blocks.find((On) => On.id === Kt.blockId);
                ((Xn.lane = Jt?.laneId || ""),
                  Jt
                    ? (delete Xn.bx, delete Xn.by)
                    : ((Xn.bx = Dn.x), (Xn.by = Dn.y)));
              }
            return (
              (Pt.layouts = { ...Pt.layouts, [mode]: yn }),
              (Tt.canvas = { ...(Tt.canvas || {}), board4: Pt }),
              Tt
            );
          }, DDUI("\u062C\u0627\u06CC \u0646\u0648\u062F\u0647\u0627 \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F"));
          makeHabits(toHabits);
        } else if (ct.kind === "resize" && ct.moved && ct.min !== ct.startMin)
          commit(
            (ot) => ({
              ...ot,
              blocks: ot.blocks.map((St) =>
                St.id === ct.blockId ? { ...St, min: ct.min } : St,
              ),
            }),
            DDUI(
              "\u0632\u0645\u0627\u0646 \u0628\u0644\u0627\u06A9 \u062A\u063A\u06CC\u06CC\u0631 \u06A9\u0631\u062F",
            ),
          );
        else if (ct.kind === "wire" && ct.moved)
          patchWire(
            ct.link.id,
            {
              bend: { ...pointerWire.current.point },
              style:
                ct.link.style === "straight"
                  ? "curve"
                  : ct.link.style || "curve",
            },
            DDUI(
              "\u0645\u0633\u06CC\u0631 \u0627\u062A\u0635\u0627\u0644 \u062C\u0627\u0628\u0647\u200C\u062C\u0627 \u0634\u062F",
            ),
          );
        else if (ct.kind === "rewire" && ct.moved) {
          const ot = toWorld(Y.clientX, Y.clientY),
            St = nodeAt(ot, ct.link[ct.end === "from" ? "to" : "from"]);
          St
            ? patchWire(
                ct.link.id,
                { [ct.end]: St.id, [ct.end + "Port"]: nearestPort(St, ot) },
                DDUI(
                  "\u0633\u0631 \u0627\u062A\u0635\u0627\u0644 \u062C\u0627\u0628\u0647\u200C\u062C\u0627 \u0634\u062F",
                ),
              )
            : setStatus(
                DDUI(
                  "\u0627\u062A\u0635\u0627\u0644 \u0642\u0628\u0644\u06CC \u062D\u0641\u0638 \u0634\u062F\u061B \u0633\u0631 \u062E\u0637 \u0631\u0627 \u0631\u0648\u06CC \u06CC\u06A9 \u0646\u0648\u062F \u0631\u0647\u0627 \u06A9\u0646",
                ),
              );
        } else if (ct.kind === "newlink") {
          const point = toWorld(Y.clientX, Y.clientY),
            target = nodeAt(point, ct.from);
          if (target && ct.moved)
            addLink(ct.from, target.id, {
              fromPort: ct.port,
              toPort: nearestPort(target, point),
            });
          else
            setStatus(
              DDlanguage === "fa"
                ? "برای اتصال، نقطه را تا نود مقصد بکش"
                : "Drag the connection point to the target node",
            );
          setConnecting(null);
          setTool("select");
        } else if (ct.kind === "marquee" && ct.moved && ct.box) {
          const ot = ct.box,
            St = layout.nodes
              .filter(
                (Tt) =>
                  Tt.kind !== "frame" &&
                  Tt.kind !== "section" &&
                  Tt.x < ot.x + ot.w &&
                  Tt.x + Tt.w > ot.x &&
                  Tt.y < ot.y + ot.h &&
                  Tt.y + Tt.h > ot.y,
              )
              .map((Tt) => Tt.id);
          selectMarquee(new Set([...(ct.shift ? ct.initial : []), ...St]), ot);
        } else if (ct.kind === "move" && !ct.moved && ct.connect) {
          if (ct.connectFrom && ct.connectFrom !== ct.tapRef) {
            addLink(ct.connectFrom, ct.tapRef);
            setConnecting(null);
            setTool("select");
          } else {
            setConnecting(ct.tapRef);
            setStatus(
              DDlanguage === "fa"
                ? "نود مقصد را انتخاب کن؛ کشیدن برای جابه‌جایی است"
                : "Select the target node; dragging moves the node",
            );
          }
        } else if (ct.kind === "move" && !ct.moved) {
          const ot = lastTap.current;
          ot?.ref === ct.tapRef && Date.now() - ot.time < 340
            ? (openEdit(ct.tapRef), (lastTap.current = null))
            : (lastTap.current = { ref: ct.tapRef, time: Date.now() });
        }
        clearPreview();
      }
    }
    function downCapture(Y) {
      if (Y.pointerType === "touch")
        if (
          (touches.current.set(Y.pointerId, { x: Y.clientX, y: Y.clientY }),
          touches.current.size === 2)
        ) {
          (Y.preventDefault(), Y.stopPropagation());
          const G = { ...cam.current },
            ct = [...touches.current.entries()];
          (cancelGesture(), (cam.current = G), (touches.current = new Map(ct)));
          const ot = [...touches.current.values()];
          if (ot.length === 2) {
            const St = {
              x: (ot[0].x + ot[1].x) / 2,
              y: (ot[0].y + ot[1].y) / 2,
            };
            pinch.current = {
              distance: Math.hypot(ot[1].x - ot[0].x, ot[1].y - ot[0].y),
              camera: { ...cam.current },
              world: toWorld(St.x, St.y),
            };
          }
          viewport.current.setPointerCapture(Y.pointerId);
        } else
          Y.currentTarget._lastTouch = {
            id: Y.pointerId,
            x: Y.clientX,
            y: Y.clientY,
          };
    }
    function pointerMove(Y) {
      if (
        Y.pointerType === "touch" &&
        touches.current.has(Y.pointerId) &&
        (touches.current.set(Y.pointerId, { x: Y.clientX, y: Y.clientY }),
        pinch.current && touches.current.size === 2)
      ) {
        const G = [...touches.current.values()],
          ct = { x: (G[0].x + G[1].x) / 2, y: (G[0].y + G[1].y) / 2 },
          ot = viewport.current.getBoundingClientRect(),
          St = pinch.current,
          Tt = Math.max(
            0.05,
            Math.min(
              8,
              (St.camera.z * Math.hypot(G[1].x - G[0].x, G[1].y - G[0].y)) /
                Math.max(1, St.distance),
            ),
          );
        ((cam.current = {
          x: ct.x - ot.left - St.world.x * Tt,
          y: ct.y - ot.top - St.world.y * Tt,
          z: Tt,
        }),
          queueCamera());
        return;
      }
      gesture.current &&
        ((latestMove.current = {
          pointerId: Y.pointerId,
          pointerType: Y.pointerType,
          clientX: Y.clientX,
          clientY: Y.clientY,
          shiftKey: Y.shiftKey,
        }),
        moveRAF.current ||
          (moveRAF.current = requestAnimationFrame(() => {
            ((moveRAF.current = 0),
              latestMove.current && paintGesture(latestMove.current));
          })));
    }
    function pointerUp(Y) {
      if ((touches.current.delete(Y.pointerId), pinch.current)) {
        touches.current.size === 0 && ((pinch.current = null), saveCamera());
        return;
      }
      endGesture(Y);
    }
    function backgroundDown(Y) {
      const nodeEl = Y.target.closest("[data-board-id]"),
        // Right-drag on a section (Feelings, Habits, Notes) pans like the canvas.
        sectionPan =
          Y.button === 2 &&
          nodeEl?.dataset.nodeKind === "frame" &&
          !!nodeEl.dataset.section;
      if (
        Y.target.closest("button,input,textarea,select,[data-wire-id]") ||
        (nodeEl && !sectionPan) ||
        pinch.current
      )
        return;
      if (Y.button === 2) {
        if (appearanceRef.current.rightDragPan) {
          Y.preventDefault();
          startPan(Y);
          gesture.current.right = true;
        }
        return;
      }
      (Y.preventDefault(), finishEdit(), setMenu(null));
      const G = toWorld(Y.clientX, Y.clientY);
      if (tool === "sticky") return addSticky(G);
      if (tool === "section") return (addLifeSection(G), setTool("select"));
      if (tool === "feeling") return ddAddFeeling(G);
      if (tool === "block") return addBlock(null, G);
      if (tool === "connector") {
        setConnecting(null);
        return;
      }
      if (
        Y.button === 1 ||
        space.current ||
        tool === "hand" ||
        Y.pointerType === "touch"
      )
        return startPan(Y);
      (Y.shiftKey ||
        (setSelected(new Set()), setWireId(null), onSelectBlock?.(null)),
        (gesture.current = {
          kind: "marquee",
          start: G,
          sx: Y.clientX,
          sy: Y.clientY,
          pointerId: Y.pointerId,
          initial: [...selected],
          shift: Y.shiftKey,
          moved: !1,
        }),
        viewport.current.setPointerCapture(Y.pointerId),
        viewport.current.focus({ preventScroll: !0 }));
    }
    function patchWire(Y, G, ct) {
      const current = layoutRef.current.edges.find((e) => e.id === Y);
      // Visual arrow direction is independent of the task's real parent.
      if (current && G.from === current.to && G.to === current.from) {
        G = { ...G, arrowReverse: !current.arrowReverse };
        for (const key of ["from", "to", "fromPort", "toPort"]) delete G[key];
      }
      if (current && (Object.hasOwn(G, "from") || Object.hasOwn(G, "to"))) {
        const next = { ...current, ...G };
        const relation = DDrewireRelation(dayRef.current, current, next.from, next.to, setup);
        if (relation !== null) {
          if (JSON.stringify(relation) === JSON.stringify(dayRef.current)) {
            setStatus(t("This relationship is already set, locked or would create a cycle", "این رابطه وجود دارد، قفل است یا یک چرخه ایجاد می‌کند"));
            return;
          }
          commit(() => relation, t("Relationship updated in Plan and Board", "رابطه در پلن و برد تغییر کرد"));
          setWireId(null);
          return;
        }
        if (current.automatic) { setStatus(t("Connect this task to a lane, or this step to a card", "کار را به لاین، یا قدم را به یک کارت وصل کن")); return; }
      }
      boardChange(
        (ot) => (
          Y.startsWith("auto:")
            ? (ot.overrides = {
                ...ot.overrides,
                [Y]: { ...(ot.overrides[Y] || {}), ...G },
              })
            : (ot.links = ot.links.map((Tt) =>
                Tt.id === Y ? { ...Tt, ...G } : Tt,
              )),
          ot
        ),
        ct,
      );
    }
    function addLink(Y, G, ct = {}) {
      if (Y === G) return;
      const relation = DDconnectRelation(dayRef.current, Y, G, setup);
      if (relation !== null) {
        if (JSON.stringify(relation) === JSON.stringify(dayRef.current)) {
          setStatus(t("This relationship is already set, locked or would create a cycle", "این رابطه وجود دارد، قفل است یا یک چرخه ایجاد می‌کند"));
          return;
        }
        commit(() => relation, t("Relationship updated in Plan and Board", "رابطه در پلن و برد تغییر کرد"));
        setWireId(null); setSelected(new Set());
        return;
      }
      if (layout.edges.some((St) => St.from === Y && St.to === G)) {
        setStatus(
          DDUI(
            "\u0627\u06CC\u0646 \u062F\u0648 \u0646\u0648\u062F \u0642\u0628\u0644\u0627\u064B \u0628\u0647 \u0647\u0645 \u0648\u0635\u0644\u200C\u0627\u0646\u062F",
          ),
        );
        return;
      }
      const ot = "link:" + C();
      (boardChange(
        (St) => ({
          ...St,
          links: [
            ...St.links.filter((link) => {
              const old = DDrelation(link.from, link.to, laneIds), next = DDrelation(Y, G, laneIds);
              return !(next?.kind === "note" && old?.kind === "note" && old.noteId === next.noteId);
            }),
            {
              id: ot,
              from: Y,
              to: G,
              style: "curve",
              arrow: !0,
              label: "",
              color: /^bug:/.test(Y) || /^bug:/.test(G) ? "#D9434A" : "#7A5FF5",
              ...ct,
            },
          ],
        }),
        DDUI(
          "\u0627\u062A\u0635\u0627\u0644 \u0633\u0627\u062E\u062A\u0647 \u0634\u062F",
        ),
      ),
        setWireId(ot),
        setSelected(new Set()),
        setInspector(!0));
    }
    function deleteWire(Y = wireId) {
      const edge = layoutRef.current.edges.find((e) => e.id === Y);
      if (edge?.automatic) {
        const next = DDdisconnectRelation(dayRef.current, edge.from, edge.to, setup);
        if (JSON.stringify(next) === JSON.stringify(dayRef.current)) {
          setStatus(t("This line shows the task hierarchy. Move its step to another card to change it.", "این خط ساختار کار را نشان می‌دهد؛ برای تغییر، قدم را به کارت دیگری وصل کن."));
          return;
        }
        commit(() => next, t("Relationship removed; items kept", "رابطه برداشته شد؛ آیتم‌ها حفظ شدند"));
        setWireId(null); return;
      }
      Y &&
        (boardChange(
          (G) =>
            Y.startsWith("auto:")
              ? { ...G, hidden: [...new Set([...G.hidden, Y])] }
              : { ...G, links: G.links.filter((ct) => ct.id !== Y) },
          DDUI(
            "\u0641\u0642\u0637 \u0627\u062A\u0635\u0627\u0644 \u062D\u0630\u0641 \u0634\u062F\u061B \u0646\u0648\u062F\u0647\u0627 \u062D\u0641\u0638 \u0634\u062F\u0646\u062F",
          ),
        ),
        setWireId(null));
    }
    function updateSub(Y, G, ct) {
      return (Y || []).map((ot) =>
        ot.id === G
          ? ct(ot)
          : { ...ot, children: updateSub(ot.children, G, ct) },
      );
    }
    function toggleDone(Y) {
      if (locked.has(Y.id)) return;
      commit((day) => {
        if (Y.kind === "block")
          day.blocks = day.blocks.map((block) =>
            block.id === Y.blockId ? DDsetTaskDone(block, !block.done) : block,
          );
        else if (Y.kind === "subtask")
          day.blocks = day.blocks.map((block) =>
            block.id === Y.blockId ? DDtoggleSubtask(block, Y.subId) : block,
          );
        else if (Y.kind === "bug")
          day.bugs = day.bugs.map((bug) =>
            bug.id === Y.bugId ? { ...bug, fixed: !bug.fixed } : bug,
          );
        else if (Y.kind === "habit" && deps.habits)
          return deps.habits.DDtoggleHabit(day, Y.habitId);
        return day;
      });
    }
    function deleteNodes() {
      if (wireId) return deleteWire();
      const nodes = layout.nodes.filter((n) => selected.has(n.id));
      if (!nodes.length && !selectedWires.size) return;
      commit((day) => {
        for (const edge of layout.edges.filter((e) => selectedWires.has(e.id) && e.automatic))
          day = DDdisconnectRelation(day, edge.from, edge.to, setup);
        const board = day.canvas?.board4;
        if (board) {
          board.links = (board.links || []).filter((e) => !selectedWires.has(e.id));
          if (Array.isArray(board.hidden)) board.hidden = board.hidden.filter((id) => !selectedWires.has(id));
        }
        return core.remove(day, nodes);
      }, t("Selection deleted · Undo to restore", "انتخاب حذف شد؛ با واگرد برگردان"));
      setSelected(new Set()); setWireSelection(null); onSelectBlock?.(null);
    }
    function duplicate() {
      const payload = core.copy(
        dayRef.current,
        layout.nodes,
        layout.edges,
        selected,
        mode,
      );
      if (payload)
        pastePayload(payload, {
          x: payload.origin.x + 32,
          y: payload.origin.y + 32,
        });
    }
    function revealEdit(Y) {
      if (
        Y.kind === "sticky" ||
        !prefs.boardAutoZoom ||
        cam.current.z >= 0.75 ||
        !viewport.current
      )
        return;
      const G = viewport.current,
        ct = Math.min(1.2, (G.clientWidth - 80) / Y.w);
      ((cam.current = {
        x: G.clientWidth / 2 - (Y.x + Y.w / 2) * ct,
        y: G.clientHeight / 2 - (Y.y + Y.h / 2) * ct,
        z: ct,
      }),
        queueCamera(),
        scheduleCamera());
    }
    function openEdit(Y) {
      const G = layout.map.get(Y);
      if (G?.kind === "emoji") { if (!locked.has(Y)) { finishEdit(); setStickerPicker({replace:G.noteId,current:G.symbol}); } return; }
      !G ||
        G.kind === "frame" ||
        G.kind === "lane" ||
        locked.has(Y) ||
        ((noteSession.current = null),
        setConnecting(null),
        setTool("select"),
        revealEdit(G),
        setEditing({
          ref: Y,
          value: G.kind === "day" ? day.focus || "" : G.title,
        }),
        setWireId(null));
    }
    function finishEdit(Y) {
      const G = editingRef.current;
      if (!G) return;
      ((editingRef.current = null), setEditing(null));
      noteSession.current = null;
      const ct = layout.map.get(G.ref),
        ot = (Y ?? G.value).trim();
      if (ct?.kind === "sticky") return;
      if (ct?.kind === "habit") {
        if (!ot && !ct.title)
          onUpdateSetup?.((s) => ({
            ...s,
            habits: (s.habits || []).filter((h) => h.id !== ct.habitId),
          }));
        else if (ot && ot !== ct.title)
          onUpdateSetup?.((s) => ({
            ...s,
            habits: (s.habits || []).map((h) =>
              h.id === ct.habitId ? { ...h, name: ot } : h,
            ),
          }));
        return;
      }
      if (ct?.kind === "bug" && !ot && !ct.title) {
        commit(
          (St) => ((St.bugs = St.bugs.filter((Tt) => Tt.id !== ct.bugId)), St),
          null,
          { history: !1 },
        );
        return;
      }
      !ct ||
        ot === ct.title ||
        commit(
          (St) => (
            ct.kind === "block"
              ? (St.blocks = St.blocks.map((Tt) =>
                  Tt.id === ct.blockId
                    ? { ...Tt, name: ot || DDUI("Untitled") }
                    : Tt,
                ))
              : ct.kind === "subtask"
                ? (St.blocks = St.blocks.map((Tt) =>
                    Tt.id === ct.blockId
                      ? {
                          ...Tt,
                          subtasks: updateSub(Tt.subtasks, ct.subId, (Pt) => ({
                            ...Pt,
                            text:
                              ot ||
                              DDUI(
                                "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646",
                              ),
                          })),
                        }
                      : Tt,
                  ))
                : ct.noteId
                  ? (St.notes = St.notes.map((Tt) =>
                      Tt.id === ct.noteId ? { ...Tt, text: ot } : Tt,
                    ))
                  : ct.kind === "bug"
                    ? (St.bugs = St.bugs.map((Tt) =>
                        Tt.id === ct.bugId
                          ? { ...Tt, text: ot || Tt.text }
                          : Tt,
                      ))
                    : ct.kind === "day" && (St.focus = ot),
            St
          ),
        );
    }
    function addChild() {
      if (!child?.value.trim()) return;
      const Y = {
        id: C(),
        text: child.value.trim(),
        done: !1,
        expanded: !0,
        children: [],
      };
      (commit(
        (G) => ({
          ...G,
          blocks: G.blocks.map((ct) =>
            ct.id === child.blockId
              ? {
                  ...ct,
                  expanded: !0,
                  subtasks: child.subId
                    ? updateSub(ct.subtasks, child.subId, (ot) => ({
                        ...ot,
                        expanded: !0,
                        children: [...(ot.children || []), Y],
                      }))
                    : [...(ct.subtasks || []), Y],
                }
              : ct,
          ),
        }),
        DDUI(
          "\u0642\u062F\u0645 \u062C\u062F\u06CC\u062F \u0627\u0636\u0627\u0641\u0647 \u0634\u062F",
        ),
      ),
        setChild(null));
    }
    // A new Life section at a spot on the canvas (inside the section under it, if any).
    function addLifeSection(point) {
      const frame = layout.map.get("section:life"),
        id = "lf-" + C();
      lifeChange((list) => {
        const b = life.DDlifeBounds(list);
        let rel = frame && point ? { x: point.x - frame.x, y: point.y - frame.y - life.DDlifeHead } : null,
          parent = "";
        if (rel) {
          const p = life.DDlifeParentAt(list, rel.x, rel.y);
          if (p) {
            const a = life.DDlifeAbs(list, p.id);
            parent = p.id;
            rel = { x: rel.x - a.x, y: rel.y - a.y };
          } else if (rel.x < 0 || rel.y < 0 || rel.x > b.w || rel.y > b.h) rel = null;
        }
        return life.DDlifeAdd(list, {
          id,
          type: "section",
          parent,
          ...(rel ? { x: Math.round(rel.x), y: Math.round(rel.y) } : {}),
        });
      });
      onToast?.(t("Section added to Life on every day", "سکشن به بخش زندگی همهٔ روزها اضافه شد"));
    }
    function addSticky(Y) {
      const G = C(),
        ct =
          Y ||
          toWorld(
            viewport.current.getBoundingClientRect().left +
              viewport.current.clientWidth / 2,
            viewport.current.getBoundingClientRect().top +
              viewport.current.clientHeight / 2,
          );
      (commit(
        (ot) => ({
          ...ot,
          notes: [
            ...ot.notes,
            {
              id: G,
              kind: "sticky",
              x: ct.x - 110,
              y: ct.y - 70,
              text: "",
              color: appearanceRef.current.stickyColor,
            },
          ],
          ...(mode === "lanes"
            ? {
                canvas: {
                  ...(ot.canvas || {}),
                  board4: {
                    ...clean(ot.canvas?.board4),
                    layouts: {
                      ...clean(ot.canvas?.board4).layouts,
                      lanes: {
                        ...(clean(ot.canvas?.board4).layouts.lanes || {}),
                        ["sticky:" + G]: { x: ct.x - 110, y: ct.y - 70 },
                      },
                    },
                  },
                },
              }
            : {}),
        }),
        DDUI(
          "\u06CC\u0627\u062F\u062F\u0627\u0634\u062A \u0633\u0627\u062E\u062A\u0647 \u0634\u062F",
        ),
      ),
        setSelected(new Set(["sticky:" + G])),
        setTool("select"),
        setEditing({ ref: "sticky:" + G, value: "" }));
    }
    // A new habit starts with an empty name, typed right on the board.
    function ddAddHabit() {
      if (!onUpdateSetup) return;
      const id = C(),
        palette = ["#E2683C", "#3F8CFF", "#2BA672", "#A35BEA", "#D39A00", "#D9434A", "#1E9BB3"];
      onUpdateSetup((s) => ({
        ...s,
        habits: [
          ...(s.habits || []),
          { id, name: "", emo: "", color: palette[(s.habits || []).length % palette.length] },
        ],
      }));
      setSelected(new Set(["habit:" + id]));
      setTool("select");
      setEditing({ ref: "habit:" + id, value: "" });
    }
    // Cards dropped into Habits become habits; a done card counts for today.
    function makeHabits(nodes) {
      if (!deps.habits || !onUpdateSetup || !nodes.length) return;
      const H = deps.habits,
        made = [];
      let list = setup.habits || [];
      for (const node of nodes) {
        const block = dayRef.current.blocks.find((b) => b.id === node.blockId);
        if (!block) continue;
        const result = H.DDhabitForBlock(list, block, node.color, C);
        list = result.habits;
        made.push({ block, habit: result.habit });
      }
      if (!made.length) return;
      onUpdateSetup((s) => {
        const habits = [...(s.habits || [])];
        for (const { habit } of made)
          if (!habits.some((h) => h.id === habit.id)) habits.push(habit);
        return { ...s, habits };
      });
      commit(
        (d) => {
          let next = core.remove(d, nodes);
          for (const { block, habit } of made)
            if (block.done)
              next = H.DDsetHabitEntry(next, habit.id, {
                done: true,
                min: measure.DDplanMinutes(block),
              });
          return next;
        },
        made.length === 1
          ? t("“" + made[0].habit.name + "” is now a habit", "«" + made[0].habit.name + "» حالا یک عادت است")
          : t("Cards are now habits", "کارت‌ها عادت شدند"),
      );
      setSelected(new Set(made.map(({ habit }) => "habit:" + habit.id)));
    }
    function ddAddFeeling(Y) {
      const G = C();
      (commit((ot) => {
        ot.bugs = [
          ...(ot.bugs || []),
          {
            id: G,
            text: "",
            type: "",
            on: "",
            fixed: !1,
            category: "inner",
            triggerTag: "general-friction",
            antidote: "",
          },
        ];
        const Tt = clean(ot.canvas?.board4);
        Tt.layouts = {
          ...Tt.layouts,
          [mode]: {
            ...(Tt.layouts[mode] || {}),
            ["bug:" + G]: { x: Y.x - 119, y: Y.y - 26 },
          },
        };
        ot.canvas = { ...(ot.canvas || {}), board4: Tt };
        return ot;
      }, DDUI("Feeling added")),
        setSelected(new Set(["bug:" + G])),
        setTool("select"),
        setEditing({ ref: "bug:" + G, value: "" }));
    }
    function addBlock(Y, G) {
      const ct = C(),
        ot =
          Y ??
          (mode === "lanes" && G
            ? layout.nodes.find(
                (St) =>
                  St.kind === "frame" &&
                  G.x >= St.x &&
                  G.x <= St.x + St.w &&
                  G.y >= St.y &&
                  G.y <= St.y + St.h,
              )?.laneId
            : void 0) ??
          setup.lanes[0]?.id ??
          "";
      (commit((St) => {
        if (
          (St.blocks.push({
            id: ct,
            name: "\u0628\u0644\u0627\u06A9 \u062C\u062F\u06CC\u062F",
            type: setup.types[0]?.id || "work",
            lane: ot,
            min: prefs.defaultMinutes,
            note: "",
            pri: 0,
            emo: "",
            done: !1,
            expanded: !0,
            subtasks: [],
          }),
          G)
        ) {
          const Tt = clean(St.canvas?.board4);
          ((Tt.layouts = {
            ...Tt.layouts,
            [mode]: { ...(Tt.layouts[mode] || {}), ["b:" + ct]: G },
          }),
            (St.canvas = { ...(St.canvas || {}), board4: Tt }));
        }
        return St;
      }, DDUI("\u0628\u0644\u0627\u06A9 \u062C\u062F\u06CC\u062F \u0633\u0627\u062E\u062A\u0647 \u0634\u062F")),
        setSelected(new Set(["b:" + ct])),
        onSelectBlock?.(ct),
        setTool("select"));
    }
    function convertSticky(Y) {
      const G = Y.title
          .split(
            `
`,
          )
          .map((ot) => ot.replace(/^[-*•\d.)\s]+/, "").trim())
          .filter(Boolean),
        ct = C();
      (commit(
        (ot) => ({
          ...ot,
          notes: ot.notes.filter((St) => St.id !== Y.noteId),
          blocks: [
            ...ot.blocks,
            {
              id: ct,
              name:
                G[0] ||
                DDUI(
                  "\u0627\u06CC\u062F\u0647 \u0627\u0632 \u0628\u0631\u062F",
                ),
              type: setup.types[0]?.id || "work",
              lane: setup.lanes[0]?.id || "",
              min: prefs.defaultMinutes,
              note: DDUI(
                "\u062A\u0628\u062F\u06CC\u0644\u200C\u0634\u062F\u0647 \u0627\u0632 \u06CC\u0627\u062F\u062F\u0627\u0634\u062A \u0628\u0631\u062F",
              ),
              pri: 0,
              emo: "",
              done: !1,
              expanded: !0,
              subtasks: G.slice(1).map((St) => ({
                id: C(),
                text: St,
                done: !1,
                expanded: !0,
                children: [],
              })),
            },
          ],
        }),
        DDUI(
          "\u06CC\u0627\u062F\u062F\u0627\u0634\u062A \u0628\u0647 \u0628\u0644\u0627\u06A9 \u0648 \u0642\u062F\u0645\u200C\u0647\u0627\u06CC \u067E\u0644\u0646 \u062A\u0628\u062F\u06CC\u0644 \u0634\u062F",
        ),
      ),
        setSelected(new Set(["b:" + ct])),
        onSelectBlock?.(ct));
    }
    function selectBranch() {
      if (!selectedNode) return;
      const Y = new Set([selectedNode.id]);
      let G = -1;
      for (; Y.size !== G; ) {
        G = Y.size;
        for (const ct of layout.automatic) Y.has(ct.from) && Y.add(ct.to);
      }
      setSelected(Y);
    }
    function groupSelection(Y = !1) {
      boardChange(
        (G) => {
          if (Y)
            for (const [ct, ot] of Object.entries(G.groups))
              ot.some((St) => selected.has(St)) && delete G.groups[ct];
          else
            selected.size > 1 &&
              (G.groups = { ...G.groups, [C()]: [...selected] });
          return G;
        },
        DDUI(
          Y
            ? "\u06AF\u0631\u0648\u0647 \u0628\u0627\u0632 \u0634\u062F"
            : "\u0646\u0648\u062F\u0647\u0627 \u06AF\u0631\u0648\u0647 \u0634\u062F\u0646\u062F",
        ),
      );
    }
    function autoArrange() {
      (boardChange(
        (Y) => ({ ...Y, layouts: { ...Y.layouts, [mode]: {} } }),
        DDUI(
          "\u0686\u06CC\u062F\u0645\u0627\u0646 \u062E\u0648\u062F\u06A9\u0627\u0631 \u0627\u0646\u062C\u0627\u0645 \u0634\u062F\u061B Undo \u0628\u0631\u0627\u06CC \u0628\u0631\u06AF\u0634\u062A",
        ),
      ),
        setTimeout(() => api.current.fit(!1), 0));
    }
    function minimapDown(Y) {
      (Y.preventDefault(), Y.stopPropagation());
      const G = mapSvg.current,
        ct = new DOMPoint(Y.clientX, Y.clientY).matrixTransform(
          G.getScreenCTM().inverse(),
        );
      ((cam.current = {
        ...cam.current,
        x: viewport.current.clientWidth / 2 - ct.x * cam.current.z,
        y: viewport.current.clientHeight / 2 - ct.y * cam.current.z,
      }),
        queueCamera(),
        scheduleCamera());
    }
    function download(Y, G, ct) {
      const ot = URL.createObjectURL(new Blob([Y], { type: ct })),
        St = document.createElement("a");
      ((St.href = ot),
        (St.download = G),
        St.click(),
        setTimeout(() => URL.revokeObjectURL(ot), 2e3));
    }
    function exportSVG() {
      const Y = selected.size
          ? layout.nodes.filter((Pt) => selected.has(Pt.id))
          : layout.nodes,
        G = nodeBounds(Y),
        ct = new Set(Y.map((Pt) => Pt.id)),
        ot = (Pt) =>
          String(Pt ?? "").replace(
            /[&<>"']/g,
            (yn) =>
              ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&apos;",
              })[yn],
          ),
        St =
          getComputedStyle(root.current).getPropertyValue("--paper").trim() ||
          "#F1F0EC";
      let Tt = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(G.w + 80)}" height="${Math.ceil(G.h + 80)}" viewBox="${G.x - 40} ${G.y - 40} ${G.w + 80} ${G.h + 80}"><rect x="${G.x - 40}" y="${G.y - 40}" width="${G.w + 80}" height="${G.h + 80}" fill="${St}"/>`;
      for (const Pt of layout.edges) {
        if (!ct.has(Pt.from) || !ct.has(Pt.to)) continue;
        const yn = wireGeometry(Pt);
        ((Tt += `<path d="${yn.d}" fill="none" stroke="${ot(Pt.color === "var(--now)" ? "#7A5FF5" : Pt.color || "#85827A")}" stroke-width="${Pt.width || 1.8}" opacity="${Pt.opacity ?? 1}" stroke-dasharray="${Pt.pattern === "dotted" ? "1 5" : Pt.dashed || Pt.pattern === "dashed" ? "6 5" : "none"}"/>`),
          Pt.label &&
            (Tt += `<text x="${yn.mid.x}" y="${yn.mid.y - 8}" font-family="Arial" font-size="12" text-anchor="middle">${ot(Pt.label)}</text>`));
      }
      for (const node of [...Y].sort(
        (a, b) =>
          (a.kind === "frame" ? 0 : a.stack) -
          (b.kind === "frame" ? 0 : b.stack),
      )) {
        if (node.kind === "emoji") {
          const art = elementRefs.current.get(node.id)?.querySelector("svg.dd-sticker-art");
          if (art) { const copy = art.cloneNode(true); copy.setAttribute("x", node.x); copy.setAttribute("y", node.y); copy.setAttribute("width", node.w); copy.setAttribute("height", node.h); Tt += '<g opacity="'+(node.opacity??1)+'">'+new XMLSerializer().serializeToString(copy)+'</g>'; }
          else Tt += '<text x="'+(node.x+node.w/2)+'" y="'+(node.y+node.h*.78)+'" text-anchor="middle" font-size="'+(Math.min(node.w,node.h)*.72)+'" opacity="'+(node.opacity??1)+'">'+ot(node.symbol || node.title)+'</text>';
          continue;
        }
        const size = node.textSize || 14,
          color = ["sticky", "day", "lane"].includes(node.kind)
            ? node.color
            : node.kind === "frame" || node.kind === "emoji"
              ? "none"
              : "#FFFFFF";
        const textColor = ["sticky", "day", "lane"].includes(node.kind)
          ? node.textColor
          : "#121211";
        const lines = ((node.emoji ? node.emoji + " " : "") + node.title)
          .split("\n")
          .slice(0, Math.max(1, Math.floor((node.h - 20) / (size * 1.5))));
        Tt += `<g opacity="${node.opacity ?? 1}"><rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="7" fill="${ot(color)}" stroke="#aaa"/>`;
        lines.forEach((line, i) => {
          Tt += `<text x="${node.x + 12}" y="${node.y + size + 10 + i * size * 1.5}" font-family="Arial,sans-serif" font-size="${size}" fill="${ot(textColor)}">${ot(line.slice(0, Math.max(1, Math.floor((node.w - 24) / (size * 0.55)))))}</text>`;
        });
        if (node.subtitle && node.kind !== "sticky")
          Tt += `<text x="${node.x + 12}" y="${node.y + 43}" font-family="Arial" font-size="11" fill="${node.kind === "lane" || node.kind === "day" ? "#ddd" : "#555"}">${ot(node.subtitle)}</text>`;
        Tt += "</g>";
      }
      download(
        Tt + "</svg>",
        "debug-day-board-" + day.date + ".svg",
        "image/svg+xml",
      );
    }
    ((api.current = {
      fit: fit,
      setZoom: setZoom,
      saveCamera: saveCamera,
      paintCamera: paintCamera,
      undo: undo,
      deleteNodes: deleteNodes,
      duplicate: duplicate,
      cancelGesture: cancelGesture,
      pointerMove: pointerMove,
      pointerUp: pointerUp,
      finishEdit: finishEdit,
    }),
      useEffect(() => {
        const n = ddSearchNode && layout.map.get(ddSearchNode.ref);
        if (!n || !viewport.current) return;
        setSelected(new Set([n.id]));
        const z = Math.min(1.2, (viewport.current.clientWidth - 80) / n.w);
        cam.current = {
          x: viewport.current.clientWidth / 2 - (n.x + n.w / 2) * z,
          y: viewport.current.clientHeight / 2 - (n.y + n.h / 2) * z,
          z,
        };
        queueCamera();
        scheduleCamera();
      }, [ddSearchNode]),
      useLayoutEffect(() => {
        paintCamera();
      }, [layout, mode, wireId, showMap, tick, focus, appearance]),
      useEffect(() => {
        const Y = viewport.current,
          G = (event) => {
            event.preventDefault();
            if (gesture.current) return;
            const unit =
              event.deltaMode === 1
                ? 16
                : event.deltaMode === 2
                  ? Y.clientHeight
                  : 1;
            const dx = event.deltaX * unit,
              dy = event.deltaY * unit;
            if (
              event.ctrlKey ||
              event.metaKey ||
              (appearanceRef.current.wheelZoom && !event.shiftKey)
            )
              api.current.setZoom(
                cam.current.z *
                  Math.exp(-Math.max(-120, Math.min(120, dy)) * 0.006),
                event.clientX,
                event.clientY,
              );
            else {
              cam.current = {
                ...cam.current,
                x: cam.current.x - (event.shiftKey && !dx ? dy : dx),
                y: cam.current.y - (event.shiftKey && !dx ? 0 : dy),
              };
              queueCamera();
              scheduleCamera();
            }
          };
        Y.addEventListener("wheel", G, { passive: !1 });
        const ct = new ResizeObserver(() => api.current.paintCamera());
        return (
          ct.observe(Y),
          () => {
            (Y.removeEventListener("wheel", G), ct.disconnect());
          }
        );
      }, []),
      useEffect(() => {
        const Y = (ot) => {
            if (
              ot.target.closest(
                "input,textarea,select,[contenteditable=true],.b6-context,.b6-properties,.b6-camera,.b6-view-panel,.dd-sticker-dialog",
              ) ||
              (ot.target.closest("[role=dialog]") &&
                !root.current?.contains(ot.target))
            )
              return;
            if (
              ot.target !== document.body &&
              !root.current?.contains(ot.target)
            )
              return;
            if (menu && ot.key === "Escape") {
              ot.preventDefault();
              setMenu(null);
              viewport.current?.focus({ preventScroll: true });
              return;
            }
            if (ot.key === " ") {
              (ot.preventDefault(),
                (space.current = !0),
                viewport.current?.classList.add("b4-panning"));
              return;
            }
            const St = ot.ctrlKey || ot.metaKey,
              K = core.shortcutKey(ot),
              latinLayout = /^[\x20-\x7e]$/.test(ot.key);
            if (St && K === "z") {
              (ot.preventDefault(),
                ot.stopImmediatePropagation(),
                undo(ot.shiftKey));
              return;
            }
            if (St && K === "y") {
              (ot.preventDefault(), ot.stopImmediatePropagation(), undo(!0));
              return;
            }
            if (ot.key === "Escape") {
              ddExitIsolation?.();
              (ot.preventDefault(),
                ot.stopImmediatePropagation(),
                !gesture.current &&
                  !selected.size &&
                  !wireId &&
                  !connecting &&
                  !help &&
                  !child &&
                  search === null &&
                  setFocus(!1),
                cancelGesture(),
                setMenu(null),
                setHelp(!1),
                setChild(null),
                setSearch(null),
                setConnecting(null),
                setWireId(null),
                setSelected(new Set()),
                setTool("select"));
              return;
            }
            if (
              (ot.key === "Delete" || ot.key === "Backspace") &&
              viewport.current?.contains(ot.target) &&
              (selected.size || wireId || selectedWires.size)
            ) {
              (ot.preventDefault(),
                ot.stopImmediatePropagation(),
                deleteNodes());
              return;
            }
            if (St && K === "d" && selected.size) {
              (ot.preventDefault(), ot.stopImmediatePropagation(), duplicate());
              return;
            }
            if (St && K === "g") {
              (ot.preventDefault(),
                ot.stopImmediatePropagation(),
                groupSelection(ot.shiftKey));
              return;
            }
            if (St && K === "a") {
              (ot.preventDefault(),
                ot.stopImmediatePropagation(),
                setSelected(
                  new Set(
                    layout.nodes
                      .filter(
                        (Pt) =>
                          Pt.kind !== "frame" &&
                          Pt.kind !== "section" &&
                          Pt.kind !== "day" &&
                          Pt.kind !== "lane",
                      )
                      .map((Pt) => Pt.id),
                  ),
                ),
                setWireId(null));
              return;
            }
            if (St && ["c", "x", "v"].includes(K)) {
              // Native copy/paste already fires on Latin layouts; other layouts need a nudge.
              if (latinLayout) return;
              ot.preventDefault();
              ot.stopImmediatePropagation();
              if (K === "v") pasteClipboard(null);
              else if (selected.size) copySelection(null, K === "x");
              return;
            }
            if (St || ot.altKey) return;
            if (ot.key === "ContextMenu" || (ot.shiftKey && ot.key === "F10")) {
              openContext(
                ot,
                selected.size
                  ? selectedNode
                    ? { ref: selectedNode.id }
                    : { selection: true }
                  : {
                      point: toWorld(
                        viewport.current.getBoundingClientRect().left +
                          viewport.current.clientWidth / 2,
                        viewport.current.getBoundingClientRect().top +
                          viewport.current.clientHeight / 2,
                      ),
                    },
              );
              return;
            }
            if (ot.shiftKey && ["Digit1", "Digit2"].includes(ot.code)) {
              ot.preventDefault();
              fit(ot.code === "Digit2");
              return;
            }
            if (["[", "]"].includes(ot.key) && selected.size) {
              ot.preventDefault();
              reorder(ot.key === "]" ? "forward" : "backward");
              return;
            }

            if (
              ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                ot.key,
              ) &&
              selected.size
            ) {
              (ot.preventDefault(), ot.stopImmediatePropagation());
              const Pt = ot.shiftKey ? 10 : 1,
                yn =
                  ot.key === "ArrowLeft"
                    ? -Pt
                    : ot.key === "ArrowRight"
                      ? Pt
                      : 0,
                An =
                  ot.key === "ArrowUp" ? -Pt : ot.key === "ArrowDown" ? Pt : 0,
                Kt = Date.now(),
                Dn = Kt - lastNudge.current < 400;
              ((lastNudge.current = Kt),
                commit(
                  (Jt) => {
                    const Xn = clean(Jt.canvas?.board4),
                      On = { ...(Xn.layouts[mode] || {}) };
                    for (const ra of selected) {
                      const ma = layout.map.get(ra);
                      if (!(!ma || locked.has(ra) || ma.memberOf))
                        if (ma.noteId && mode !== "lanes") {
                          const Oa = Jt.notes.find((fa) => fa.id === ma.noteId);
                          ((Oa.x += yn), (Oa.y += An));
                        } else On[ra] = { x: ma.x + yn, y: ma.y + An };
                    }
                    return (
                      (Xn.layouts = { ...Xn.layouts, [mode]: On }),
                      (Jt.canvas = { ...(Jt.canvas || {}), board4: Xn }),
                      Jt
                    );
                  },
                  null,
                  { history: !Dn },
                ));
              return;
            }
            if (ot.key === "Enter" && selectedNode) {
              (ot.preventDefault(), openEdit(selectedNode.id));
              return;
            }
            const Tt = K;
            if (Tt === "v") setTool("select");
            else if (Tt === "h") setTool("hand");
            else if (Tt === "c") setTool("connector");
            else if (Tt === "b") setTool("block");
            else if (Tt === "s" && ot.shiftKey) setTool("section");
            else if (Tt === "s") setTool("sticky");
            else if (Tt === "e") { finishEdit(); setStickerPicker({}); }
            else if (Tt === "f") (ot.preventDefault(), fit(ot.shiftKey));
            else if (Tt === "0") (ot.preventDefault(), setZoom(1));
            else if (Tt === "+" || Tt === "=")
              (ot.preventDefault(), setZoom(core.zoomStep(cam.current.z, 1)));
            else if (Tt === "-")
              (ot.preventDefault(), setZoom(core.zoomStep(cam.current.z, -1)));
            else if (Tt === "?") (ot.preventDefault(), setHelp((Pt) => !Pt));
            else return;
            ot.stopImmediatePropagation();
          },
          G = (ot) => {
            ot.key === " " &&
              ((space.current = !1),
              viewport.current?.classList.remove("b4-panning"));
          },
          ct = () => {
            ((space.current = !1),
              api.current.cancelGesture(),
              viewport.current?.classList.remove("b4-panning"));
          };
        return (
          window.addEventListener("keydown", Y, !0),
          window.addEventListener("keyup", G, !0),
          window.addEventListener("blur", ct),
          () => {
            (window.removeEventListener("keydown", Y, !0),
              window.removeEventListener("keyup", G, !0),
              window.removeEventListener("blur", ct));
          }
        );
      }, [
        selected,
        wireId,
        layout,
        model.locked,
        model.groups,
        mode,
        selectedNode,
        wireSelection,
        menu,
      ]),
      useEffect(() => {
        if (!DDreadBoardView(day.date, day.canvas?.board4).camera) {
          const Y = requestAnimationFrame(() => api.current.fit(!1));
          return () => cancelAnimationFrame(Y);
        }
      }, []),
      useEffect(() => {
        const Y = () => saveCamera();
        return (
          window.addEventListener("pagehide", Y),
          () => window.removeEventListener("pagehide", Y)
        );
      }, [mode]),
      useEffect(
        () => () => {
          ((mounted.current = !1),
            cancelAnimationFrame(cameraRAF.current),
            cancelAnimationFrame(moveRAF.current),
            clearTimeout(cameraTimer.current),
            (gesture.current = null),
            touches.current.clear());
        },
        [],
      ));
    const plannedMinutes = day.blocks
        .filter(isScheduled)
        .reduce((Y, G) => Y + measure.DDplanMinutes(G), 0),
      doneMinutes = day.blocks
        .filter((Y) => isScheduled(Y) && Y.done)
        .reduce((Y, G) => Y + measure.DDplanMinutes(G), 0),
      completion = DDcompletion(day, laneIds).percent;
    const shortcutKeys = [
      ["Undo", "Ctrl+Z"],
      ["Redo", "Ctrl+Shift+Z"],
      ["Fit all objects", "F"],
      ["Zoom to selection", "Shift+F"],
      ["Board help", "?"],
      ["Duplicate selection", "Ctrl+D"],
      ["Group selection", "Ctrl+G"],
      ["Delete selected nodes", "Delete"],
      ["Delete connection", "Delete"],
      ["Exit focus mode", "Esc"],
      ["Exit full screen", "Esc"],
    ];
    function selectMarquee(S, box) {
      (setSelected(S), setWireId(null));
      const ids = [];
      for (const e of layout.edges) {
        const p = wireRefs.current.get(e.id)?.querySelector("[data-wire-path]");
        if (!p) continue;
        let n = 0;
        try {
          n = p.getTotalLength();
        } catch {
          continue;
        }
        for (let i = 0; i <= 24; i++) {
          const q = p.getPointAtLength((n * i) / 24);
          if (
            q.x >= box.x &&
            q.x <= box.x + box.w &&
            q.y >= box.y &&
            q.y <= box.y + box.h
          ) {
            ids.push(e.id);
            break;
          }
        }
      }
      setWireSelection(ids.length ? { sel: S, ids } : null);
    }
    function toolButton(Y, G, ct, ot = {}, lb) {
      const k = shortcutKeys.find(([a]) => a === Y || DDUI(a) === Y);
      return _.createElement(
        "button",
        {
          type: "button",
          className: "b2-icon",
          "aria-label": DDUI(Y),
          "data-tip": DDUI(Y) + (k ? " \xB7 " + k[1] : ""),
          onClick: ct,
          ...ot,
        },
        G === "?"
          ? _.createElement(
              "b",
              { className: "dd-glyph", "aria-hidden": "true" },
              G,
            )
          : G &&
              _.createElement(controls.Icon, {
                React: _,
                name:
                  {
                    pen: "edit",
                    fit: "fit",
                    copy: "duplicate",
                    arrange: "align",
                    gridDots: "grid",
                    minimap: "map",
                    magnet: "snap",
                    "\u25A3": "lock",
                    sticky: "note",
                    tree: "branch",
                  }[G] || G,
              }),
        lb && _.createElement("span", { className: "dd-btn-label" }, lb),
      );
    }
    function nodeIcon(Y) {
      return Y.done
        ? _.createElement(z, { name: "check" })
        : Y.kind === "subtask"
          ? _.createElement("span", { className: "dd-step-box", "aria-hidden": true })
        : Y.emoji
          ? _.createElement(B, { emoji: Y.emoji, size: 17 })
          : _.createElement(z, {
              name:
                Y.icon ||
                (Y.kind === "bug"
                  ? "heart"
                  : Y.kind === "subtask"
                    ? "dot"
                    : "tree"),
            });
    }
    // Grow or shrink a note so its whole text shows.
    function fitNote(node) {
      const el = elementRefs.current.get(node.id),
        text = el?.querySelector(".dd-note-preview"),
        head = el?.querySelector(".b4-sticky-head");
      if (!text) return;
      const height = Math.round(
        Math.max(
          96,
          Math.min(1800, (head?.offsetHeight || 36) + text.scrollHeight + 4),
        ),
      );
      commit(
        (d) => core.setStyle(d, [node], { height }),
        t("Note fits its text", "اندازهٔ نوت با متن هماهنگ شد"),
      );
    }
    function saveNote(noteId, text) {
      const first = noteSession.current !== noteId;
      commit(
        (day) => ({
          ...day,
          notes: day.notes.map((note) =>
            note.id === noteId ? { ...note, text } : note,
          ),
        }),
        null,
        { history: first },
      );
      noteSession.current = noteId;
    }
    function noteEditor(node) {
      return _.createElement(
        "div",
        { className: "dd-note-editor" },
        _.createElement(
          "div",
          { className: "dd-note-editor-head" },
          _.createElement(
            "span",
            null,
            DDlanguage === "fa" ? "ذخیرهٔ خودکار" : "Saves as you type",
          ),
          _.createElement(
            "button",
            {
              type: "button",
              onClick: () => finishEdit(),
              "aria-label":
                DDlanguage === "fa"
                  ? "پایان ویرایش نوت"
                  : "Finish editing note",
            },
            DDlanguage === "fa" ? "تمام" : "Done",
          ),
        ),
        _.createElement("textarea", {
          key: node.id,
          autoFocus: true,
          dir: "auto",
          value: editing.value,
          maxLength: 4000,
          "aria-label": DDUI("Sticky note text"),
          placeholder: DDUI("Write your idea\u2026"),
          onPointerDown: (event) => event.stopPropagation(),
          onChange: (event) => {
            const value = event.target.value;
            setEditing({ ref: node.id, value });
            saveNote(node.noteId, value);
          },
          onBlur: (event) => {
            if (
              !event.currentTarget.parentElement.contains(event.relatedTarget)
            )
              finishEdit();
          },
          onKeyDown: (event) => {
            if (
              event.key === "Escape" ||
              (event.key === "Enter" && (event.ctrlKey || event.metaKey))
            ) {
              event.preventDefault();
              event.stopPropagation();
              finishEdit();
            }
          },
        }),
      );
    }
    function renderNode(Y) {
      if (Y.kind === "section")
        return _.createElement("div", {
          key: Y.id,
          ref: (el) => {
            el
              ? elementRefs.current.set(Y.id, el)
              : elementRefs.current.delete(Y.id);
          },
          className:
            "b4-card-section" +
            (selected.has(Y.memberOf) ? " is-active" : ""),
          "data-board-id": Y.id,
          "aria-hidden": true,
          style: {
            left: Y.x,
            top: Y.y,
            width: Y.w,
            height: Y.h,
            "--node-color": Y.color,
            zIndex: 3,
          },
        });
      const G = selected.has(Y.id),
        ct = locked.has(Y.id),
        ot = editing?.ref === Y.id,
        St = Y.kind === "frame",
        Tt = Y.kind === "sticky",
        Pt = Y.kind === "emoji",
        yn = Y.kind === "lane" || Y.kind === "day",
        An = ["block", "subtask", "bug", "habit"].includes(Y.kind);
      return _.createElement(
        "div",
        {
          key: Y.id,
          ref: (Kt) => {
            Kt
              ? elementRefs.current.set(Y.id, Kt)
              : elementRefs.current.delete(Y.id);
          },
          "data-board-id": Y.id,
          "data-node-kind": Y.kind,
          "data-section": Y.section || Y.sectionId,
          "data-member": Y.memberOf ? true : undefined,
          "data-node-done": !!Y.done,
          "data-level": Y.kind === "habit" ? Y.level : undefined,
          role: "group",
          "aria-label": Y.title + (Y.min ? ", " + w(Y.min) : ""),
          tabIndex: St ? -1 : 0,
          className:
            "b4-node b4-" +
            Y.kind +
            (G ? " selected" : "") +
            (ct ? " locked" : "") +
            (connecting === Y.id ? " connecting" : ""),
          style: {
            left: Y.x,
            top: Y.y,
            width: Y.w,
            height: Y.h,
            "--node-color": Y.color,
            "--node-text": Y.textColor,
            "--object-opacity": Y.opacity,
            "--object-size": (Y.textSize || 14) + "px",
            "--object-align": Y.textAlign || "start",
            background: St
              ? "var(--wash)"
              : Tt || Pt || yn
                ? Pt
                  ? "transparent"
                  : core.rgba(Y.color, Y.opacity)
                : `color-mix(in srgb, var(--panel) ${Y.opacity * 100}%, transparent)`,
            color: yn || Tt || Pt ? Y.textColor : "var(--pi)",
            zIndex: St ? 1 : Y.stack,
          },
          onPointerDown: (Kt) => nodeDown(Kt, Y),
          onDoubleClick: (Kt) => {
            (Kt.stopPropagation(), openEdit(Y.id));
          },
          onFocus: () => {},
          // A section is a place on the canvas: right-click gives the canvas menu.
          onContextMenu: (event) =>
            openContext(event, Y.section ? {} : { ref: Y.id }),
        },
        Pt
          ? _.createElement(B, { emoji: Y.symbol || Y.title, size: Math.max(24, Math.min(Y.w,Y.h)-10) })
          : _.createElement(
              _.Fragment,
              null,
              An &&
                _.createElement(
                  "button",
                  {
                    type: "button",
                    className: "b4-node-icon",
                    "aria-label": "Toggle " + Y.title,
                    title: DDUI(Y.done ? "Mark not done" : "Mark done"),
                    "aria-pressed": !!Y.done,
                    onClick: (Kt) => {
                      (Kt.stopPropagation(), toggleDone(Y));
                    },
                  },
                  nodeIcon(Y),
                ),
              An &&
                Y.done &&
                Y.kind !== "habit" &&
                _.createElement(
                  "span",
                  { className: "dd-done-badge" },
                  _.createElement(z, { name: "check" }),
                  DDUI(Y.kind === "bug" ? "Resolved" : "Done"),
                ),
              _.createElement(
                "div",
                { className: "b4-node-body" },
                ot && Tt
                  ? noteEditor(Y)
                  : ot
                    ? _.createElement("input", {
                        autoFocus: !0,
                        dir: "auto",
                        value: editing.value,
                        maxLength: Y.kind === "sticky" ? 4e3 : 300,
                        "aria-label": DDUI("Node title"),
                        onChange: (Kt) =>
                          setEditing({ ...editing, value: Kt.target.value }),
                        onPointerDown: (Kt) => Kt.stopPropagation(),
                        onBlur: (Kt) => finishEdit(Kt.target.value),
                        onKeyDown: (Kt) => {
                          (Kt.key === "Enter" &&
                            (Kt.preventDefault(), finishEdit(Kt.target.value)),
                            Kt.key === "Escape" &&
                              (Y.kind === "bug" && !Y.title
                                ? finishEdit("")
                                : ((editingRef.current = null),
                                  setEditing(null)),
                              Kt.stopPropagation()));
                        },
                      })
                    : Tt
                      ? _.createElement(
                          _.Fragment,
                          null,
                          _.createElement(
                            "div",
                            { className: "b4-sticky-head" },
                            _.createElement(
                              "button",
                              {
                                type: "button",
                                className: "dd-note-drag",
                                "data-drag-handle": true,
                                "aria-label":
                                  DDlanguage === "fa"
                                    ? "جابه‌جایی نوت"
                                    : "Move note",
                                title:
                                  DDlanguage === "fa"
                                    ? "برای جابه‌جایی بکش"
                                    : "Drag to move",
                                onPointerDown: (event) =>
                                  nodeDown(event, Y, true),
                                onClick: (event) => {
                                  event.stopPropagation();
                                },
                              },
                              "⠿",
                            ),
                            _.createElement("span", null, DDUI("یادداشت")),
                            _.createElement(
                              "button",
                              {
                                type: "button",
                                "aria-label":
                                  DDlanguage === "fa"
                                    ? "ویرایش نوت"
                                    : "Edit note",
                                onClick: () => openEdit(Y.id),
                              },
                              DDlanguage === "fa" ? "ویرایش" : "Edit",
                            ),
                            _.createElement(
                              "button",
                              {
                                type: "button",
                                title: DDUI("Convert note to plan"),
                                onClick: () => convertSticky(Y),
                              },
                              DDUI("→ پلن"),
                            ),
                          ),
                          _.createElement(
                            "div",
                            { className: "dd-note-preview", dir: "auto" },
                            Y.title || DDUI("Double-click or Edit to write"),
                          ),
                        )
                      : _.createElement(
                          _.Fragment,
                          null,
                          _.createElement(
                            "div",
                            {
                              className: "b4-node-title",
                              dir: "auto",
                              title: Y.title,
                            },
                            Y.kind === "day" &&
                              Y.emoji &&
                              _.createElement(B, { emoji: Y.emoji, size: 16 }),
                            Y.title,
                            Y.kind === "block" && Y.pri > 0 && _.createElement("small", { className: "dd-board-priority pri p" + Y.pri, title: DDpriorityLabel(Y.pri, DDlanguage) }, "P" + Y.pri),
                          ),
                          Y.kind === "block" && _.createElement(DDTaskTags, { React: _, task: Y, language: DDlanguage }),
                          Y.subtitle &&
                            _.createElement(
                              "div",
                              { className: "b4-node-subtitle", dir: "auto" },
                              _.createElement(
                                "b",
                                { "data-duration": !0 },
                                Y.min
                                  ? w(Y.min)
                                  : Y.subtitle.split(" \xB7 ")[0],
                              ),
                              _.createElement(
                                "span",
                                null,
                                Y.min
                                  ? Y.subtitle
                                      .replace(w(Y.min), "")
                                      .replace(/^ · /, "")
                                  : Y.subtitle.split(" \xB7 ").slice(1).join(" \xB7 "),
                              ),
                            ),
                        ),
              ),
              _.createElement(
                "div",
                { className: "b4-node-actions" },
                (Y.kind === "block" || Y.kind === "subtask") &&
                  _.createElement(
                    _.Fragment,
                    null,
                    Y.hasChildren &&
                      _.createElement(
                        "button",
                        {
                          type: "button",
                          "aria-label": "Toggle children of " + Y.title,
                          title: DDUI(Y.expanded ? "Collapse" : "Expand"),
                          "aria-expanded": Y.expanded,
                          onClick: () =>
                            commit((Kt) => ({
                              ...Kt,
                              blocks: Kt.blocks.map((Dn) =>
                                Dn.id === Y.blockId
                                  ? Y.kind === "block"
                                    ? { ...Dn, expanded: !Y.expanded }
                                    : {
                                        ...Dn,
                                        subtasks: updateSub(
                                          Dn.subtasks,
                                          Y.subId,
                                          (Jt) => ({
                                            ...Jt,
                                            expanded: !Y.expanded,
                                          }),
                                        ),
                                      }
                                  : Dn,
                              ),
                            })),
                        },
                        Y.expanded ? "\u2212" : "\u203A",
                      ),
                    _.createElement(
                      "button",
                      {
                        type: "button",
                        "aria-label": "Add child node under " + Y.title,
                        title: DDUI("Add sub-step"),
                        onClick: () =>
                          setChild({
                            blockId: Y.blockId,
                            subId: Y.subId || null,
                            value: "",
                          }),
                      },
                      "+",
                    ),
                  ),
                (Y.kind === "lane" || Y.kind === "frame") &&
                  _.createElement(
                    "button",
                    {
                      type: "button",
                      "aria-label": "Add to " + Y.title,
                      title: Y.section
                        ? t("Add here", "\u0627\u0641\u0632\u0648\u062f\u0646 \u0627\u06cc\u0646\u062c\u0627")
                        : DDUI("Add block here"),
                      onClick: () =>
                        Y.section === "life"
                          ? addLifeSection(null)
                          : Y.section === "feelings"
                          ? ddAddFeeling({ x: Y.x + 170, y: Y.y + Y.h - 40 })
                          : Y.section === "habits"
                            ? ddAddHabit()
                          : Y.section === "notes"
                            ? addSticky({ x: Y.x + 170, y: Y.y + Y.h + 90 })
                            : addBlock(Y.laneId),
                    },
                    "+",
                  ),
                ct &&
                  _.createElement("span", { title: DDUI("Locked") }, "\u25A3"),
              ),
            ),
        Tt &&
          !ct &&
          !ot &&
          (Y.memberOf ? ["s"] : ["sw", "se"]).map(
            (edge) =>
              _.createElement("button", {
                type: "button",
                key: edge,
                className: "b6-note-resize",
                "data-resize": true,
                "data-edge": edge,
                "aria-label":
                  t("Resize note", "تغییر اندازهٔ نوت") +
                  (edge === "se" || (Y.memberOf && edge === "s") ? "" : " (" + edge + ")"),
                title: t(
                  "Drag to resize (Shift keeps the shape). Double-click to fit the text.",
                  "برای تغییر اندازه بکش (با Shift شکلش حفظ می‌شود). دابل‌کلیک: اندازه به اندازهٔ متن",
                ),
                onDoubleClick: (event) => {
                  event.stopPropagation();
                  fitNote(Y);
                },
                onPointerDown: (event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  event.stopPropagation();
                  setSelected(new Set([Y.id]));
                  gesture.current = {
                    kind: "note-resize",
                    ref: Y.id,
                    edge,
                    x: Y.x,
                    y: Y.y,
                    width: Y.w,
                    height: Y.h,
                    sx: event.clientX,
                    sy: event.clientY,
                    pointerId: event.pointerId,
                    moved: false,
                  };
                  viewport.current.setPointerCapture(event.pointerId);
                },
              }),
          ),
        false &&
          _.createElement("span", {
            className: "b4-resize",
            "data-resize": !0,
            role: "slider",
            tabIndex: 0,
            "aria-label": "Duration of " + Y.title,
            "aria-valuemin": 15,
            "aria-valuemax": 720,
            "aria-valuenow": Y.min,
            onPointerDown: (Kt) => {
              (Kt.preventDefault(),
                Kt.stopPropagation(),
                (gesture.current = {
                  kind: "resize",
                  ref: Y.id,
                  blockId: Y.blockId,
                  startMin: Y.min,
                  min: Y.min,
                  sx: Kt.clientX,
                  sy: Kt.clientY,
                  pointerId: Kt.pointerId,
                  moved: !1,
                }),
                viewport.current.setPointerCapture(Kt.pointerId));
            },
            onKeyDown: (Kt) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(Kt.key)) {
                (Kt.preventDefault(), Kt.stopPropagation());
                const Dn =
                  Kt.key === "Home"
                    ? 15
                    : Kt.key === "End"
                      ? 720
                      : Math.max(
                          15,
                          Math.min(
                            720,
                            Y.min + (Kt.key === "ArrowRight" ? 15 : -15),
                          ),
                        );
                commit((Jt) => ({
                  ...Jt,
                  blocks: Jt.blocks.map((Xn) =>
                    Xn.id === Y.blockId ? { ...Xn, min: Dn } : Xn,
                  ),
                }));
              }
            },
          }),
        Y.section === "life" &&
          _.createElement(LifeBoard, {
            items: life.DDlifeItems(setup),
            getZoom: () => cam.current.z,
            language: DDlanguage,
            onChange: lifeChange,
            makeId: C,
            canDrag: () => !space.current && tool === "select",
            onBoardPointerDown: (e) => {
              if (tool === "section" || tool === "hand" || space.current) nodeDown(e, Y);
              else e.stopPropagation();
            },
          }),
        !ct &&
          ["left", "right", "top", "bottom"].map((Kt) =>
            _.createElement("button", {
              type: "button",
              key: Kt,
              className: "b4-port " + Kt,
              "data-port": Kt,
              "aria-label": "Connect from " + Y.title + " " + Kt,
              title: DDUI("Drag to connect"),
              onPointerDown: (Dn) => portDown(Dn, Y, Kt),
            }),
          ),
      );
    }
    // The selected card shows what belongs to it: category, note, steps and linked notes.
    // A selected habit: tick, minutes and its last weeks.
    function habitDetails(node) {
      const habit = (setup.habits || []).find((h) => h.id === node.habitId);
      if (!habit || !deps.habits) return null;
      return _.createElement(deps.habits.DDHabitDetails, {
        React: _,
        Emoji: B,
        habit,
        day,
        days: { ...(allDays || {}), [day.date]: day },
        date: day.date,
        setup,
        language: DDlanguage,
        onUpdateDay: (change) => commit((d) => change(d)),
        onUpdateSetup: (change) => onUpdateSetup?.(change),
        onClose: () => setDetails(false),
      });
    }
    // A selected feeling: the same words and choices as the Feelings page.
    function feelingDetails(node) {
      const bug = (day.bugs || []).find((b) => b.id === node.bugId);
      if (!bug) return null;
      const h = _.createElement,
        isLocked = locked.has(node.id),
        change = (patch, grouped) => {
          const first = !grouped || noteDraft.current !== "bug:" + bug.id;
          if (grouped) noteDraft.current = "bug:" + bug.id;
          commit(
            (d) => {
              d.bugs = d.bugs.map((b) => (b.id === bug.id ? { ...b, ...patch } : b));
              return d;
            },
            grouped ? null : t("Feeling updated", "احساس به‌روز شد"),
            { history: first },
          );
        },
        topics = deps.feelingTopics || [];
      return h(
        "aside",
        {
          className: "dd-card-details dd-feeling-details",
          dir: DDlanguage === "fa" ? "rtl" : "ltr",
          "aria-label": t("Feeling", "احساس"),
          style: { "--card-color": DDbugColor(bug) },
          onPointerDown: (event) => event.stopPropagation(),
        },
        h(
          "header",
          null,
          h("span", { className: "dd-card-swatch" }),
          h("strong", null, "💭 " + t("Feeling", "احساس")),
          h(
            "button",
            {
              type: "button",
              "aria-label": t("Hide details", "بستن جزئیات"),
              onClick: () => setDetails(false),
            },
            "×",
          ),
        ),
        h(
          "label",
          { className: "dd-card-field" },
          h("span", null, t("What are you feeling, or what happened?", "چه حسی داری، یا چه اتفاقی افتاد؟")),
          h("textarea", {
            dir: "auto",
            rows: 3,
            maxLength: 4000,
            value: bug.text || "",
            disabled: isLocked,
            onChange: (event) => change({ text: event.target.value }, true),
            onBlur: () => (noteDraft.current = null),
          }),
        ),
        topics.length > 0 &&
          h(
            "div",
            { className: "dd-card-field" },
            h("span", null, t("Topic", "موضوع")),
            h(
              "div",
              { className: "dd-feeling-topics", role: "group" },
              topics.map(([id, en, fa]) =>
                h(
                  "button",
                  {
                    key: id,
                    type: "button",
                    "aria-pressed": bug.category === id,
                    disabled: isLocked,
                    style: { "--topic": DDbugColor({ category: id }) },
                    onClick: () => change({ category: id, color: undefined }),
                  },
                  t(en, fa),
                ),
              ),
            ),
          ),
        h(
          "label",
          { className: "dd-card-field" },
          h("span", null, t("Related card", "کارت مرتبط")),
          h(
            "select",
            {
              value: day.blocks.some((b) => b.id === bug.blockId) ? bug.blockId : "",
              disabled: isLocked,
              onChange: (event) => change({ blockId: event.target.value, on: "" }),
            },
            h("option", { value: "" }, t("No specific card", "کارت خاصی نه")),
            day.blocks.map((b) =>
              h("option", { key: b.id, value: b.id }, b.name || DDUI("Untitled")),
            ),
          ),
        ),
        h(
          "label",
          { className: "dd-card-field" },
          h("span", null, t("What could help?", "چه چیزی می‌تواند کمک کند؟")),
          h("input", {
            dir: "auto",
            maxLength: 4000,
            value: bug.antidote || "",
            disabled: isLocked,
            onChange: (event) => change({ antidote: event.target.value }, true),
            onBlur: () => (noteDraft.current = null),
          }),
        ),
        h(
          "div",
          { className: "dd-feeling-actions" },
          h(
            "button",
            {
              type: "button",
              className: "btn",
              disabled: isLocked,
              "aria-pressed": !!bug.fixed,
              onClick: () => toggleDone(node),
            },
            bug.fixed ? t("Open again", "دوباره باز کن") : t("It passed", "گذشت"),
          ),
          h(
            "button",
            {
              type: "button",
              className: "textbtn",
              disabled: isLocked,
              onClick: () => {
                commit(
                  (d) => core.remove(d, [node]),
                  t("Feeling deleted · Undo to restore", "احساس حذف شد؛ با واگرد برگردان"),
                );
                setSelected(new Set());
              },
            },
            t("Delete", "حذف"),
          ),
        ),
      );
    }
    function cardDetails() {
      if (!details || properties || selectedWire || !selectedNode) return null;
      if (selectedNode.kind === "habit") return habitDetails(selectedNode);
      if (selectedNode.kind === "bug") return feelingDetails(selectedNode);
      if (!["block", "subtask"].includes(selectedNode.kind)) return null;
      const block = day.blocks.find((b) => b.id === selectedNode.blockId);
      if (!block) return null;
      const type = typeFor(block.type),
        color = block.color || type.color,
        ownRefs = new Set([
          "b:" + block.id,
          ...layout.nodes
            .filter((n) => n.kind === "subtask" && n.blockId === block.id)
            .map((n) => n.id),
        ]),
        linkedNotes = [
          ...new Set(
            layout.edges.flatMap((edge) =>
              ownRefs.has(edge.from) && edge.to.startsWith("sticky:")
                ? [edge.to.slice(7)]
                : ownRefs.has(edge.to) && edge.from.startsWith("sticky:")
                  ? [edge.from.slice(7)]
                  : [],
            ),
          ),
        ]
          .map((id) => (day.notes || []).find((n) => n.id === id))
          .filter(Boolean),
        feelings = (day.bugs || []).filter(
          (bug) =>
            bug.blockId === block.id ||
            (!bug.blockId &&
              bug.on &&
              bug.on.toLowerCase() === (block.name || "").toLowerCase()),
        ),
        isLocked = locked.has("b:" + block.id),
        changeMeasure = (change) =>
          !isLocked &&
          commit((d) => {
            d.blocks = d.blocks.map((b) => (b.id === block.id ? change(b) : b));
            return d;
          }),
        h = _.createElement;
      const step = (item, depth) =>
        h(
          "li",
          { key: item.id, style: { "--depth": depth } },
          h(
            "label",
            null,
            h("input", {
              type: "checkbox",
              checked: !!item.done,
              disabled: isLocked,
              onChange: () =>
                toggleDone({
                  id: "sub:" + block.id + ":" + item.id,
                  kind: "subtask",
                  blockId: block.id,
                  subId: item.id,
                }),
            }),
            h("span", { dir: "auto" }, item.text),
          ),
          item.children?.length
            ? h("ul", null, item.children.map((c) => step(c, depth + 1)))
            : null,
        );
      return h(
        "aside",
        {
          className: "dd-card-details",
          dir: DDlanguage === "fa" ? "rtl" : "ltr",
          "aria-label": t("Card details", "جزئیات کارت"),
          style: { "--card-color": color },
          onPointerDown: (event) => event.stopPropagation(),
        },
        h(
          "header",
          null,
          h("span", { className: "dd-card-swatch" }),
          h("strong", { dir: "auto" }, block.name || DDUI("Untitled")),
          h(
            "button",
            {
              type: "button",
              "aria-label": t("Hide card details", "بستن جزئیات"),
              onClick: () => setDetails(false),
            },
            "×",
          ),
        ),
        h(
          "label",
          { className: "dd-card-field" },
          h("span", null, t("Category", "دسته")),
          h(
            "select",
            {
              value: block.type,
              "aria-label": t("Category", "دسته"),
              disabled: isLocked,
              onChange: (event) => {
                const value = event.target.value;
                commit(
                  (d) => {
                    const b = d.blocks.find((b) => b.id === block.id);
                    if (b) {
                      b.type = value;
                      delete b.color;
                    }
                    return d;
                  },
                  t("Category changed", "دسته تغییر کرد"),
                );
              },
            },
            setup.types.map((type) =>
              h("option", { key: type.id, value: type.id }, DDUI(type.name)),
            ),
          ),
        ),
        h("label", { className: "dd-card-field" }, h("span", null, t("Lane", "لاین")),
          h("select", { value: laneIds.includes(block.lane) ? block.lane : "", disabled: isLocked, "aria-label": t("Task lane", "لاین کار"), onChange: (e) => { const lane = e.target.value; changeMeasure((b) => ({ ...b, lane })); } },
            ...setup.lanes.map((l) => h("option", { key: l.id, value: l.id }, l.name)), h("option", { value: "" }, t("Parked", "پارک‌شده")))),
        h(DDTaskMetadata, { React: _, task: block, language: DDlanguage, disabled: isLocked, onChange: (patch) => changeMeasure((b) => ({ ...b, ...patch })) }),
        h(
          "div",
          { className: "dd-card-field dd-card-time" },
          h("span", null, t("Measured by", "اندازه با")),
          h(measure.DDMeasurePicker, {
            React: _,
            block,
            language: DDlanguage,
            onChange: changeMeasure,
          }),
          measure.DDmeasureOf(block) === "time"
            ? h(
            "span",
            { className: "dd-card-minutes" },
            h("input", {
              type: "number",
              min: 5,
              max: 720,
              step: 5,
              value: block.min,
              disabled: isLocked,
              "aria-label": t("Minutes", "دقیقه"),
              onChange: (event) => {
                const value = Math.round(+event.target.value);
                if (!Number.isFinite(value) || value < 5 || value > 720) return;
                commit((d) => {
                  const b = d.blocks.find((b) => b.id === block.id);
                  if (b) b.min = value;
                  return d;
                });
              },
            }),
            h("small", null, t("min", "دقیقه") + " · " + w(block.min)),
          )
            : h(measure.DDMeasureControl, {
                React: _,
                block,
                language: DDlanguage,
                onChange: changeMeasure,
              }),
        ),
        h(
          "label",
          { className: "dd-card-field" },
          h("span", null, t("Note", "یادداشت")),
          h("textarea", {
            dir: "auto",
            rows: 3,
            maxLength: 4000,
            value: block.note || "",
            disabled: isLocked,
            placeholder: t("Anything to remember about this card…", "چیزی که می‌خواهی یادت بماند…"),
            onChange: (event) => {
              const value = event.target.value,
                first = noteDraft.current !== block.id;
              noteDraft.current = block.id;
              commit(
                (d) => {
                  const b = d.blocks.find((b) => b.id === block.id);
                  if (b) b.note = value;
                  return d;
                },
                null,
                { history: first },
              );
            },
            onBlur: () => (noteDraft.current = null),
          }),
        ),
        block.subtasks?.length
          ? h(
              "div",
              { className: "dd-card-field" },
              h(
                "span",
                null,
                t("Steps", "قدم‌ها") +
                  " · " +
                  de(block.subtasks).done +
                  "/" +
                  de(block.subtasks).total,
              ),
              h("ul", { className: "dd-card-steps" }, block.subtasks.map((c) => step(c, 0))),
            )
          : null,
        linkedNotes.length || feelings.length
          ? h(
              "div",
              { className: "dd-card-field" },
              h("span", null, t("Linked", "مرتبط")),
              h(
                "ul",
                { className: "dd-card-linked" },
                linkedNotes.map((note) =>
                  h(
                    "li",
                    { key: note.id },
                    h(
                      "button",
                      {
                        type: "button",
                        dir: "auto",
                        style: { "--chip": note.color || "#FFE27A" },
                        onClick: () => {
                          setSelected(new Set(["sticky:" + note.id]));
                          setWireId(null);
                        },
                      },
                      (note.text || t("Empty note", "یادداشت خالی")).slice(0, 140),
                    ),
                  ),
                ),
                feelings.map((bug) =>
                  h(
                    "li",
                    { key: bug.id },
                    h(
                      "button",
                      {
                        type: "button",
                        dir: "auto",
                        className: "is-feeling",
                        style: { "--chip": DDbugColor(bug) },
                        onClick: () => {
                          if (layout.map.has("bug:" + bug.id))
                            setSelected(new Set(["bug:" + bug.id]));
                        },
                      },
                      bug.text,
                    ),
                  ),
                ),
              ),
            )
          : null,
        h(
          "button",
          {
            type: "button",
            className: "dd-card-add",
            disabled: isLocked,
            onClick: () =>
              setChild({
                blockId: block.id,
                subId: selectedNode.subId || null,
                value: "",
              }),
          },
          "+ " + t("Add a step", "افزودن قدم"),
        ),
      );
    }
    function changeAppearance(patch) {
      const next = { ...appearanceRef.current, ...patch };
      appearanceRef.current = next;
      core.remember("debug-day:board-appearance", next);
      setAppearance(next);
      queueCamera();
    }
    function toggleView(key) {
      const value = key === "grid" ? !grid : key === "snap" ? !snap : !showMap;
      core.remember("debug-day:board-" + key, value);
      if (key === "grid") setGrid(value);
      else if (key === "snap") setSnap(value);
      else setShowMap(value);
    }
    function openContext(event, target = {}) {
      if (event.target.closest("input,textarea,select,[contenteditable=true]"))
        return;
      event.preventDefault();
      event.stopPropagation();
      if (suppressContext.current) return;
      if (gesture.current?.kind === "pan" && gesture.current.right) {
        pendingContext.current = {
          target,
          clientX: event.clientX,
          clientY: event.clientY,
        };
        return;
      }
      finishEdit();
      restoreStylePreview();
      setProperties(false);
      setViewPanel(false);
      setInspector(false);
      if (target.ref) {
        if (!selected.has(target.ref)) selectOne(target.ref);
        else setWireId(null);
      } else if (target.wire) {
        setSelected(new Set());
        setWireSelection(null);
        setWireId(target.wire);
      }
      const rect = root.current.getBoundingClientRect();
      const anchor =
        event.currentTarget.getBoundingClientRect?.() ||
        viewport.current.getBoundingClientRect();
      setMenu({
        ...target,
        x: (event.clientX || anchor.left + anchor.width / 2) - rect.left,
        y: (event.clientY || anchor.bottom) - rect.top,
        stamp: performance.now(),
      });
    }
    function closeContext(focus = false) {
      setMenu(null);
      if (focus) viewport.current?.focus({ preventScroll: true });
    }
    function restoreStylePreview() {
      if (!(stylePreview.current instanceof Map)) return;
      for (const [el, styles] of stylePreview.current)
        for (const [key, value] of Object.entries(styles))
          el.style.setProperty(key, value);
      stylePreview.current = false;
    }
    function temporary(el, patch) {
      if (!el) return;
      if (!(stylePreview.current instanceof Map))
        stylePreview.current = new Map();
      const old = stylePreview.current.get(el) || {};
      for (const [key, value] of Object.entries(patch)) {
        if (!(key in old)) old[key] = el.style.getPropertyValue(key);
        el.style.setProperty(key, value);
      }
      stylePreview.current.set(el, old);
    }
    function previewStyle(patch) {
      for (const n of selectedNodes) {
        if (locked.has(n.id)) continue;
        const el = elementRefs.current.get(n.id),
          opacity = patch.opacity ?? n.opacity;
        const bg =
          n.kind === "sticky" || n.kind === "day" || n.kind === "lane"
            ? core.rgba(patch.fill || n.color, opacity)
            : `color-mix(in srgb, var(--panel) ${opacity * 100}%, transparent)`;
        temporary(el, {
          ...(patch.fill ? { "--node-color": patch.fill } : {}),
          ...(patch.fill && n.kind === "frame" ? { "--node-text": core.contrast(patch.fill) } : {}),
          "--object-opacity": String(opacity),
          background: bg,
        });
      }
    }
    function previewWire(patch) {
      const el = wireRefs.current.get(wireId)?.querySelector(".b4-wire-line");
      temporary(el, {
        ...(patch.color ? { stroke: patch.color } : {}),
        ...(patch.opacity !== undefined
          ? { opacity: String(patch.opacity) }
          : {}),
      });
    }
    function applyStyle(patch) {
      restoreStylePreview();
      commit(
        (d) => core.setStyle(d, selectedNodes, patch),
        t("Appearance updated", "ظاهر تغییر کرد"),
      );
      if (
        patch.fill &&
        selectedNodes.some((n) => n.kind === "sticky" && !n.locked)
      )
        changeAppearance({ stickyColor: patch.fill });
    }
    function placeSelection(patch) {
      const nodes = selectedNodes.filter((n) => !locked.has(n.id)),
        box = core.bounds(nodes);
      const positions = Object.fromEntries(
        nodes.map((n) => [
          n.id,
          {
            x: n.x + (patch.x === undefined ? 0 : patch.x - box.x),
            y: n.y + (patch.y === undefined ? 0 : patch.y - box.y),
          },
        ]),
      );
      commit(
        (d) => core.place(d, nodes, positions, mode),
        t("Position updated", "موقعیت تغییر کرد"),
      );
    }
    function arrangeSelection(operation) {
      const nodes = selectedNodes.filter(
        (n) => !locked.has(n.id) && n.kind !== "frame",
      );
      commit(
        (d) => core.place(d, nodes, core.arrange(nodes, operation), mode),
        t("Selection aligned", "انتخاب تراز شد"),
      );
    }
    function reorder(direction) {
      commit(
        (d) =>
          core.reorder(
            d,
            layout.nodes.filter((n) => n.kind !== "frame").map((n) => n.id),
            new Set([...selected].filter((ref) => !locked.has(ref))),
            direction,
          ),
        t("Layer order updated", "ترتیب لایه‌ها تغییر کرد"),
      );
    }
    function toggleLock() {
      boardChange(
        (b) => ({
          ...b,
          locked: [
            ...new Set([
              ...b.locked.filter((ref) => !selected.has(ref)),
              ...([...selected].some((ref) => !locked.has(ref))
                ? [...selected]
                : []),
            ]),
          ],
        }),
        t("Lock updated", "قفل تغییر کرد"),
      );
    }
    function copySelection(event, cut = false) {
      const nodes = cut
        ? layout.nodes.filter((n) => !locked.has(n.id))
        : layout.nodes;
      const payload = core.copy(
        dayRef.current,
        nodes,
        layout.edges,
        selected,
        mode,
      );
      if (!payload) return;
      clipboard.current = sharedClipboard = payload;
      if (event?.clipboardData) {
        event.preventDefault();
        event.stopImmediatePropagation();
        event.clipboardData.setData(
          "application/x-debug-day-board",
          JSON.stringify(payload),
        );
        event.clipboardData.setData("text/plain", payload.text);
      } else navigator.clipboard?.writeText(payload.text).catch(() => {});
      if (cut) {
        commit(
          (d) =>
            core.remove(
              d,
              nodes.filter((n) => selected.has(n.id)),
            ),
          t("Selection cut", "انتخاب بریده شد"),
        );
        setSelected(new Set());
      } else
        setStatus(
          t("Copied · paste anywhere on the board", "کپی شد؛ هرجای برد بچسبان"),
        );
    }
    function pastePayload(payload, point) {
      finishEdit();
      const rect = viewport.current.getBoundingClientRect();
      const at =
        point ||
        toWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const result = core.paste(dayRef.current, payload, at, mode, C);
      if (!result.refs.length) return;
      commit(() => result.day, t("Pasted", "چسبانده شد"));
      setSelected(new Set(result.refs));
      setWireId(null);
      setWireSelection(null);
      setTool("select");
    }
    function pasteText(text, point) {
      if (!text?.trim()) return;
      const payload = {
        version: 1,
        origin: { x: 0, y: 0 },
        items: [
          {
            kind: "sticky",
            ref: "sticky:clipboard",
            x: 0,
            y: 0,
            data: {
              id: "clipboard",
              kind: "sticky",
              text: text.slice(0, 4000),
              color: appearanceRef.current.stickyColor,
            },
          },
        ],
        links: [],
      };
      pastePayload(payload, point);
    }
    async function pasteClipboard(point, event) {
      let text = "",
        payload;
      clipboard.current ||= sharedClipboard;
      if (!event && clipboard.current) {
        pastePayload(clipboard.current, point);
        return;
      }
      if (event?.clipboardData) {
        try {
          payload = core.clipboard(
            JSON.parse(
              event.clipboardData.getData("application/x-debug-day-board"),
            ),
          );
        } catch {}
        text = event.clipboardData.getData("text/plain");
        if (!payload && !text) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      } else {
        try {
          text = await navigator.clipboard.readText();
        } catch {}
      }
      if (
        !payload &&
        clipboard.current &&
        (!text || text === clipboard.current.text)
      )
        payload = clipboard.current;
      if (payload) pastePayload(payload, point);
      else if (text) pasteText(text, point);
      else
        setStatus(
          t(
            "Use Ctrl/Cmd+V to paste from your clipboard",
            "برای چسباندن از کلیپ‌بورد Ctrl/Cmd+V را بزن",
          ),
        );
    }
    useEffect(() => {
      const inside = (event) =>
        root.current?.contains(event.target) &&
        !event.target.closest("input,textarea,select,[contenteditable=true]");
      const onCopy = (event) => {
          if (inside(event)) copySelection(event);
        },
        onCut = (event) => {
          if (inside(event)) copySelection(event, true);
        },
        onPaste = (event) => {
          if (inside(event)) pasteClipboard(null, event);
        };
      document.addEventListener("copy", onCopy);
      document.addEventListener("cut", onCut);
      document.addEventListener("paste", onPaste);
      return () => {
        document.removeEventListener("copy", onCopy);
        document.removeEventListener("cut", onCut);
        document.removeEventListener("paste", onPaste);
      };
    }, [selected, layout, mode]);
    useEffect(() => () => restoreStylePreview(), [selected, wireId]);
    function contextItems() {
      const item = (id, en, fa, icon, action, rest = {}) => ({
        id,
        label: t(en, fa),
        icon,
        action,
        ...rest,
      });
      const sep = (id) => ({ id, separator: true });
      const editable = selectedNodes.some((n) => !locked.has(n.id)),
        copyable = selectedNodes.some((n) =>
          ["block", "subtask", "sticky", "emoji", "bug"].includes(n.kind),
        );
      const showProperties = () => {
        setProperties(true);
        setInspector(true);
        setViewPanel(false);
        requestAnimationFrame(() =>
          root.current
            ?.querySelector(".b6-properties button")
            ?.focus({ preventScroll: true }),
        );
      };
      const styleItems = [
        item(
          "properties",
          "Color & properties…",
          "رنگ و ویژگی‌ها…",
          "palette",
          showProperties,
        ),
        item("opacity", "Opacity", "شفافیت", "opacity", null, {
          children: [100, 75, 50, 25, 0].map((n) =>
            item(
              "alpha-" + n,
              n + "%",
              n + "٪",
              "opacity",
              () =>
                menu.wire
                  ? patchWire(wireId, { opacity: n / 100 })
                  : applyStyle({ opacity: n / 100 }),
              {
                checked: menu.wire
                  ? (selectedWire?.opacity ?? 1) === n / 100
                  : selectedNodes.every((node) => node.opacity === n / 100),
                disabled: !menu.wire && !editable,
              },
            ),
          ),
        }),
      ];
      if (menu.wire)
        return [
          ...styleItems,
          sep("route-sep"),
          item("route", "Connection route", "مسیر اتصال", "connector", null, {
            children: [
              ["curve", "Curved", "منحنی"],
              ["straight", "Straight", "مستقیم"],
              ["elbow", "Elbow", "زاویه‌دار"],
            ].map(([style, en, fa]) =>
              item(
                style,
                en,
                fa,
                "connector",
                () => patchWire(wireId, { style, bend: null }),
                { checked: (selectedWire?.style || "curve") === style },
              ),
            ),
          }),
          item(
            "arrow",
            "Arrow at the end",
            "فلش در انتها",
            "arrow",
            () => patchWire(wireId, { arrow: !selectedWire?.arrow }),
            { checked: !!selectedWire?.arrow },
          ),
          item("reverse", "Reverse direction", "معکوس کردن جهت", "swap", () =>
            patchWire(wireId, {
              from: selectedWire.to,
              to: selectedWire.from,
              fromPort: selectedWire.toPort,
              toPort: selectedWire.fromPort,
            }),
          ),
          item("reset-route", "Reset route", "بازنشانی مسیر", "undo", () =>
            patchWire(wireId, { bend: null, fromPort: null, toPort: null }),
          ),
          sep("delete-sep"),
          item(
            "delete-wire",
            "Delete connection",
            "حذف اتصال",
            "trash",
            () => deleteWire(),
            { danger: true, shortcut: "Delete" },
          ),
        ];
      if (menu.ref || menu.selection) {
        const allLocked =
          selectedNodes.length > 0 &&
          selectedNodes.every((n) => locked.has(n.id));
        const align = [
          ["left", "Align left", "تراز چپ"],
          ["center-x", "Align horizontal centers", "تراز مرکز افقی"],
          ["right", "Align right", "تراز راست"],
          ["top", "Align top", "تراز بالا"],
          ["center-y", "Align vertical centers", "تراز مرکز عمودی"],
          ["bottom", "Align bottom", "تراز پایین"],
          ["distribute-x", "Distribute horizontally", "فاصلهٔ افقی برابر"],
          ["distribute-y", "Distribute vertically", "فاصلهٔ عمودی برابر"],
        ];
        return [
          selectedNode &&
            item(
              "edit",
              selectedNode.kind === "emoji" ? "Change sticker / emoji" : "Edit text",
              selectedNode.kind === "emoji" ? "تغییر استیکر / ایموجی" : "ویرایش متن",
              "edit",
              () => openEdit(selectedNode.id),
              {
                disabled: allLocked || selectedNode.kind === "frame",
                shortcut: "Enter",
              },
            ),
          ...styleItems,
          selectedNode?.kind === "block" && item("task-symbol","Change task sticker / emoji","تغییر استیکر / ایموجی کار","spark",()=>{finishEdit();setStickerPicker({target:selectedNode.blockId,current:selectedNode.emoji});},{disabled:allLocked}),
          sep("clipboard-sep"),
          item("copy", "Copy", "کپی", "copy", () => copySelection(), {
            disabled: !copyable,
            shortcut: "Ctrl/Cmd+C",
          }),
          item("cut", "Cut", "برش", "cut", () => copySelection(null, true), {
            disabled: !copyable || !editable,
            shortcut: "Ctrl/Cmd+X",
          }),
          item(
            "duplicate",
            "Duplicate",
            "ساخت کپی مستقل",
            "duplicate",
            duplicate,
            { disabled: !copyable, shortcut: "Ctrl/Cmd+D" },
          ),
          sep("position-sep"),
          item(
            "align",
            "Align & distribute",
            "تراز و فاصله‌گذاری",
            "align",
            null,
            {
              disabled: selectedNodes.filter((n) => !n.locked).length < 2,
              children: align.map(([op, en, fa]) =>
                item(op, en, fa, "align", () => arrangeSelection(op), {
                  disabled:
                    op.startsWith("distribute") &&
                    selectedNodes.filter((n) => !n.locked).length < 3,
                }),
              ),
            },
          ),
          item("layers", "Layer order", "ترتیب لایه‌ها", "layers", null, {
            disabled: !editable,
            children: [
              ["front", "Bring to front", "آوردن به جلو"],
              ["forward", "Bring forward", "یک لایه جلو"],
              ["backward", "Send backward", "یک لایه عقب"],
              ["back", "Send to back", "فرستادن به پشت"],
            ].map(([op, en, fa]) =>
              item(op, en, fa, "layers", () => reorder(op)),
            ),
          }),
          item("group", "Group", "گروه‌کردن", "group", () => groupSelection(), {
            disabled: selected.size < 2,
            shortcut: "Ctrl/Cmd+G",
          }),
          Object.values(model.groups).some((refs) =>
            refs.some((ref) => selected.has(ref)),
          ) &&
            item(
              "ungroup",
              "Ungroup",
              "بازکردن گروه",
              "ungroup",
              () => groupSelection(true),
              { shortcut: "Ctrl/Cmd+Shift+G" },
            ),
          item(
            "lock",
            allLocked ? "Unlock" : "Lock",
            allLocked ? "بازکردن قفل" : "قفل‌کردن",
            allLocked ? "unlock" : "lock",
            toggleLock,
          ),
          sep("link-sep"),
          selectedNode &&
            item(
              "connect",
              "Connect from here",
              "اتصال از اینجا",
              "connector",
              () => {
                setConnecting(selectedNode.id);
                setTool("connector");
              },
              { disabled: allLocked },
            ),
          selectedNode?.kind === "sticky" &&
            item(
              "convert",
              "Convert note to task",
              "تبدیل نوت به کار",
              "task",
              () => convertSticky(selectedNode),
              { disabled: allLocked },
            ),
          selectedNode &&
            mode === "mindmap" &&
            item(
              "branch",
              "Select branch",
              "انتخاب شاخه",
              "branch",
              selectBranch,
            ),
          item(
            "fit-selection",
            "Zoom to selection",
            "نمایش انتخاب",
            "fit",
            () => fit(true),
            { shortcut: "Shift+2" },
          ),
          sep("delete-sep"),
          item(
            "delete",
            "Delete selection",
            "حذف انتخاب",
            "trash",
            deleteNodes,
            {
              danger: true,
              disabled: !editable || !copyable,
              shortcut: "Delete",
            },
          ),
        ];
      }
      return [
        item("add-note", "Add note here", "افزودن نوت اینجا", "note", () =>
          addSticky(menu.point),
        ),
        item("add-symbol","Add sticker / emoji here","افزودن استیکر / ایموجی اینجا","spark",()=>{finishEdit();setStickerPicker({point:menu.point});}),
        item("add-task", "Add task here", "افزودن کار اینجا", "task", () =>
          addBlock(null, menu.point),
        ),
        item(
          "add-feeling",
          "Add feeling here",
          "افزودن احساس اینجا",
          "feeling",
          () => ddAddFeeling(menu.point),
        ),
        sep("paste-sep"),
        item(
          "paste",
          "Paste here",
          "چسباندن اینجا",
          "paste",
          () => pasteClipboard(menu.point),
          { shortcut: "Ctrl/Cmd+V" },
        ),
        item(
          "select-all",
          "Select all objects",
          "انتخاب همهٔ اشیا",
          "select",
          () => {
            setSelected(
              new Set(
                layout.nodes
                  .filter((n) => !["day", "lane", "frame"].includes(n.kind))
                  .map((n) => n.id),
              ),
            );
            setWireId(null);
          },
          { shortcut: "Ctrl/Cmd+A" },
        ),
        sep("view-sep"),
        item(
          "fit-all",
          "Fit all objects",
          "نمایش همهٔ اشیا",
          "fit",
          () => fit(false),
          { shortcut: "Shift+1" },
        ),
        item("zoom-100", "Zoom to 100%", "زوم ۱۰۰٪", "zoom", () => setZoom(1), {
          shortcut: "0",
        }),
        item("view", "Canvas settings…", "تنظیمات بوم…", "settings", () => {
          setViewPanel(true);
          setProperties(false);
          setInspector(false);
        }),
        item(
          "grid",
          "Dot grid",
          "شبکهٔ نقطه‌ای",
          "grid",
          () => toggleView("grid"),
          { checked: grid },
        ),
        sep("history-sep"),
        item("undo", "Undo", "واگرد", "undo", () => undo(), {
          disabled: !history.current.past.length,
          shortcut: "Ctrl/Cmd+Z",
        }),
        item("redo", "Redo", "انجام مجدد", "redo", () => undo(true), {
          disabled: !history.current.future.length,
          shortcut: "Ctrl/Cmd+Shift+Z",
        }),
        item("layout", "Layout options", "گزینه‌های چیدمان", "align", null, {
          children: [
            item(
              "reset-layout",
              "Reset task positions",
              "بازنشانی جای کارها",
              "undo",
              autoArrange,
            ),
            model.hidden.length > 0 &&
              item(
                "restore-links",
                "Restore hidden connections",
                "برگرداندن اتصال‌های پنهان",
                "connector",
                () =>
                  boardChange(
                    (b) => ({ ...b, hidden: [] }),
                    t("Connections restored", "اتصال‌ها برگشتند"),
                  ),
              ),
          ].filter(Boolean),
        }),
      ];
    }

    const selectedNodes = [...selected]
        .map((Y) => layout.map.get(Y))
        .filter(Boolean),
      titleFor = (Y) => layout.map.get(Y)?.title || Y;
    return _.createElement(
      "section",
      {
        className: "b2 b4 b6" + (focus ? " focus-mode" : ""),
        id: "b2",
        ref: root,
        "aria-label": DDUI("Board workspace"),
        onContextMenu: (event) => {
          if (
            event.target.closest(
              "button,input,textarea,select,[contenteditable],[data-wire-id],[data-board-id],.b6-context",
            )
          )
            return;
          openContext(event, { point: toWorld(event.clientX, event.clientY) });
        },
      },
      _.createElement(
        "header",
        { className: "b2-top" },
        _.createElement(
          "div",
          { className: "b2-brandbar" },
          _.createElement(
            "div",
            null,
            _.createElement(
              "strong",
              null,
              DDUI("\u0628\u0631\u062F \u062E\u0644\u0627\u0642\u06CC\u062A"),
            ),
            _.createElement(
              "small",
              null,
              ie.format(E(day.date)),
              " \xB7 ",
              completion,
              DDUI("% \u0627\u0646\u062C\u0627\u0645\u200C\u0634\u062F\u0647"),
            ),
          ),
          _.createElement(
            "div",
            {
              className: "b4-modes",
              role: "group",
              "aria-label": DDUI("Board structure mode"),
            },
            _.createElement(
              "button",
              {
                type: "button",
                "aria-pressed": mode === "mindmap",
                onClick: () => {
                  (finishEdit(),
                    setMode("mindmap"),
                    setSelected(new Set()),
                    setWireId(null),
                    DDsaveBoardView(
                      dayRef.current.date,
                      { ...cam.current },
                      "mindmap",
                    ),
                    setTimeout(() => api.current.fit(!1), 0));
                },
              },
              DDUI("\u0645\u0627\u06CC\u0646\u062F\u0645\u067E"),
            ),
            _.createElement(
              "button",
              {
                type: "button",
                "aria-pressed": mode === "lanes",
                onClick: () => {
                  (finishEdit(),
                    setMode("lanes"),
                    setSelected(new Set()),
                    setWireId(null),
                    DDsaveBoardView(
                      dayRef.current.date,
                      { ...cam.current },
                      "lanes",
                    ),
                    setTimeout(() => api.current.fit(!1), 0));
                },
              },
              DDUI("\u0644\u0627\u06CC\u0646\u200C\u0647\u0627"),
            ),
          ),
        ),
        _.createElement(
          "div",
          { className: "b2-top-actions" },
          toolButton(DDUI("Undo"), "undo", () => undo(), {
            disabled: !history.current.past.length,
          }),
          toolButton(DDUI("Redo"), "redo", () => undo(!0), {
            disabled: !history.current.future.length,
          }),
          _.createElement("span", { className: "b2-sep" }),
          toolButton(
            DDUI("Search board"),
            "search",
            () => setSearch((Y) => (Y === null ? "" : null)),
            {},
            DDUI("Search"),
          ),
          toolButton(
            DDUI("Fit all objects"),
            "fitAll",
            () => fit(!1),
            {},
            DDUI("Fit all"),
          ),
          toolButton(
            DDUI("Export board SVG"),
            "download",
            exportSVG,
            {},
            DDUI("Export"),
          ),
          toolButton(
            DDUI(focus ? "Exit full screen" : "Full screen"),
            focus ? "shrink" : "expand",
            () => setFocus((Y) => !Y),
            {},
            DDUI(focus ? "Exit full screen" : "Full screen"),
          ),
          toolButton("Board help", "?", () => setHelp((Y) => !Y)),
          toolButton(
            t("Go to Life section", "رفتن به بخش زندگی"),
            "fitAll",
            () => {
              const node = layout.map.get("section:life"),
                el = viewport.current;
              if (!node || !el) return;
              setSelected(new Set([node.id]));
              cam.current = core.fit([node], el.clientWidth, el.clientHeight, {
                left: 36,
                right: 36,
                top: 48,
                bottom: 100,
                maxZoom: 1,
              });
              queueCamera();
              scheduleCamera();
            },
            { "data-life-jump": true },
            t("Life", "زندگی"),
          ),
        ),
      ),
      (selected.size > 0 || selectedWire || selectedWires.size > 0) &&
        _.createElement(
          "div",
          {
            className: "b4-selectionbar",
            role: "toolbar",
            "aria-label": "Selection actions",
          },
          selectedWire
            ? _.createElement(
                _.Fragment,
                null,
                _.createElement(
                  "strong",
                  null,
                  DDUI("\u0627\u062A\u0635\u0627\u0644"),
                  selectedWire.label ? " \xB7 " + selectedWire.label : "",
                ),
                toolButton("Connection details", "gear", () =>
                  setInspector((Y) => !Y),
                ),
                toolButton(DDUI("Reverse connection"), "swap", () =>
                  patchWire(
                    selectedWire.id,
                    {
                      from: selectedWire.to,
                      to: selectedWire.from,
                      fromPort: selectedWire.toPort,
                      toPort: selectedWire.fromPort,
                    },
                    DDUI(
                      "\u062C\u0647\u062A \u0627\u062A\u0635\u0627\u0644 \u0639\u0648\u0636 \u0634\u062F",
                    ),
                  ),
                ),
                toolButton(DDUI("Reset connection route"), "fit", () =>
                  patchWire(
                    selectedWire.id,
                    { bend: null, fromPort: null, toPort: null },
                    DDUI(
                      "\u0645\u0633\u06CC\u0631 \u0627\u062A\u0635\u0627\u0644 \u062E\u0648\u062F\u06A9\u0627\u0631 \u0634\u062F",
                    ),
                  ),
                ),
                toolButton(DDUI("Delete connection"), "trash", () =>
                  deleteWire(),
                ),
              )
            : _.createElement(
                _.Fragment,
                null,
                _.createElement(
                  "strong",
                  { className: "b4-readout" },
                  selectedNode &&
                    _.createElement(
                      "span",
                      {
                        style: {
                          background: selectedNode.color,
                          color: selectedNode.textColor,
                        },
                      },
                      nodeIcon(selectedNode),
                    ),
                  _.createElement(
                    "span",
                    { dir: "auto" },
                    selectedNode
                      ? selectedNode.title
                      : (selected.size
                          ? selected.size + t(" objects", " شیء")
                          : "") +
                          (selectedWires.size
                            ? (selected.size ? " \xB7 " : "") +
                              selectedWires.size +
                              " " +
                              DDUI("lines")
                            : ""),
                  ),
                  selectedNode?.min > 0 &&
                    _.createElement("b", null, w(selectedNode.min)),
                ),
                selectedNode &&
                  ["block", "subtask", "bug", "habit"].includes(selectedNode.kind) &&
                  toolButton(
                    t("Card details", "جزئیات کارت"),
                    "task",
                    () => {
                      setDetails(!details);
                      setProperties(false);
                    },
                    { "aria-pressed": details },
                  ),
                toolButton(
                  t("Color & properties", "رنگ و ویژگی‌ها"),
                  "palette",
                  () => {
                    restoreStylePreview();
                    setProperties(!properties);
                    setViewPanel(false);
                  },
                  { "aria-pressed": properties },
                ),
                toolButton(
                  t("More actions", "گزینه‌های بیشتر"),
                  "more",
                  (event) =>
                    openContext(
                      event,
                      selectedNode
                        ? { ref: selectedNode.id }
                        : { selection: true },
                    ),
                ),
                toolButton("Zoom to selection", "fit", () => fit(!0)),
                selectedNode &&
                  (selectedNode.kind === "block" ||
                    selectedNode.kind === "subtask") &&
                  toolButton(
                    t("Add a step", "افزودن قدم"),
                    "plus",
                    () =>
                      setChild({
                        blockId: selectedNode.blockId,
                        subId: selectedNode.subId || null,
                        value: "",
                      }),
                    { "data-add-step": true },
                    t("Step", "قدم"),
                  ),
                selectedNode &&
                  toolButton(DDUI("Edit selected node"), "pen", () =>
                    openEdit(selectedNode.id),
                  ),
                selectedNode &&
                  mode === "mindmap" &&
                  toolButton(DDUI("Select branch"), "tree", selectBranch),
                toolButton(DDUI("Duplicate selection"), "copy", duplicate),
                selected.size > 1 &&
                  toolButton(DDUI("Group selection"), "tree", () =>
                    groupSelection(),
                  ),
                Object.values(model.groups).some((Y) =>
                  Y.some((G) => selected.has(G)),
                ) &&
                  toolButton(DDUI("Ungroup selection"), "swap", () =>
                    groupSelection(!0),
                  ),
                toolButton("Lock or unlock selection", "\u25A3", () =>
                  boardChange(
                    (Y) => ({
                      ...Y,
                      locked: [
                        ...new Set([
                          ...Y.locked.filter((G) => !selected.has(G)),
                          ...([...selected].some((G) => !locked.has(G))
                            ? [...selected]
                            : []),
                        ]),
                      ],
                    }),
                    DDUI(
                      "\u0642\u0641\u0644 \u0646\u0648\u062F\u0647\u0627 \u062A\u063A\u06CC\u06CC\u0631 \u06A9\u0631\u062F",
                    ),
                  ),
                ),
                toolButton("Delete selected nodes", "trash", deleteNodes),
              ),
        ),
      _.createElement(
        "div",
        {
          className: "b2-viewport",
          ref: viewport,
          tabIndex: 0,
          role: "application",
          "aria-label":
            "Canvas. Drag nodes; Space to pan. C to connect. Delete to remove selection.",
          "data-tool": tool,
          "data-mode": mode,
          "data-grid": grid,
          onPointerDownCapture: downCapture,
          onPointerUpCapture: (e) => touches.current.delete(e.pointerId),
          onPointerCancelCapture: (e) => touches.current.delete(e.pointerId),
          onPointerDown: backgroundDown,
          onPointerMove: pointerMove,
          onPointerUp: pointerUp,
          onPointerCancel: (Y) => {
            (touches.current.delete(Y.pointerId), api.current.cancelGesture());
          },
          onLostPointerCapture: (Y) => {
            gesture.current?.pointerId === Y.pointerId &&
              api.current.cancelGesture();
          },
          onDoubleClick: (Y) => {
            Date.now() - lastNodeTap.current > 600 &&
              !Y.target.closest("[data-board-id],[data-wire-id]") &&
              tool === "select" &&
              addSticky(toWorld(Y.clientX, Y.clientY));
          },
        },
        _.createElement(
          "div",
          {
            className: "b2-world",
            ref: world,
            style: {
              transform: `translate3d(${cam.current.x}px,${cam.current.y}px,0) scale(${cam.current.z})`,
            },
          },
          _.createElement(
            "svg",
            {
              className: "b4-wires",
              "aria-label": "Mindmap connections",
              style: { zIndex: wireId ? 38 : 8 },
            },
            _.createElement(
              "defs",
              null,
              _.createElement(
                "marker",
                {
                  id: "b4-arrow",
                  viewBox: "0 0 10 10",
                  refX: "9",
                  refY: "5",
                  markerWidth: "7",
                  markerHeight: "7",
                  orient: "auto-start-reverse",
                  markerUnits: "strokeWidth",
                },
                _.createElement("path", {
                  d: "M1 1L9 5 1 9",
                  fill: "none",
                  stroke: "context-stroke",
                  strokeWidth: "1.5",
                }),
              ),
            ),
            layout.edges.map((Y) => {
              const G = wireGeometry(Y),
                ct = wireId === Y.id;
              return G
                ? _.createElement(
                    "g",
                    {
                      key: Y.id,
                      "data-wire-id": Y.id,
                      ref: (ot) => {
                        ot
                          ? wireRefs.current.set(Y.id, ot)
                          : wireRefs.current.delete(Y.id);
                      },
                      className:
                        ct || selectedWires.has(Y.id)
                          ? "b4-wire selected"
                          : "b4-wire",
                      onContextMenu: (event) =>
                        openContext(event, { wire: Y.id }),
                    },
                    _.createElement("path", {
                      "data-wire-path": !0,
                      d: G.d,
                      className: "b4-wire-hit",
                      fill: "none",
                      stroke: "transparent",
                      strokeWidth: 20,
                      vectorEffect: "non-scaling-stroke",
                      tabIndex: 0,
                      role: "button",
                      "aria-label":
                        "Connection: " +
                        titleFor(Y.from) +
                        " \u2192 " +
                        titleFor(Y.to),
                      onFocus: (event) => {
                        if (!event.currentTarget.matches(":focus-visible"))
                          return;
                        (setWireId(Y.id), setSelected(new Set()));
                      },
                      onPointerDown: (ot) => wireDown(ot, Y),
                      onKeyDown: (ot) => {
                        (ot.key === "Enter" &&
                          (ot.preventDefault(),
                          setWireId(Y.id),
                          setInspector(!0)),
                          (ot.key === "Delete" || ot.key === "Backspace") &&
                            (ot.preventDefault(),
                            ot.stopPropagation(),
                            deleteWire(Y.id)));
                      },
                    }),
                    _.createElement("path", {
                      "data-wire-path": !0,
                      d: G.d,
                      fill: "none",
                      stroke: Y.color || "#85827A",
                      strokeWidth: Y.width || 1.8,
                      opacity: Y.opacity ?? 1,
                      vectorEffect: "non-scaling-stroke",
                      strokeDasharray:
                        Y.pattern === "dotted"
                          ? "1 5"
                          : Y.dashed || Y.pattern === "dashed"
                            ? "6 5"
                            : void 0,
                      strokeLinecap: "round",
                      markerStart: Y.arrow && Y.arrowReverse ? "url(#b4-arrow)" : void 0,
                      markerEnd: Y.arrow && !Y.arrowReverse ? "url(#b4-arrow)" : void 0,
                      className: "b4-wire-line",
                    }),
                    Y.label &&
                      _.createElement(
                        "g",
                        {
                          "data-wire-label": !0,
                          transform: `translate(${G.mid.x} ${G.mid.y - 12 / cam.current.z}) scale(${1 / cam.current.z})`,
                        },
                        _.createElement("rect", {
                          x: -Math.min(130, Y.label.length * 3.5 + 8),
                          y: -11,
                          width: Math.min(260, Y.label.length * 7 + 16),
                          height: 22,
                          rx: 5,
                          fill: "var(--paper)",
                          stroke: "var(--rule-2)",
                        }),
                        _.createElement(
                          "text",
                          {
                            textAnchor: "middle",
                            dominantBaseline: "middle",
                            fill: "var(--ink)",
                            fontSize: 11,
                          },
                          Y.label.slice(0, 36),
                        ),
                      ),
                    ct &&
                      [
                        ["from", G.p],
                        ["to", G.q],
                        ["bend", G.mid],
                      ].map(([ot, St]) =>
                        _.createElement(
                          "g",
                          {
                            key: ot,
                            "data-end": ot,
                            transform: `translate(${St.x} ${St.y}) scale(${1 / cam.current.z})`,
                            className: "b4-wire-handle " + ot,
                            onPointerDown: (Tt) => wireDown(Tt, Y, ot),
                            role: "button",
                            tabIndex: 0,
                            "aria-label":
                              ot === "bend"
                                ? "Move connection route"
                                : ot === "from"
                                  ? "Move connection start"
                                  : "Move connection end",
                          },
                          _.createElement("circle", {
                            r: 13,
                            fill: "transparent",
                          }),
                          _.createElement("circle", {
                            r: ot === "bend" ? 5 : 7,
                            fill: "var(--paper)",
                            stroke: "var(--now)",
                            strokeWidth: 2,
                          }),
                          ot === "bend" &&
                            _.createElement("path", {
                              d: "M-2 0h4M0-2v4",
                              stroke: "var(--now)",
                            }),
                        ),
                      ),
                  )
                : null;
            }),
            _.createElement("path", {
              ref: draftPath,
              style: { display: "none" },
              fill: "none",
              stroke: "var(--now)",
              strokeWidth: 2,
              vectorEffect: "non-scaling-stroke",
              strokeDasharray: "6 4",
            }),
          ),
          _.createElement("svg", {
            className: "b6-guides",
            ref: guideSvg,
            "aria-hidden": true,
          }),
          layout.nodes.map(renderNode),
          _.createElement("div", {
            className: "b4-marquee",
            ref: marquee,
            style: { display: "none" },
          }),
        ),
      ),
      connecting &&
        _.createElement(
          "div",
          { className: "b4-connect-hint", role: "status" },
          DDUI("\u0627\u0632 \xAB"),
          titleFor(connecting).slice(0, 35),
          DDUI(
            "\xBB \u0628\u0647 \u0646\u0648\u062F \u0645\u0642\u0635\u062F \u06A9\u0644\u06CC\u06A9 \u06A9\u0646 ",
          ),
          _.createElement(
            "button",
            {
              type: "button",
              onClick: () => {
                (setConnecting(null), setTool("select"));
              },
            },
            DDUI("\u0644\u063A\u0648"),
          ),
        ),
      ((selectedWire && inspector) ||
        (properties && selectedNodes.length > 0)) &&
        _.createElement(controls.PropertiesPanel, {
          key: selectedWire?.id || [...selected].join("|"),
          React: _,
          language: DDlanguage,
          nodes: selectedNodes,
          wire: selectedWire ? { ...selectedWire, fromPort: wireGeometry(selectedWire)?.from, toPort: wireGeometry(selectedWire)?.to } : null,
          onStyle: applyStyle,
          onPreview: previewStyle,
          onWirePatch: (patch) => {
            restoreStylePreview();
            patchWire(
              wireId,
              patch,
              t("Connection updated", "اتصال تغییر کرد"),
            );
          },
          onWirePreview: previewWire,
          onPosition: placeSelection,
          category:
            selectedNode?.kind === "block"
              ? {
                  value: day.blocks.find((b) => b.id === selectedNode.blockId)
                    ?.type,
                  options: setup.types,
                }
              : null,
          onCategory: (type) =>
            commit(
              (d) => {
                const b = d.blocks.find((b) => b.id === selectedNode.blockId);
                if (b && !locked.has(selectedNode.id)) {
                  b.type = type;
                  delete b.color;
                }
                return d;
              },
              t("Category changed", "دسته تغییر کرد"),
            ),
          onClose: () => {
            restoreStylePreview();
            setProperties(false);
            setInspector(false);
            viewport.current?.focus({ preventScroll: true });
          },
        }),
      cardDetails(),
      viewPanel &&
        _.createElement(controls.ViewPanel, {
          React: _,
          language: DDlanguage,
          value: appearance,
          onChange: changeAppearance,
          grid,
          snap,
          map: showMap,
          onGrid: () => toggleView("grid"),
          onSnap: () => toggleView("snap"),
          onMap: () => toggleView("map"),
          onClose: () => {
            setViewPanel(false);
            viewport.current?.focus({ preventScroll: true });
          },
        }),
      search !== null &&
        _.createElement(
          "aside",
          { className: "b4-search", dir: DDlanguage === "fa" ? "rtl" : "ltr" },
          _.createElement(
            "div",
            { className: "b4-panel-head" },
            _.createElement("input", {
              autoFocus: !0,
              value: search,
              onChange: (Y) => setSearch(Y.target.value),
              placeholder: DDUI(
                "\u062C\u0633\u062A\u062C\u0648 \u062F\u0631 \u0646\u0648\u062F\u0647\u0627 \u0648 \u06CC\u0627\u062F\u062F\u0627\u0634\u062A\u200C\u0647\u0627\u2026",
              ),
              "aria-label": DDUI("Search board nodes"),
            }),
            _.createElement(
              "button",
              { type: "button", onClick: () => setSearch(null) },
              "\xD7",
            ),
          ),
          _.createElement(
            "div",
            null,
            layout.nodes
              .filter((Y) =>
                Y.kind !== "section" &&
                (Y.title + " " + (Y.subtitle || ""))
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .slice(0, 30)
              .map((Y) =>
                _.createElement(
                  "button",
                  {
                    type: "button",
                    key: Y.id,
                    dir: "auto",
                    onClick: () => {
                      (setSelected(new Set([Y.id])), setWireId(null));
                      const G = nodeBounds([Y]),
                        ct = viewport.current,
                        ot = Math.min(1.3, (ct.clientWidth - 100) / G.w);
                      ((cam.current = {
                        x: ct.clientWidth / 2 - (G.x + G.w / 2) * ot,
                        y: ct.clientHeight / 2 - (G.y + G.h / 2) * ot,
                        z: ot,
                      }),
                        queueCamera(),
                        scheduleCamera());
                    },
                  },
                  Y.title || DDUI("\u06CC\u0627\u062F\u062F\u0627\u0634\u062A"),
                  Y.min > 0 && _.createElement("small", null, w(Y.min)),
                ),
              ),
          ),
        ),
      child &&
        _.createElement(
          "form",
          {
            className: "b4-child",
            dir: DDlanguage === "fa" ? "rtl" : "ltr",
            onSubmit: (Y) => {
              (Y.preventDefault(), addChild());
            },
          },
          _.createElement(
            "label",
            null,
            DDUI("\u0642\u062F\u0645 \u062C\u062F\u06CC\u062F"),
            _.createElement("input", {
              autoFocus: !0,
              value: child.value,
              onChange: (Y) => setChild({ ...child, value: Y.target.value }),
              maxLength: 300,
              placeholder: DDUI(
                "\u0645\u062B\u0644\u0627\u064B: \u0627\u062A\u0648\u062F \u0627\u0648\u0644 \u0631\u0627 \u0622\u0645\u0627\u062F\u0647 \u06A9\u0646",
              ),
              "aria-label": DDUI("New child node"),
            }),
          ),
          _.createElement(
            "button",
            {
              className: "btn solid",
              type: "submit",
              disabled: !child.value.trim(),
            },
            DDUI("\u0627\u0641\u0632\u0648\u062F\u0646"),
          ),
          _.createElement(
            "button",
            { className: "btn", type: "button", onClick: () => setChild(null) },
            DDUI("\u0644\u063A\u0648"),
          ),
        ),
      showMap &&
        _.createElement(
          "div",
          {
            className: "b2-map b4-minimap",
            "aria-label": DDUI("Board minimap"),
            title: DDUI(
              "\u06A9\u0644\u06CC\u06A9 \u06CC\u0627 \u06A9\u0634\u06CC\u062F\u0646 \u0628\u0631\u0627\u06CC \u062C\u0627\u0628\u0647\u200C\u062C\u0627\u06CC\u06CC \u062F\u0648\u0631\u0628\u06CC\u0646",
            ),
            onPointerDown: (Y) => {
              if (Y.button !== 0) return;
              (minimapDown(Y), Y.currentTarget.setPointerCapture(Y.pointerId));
            },
            onPointerMove: (Y) => {
              Y.currentTarget.hasPointerCapture(Y.pointerId) && minimapDown(Y);
            },
          },
          _.createElement(
            "svg",
            {
              ref: mapSvg,
              viewBox: `${bounds.x - 70} ${bounds.y - 70} ${bounds.w + 140} ${bounds.h + 140}`,
              preserveAspectRatio: "xMidYMid meet",
            },
            layout.nodes.map((Y) =>
              _.createElement("rect", {
                key: Y.id,
                x: Y.x,
                y: Y.y,
                width: Y.w,
                height: Y.h,
                rx: 5,
                fill:
                  Y.kind === "frame" || Y.kind === "section"
                    ? "none"
                    : Y.color,
                stroke:
                  Y.kind === "frame" || Y.kind === "section"
                    ? "#85827A"
                    : "none",
                opacity: selected.has(Y.id) ? 1 : 0.65,
              }),
            ),
            _.createElement("rect", {
              "data-map-camera": !0,
              fill: "var(--now)",
              fillOpacity: 0.08,
              stroke: "var(--now)",
              strokeWidth: 1.5,
              vectorEffect: "non-scaling-stroke",
            }),
          ),
        ),
      _.createElement(
        "div",
        {
          className: "b2-dock",
          role: "toolbar",
          "aria-label": DDUI("Canvas tools"),
        },
        [
          ["select", DDUI("\u0627\u0646\u062A\u062E\u0627\u0628"), "sort"],
          ["hand", DDUI("\u062F\u0633\u062A"), "hand"],
          ...(mode === "lanes"
            ? []
            : [["connector", DDUI("\u0627\u062A\u0635\u0627\u0644"), "tree"]]),
          ["block", DDUI("\u0628\u0644\u0627\u06A9"), "plus"],
          [
            "sticky",
            DDUI("\u06CC\u0627\u062F\u062F\u0627\u0634\u062A"),
            "sticky",
          ],
          ["section", t("Section", "سکشن"), "square"],
          ["feeling", DDUI("Feeling"), "smile"],
        ].map(([Y, G, ct]) =>
          _.createElement(
            "button",
            {
              type: "button",
              key: Y,
              className: "b2-icon",
              "aria-label": DDUI(
                Y === "connector"
                  ? "Connect nodes"
                  : Y === "hand"
                    ? "Hand tool"
                    : Y === "select"
                      ? "Select tool"
                      : Y === "block"
                        ? "Time block tool"
                        : Y === "feeling"
                          ? "Feeling or mistake tool"
                          : Y === "section"
                            ? "Section tool"
                            : "Sticky note tool",
              ),
              "aria-pressed": tool === Y,
              onClick: () => {
                (setTool(Y), setConnecting(null), setWireId(null));
              },
            },
            _.createElement(controls.Icon, {
              React: _,
              name:
                {
                  cursor: "select",
                  move: "hand",
                  line: "connect",
                  square: "task",
                  bang: "spark",
                  sticky: "note",
                }[ct] || ct,
            }),
            _.createElement("span", null, Y === "connector" ? t("Connect","اتصال") : G),
          ),
        ),
        _.createElement("span", { className: "b2-sep" }),
        toolButton(t("Stickers & emoji","استیکر و ایموجی"),"spark",()=>{finishEdit();setMenu(null);setStickerPicker({target:selectedNode?.kind==="block"?selectedNode.blockId:""});},{},t("Stickers","استیکر")),
        toolButton(
          DDUI("Snap to grid"),
          "snap",
          () => toggleView("snap"),
          { "aria-pressed": snap, "data-view-toggle": true },
          DDUI("Snap"),
        ),
        toolButton(
          DDUI("Show grid"),
          "grid",
          () => toggleView("grid"),
          { "aria-pressed": grid, "data-view-toggle": true },
          DDUI("Grid"),
        ),
        toolButton(
          DDUI("Toggle minimap"),
          "map",
          () => toggleView("map"),
          { "aria-pressed": showMap, "data-view-toggle": true },
          DDUI("Minimap"),
        ),
        toolButton(
          t("Canvas settings", "تنظیمات بوم"),
          "settings",
          () => {
            setViewPanel(!viewPanel);
            setProperties(false);
            setInspector(false);
          },
          { "aria-pressed": viewPanel },
        ),
      ),
      _.createElement(controls.ZoomControl, {
        React: _,
        language: DDlanguage,
        viewport,
        getCamera: () => cam.current,
        onZoom: setZoom,
        onFit: fit,
        onView: () => {
          setViewPanel(true);
          setProperties(false);
          setInspector(false);
        },
      }),
      _.createElement(
        "div",
        {
          className: "b4-status" + (status ? "" : " dd-keyboard-only"),
          role: "status",
        },
        status ||
          DDUI(
            wireId
              ? "\u062E\u0637 \u0631\u0627 \u0628\u06A9\u0634 \u062A\u0627 \u0645\u0633\u06CC\u0631 \u0639\u0648\u0636 \u0634\u0648\u062F\u061B \u062F\u0648 \u0633\u0631 \u062E\u0637 \u0628\u0631\u0627\u06CC \u062A\u063A\u06CC\u06CC\u0631 \u0627\u062A\u0635\u0627\u0644"
              : "Space: \u062D\u0631\u06A9\u062A \u0628\u0648\u0645 \xB7 C: \u0627\u062A\u0635\u0627\u0644 \xB7 F: \u0646\u0645\u0627\u06CC\u0634 \u0647\u0645\u0647 \xB7 Delete: \u062D\u0630\u0641",
          ),
      ),
      menu &&
        _.createElement(controls.ContextMenu, {
          key: menu.stamp,
          React: _,
          language: DDlanguage,
          menu,
          items: contextItems(),
          onClose: closeContext,
          boardRef: root,
          title: menu.wire
            ? t("Connection", "اتصال")
            : menu.ref || menu.selection
              ? selected.size > 1
                ? selected.size + t(" selected objects", " شیء انتخاب‌شده")
                : selectedNode?.title || t("Object", "شیء")
              : t("Canvas", "بوم"),
        }),
      stickerPicker && _.createElement(playful.Picker,{current:stickerPicker.current,target:stickerPicker.target || "",targets:stickerPicker.replace?[]:day.blocks,onClose:()=>setStickerPicker(null),onPick:(value,target)=>{const rect=viewport.current.getBoundingClientRect(),point=stickerPicker.point || toWorld(rect.left+rect.width/2,rect.top+rect.height/2),id=stickerPicker.replace || C(),size=playful.isSticker(value)?128:76;commit(d=>playful.data.put(d,value,{id,replace:stickerPicker.replace,taskId:target,x:point.x-size/2,y:point.y-size/2}),t("A little personality added","کمی حال‌وهوا اضافه شد"));setSelected(new Set([target?"b:"+target:"sticky:"+id]));setWireId(null);setTool("select");onSelectBlock?.(target || null);}}),
      help &&
        _.createElement(
          "div",
          {
            className: "b4-help-backdrop",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": "Board help",
            onClick: () => setHelp(!1),
          },
          _.createElement(
            "div",
            {
              className: "b4-help",
              dir: DDlanguage === "fa" ? "rtl" : "ltr",
              onClick: (Y) => Y.stopPropagation(),
            },
            _.createElement(
              "div",
              { className: "b4-panel-head" },
              _.createElement(
                "strong",
                null,
                DDUI(
                  "\u06A9\u0646\u062A\u0631\u0644\u200C\u0647\u0627\u06CC \u0628\u0631\u062F",
                ),
              ),
              _.createElement(
                "button",
                { type: "button", autoFocus: !0, onClick: () => setHelp(!1) },
                DDUI("\u0628\u0633\u062A\u0646"),
              ),
            ),
            _.createElement(
              "p",
              null,
              DDUI(
                "\u0628\u0631\u0627\u06CC \u0627\u0646\u062A\u062E\u0627\u0628 \u062E\u0637\u060C \u0631\u0648\u06CC \u0622\u0646 \u06A9\u0644\u06CC\u06A9 \u06A9\u0646. \u062D\u0630\u0641 \u062E\u0637\u060C \u0646\u0648\u062F\u0647\u0627 \u0648 \u06A9\u0627\u0631\u0647\u0627\u06CC \u067E\u0644\u0646 \u0631\u0627 \u062D\u0630\u0641 \u0646\u0645\u06CC\u200C\u06A9\u0646\u062F.",
              ),
            ),
            _.createElement(
              "p",
              null,
              DDUI(
                "\u062F\u0648 \u0633\u0631 \u062E\u0637 \u0628\u0631\u0627\u06CC \u062A\u063A\u06CC\u06CC\u0631 \u0646\u0648\u062F\u060C \u0648 \u062F\u0633\u062A\u06AF\u06CC\u0631\u0647 \u0648\u0633\u0637 \u0628\u0631\u0627\u06CC \u062A\u063A\u06CC\u06CC\u0631 \u0645\u0633\u06CC\u0631 \u0647\u0633\u062A\u0646\u062F. \u0647\u0645\u06CC\u0646 \u06A9\u0627\u0631\u0647\u0627 \u0627\u0632 \u067E\u0646\u0644 \u0627\u062A\u0635\u0627\u0644 \u0647\u0645 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633\u200C\u0627\u0646\u062F.",
              ),
            ),
            _.createElement(
              "p",
              null,
              DDUI(
                "\u0628\u0631\u0627\u06CC \u0633\u0627\u062E\u062A \u0627\u062A\u0635\u0627\u0644\u060C \u0627\u0628\u0632\u0627\u0631 \xAB\u0627\u062A\u0635\u0627\u0644\xBB \u0631\u0627 \u0628\u0632\u0646 \u0648 \u062F\u0648 \u0646\u0648\u062F \u0631\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646\u061B \u06CC\u0627 \u0627\u0632 \u0646\u0642\u0637\u0647 \u06A9\u0646\u0627\u0631 \u0646\u0648\u062F \u0628\u06A9\u0634.",
              ),
            ),
            _.createElement(
              "dl",
              null,
              _.createElement("dt", null, "Space / H"),
              _.createElement(
                "dd",
                null,
                DDUI("\u062D\u0631\u06A9\u062A \u0628\u0648\u0645"),
              ),
              _.createElement(
                "dt",
                null,
                DDUI("Ctrl / Cmd + \u0627\u0633\u06A9\u0631\u0648\u0644"),
              ),
              _.createElement(
                "dd",
                null,
                DDUI(
                  "\u0632\u0648\u0645 \u062F\u0648\u0631 \u0646\u0634\u0627\u0646\u06AF\u0631",
                ),
              ),
              _.createElement(
                "dt",
                null,
                DDUI("Shift + \u06A9\u0644\u06CC\u06A9"),
              ),
              _.createElement(
                "dd",
                null,
                DDUI(
                  "\u0627\u0646\u062A\u062E\u0627\u0628 \u0686\u0646\u062F \u0646\u0648\u062F",
                ),
              ),
              _.createElement("dt", null, "Ctrl / Cmd + Z"),
              _.createElement(
                "dd",
                null,
                DDUI(
                  "Undo\u061B \u0628\u0627 Shift \u0628\u0631\u0627\u06CC Redo",
                ),
              ),
              _.createElement("dt", null, "Ctrl / Cmd + G"),
              _.createElement(
                "dd",
                null,
                DDUI(
                  "\u06AF\u0631\u0648\u0647\u200C\u06A9\u0631\u062F\u0646\u061B \u0628\u0627 Shift \u0628\u0631\u0627\u06CC \u0628\u0627\u0632\u06A9\u0631\u062F\u0646 \u06AF\u0631\u0648\u0647",
                ),
              ),
              _.createElement("dt", null, "F / Shift F"),
              _.createElement(
                "dd",
                null,
                DDUI(
                  "\u0646\u0645\u0627\u06CC\u0634 \u0647\u0645\u0647 / \u0627\u0646\u062A\u062E\u0627\u0628",
                ),
              ),
              _.createElement("dt", null, "Esc"),
              _.createElement(
                "dd",
                null,
                DDUI(
                  "\u0644\u063A\u0648 \u062D\u0631\u06A9\u062A \u06CC\u0627 \u0627\u062A\u0635\u0627\u0644",
                ),
              ),
            ),
            _.createElement(
              "p",
              null,
              DDUI(
                "\u062F\u0631 \u0645\u0648\u0628\u0627\u06CC\u0644: \u06CC\u06A9 \u0627\u0646\u06AF\u0634\u062A \u0628\u0631\u0627\u06CC \u062D\u0631\u06A9\u062A \u0631\u0648\u06CC \u0641\u0636\u0627\u06CC \u062E\u0627\u0644\u06CC\u060C \u062F\u0648 \u0627\u0646\u06AF\u0634\u062A \u0628\u0631\u0627\u06CC \u0632\u0648\u0645\u060C \u062F\u0648 \u0636\u0631\u0628\u0647 \u0631\u0648\u06CC \u0646\u0648\u062F \u0628\u0631\u0627\u06CC \u0648\u06CC\u0631\u0627\u06CC\u0634.",
              ),
            ),
          ),
        ),
    );
  };
}
