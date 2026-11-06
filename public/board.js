import { DDcompletion, DDTaskMetadata, DDTaskTags, DDpriorityLabel, DDprogressLabel } from "./planner.js";
import { DDreconcileDay, DDrelation, DDconnectRelation, DDdisconnectRelation, DDrewireRelation } from "./relations.js";
import { DDconnectionGeometry } from "./connections.js";
import { DDundoRevert } from "./board-history.js";
import { DDEngineOverlay, DDengineBus, DDengineTask, DDengineTaskFromNote, DDengineSources, DDengineSourceHistory, DDengineStrip, DDinstallEngineStyles, DDengineCarry } from "./engine.js";
import { DDengineSectionIds, DDinstallEngineQuietStyles } from "./engine-quiet.js";
import { DDboardShortcuts, DDboardSearchRows, DDrootSelection, DDmarqueeSelection, DDselectionToolbar, DDBoardSearch, DDBoardTimer, DDBoardTimerButton, DDinstallBoardExperience, DDinstallZoomLock } from "./board-experience.js";
import {
  DDinstallLifeStyles,
  DDlifeAbs,
  DDlifeAdd,
  DDlifeBounds,
  DDlifeHead,
  DDlifeItems,
  DDlifeParentAt,
  DDlifeState, DDlifeHistory, DDlifeVisible, DDlifeCompact, DDlifeColor, DDlifeMoveBy, DDlifeRemove, DDlifeDescendants, DDlifeAdopt, DDlifePath, DDlifeKeepIn, DDlifeInFrame, DDlifeShown, DDlifeHome, DDlifeRelease,
} from "./life-board.js";
import{DDBoardRails,DDinstallRailStyles,DDsetRailRole,DDrailPreferences,DDrailScope}from"./rails.js";
import{DDstickyDateLabel,DDstickyToday,DDstickyHeight,DDstickySnap,DDstickyFormat,DDstickyTodo,DDStickyText,DDinstallStickyStyles}from"./stickies.js";
import { DDSectionsFlowchart, DDsectionsBus, DDinstallSectionsFlowStyles } from "./sections-flow.js";
import { DDsectionTint, DDSectionChip, DDsetSectionColor, DDsectionPath, DDsectionPalette, DDlifeSendTo, DDlifeTakeOut } from "./life-board.js";
import { DDplaces, DDPlacesBack } from "./places.js";
import { DDusePen, DDnormalizeStrokes, DDmarksRebase, DDpenCSS } from "./pen.js";
import { DDuseComments, DDnormalizeComments, DDcommentsTransfer, DDcommentsCSS } from "./comments.js";
import { DDnoteTagsCSS } from "./note-tags.js";
import { DDuseNoteTools, DDnoteBranch, DDparentLooks, DDnoteFamilyCSS } from "./note-family.js";
import { DDuseBoardPhotos, DDnotePhoto, DDphotoHeight, DDboardPhotosCSS } from "./board-photos.js";
import { DDtrashAdd, DDtrashRestore, DDtrashLabel } from "./trash.js";
import { DDcanvasTidy } from "./upkeep.js";
import { DDdueText, DDdueDate, DDdueDaysLeft, DDdueSet, DDDueEditor } from "./deadlines.js";
import { DDenergyOf, DDenergyLabel } from "./energy.js";
import { DDbudgetOf, DDbudgetUsed, DDbudgetText, DDbudgetLabel, DDbudgetPresets, DDbudgetSame } from "./budgets.js";
import { DDsyncCopies, DDsyncNewId, DDsyncValid, DDsyncForget, DDsyncMarkLife, DDsyncJoin, DDsyncPlaces, DDsyncSameNotes, DDinstallLinkedStyles } from "./linked.js";
const life = { DDinstallLifeStyles, DDlifeAbs, DDlifeAdd, DDlifeBounds, DDlifeHead, DDlifeItems, DDlifeParentAt };
// Board interaction engine. Legacy planner adapters are injected once by the app.
// On a phone the Board opens full screen unless the person chose otherwise
// (Canvas settings › Open full screen); a computer keeps it in the page.
function phoneBoard() {
  try { return matchMedia("(max-width:700px)").matches; } catch { return false; }
}

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
  // The board's own copy is the latest copy until something else may have been
  // copied: the window lost focus (another app) or text was copied on the page.
  let sharedFresh = false;
  if (typeof window !== "undefined") {
    window.addEventListener("blur", () => { sharedFresh = false; });
    const elsewhere = (e) => { const el = e.target?.closest ? e.target : document.activeElement; if (!el?.closest?.(".b2") || el.closest("input,textarea,select,[contenteditable=true]")) sharedFresh = false; };
    document.addEventListener("copy", elsewhere, true);
    document.addEventListener("cut", elsewhere, true);
  }
  life.DDinstallLifeStyles();
  DDinstallBoardExperience();
  DDinstallZoomLock();
  DDinstallRailStyles();
  DDinstallStickyStyles();
  DDinstallEngineStyles();
  DDinstallEngineQuietStyles();
  DDinstallSectionsFlowStyles();
  // Comments, pen, note tags and parent notes (5.36).
  if (typeof document !== "undefined" && !document.getElementById("dd-board-tools-css"))
    document.head.append(Object.assign(document.createElement("style"), { id: "dd-board-tools-css", textContent: DDpenCSS + DDcommentsCSS + DDnoteTagsCSS + DDnoteFamilyCSS + DDboardPhotosCSS }));
  DDinstallLinkedStyles();
  let stepTextContext;
  return function BoardWorkspace({
    day: day,
    days: allDays,
    setup: setup,
    selectedBlockId: selectedBlockId,
    onSelectBlock: onSelectBlock,
    onUpdateDay: onUpdateDay,
    onUpdateSetup: onUpdateSetup,
    onUpdateDayOnDate,
    onToast: onToast,
    matchesFilter: matchesFilter,
    nodeMatches: ddNodeMatches,
    searchNode: ddSearchNode,
    onExitIsolation: ddExitIsolation,
    timer = { seconds: 1500, running: false },
    onTimerChange,
    onRevealObject,
  }) {
    const DDlanguage = deps.language(),
      t = (en, fa) => (DDlanguage === "fa" ? fa : en),
      railDate = new Date().toLocaleDateString("en-CA");
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
          // The day's own comments and drawings (5.36).
          ...(DDnormalizeComments(Y.comments).length ? { comments: DDnormalizeComments(Y.comments) } : {}),
          ...(DDnormalizeStrokes(Y.strokes).length ? { strokes: DDnormalizeStrokes(Y.strokes) } : {}),
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
      [wirePop, setWirePop] = useState(null),
      [selected, setSelected] = useState(new Set()),
      [wireId, setWireId] = useState(null),
      [wireSelection, setWireSelection] = useState(null),
      [editing, setEditing] = useState(null),
      [child, setChild] = useState(null),
      [focus, setFocus] = useState(() => {
        let once = false;
        try { once = sessionStorage.getItem("debug-day:board-open-fullscreen") === "1"; sessionStorage.removeItem("debug-day:board-open-fullscreen"); } catch {}
        return once || core.local("debug-day:board-start-fullscreen", phoneBoard());
      }),
      [startFullscreen, setStartFullscreen] = useState(() => core.local("debug-day:board-start-fullscreen", phoneBoard())),
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
      [alignPanel, setAlignPanel] = useState(false),
      // The Sections flowchart (Tab, D, the Sections button or Ctrl+Space), with the Life area tools.
      [lifeNav, setLifeNav] = useState(() => DDsectionsBus.take()),
      // The Engine brought over the board (E, the toolbar or Ctrl+Space).
      [engine, setEngine] = useState(() => DDengineBus.take()),
      // A section's record shows its last 7 days unless this is on.
      [historyAll, setHistoryAll] = useState(false),
      // The section whose own board is open (a Life section id), or null for the main board.
      [room, setRoom] = useState(() => { try { return sessionStorage.getItem("debug-day:board-room") || null; } catch { return null; } }),
      roomCams = useRef({}),
      [quickColor, setQuickColor] = useState(null),
      [dueEdit, setDueEdit] = useState(null),
      [stickerPicker, setStickerPicker] = useState(null),
      [details, setDetails] = useState(
        () => !globalThis.matchMedia?.("(max-width: 700px)").matches,
      ),
      noteDraft = useRef(null),
      stickyHeights = useRef(new Map()), [stickyRevision,setStickyRevision] = useState(0),
      appearanceRef = useRef(appearance),
      guideSvg = useRef(null),
      clipboard = useRef(sharedClipboard),
      pendingContext = useRef(null),
      suppressContext = useRef(false),
      stylePreview = useRef(false),
      [search, setSearch] = useState(null),
      [timerOpen, setTimerOpen] = useState(false),
      timerButton = useRef(null),
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
      ghostNote = useRef(null),
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
      history = useRef(DDlifeHistory),
      dayRef = useRef(day),
      ownUpdate = useRef(null),
      searchShown = useRef(null),
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
      mounted = useRef(!0),
      lastNudge = useRef(0),
      noteSession = useRef(null),
      // Typing in a note waits a moment before it is saved (and before every other
      // view hears about it), so each key no longer rebuilds the whole board.
      pendingNote = useRef(null);
    const selectionbar = useRef(null), selectionState = useRef(null), pendingReveal = useRef(null), connectionStyle = useRef("elbow"), wireCache = useRef(new Map()),
      // Line shapes for the board as it is now: kept until a card moves or the board
      // changes, so a click or a selection does not route every line again.
      steadyWires = useRef({ layout: null, map: new Map() });
    // Writing zoomed out: where the board was before it came closer, and the glide.
    const editReturn = useRef(null), glide = useRef(0), glideTo = useRef(null);
    selectionState.current = { selected, wireId, selectedWires: wireSelection?.ids || [] };
    useEffect(() => { if (tool !== "sticky") hideGhost(); }, [tool]);
    // Align opens by itself when several things are picked; once closed it
    // stays closed until the selection drops below two again.
    const alignClosed = useRef(false);
    useEffect(() => {
      if (selected.size < 2) { setAlignPanel(false); alignClosed.current = false; }
      // On a phone it would cover the board: the bar's Align button opens it there.
      else if (!alignClosed.current && !window.matchMedia?.("(max-width:700px)").matches) setAlignPanel(true);
    }, [selected]);
    useEffect(() => {
      const enter = () => { try { sessionStorage.removeItem("debug-day:board-open-fullscreen"); } catch {} setFocus(true); };
      window.addEventListener("debug-day-board-fullscreen", enter);
      return () => window.removeEventListener("debug-day-board-fullscreen", enter);
    }, []);
    ((propsRef.current = {
      day: day,
      setup: setup,
      onSelectBlock: onSelectBlock,
      onUpdateDay: onUpdateDay,
      onUpdateSetup: onUpdateSetup,
      onUpdateDayOnDate, allDays,
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
    // An undo step keeps the state before and right after the action, so undo
    // takes back only that action (see board-history.js).
    function remember(Y, shared = DDlifeState(propsRef.current.setup), afterDay = null, afterLife = null) {
      const G = history.current;
      (G.past.push({ day: copy(Y), life: copy(shared), ...(afterDay ? { after: { day: copy(afterDay), life: copy(afterLife || shared) } } : {}), bytes: JSON.stringify([Y,shared,afterDay,afterLife]).length }),
        (G.future = []));
      let ct = G.past.reduce((ot, St) => ot + St.bytes, 0);
      for (; G.past.length > 50 || (ct > 24e6 && G.past.length > 1); )
        ct -= G.past.shift().bytes;
    }
    // On a section's own board, what is made there stays in that section: a new
    // day note becomes a note in the section, and nothing drifts out of it.
    function keepInRoom(d, before, shared, roomId) {
      const frame = layoutRef.current.map.get("section:life"), known = new Set((before.notes || []).map((n) => n.id));
      if (frame) for (const note of (d.notes || []).filter((n) => !known.has(n.id) && n.kind !== "emoji")) {
        const ref = "sticky:" + note.id, { width, height, ...style } = d.canvas?.board4?.styles?.[ref] || {},
          w = width || 240, h = height || 240, items = d.__life.items, inside = DDlifeDescendants(items, roomId),
          target = DDlifeParentAt(items, note.x - frame.x + w / 2, note.y - frame.y - DDlifeHead + h / 2, new Set(items.filter((i) => !inside.has(i.id)).map((i) => i.id)), roomId) || items.find((i) => i.id === roomId),
          base = DDlifeAbs(items, target.id), id = items.some((i) => i.id === note.id) ? "lf-" + C() : note.id;
        d.__life.items = DDlifeAdd(items, { id, type: "sticky", parent: target.id, text: note.text, color: note.color, x: Math.round(note.x - frame.x - base.x), y: Math.round(note.y - frame.y - DDlifeHead - base.y), w, h, style, syncId: note.syncId });
        d.notes = d.notes.filter((n) => n !== note);
        transferRef(d, ref, "life:" + id);
      }
      d.__life.items = DDlifeKeepIn(d.__life.items, roomId, shared.items || []);
    }
    function commit(Y, G, ct = {}) {
      // Anything else that changes the board starts from the latest typed text.
      if (pendingNote.current) flushNote();
      const ot = dayRef.current, shared = DDlifeState(propsRef.current.setup);
      const draft = copy(ot);
      draft.__life = copy(shared);
      let result = Y(draft);
      if (!result) return;
      const oldNotes = new Map([...(ot.notes || []), ...(shared.items || [])].map(n=>[n.id,n]));
      for(const note of [...(result.notes || []), ...(result.__life?.items || [])]) {
        if((note.kind === "sticky" || note.type === "sticky") && !oldNotes.has(note.id)) note.at = DDstickyToday();
      }
      if (layoutRef.current?.room && result.__life?.items) keepInRoom(result, ot, shared, layoutRef.current.room);
      // A section that went away keeps its drawings and comments in place, or takes them along.
      if (result.__life) result.__life = DDmarksRebase(shared, result.__life);
      let nextLife = result.__life || shared;
      delete result.__life;
      delete result.__lifeFrame;
      // Keep Life-to-Life wires shared, while links to a day's task stay with that day.
      const board = result.canvas?.board4;
      if (board?.links) {
        const sharedLinks = board.links.filter((l) => l.from.startsWith("life:") && l.to.startsWith("life:"));
        if (result.__sharedLinksEdited) nextLife.links = sharedLinks;
        else if (sharedLinks.length) nextLife.links = [...new Map([...(nextLife.links || []), ...sharedLinks].map((l) => [l.id,l])).values()];
        board.links = board.links.filter((l) => !sharedLinks.includes(l));
      }
      delete result.__sharedLinksEdited;
      let St = DDreconcileDay(result, ot, { ...propsRef.current.setup, life: nextLife });
      // Feed places live in the Feed; a day keeps no copy of them (5.45).
      if (St?.canvas) St.canvas = DDcanvasTidy(St.canvas);
      // Linked copies on this board follow the one that changed in the same step,
      // so the day and the Feed are saved together and agree.
      if (St) {
        const linked = DDsyncCopies({ setup: { life: nextLife }, days: { d: St } }, { setup: { life: shared }, days: { d: ot } });
        St = linked.days.d; nextLife = linked.setup.life;
      }
      // A delete keeps what it took from the Feed in Recently deleted for 30 days.
      if (St && ct.trash) nextLife = DDtrashAdd(shared, nextLife, (id) => (shared.items || []).some((i) => i.id === id) ? DDlifeAbs(shared.items, id) : null);
      const lifeChanged = JSON.stringify(shared) !== JSON.stringify(nextLife);
      !St ||
        (!lifeChanged && JSON.stringify(St) === JSON.stringify(ot)) ||
        (ct.history !== !1 && remember(ot, shared, St, nextLife),
        lifeChanged && (propsRef.current.setup = { ...propsRef.current.setup, life: nextLife }, propsRef.current.onUpdateSetup?.((s) => ({ ...s, life: nextLife }))),
        (dayRef.current = St),
        (ownUpdate.current = St),
        propsRef.current.onUpdateDay(() => St),
        setTick((Tt) => Tt + 1),
        G && setStatus(G));
    }
    function boardDocument() {
      const d = copy(dayRef.current), frame = layoutRef.current?.map.get("section:life");
      d.__life = DDlifeState(propsRef.current.setup);
      d.__lifeFrame = frame ? { x:frame.x, y:frame.y + DDlifeHead } : {x:0,y:0};
      return d;
    }
    function boardChange(Y, G, ct) {
      commit(
        (ot) => (
          (ot.canvas = {
            ...(ot.canvas || {}),
            board4: Y({ ...clean(ot.canvas?.board4), links:[...clean(ot.canvas?.board4).links,...ot.__life.links] }),
          }),
          (ot.__sharedLinksEdited = true, ot)
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
      const Tt = copy((St.day?.date && propsRef.current.allDays?.[St.day.date]) || dayRef.current), shared = DDlifeState(propsRef.current.setup);
      // Take back only what this step changed; later changes (a note from the
      // phone, an edit in another view) stay. Old steps without `after` restore whole.
      const beforeLife = St.life && (Array.isArray(St.life) ? { ...shared, items: St.life } : St.life);
      const nextDay = St.day && (St.after?.day ? DDundoRevert(Tt, St.after.day, St.day) : copy(St.day));
      const nextLife = beforeLife && (St.after?.life ? DDundoRevert(shared, St.after.life, beforeLife) : copy(beforeLife));
      ot.push({ day: St.day ? Tt : null, life: copy(shared), ...(St.after ? { after: { day: nextDay ? copy(nextDay) : null, life: copy(nextLife || shared) } } : {}), bytes: JSON.stringify([Tt,shared,nextDay,nextLife]).length });
      if (nextLife) {
        propsRef.current.setup = { ...propsRef.current.setup, life: copy(nextLife) };
        propsRef.current.onUpdateSetup?.((s) => ({ ...s, life: copy(nextLife) }));
      }
      if (nextDay && nextDay.date !== dayRef.current.date) propsRef.current.onUpdateDayOnDate?.(nextDay.date, () => copy(nextDay));
      else if (nextDay) {
      ((dayRef.current = copy(nextDay)),
        (ownUpdate.current = dayRef.current),
        propsRef.current.onUpdateDay(() => dayRef.current),
        setSelected(new Set()),
        setWireId(null),
        setConnecting(null),
        setTick((Pt) => Pt + 1),
        setStatus(Y ? t("Redone", "انجام مجدد") : t("Undone", "بازگشت تغییر")));
      }
      setTick((n) => n + 1);
    }
    // A change made in another view on this device is one undo step here. A change
    // that came in from sync (the phone, another tab) is not: undo never removes it.
    const seenRemote = useRef(window.__ddRemoteApply || 0);
    useLayoutEffect(() => {
      const remote = (window.__ddRemoteApply || 0) !== seenRemote.current;
      seenRemote.current = window.__ddRemoteApply || 0;
      (day !== dayRef.current &&
        (day !== ownUpdate.current &&
          !remote &&
          JSON.stringify(day) !== JSON.stringify(dayRef.current) &&
          remember(dayRef.current, undefined, day),
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
    // Where the Engine was moved to. A new day starts where the last day left it.
    function engineShift(saved) {
      const ok = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y),
        pick = (p) => ({ x: p.x, y: p.y, ...(p.w > 0 ? { w: p.w } : {}), ...(p.h > 0 ? { h: p.h } : {}) });
      if (ok(saved?.["section:engine"])) return pick(saved["section:engine"]);
      const last = Object.entries(allDays || {})
        .filter(([date]) => date < day.date)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([, d]) => d.canvas?.board4?.layouts?.mindmap?.["section:engine"])
        .find(ok);
      return last ? pick(last) : { x: 0, y: 0 };
    }
    // Dragging the Engine's title moves the whole Engine: today's tree and its section.
    function startEngineMove(e) {
      const area = layout.map.get("section:engine");
      if (!area || mode !== "mindmap" || layout.room) return;
      const refs = [area.id, ...layout.nodes.filter((n) => ["day", "lane", "block", "subtask", "bug"].includes(n.kind) && !n.lifeId).map((n) => n.id)];
      setSelected(new Set());
      gesture.current = {
        kind: "move", pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, refs,
        starts: Object.fromEntries(refs.map((ref) => { const n = layout.map.get(ref); return [ref, { x: n.x, y: n.y }]; })),
        moved: false, frame: true, engine: true, tapRef: area.id,
      };
      viewport.current.setPointerCapture(e.pointerId);
      viewport.current.focus({ preventScroll: true });
    }
    // Dragging the Feed's name moves the Feed with everything in it, on every day.
    function startFeedMove(e) {
      const area = layout.map.get("section:life");
      if (!area || layout.room) return;
      // Sections placed outside the Feed (and what is in them) stay where they are.
      const items = DDlifeItems(setup), outside = new Set(items.filter((i) => !i.parent && i.out).flatMap((i) => [...DDlifeDescendants(items, i.id)]));
      const refs = [area.id, ...layout.nodes.filter((n) => n.lifeId && !outside.has(n.lifeId)).map((n) => n.id)];
      setSelected(new Set());
      gesture.current = {
        kind: "move", pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, refs,
        starts: Object.fromEntries(refs.map((ref) => { const n = layout.map.get(ref); return [ref, { x: n.x, y: n.y }]; })),
        moved: false, frame: true, feed: true, tapRef: area.id,
      };
      viewport.current.setPointerCapture(e.pointerId);
      viewport.current.focus({ preventScroll: true });
    }
    // The Engine and the Feed grow from their bottom-right corner.
    function startAreaResize(e, area) {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation(); finishEdit(); setMenu(null);
      gesture.current = { kind: area.section === "engine" ? "engine-resize" : "life-resize", pointerId: e.pointerId, sx: e.clientX, sy: e.clientY,
        w: area.w, h: area.h, minW: area.autoW || 240, minH: area.autoH || 240, moved: false };
      viewport.current.setPointerCapture(e.pointerId);
    }
    // The Life section is the same on every day: it is kept in setup, not in the day.
    function lifeChange(change) {
      commit((d) => { d.__life.items = change(d.__life.items); return d; });
    }
    function restoreTrash(id) {
      const entry = (DDlifeState(setup).trash || []).find((e) => e.id === id);
      if (!entry) return;
      commit((d) => { d.__life = DDtrashRestore(d.__life, id); return d; }, t("Put back: ", "برگشت: ") + DDtrashLabel(entry, Date.now(), DDlanguage).split(" · ")[0]);
    }
    // A soft budget on a section: no warnings, just "used / budget" beside its name.
    function setBudget(id, budget) {
      lifeChange((list) => list.map((i) => i.id !== id ? i : budget ? { ...i, budget: { n: budget.n, unit: budget.unit, per: budget.per } } : (({ budget: _gone, ...rest }) => rest)(i)));
    }
    // A deadline on a note or a section (deadlines.js): only a date, never a warning.
    function setDue(ref, due) {
      const life = ref.startsWith("life:"), id = life ? ref.slice(5) : ref.replace(/^sticky:/, "");
      commit((d) => {
        const list = life ? d.__life.items : d.notes, i = list.findIndex((x) => x.id === id);
        if (i < 0) return;
        list[i] = DDdueSet(list[i], due);
        return d;
      }, due ? t("Deadline: ", "ددلاین: ") + DDdueDate(due, DDlanguage) : t("No deadline", "بدون ددلاین"));
    }
    function lifeFrame(Y, ct, top, left) {
      if (ddNodeMatches) return top;
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
      return node.y + node.h + 48;
    }
    // Feelings and Habits have their own sections on the board, in both modes.
    // Whatever changes here is the same data Plan and Lanes show.
    function sideSections(Y, ct, attachedBugs, top, left) {
      const CARD = 280,
        bugVisible = (n) =>
          !ddNodeMatches || ddNodeMatches.has("bug:" + day.date + ":" + n.id),
        linked = new Set(model.links.flatMap((l) => [l.from, l.to])),
        // Feelings were removed from the app (5.16); old entries stay in the data.
        freeBugs = [].filter(
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
      if (freeBugs.length)
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
      // Habits live in the rail beside the board (Shift+H), not in a section under the Engine.
      return top;
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
        [].filter(
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
      const noteH = (note,width=240) => {
        const m=stickyHeights.current.get("sticky:"+note.id);
        return DDstickyHeight(width,m&&m.w===width&&m.text===note.text?m.h:String(note.text||"").split("\n").reduce((sum,l)=>sum+Math.max(1,Math.ceil(l.length/25)),0)*24+80);
      };
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
            });
        if (mode === "mindmap") {
          let Jt = 56;
          const Xn = [];
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
              for (const ba of [].filter(
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
          ct["day:root"] || (Y[0].y = Math.max(60, Jt / 2 - 35) + shift.y);
          engineFrame(Y, shift);
          Object.assign(shift, { x: 0, y: 0, w: 0, h: 0 });
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
        for (const Jt of (day.notes || []).filter(
          (n) =>
            mode !== "lanes" && !roomItem &&
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
            title: it.text || (it.type === "section" ? t("Section","سکشن") : ""), color, textColor: it.style?.plain ? "var(--ink)" : core.contrast(color), ownColor: (it.type === "section" && !!it.parent && !!it.ownColor && !!it.color) || undefined, collapsed: it.collapsed, parentId: it.parent ? "life:" + it.parent : null,
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
          else if (n.plain) n.textColor = "var(--ink)";
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
      }, [
        day.blocks,
        day.bugs,
        day.notes,
        day.habits,
        setup.habits,
        setup.life,
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
        room, stickyRevision,
      ]),
      layoutRef = useRef(layout),
      labelPlace = useRef({ z: 0, layout: null });
    layoutRef.current = layout;
    // Sections drawn inside the Engine are its own quiet parts (5.37): softer on
    // the board, last in Tab. Read from the main board; kept while it is away.
    const engineSectionsRef = useRef(new Set()),
      engineSections = useMemo(() => {
        const area = layout.map.get("section:engine"), feed = layout.map.get("section:life");
        if (area && feed && !layout.room) engineSectionsRef.current = DDengineSectionIds(DDlifeItems(setup), feed, area);
        return engineSectionsRef.current;
      }, [layout]);
    // Comments, the pen, note tags and parent notes (5.36) live in their own
    // modules; the board hands them its data, its camera and its commit.
    const markCtx = {
      React: _, day, days: allDays, setup, mode, layout, tool, setTool, selected, items: DDlifeItems(setup), lifeHead: DDlifeHead,
      clearBoardSelection: () => { setSelected(new Set()); setWireId(null); setWireSelection(null); },
      commit: (change, message) => commit(change, message), toWorld, getCamera: () => cam.current, viewport, setStatus,
      pinching: () => !!pinch.current || touches.current.size > 1, panKey: () => space.current,
      reveal: (row) => revealSearchResult(row), enterRoom, setMode, mark: () => DDplaces.mark(), lifeHome: DDlifeHome,
      unfold: (id) => lifeChange((list) => list.map((i) => (i.id === id ? { ...i, collapsed: false } : i))),
      glide: (p) => { const el = viewport.current, z = Math.max(cam.current.z, 0.7); if (el) glideCamera({ x: el.clientWidth / 2 - (p.x + (el.clientWidth < 700 ? 0 : 140 / z)) * z, y: el.clientHeight / 2 - (p.y - (el.clientWidth < 700 ? 120 / z : 60 / z)) * z, z }); },
      finishEdit: () => finishEdit(), setMenu, search: (q) => { finishEdit(); setSearch(q); },
    };
    const pen = DDusePen(markCtx), comments = DDuseComments(markCtx), noteTools = DDuseNoteTools(markCtx);
    // The tag panel for several notes closes when the selection moves on.
    useEffect(() => { if (noteTools.group?.some((ref) => !selected.has(ref))) noteTools.stopTags(); }, [selected]);
    // Photos dropped, pasted or picked onto the board (5.38): a note holding a Drive link.
    const photos = DDuseBoardPhotos({ ...markCtx, root, language: DDlanguage, addPhoto: (point, template) => addSticky(point, template) });
    useLayoutEffect(() => { placeSectionLabels(true); }, [layout]);
    // Text still waiting to be saved is saved when the page hides or the board closes.
    const flushNoteRef = useRef(flushNote);
    flushNoteRef.current = flushNote;
    useEffect(() => {
      const hide = () => { if (document.visibilityState === "hidden") flushNoteRef.current(); }, leave = () => flushNoteRef.current();
      document.addEventListener("visibilitychange", hide);
      addEventListener("pagehide", leave);
      return () => { document.removeEventListener("visibilitychange", hide); removeEventListener("pagehide", leave); flushNoteRef.current(); };
    }, []);
    // A section that grew around a long note keeps that size, so what sits in the
    // grown part belongs to it and moves with it (one rule for drawing and for drops).
    useEffect(() => {
      if (editing || gesture.current) return;
      const items = DDlifeItems(setup), grow = new Map();
      for (const n of layout.nodes) if (n.lifeSection && !n.collapsed) {
        const it = items.find((i) => i.id === n.lifeId);
        if (it && n.h > it.h + 1) grow.set(it.id, Math.ceil(n.h));
      }
      if (grow.size) commit((d) => { d.__life.items = d.__life.items.map((i) => (grow.has(i.id) ? { ...i, h: grow.get(i.id) } : i)); return d; }, null, { history: !1 });
    }, [layout, editing]);
    // How many things each section keeps on its own board, outside its frame.
    const offFrame = useMemo(() => {
      const items = DDlifeItems(setup), m = new Map();
      for (const i of items) if (i.parent && !DDlifeInFrame(items, i)) m.set(i.parent, (m.get(i.parent) || 0) + 1);
      return m;
    }, [setup.life]);
    // Sections paint in nesting order (a parent under what is inside it); every
    // other node keeps its place.
    const paintOrder = useMemo(() => {
      const list = layout.nodes, slots = [], sections = [];
      list.forEach((n, i) => { if (n.lifeSection) { slots.push(i); sections.push(n); } });
      if (sections.length < 2) return list;
      sections.sort((a, b) => a.stack - b.stack);
      const out = list.slice();
      slots.forEach((slot, i) => (out[slot] = sections[i]));
      return out;
    }, [layout]);
    // Typing only changes the note being written: measure just that one on each
    // key. Everything is measured again when the board, the note or the language changes.
    useLayoutEffect(()=>{
      const measure=()=>{let changed=false;for(const n of layout.nodes.filter(n=>n.kind==="sticky")) {
        const el=elementRefs.current.get(n.id),body=el?.querySelector(":scope>.b4-node-body"),input=el?.querySelector("textarea");
        if(input){input.style.height="0px";input.style.height=input.scrollHeight+"px";}
        if(!body)continue;
        const h=Math.ceil(body.scrollHeight+(el.querySelector(".dd-sticky-footer")?.offsetHeight||0)),old=stickyHeights.current.get(n.id);
        if(!old||old.h!==h||old.w!==n.w||old.text!==n.title||old.size!==(n.textSize||16)){stickyHeights.current.set(n.id,{w:n.w,text:n.title,size:n.textSize||16,h});changed=true;}
      }if(changed)setStickyRevision(v=>v+1);};
      measure();const observer=new ResizeObserver(measure);
      for(const el of elementRefs.current.values()){const body=el.querySelector?.(":scope>.b4-node-body");if(body&&el.dataset.nodeKind==="sticky"){observer.observe(body);const footer=el.querySelector(".dd-sticky-footer");if(footer)observer.observe(footer);}}
      return()=>observer.disconnect();
    },[layout,editing?.ref,DDlanguage]);
    const measureTyped=useRef(null);
    useLayoutEffect(()=>{
      const n=editing&&layout.map.get(editing.ref);
      if(!n||n.kind!=="sticky"||measureTyped.current?.ref!==editing.ref){measureTyped.current=editing&&{ref:editing.ref};return;}
      const el=elementRefs.current.get(n.id),body=el?.querySelector(":scope>.b4-node-body"),input=el?.querySelector("textarea");
      if(input){input.style.height="0px";input.style.height=input.scrollHeight+"px";}
      if(!body)return;
      const h=Math.ceil(body.scrollHeight+(el.querySelector(".dd-sticky-footer")?.offsetHeight||0)),old=stickyHeights.current.get(n.id);
      if(!old||old.h!==h||old.w!==n.w||old.text!==n.title||old.size!==(n.textSize||16)){stickyHeights.current.set(n.id,{w:n.w,text:n.title,size:n.textSize||16,h});setStickyRevision(v=>v+1);}
    },[editing?.value]);
    // Where each task came from (phase 4): every section's done / not done record,
    // read from all days. Nothing is stored, so it is the same on every day.
    const sourceHistory = useMemo(
        () => DDengineSourceHistory({ ...(allDays || {}), [day.date]: day }, DDlifeItems(setup), day.date),
        [allDays, day, setup.life],
      ),
      sectionNames = new Map(DDlifeItems(setup).filter((i) => i.type === "section").map((i) => [i.id, i.text || t("Section", "سکشن")])),
      // Every day with this one up to date, for the sections' soft budgets (5.44).
      budgetDays = useMemo(() => ({ ...(allDays || {}), [day.date]: day }), [allDays, day]);
    // How many copies each linked note or section has, on every day and in the Feed.
    const syncCount = useMemo(() => {
      const count = new Map(), add = (id) => { if (DDsyncValid(id)) count.set(id, (count.get(id) || 0) + 1); };
      for (const it of DDlifeItems(setup)) add(it.syncId);
      for (const d of Object.values({ ...(allDays || {}), [day.date]: day })) for (const n of d?.notes || []) add(n.syncId);
      return count;
    }, [allDays, day, setup.life]);
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
    // The cards the lines drawn in this render go around, gathered once (not once per line).
    let shownObstacles = null;
    const paintObstacles = () => shownObstacles || (shownObstacles = layout.nodes.map((n) => nodeFor(n.id)));
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
    // A line's bend is saved where it sits on the main board. On a section's own
    // board the Feed things are drawn elsewhere, so their bends move with them.
    function bendShift(wire) {
      const shift = layoutRef.current?.roomShift;
      return shift && wire.from?.startsWith("life:") && wire.to?.startsWith("life:") ? shift : null;
    }
    function wireGeometry(wire, obstacles) {
      const steady = !preview.current.size && !pointerWire.current, kept = steady && steadyWires.current.layout === layoutRef.current ? steadyWires.current.map.get(wire.id) : null;
      if (kept && kept.wire === wire) { wireCache.current.set(wire.id, kept.geometry); return kept.geometry; }
      const a = nodeFor(wire.from), b = nodeFor(wire.to);
      if (!a || !b) return null;
      const drag = pointerWire.current, shift = bendShift(wire);
      const shown = shift && wire.bend ? { ...wire, bend: { x: wire.bend.x + shift.x, y: wire.bend.y + shift.y } } : wire;
      const geometry = DDconnectionGeometry(a, b, drag?.id === wire.id && drag.end === "bend" ? { ...wire, bend: drag.point } : shown, (typeof obstacles === "function" ? obstacles() : obstacles) || layoutRef.current.nodes.map((n) => nodeFor(n.id)));
      if (geometry && drag?.id === wire.id && ["from", "to"].includes(drag.end)) {
        if (drag.end === "from") geometry.p = drag.point; else geometry.q = drag.point;
        geometry.d = `M${geometry.p.x} ${geometry.p.y}L${geometry.q.x} ${geometry.q.y}`;
        geometry.mid = { x: (geometry.p.x + geometry.q.x) / 2, y: (geometry.p.y + geometry.q.y) / 2 };
      }
      wireCache.current.set(wire.id, geometry);
      if (steady && geometry) {
        if (steadyWires.current.layout !== layoutRef.current) steadyWires.current = { layout: layoutRef.current, map: new Map() };
        steadyWires.current.map.set(wire.id, { wire, geometry });
      }
      return geometry;
    }
    function paintWires(recalculate = true) {
      const obstacles = recalculate ? layoutRef.current.nodes.map((n) => nodeFor(n.id)) : null;
      for (const Y of layoutRef.current.edges) {
        const G = (!recalculate && wireCache.current.get(Y.id)) || wireGeometry(Y, obstacles),
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
    function paintSelection() {
      const bar = selectionbar.current, view = viewport.current, host = root.current;
      if (!bar || !view || !host) return;
      const state = selectionState.current;
      const nodes = layoutRef.current.nodes.filter((n) => state.selected.has(n.id)).map((n) => nodeFor(n.id));
      if (!nodes.length) for (const edge of layoutRef.current.edges.filter((e) => e.id === state.wireId || state.selectedWires.includes(e.id))) {
        // Keep the connection toolbar clear of its endpoint cards too.
        for (const id of [edge.from, edge.to]) { const node=nodeFor(id);if(node)nodes.push(node); }
        const g = wireCache.current.get(edge.id) || wireGeometry(edge);
        if (g) nodes.push({ x:Math.min(g.p.x,g.q.x), y:Math.min(g.p.y,g.q.y), w:Math.abs(g.p.x-g.q.x), h:Math.abs(g.p.y-g.q.y) });
      }
      if (!nodes.length) return;
      // A picked note's tags and family sit under it (5.36): keep the bar off them too.
      { const v = view.getBoundingClientRect(), c = cam.current;
        for (const e of host.querySelectorAll("[data-note-under]")) { if (!state.selected.has(e.dataset.noteUnder)) continue; const r = e.getBoundingClientRect(); if (r.height) nodes.push({ x:(r.left-v.left-c.x)/c.z, y:(r.top-v.top-c.y)/c.z, w:r.width/c.z, h:r.height/c.z }); } }
      // The top row and its actions (Undo, Search…) can wrap on phones; stay below both.
      const vr = view.getBoundingClientRect(), tops = [...host.querySelectorAll(".b2-top,.b2-top-actions")].map((e) => e.getBoundingClientRect()).filter((r) => r.height && r.top < vr.top + vr.height / 2);
      const br = tops.length ? { bottom: Math.max(...tops.map((r) => r.bottom)) } : null;
      const position = DDselectionToolbar(core.bounds(nodes), cam.current, {w:view.clientWidth,h:view.clientHeight}, {w:bar.offsetWidth,h:bar.offsetHeight}, Math.max(64,(br?.bottom || vr.top+64)-vr.top+10),view.clientWidth<700?134:84);
      const panel=host.querySelector(".b6-properties,.dd-card-details"), pr=panel?.getBoundingClientRect();
      if(pr && position.x+bar.offsetWidth>pr.left-vr.left && position.x<pr.right-vr.left && position.y+bar.offsetHeight>pr.top-vr.top && position.y<pr.bottom-vr.top) {
        if(pr.left-vr.left-bar.offsetWidth-12>=8)position.x=pr.left-vr.left-bar.offsetWidth-12;
        else position.y=Math.max((br?.bottom||vr.top+114)-vr.top+6,pr.top-vr.top-bar.offsetHeight-8);
      }
      // Never cover an open side rail: slide beside it.
      for(const r of [...host.querySelectorAll(".dd-rail-panel")].map((e)=>e.getBoundingClientRect()).filter((r)=>r.width&&r.height)){
        const L=r.left-vr.left,R=r.right-vr.left,T=r.top-vr.top,B=r.bottom-vr.top;
        if(position.x+bar.offsetWidth>L&&position.x<R&&position.y+bar.offsetHeight>T&&position.y<B){
          if(L>vr.width/2&&L-bar.offsetWidth-8>=8)position.x=L-bar.offsetWidth-8;
          else if(R+8+bar.offsetWidth<=vr.width-8)position.x=R+8;
          else if(B+8+bar.offsetHeight<=vr.height-8)position.y=B+8;
          else if(T-8-bar.offsetHeight>=8)position.y=T-8-bar.offsetHeight;
        }
      }
      bar.style.left = position.x + "px"; bar.style.top = position.y + "px";
    }
    // Section names follow one rule at every zoom. The name pill grows and shrinks
    // with the board but never below a readable 12px on screen, and never gets
    // wider than its section (a long name ends in "…"). When names would sit on
    // top of each other, the bigger section's name stays and the smaller one
    // steps aside until there is room again; a section too small on screen to
    // hold a name hides it. Selecting a section always shows its name.
    function placeSectionLabels(force = false) {
      const G = cam.current, map = layoutRef.current?.map, host = world.current;
      if (!host || !map) return;
      if (!force && labelPlace.current.z === G.z && labelPlace.current.layout === layoutRef.current) return;
      labelPlace.current = { z: G.z, layout: layoutRef.current };
      const k = Math.max(1, 0.75 / G.z), gap = 4 / G.z,
        depth = (n) => { let d = 0, p = n.parentId; while (p && d < 60) { d++; p = map.get(p)?.parentId; } return d; },
        list = [...host.querySelectorAll(".b4-life-section")].map((el) => ({ el, n: map.get(el.dataset.boardId) })).filter((e) => e.n);
      list.sort((a, b) => depth(a.n) - depth(b.n) || b.n.w * b.n.h - a.n.w * a.n.h);
      // Read every size first, then write: mixing them made the browser lay out
      // the board again for each section, on every key typed in a note.
      for (const e of list) { const body = e.el.querySelector(":scope > .b4-node-body"); e.bw = body?.offsetWidth || 0; e.bh = body?.offsetHeight || 0; }
      const shown = [];
      for (const { el, n, bw, bh } of list) {
        const r = { x: n.x + 10 * k, y: n.y + (n.collapsed ? 5 : 10) * k, w: bw, h: bh || 28 * k },
          tooSmall = !n.collapsed && (n.w * G.z < 64 || n.h * G.z < r.h * G.z * 1.6),
          clash = shown.some((o) => r.x < o.x + o.w + gap && r.x + r.w + gap > o.x && r.y < o.y + o.h + gap && r.y + r.h + gap > o.y),
          hide = !n.room && (tooSmall || clash);
        if (!hide) shown.push(r);
        if ((el.dataset.labelHidden === "true") !== hide) el.dataset.labelHidden = String(hide);
      }
    }
    function paintCamera() {
      cameraRAF.current = 0;
      const Y = viewport.current,
        G = cam.current;
      if (!Y || !world.current) return;
      ((world.current.style.transform = `translate3d(${G.x}px,${G.y}px,0) scale(${G.z})`),
        Y.style.setProperty("--b4-inverse", 1 / G.z),
        // Lines thin out a little as you zoom out, so they never outweigh the notes.
        Y.style.setProperty("--b4-line-inverse", Math.pow(1 / G.z, 0.75)),
        Y.classList.toggle("b4-overview", G.z < 0.7),
        Y.classList.toggle("b4-small", G.z < 0.95),
        Y.classList.toggle("b4-far", G.z < 0.35));
      placeSectionLabels();
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
        paintWires(false), paintSelection());
    }
    function queueCamera() {
      cameraRAF.current ||
        (cameraRAF.current = requestAnimationFrame(paintCamera));
    }
    function saveCamera() {
      clearTimeout(cameraTimer.current);
      DDsaveBoardView(dayRef.current.date, { ...cam.current }, mode);
      // The place you are in remembers where the camera is (Back, 5.33).
      DDplaces.note({ cam: { ...cam.current }, date: dayRef.current.date });
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
    function toggleBoardTheme() {
      const dark = setup.look?.theme === "dark" || (setup.look?.theme !== "light" && matchMedia("(prefers-color-scheme:dark)").matches);
      onUpdateSetup?.(s=>({...s,look:{...s.look,theme:dark?"light":"dark"}}));
    }
    function toggleRail(key, mobile = matchMedia("(max-width:700px)").matches) {
      onUpdateSetup?.((s) => {
        const open = DDrailPreferences(s.preferences, mobile), next = !open[key], patch = {};
        for (const k of ["goal", "note", "habits"]) if (k === key || mobile) patch["boardRail" + k[0].toUpperCase() + k.slice(1)] = k === key ? next : false;
        return { ...s, preferences: { ...s.preferences, ...patch } };
      });
    }
    function revealRail(row) {
      DDplaces.mark();
      if (!layout.map.has(row.id)) {
        const item = row.lifeId && DDlifeItems(setup).find((i) => i.id === row.lifeId);
        enterRoom(item ? DDrailScope(item, DDlifeItems(setup)) : null);
        setTimeout(() => revealBoardResult(row), 0);
        return;
      }
      revealBoardResult(row);
    }
    // A search result on another board (a day note seen from inside a section,
    // or a Feed note that lives in another section) opens that board first.
    function revealSearchResult(row) {
      const items = DDlifeItems(setup), item = row.lifeId && items.find((i) => i.id === row.lifeId), room = layout.room || null;
      const home = layout.map.has(row.id) ? room : item ? DDlifeHome(items, item.id) || null : row.id.startsWith("sticky:") ? null : room;
      if (home === room) return revealBoardResult(row);
      DDplaces.mark(); setSearch(null);
      enterRoom(home, true);
      setTimeout(() => revealBoardResult(row), 0);
    }
    function revealBoardResult(row) {
      DDplaces.mark();
      finishEdit(); cancelGesture(); setProperties(false); setInspector(false); setSearch(null);
      pendingReveal.current = row; onRevealObject?.();
      if(row.lifeId) {
        const items=DDlifeItems(setup), parents=new Set();let item=items.find(i=>i.id===row.lifeId);
        while(item?.parent){parents.add(item.parent);item=items.find(i=>i.id===item.parent);}
        if(items.some(i=>parents.has(i.id)&&i.collapsed))lifeChange(list=>list.map(i=>parents.has(i.id)?{...i,collapsed:false}:i));
      } else if(row.blockId) {
        commit(d=>{d.blocks=d.blocks.map(b=>{
          if(b.id!==row.blockId)return b;
          const expand=list=>(list||[]).map(i=>({...i,...(row.parents?.includes(i.id)?{expanded:true}:{}),children:expand(i.children)}));
          return {...b,expanded:true,subtasks:expand(b.subtasks)};
        });return d;});
      }
      if(row.kind==="sticky"&&!row.lifeId && mode==="lanes")setMode("mindmap");
      setTick(n=>n+1);
    }
    function fit(selection = false, scope = "all") {
      const el = viewport.current;
      if (!el) return;
      const nodes =
        selection && selected.size
          ? layout.nodes.filter((n) => selected.has(n.id))
          : layout.nodes.filter((n) => n.section !== "life" && (scope === "room" ? n.lifeId : scope!=="day" || !n.lifeId));
      const options = {
        left: 36,
        right: 36,
        top: (el.clientWidth < 700 ? 142 : 88) + (layout.room ? 52 : 0),
        bottom: el.clientWidth < 700 ? 132 : 100,
        maxZoom: selection ? 1.6 : 1.05,
      };
      let next = core.fit(nodes, el.clientWidth, el.clientHeight, options);
      // A section's board also frames its record under it. The record grows a
      // little when zoomed out, so measure it at the zoom the fit lands on.
      const record = !selection && layout.room && el.querySelector("[data-room-history]");
      // Keep the record clear of the minimap in the corner.
      const map = record && el.parentElement?.querySelector(".b4-minimap");
      if (map && map.offsetParent) options.bottom = Math.max(options.bottom, el.getBoundingClientRect().bottom - map.getBoundingClientRect().top + 12);
      if (record) for (let i = 0; i < 2; i++) {
        const k = Math.min(1.6, Math.max(1, 1 / next.z));
        next = core.fit([...nodes, { x: parseFloat(record.style.left) || 0, y: parseFloat(record.style.top) || 0, w: record.offsetWidth * k, h: record.offsetHeight * k }], el.clientWidth, el.clientHeight, options);
      }
      cam.current = next;
      queueCamera();
      scheduleCamera();
    }
    function selectOne(Y) {
      if (Y === "section:life") return;
      (setSelected(new Set([Y])), setWireId(null));
      const G = layout.map.get(Y);
      G?.blockId && onSelectBlock?.(G.blockId);
    }
    // A thing belongs to one group: grabbing any member takes the whole group.
    // Older boards may hold overlapping groups; they count as one.
    function groupFor(Y) {
      const all = Object.values(model.groups).filter(Array.isArray), out = new Set([Y]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const g of all) if (g.some((r) => out.has(r)) && g.some((r) => !out.has(r))) { g.forEach((r) => out.add(r)); grew = true; }
      }
      return [...out];
    }
    function nodeDown(Y, G, ddMove = false) {
      if (
        Y.button === 2 ||
        Y.target.closest("input,textarea,select,[data-port],[data-resize]") ||
        (Y.target.closest("button") && !ddMove)
      )
        return;
      Y.preventDefault();
      Y.stopPropagation();
      finishEdit();
      setMenu(null);
      // The section and sticky tools work on top of anything, sections included.
      if (tool === "section" || tool === "sticky" || tool === "text") return backgroundDown(Y, true);
      if (space.current || (tool === "hand" && !ddMove) || Y.button === 1)
        return startPan(Y);
      // A section's name always drags it. Its empty area: a click selects it, a
      // drag draws a selection box (so notes and sections inside are easy to pick
      // together), and once it is selected a drag there moves the whole selection.
      // On touch the empty area pans.
      if ((G.kind === "frame" || (G.lifeSection && (Y.pointerType === "touch" || Y.shiftKey || !selected.has(G.id)))) && Y.target === Y.currentTarget) return backgroundDown(Y, true);
      // The open section is the floor of its own board: it does not move.
      if (G.room) return backgroundDown(Y, true);
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
      for (const ref of [...moving]) {
        const n = layout.map.get(ref);
        if (n?.lifeSection) for (const id of DDlifeDescendants(DDlifeItems(setup), n.lifeId)) moving.add("life:" + id);
      }
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
        (ref) => ref !== "section:life" && layout.map.has(ref) && !locked.has(ref),
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
        // A double-click on a section's name renames it; on its empty area it adds a note.
        onName: !!Y.target.closest(".b4-node-body"),
        shift: Y.shiftKey,
        // Alt (Option) drag drops a copy and leaves the original in place.
        alt: Y.altKey && !ddConnect,
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
        // FigJam shows just the line's toolbar; the details panel opens on request.
        setInspector(!1),
        setWirePop(null),
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
    function portDown(Y, G, ct, plus = false) {
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
          plus,
        }),
        viewport.current.setPointerCapture(Y.pointerId));
    }
    function nodeAt(Y, G) {
      const rect=viewport.current.getBoundingClientRect(), c=cam.current;
      const hit=document.elementFromPoint(rect.left+c.x+Y.x*c.z,rect.top+c.y+Y.y*c.z)?.closest("[data-board-id]");
      const direct=hit&&layout.map.get(hit.dataset.boardId);
      if(direct&&direct.id!==G&&direct.section!=="life"&&direct.section!=="engine")return direct;
      const ct = layout.nodes.filter(
        (ot) =>
          ot.section !== "life" &&
          ot.section !== "engine" &&
          ot.id !== G &&
          Y.x >= ot.x - 10 / cam.current.z &&
          Y.x <= ot.x + ot.w + 10 / cam.current.z &&
          Y.y >= ot.y - 10 / cam.current.z &&
          Y.y <= ot.y + ot.h + 10 / cam.current.z,
      );
      return ct.filter((ot) => ot.kind !== "frame").at(-1) || ct.at(-1);
    }
    // Where a line being drawn lands. Over a section's empty inside it lands on
    // nothing (a new note is made there), so lines never stick to the frame.
    function linkTarget(p, from) {
      const n = nodeAt(p, from);
      if (!n || !(n.lifeSection || n.kind === "frame")) return n;
      const e = 14 / cam.current.z;
      return p.x > n.x + e && p.x < n.x + n.w - e && p.y > n.y + e && p.y < n.y + n.h - e ? null : n;
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
      if (G.kind === "life-resize" || G.kind === "engine-resize") {
        G.size = { w:Math.round(Math.max(G.minW,G.w + ct/cam.current.z)), h:Math.round(Math.max(G.minH,G.h + ot/cam.current.z)) };
        const el = elementRefs.current.get(G.kind === "engine-resize" ? "section:engine" : "section:life");
        if (el) { el.style.width = G.size.w + "px"; el.style.height = G.size.h + "px"; }
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
        // Alt-drag makes a copy: the original stays put and the copy-to-be
        // follows the pointer, see-through, so it is clear a copy is made.
        if (G.alt && !G.altShown) { G.altShown = true; altCopyLook(G.refs); }
        for (const An of G.refs) {
          const Kt = G.starts[An],
            Dn = { x: Kt.x + Pt, y: Kt.y + yn };
          preview.current.set(An, Dn);
          const Jt = elementRefs.current.get(An);
          Jt && (Jt.style.transform = `translate3d(${Pt}px,${yn}px,0)`);
        }
        paintWires(); paintSelection();
        return;
      }
      if (G.kind === "note-resize") {
        const edge = G.edge || "se",
          dx = ct / cam.current.z * (Y.altKey ? 2 : 1),
          dy = ot / cam.current.z * (Y.altKey ? 2 : 1);
        let width =
            G.width + (edge.includes("e") ? dx : edge.includes("w") ? -dx : 0),
          height =
            G.height + (edge.includes("s") ? dy : edge.includes("n") ? -dy : 0);
        const resized = layout.map.get(G.ref), sticky = resized?.kind === "sticky";
        // FigJam stickies: the left/right edges change only the width (text reflows);
        // corners and the top/bottom edges scale the whole note, text included.
        G.centered=Y.altKey;
        if (sticky && (edge.length === 2 || edge === "n" || edge === "s")) {
          const scale = Math.max(160 / (resized.baseW || 240), Math.min(4000 / G.width, edge.length === 2 ? Math.max(width / G.width, height / G.height) : height / G.height));
          width = G.width * scale;
          height = G.height * scale;
          G.scale = scale;
        } else if (sticky) {
          width=Math.max(resized.baseW||240,width);
          height = G.height;
          G.scale = 1;
        } else if (Y.shiftKey && edge.length === 2) {
          const scale = Math.max(width / G.width, height / G.height);
          width = G.width * scale;
          height = G.height * scale;
        }
        // Like FigJam, a section may shrink past its contents; they stay put and hang over.
        width = Math.round(Math.max(resized?.lifeSection ? 80 : sticky ? 40 : 144, Math.min(resized?.lifeSection ? 20000 : sticky ? 4000 : 1200, width)));
        height = Math.round(Math.max(resized?.lifeSection ? 60 : sticky ? 40 : 96, Math.min(resized?.lifeSection ? 20000 : sticky ? 4000 : 1800, height)));
        const x = G.x + (Y.altKey ? (G.width-width)/2 : edge.includes("w") ? G.width - width : 0),
          y = G.y + (Y.altKey ? (G.height-height)/2 : edge.includes("n") ? G.height - height : 0);
        G.size = { width, height };
        G.position = { x, y };
        const el = elementRefs.current.get(G.ref);
        if (el) {
          el.style.width = width + "px";
          el.style.height = height + "px";
          el.style.transform = `translate3d(${x - G.x}px,${y - G.y}px,0)`;
          el.dataset.size = width + " \u00d7 " + height;
          if (sticky) el.style.setProperty("--object-size", (G.textSize || 16) * (G.scale || 1) + "px");
        }
        preview.current.set(G.ref, { x, y, w: width, h: height });
        paintWires(); paintSelection();
        return;
      }
      if (G.kind === "resize") {
        G.min = Math.max(
          5,
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
              ? linkTarget(Tt, G.link[G.end === "from" ? "to" : "from"])?.id
              : null,
          ));
        return;
      }
      if (G.kind === "newlink") {
        const target = linkTarget(Tt, G.from), from = layout.map.get(G.from);
        ((draftPath.current.style.display = "block"),
          draftPath.current.setAttribute(
            "d",
            `M${G.start.x} ${G.start.y}L${Tt.x} ${Tt.y}`,
          ),
          showPreview(target?.id));
        // Over empty canvas, a note-to-be waits at the end of the line (FigJam).
        if (!target && from?.kind === "sticky" && Math.hypot(ct, ot) > 30) showGhost(dropRect(from, G.port, Tt), from.color);
        else hideGhost();
        return;
      }
      if (G.kind === "marquee" || G.kind === "section-create") {
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
    function altCopyLook(refs) {
      viewport.current?.classList.add("dd-alt-copying");
      for (const ref of refs) {
        const el = elementRefs.current.get(ref);
        if (!el?.parentNode) continue;
        const stay = el.cloneNode(true);
        stay.classList.add("dd-alt-original");
        stay.classList.remove("selected");
        stay.style.transform = "";
        stay.setAttribute("aria-hidden", "true");
        for (const n of [stay, ...stay.querySelectorAll("[data-board-id],[id]")]) { n.removeAttribute("data-board-id"); n.removeAttribute("id"); }
        el.parentNode.insertBefore(stay, el);
        el.classList.add("dd-alt-ghost");
      }
    }
    function showPreview(Y) {
      for (const [G, ct] of elementRefs.current)
        ct.classList.toggle("b4-drop-target", G === Y);
    }
    function clearPreview() {
      if (guideSvg.current) guideSvg.current.replaceChildren();
      viewport.current?.classList.remove("dd-alt-copying");
      for (const el of root.current?.querySelectorAll(".dd-alt-original") || []) el.remove();
      for (const [Y, G] of elementRefs.current) {
        ((G.style.transform = ""), G.classList.remove("b4-drop-target", "dd-alt-ghost"));
        const ct = layout.map.get(Y);
        if (ct) {
          G.style.width = ct.w + "px";
          G.style.height = ct.h + "px";
          if (ct.kind === "sticky") G.style.setProperty("--object-size", (ct.textSize || 16) + "px");
        }
        const ot = G.querySelector("[data-duration]");
        ot && ct?.min && (ot.textContent = w(ct.min));
      }
      (preview.current.clear(),
        (pointerWire.current = null),
        hideGhost(),
        draftPath.current && (draftPath.current.style.display = "none"),
        marquee.current && (marquee.current.style.display = "none"),
        paintWires(), paintSelection());
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
    function transferRef(d,from,to) {
      d.canvas ||= {}; d.canvas.board4 ||= {};
      const board=d.canvas.board4, moved=(d.__life.links||[]).filter((l)=>l.from===from||l.to===from);
      board.links=[...(board.links||[]),...moved].map((l)=>({...l,from:l.from===from?to:l.from,to:l.to===from?to:l.to}));
      d.__life.links=(d.__life.links||[]).filter((l)=>!moved.includes(l));
      // Its comments follow the card to its new home.
      DDcommentsTransfer(d,from,to);
      core.cleanRefs(d,[from]);
    }
    // Two quick taps on the same thing, close together on screen.
    function doubleTap(key, Y) {
      const last = lastTap.current, now = Date.now();
      if (last?.key === key && now - last.time < 400 && Math.hypot(Y.clientX - last.x, Y.clientY - last.y) < 16) {
        lastTap.current = null;
        return true;
      }
      lastTap.current = { key, time: now, x: Y.clientX, y: Y.clientY };
      return false;
    }
    // A double-click (or double-tap) on empty board, a section's empty area or
    // the Engine/Feed area adds a note right there.
    function noteHere(Y) {
      if (layout.room && mode !== "mindmap") return;
      addSticky(toWorld(Y.clientX, Y.clientY));
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
        // FigJam: a click (no drag) on a section's empty area selects the section.
        if (ct.tapSection && !ct.moved && !ct.right) {
          clearPreview();
          if (!ct.shift && doubleTap(ct.tapSection, Y)) return noteHere(Y);
          if (ct.shift) setSelected((s) => { const next = new Set(s); next.has(ct.tapSection) ? next.delete(ct.tapSection) : next.add(ct.tapSection); return next; });
          else selectOne(ct.tapSection);
          return;
        }
        if (ct.kind === "pan") {
          const context = pendingContext.current;
          pendingContext.current = null;
          if (!ct.moved && !ct.right && Y.pointerType === "touch" && tool === "select" && doubleTap("board", Y)) {
            clearPreview();
            return noteHere(Y);
          }
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
          elementRefs.current.get(ct.ref)?.removeAttribute("data-resizing");
          const el = elementRefs.current.get(ct.ref);
          if (el) delete el.dataset.size;
        }
        if (ct.kind === "life-resize" && ct.moved) {
          commit((d) => { d.__life.frame = { ...d.__life.frame, ...ct.size }; return d; }, t("Feed resized on every day","اندازهٔ فید در همهٔ روزها تغییر کرد"));
        } else if (ct.kind === "engine-resize" && ct.moved && ct.size) {
          // The Engine keeps the size you gave it; a new day starts with the same size.
          commit((d) => {
            const board = clean(d.canvas?.board4), saved = { ...(board.layouts.mindmap || {}) };
            saved["section:engine"] = { ...engineShift(saved), w: ct.size.w, h: ct.size.h };
            board.layouts = { ...board.layouts, mindmap: saved };
            d.canvas = { ...(d.canvas || {}), board4: board };
            return d;
          }, t("Engine resized", "اندازهٔ انجین تغییر کرد"));
        } else if (ct.kind === "move" && ct.moved && ct.feed) {
          // The Feed moved: its place is shared by every day, like its notes.
          const end = preview.current.get("section:life"), begin = ct.starts["section:life"];
          if (end && begin) {
            const x = Math.round(end.x), y = Math.round(end.y);
            const dx = x - Math.round(begin.x), dy = y - Math.round(begin.y);
            commit((d) => {
              d.__life.frame = { ...d.__life.frame, x, y };
              d.__life.items = d.__life.items.map((i) => (!i.parent && i.out ? { ...i, x: i.x - dx, y: i.y - dy } : i));
              return d;
            }, t("Feed moved", "فید جابه‌جا شد"));
          }
        } else if (ct.kind === "note-resize" && ct.moved) {
          const n = layout.map.get(ct.ref);
          if (n && ct.size)
            commit(
              (d) => {
                // A scaled sticky keeps its text in proportion (FigJam).
                const textSize = n.kind === "sticky" && ct.scale && ct.scale !== 1 ? { textSize: Math.round((ct.textSize || 16) * ct.scale * 10) / 10 } : {};
                if(n.kind === "sticky") {
                  const corner=(ct.edge||"se").length===2,base=Math.max(160,(n.baseW||240)*(corner?(ct.scale||1):1));
                  ct.size.width=corner?DDstickySnap(n.w,n.baseW||240)/(n.baseW||240)*base:DDstickySnap(ct.size.width,base);
                  if(ct.centered)ct.position.x=n.x+(n.w-ct.size.width)/2;else if(ct.edge?.includes("w"))ct.position.x=n.x+n.w-ct.size.width;
                  const list=n.lifeId?d.__life.items:d.notes,item=list.find(i=>i.id===(n.lifeId||n.noteId));if(item)item.baseW=base;
                }
                const stickySize=n.kind==="sticky"?{width:ct.size.width}:ct.size;
                let next = core.setStyle(d, [n], n.memberOf ? { height: ct.size.height } : { ...stickySize, ...textSize });
                if (
                  !n.memberOf &&
                  ct.position &&
                  (ct.position.x !== n.x || ct.position.y !== n.y)
                )
                  next = core.place(next, [n], { [n.id]: ct.position }, mode);
                if (n.lifeSection && ct.position) {
                  // Resizing the container from north/west never moves its contents.
                  const dx = ct.position.x-n.x, dy = ct.position.y-n.y;
                  next.__life.items = next.__life.items.map((i)=>i.parent===n.lifeId?{...i,x:i.x-dx,y:i.y-dy}:i);
                }
                // A section grown over neighbours takes them in, as in FigJam. Made
                // smaller, what ends up outside drops to the board it sits on, so
                // nothing vanishes; on its own board the whole board is still its.
                if (n.lifeSection && next.__life) next.__life.items = DDlifeAdopt(layout.room === n.lifeId ? next.__life.items : DDlifeRelease(next.__life.items, n.lifeId), n.lifeId);
                return next;
              },
              t("Note resized", "اندازهٔ نوت تغییر کرد"),
            );
        } else if (ct.kind === "move" && ct.moved && ct.engine) {
          // The Engine moved: today's tree keeps its shape and lands in the new spot.
          const end = preview.current.get("section:engine"), begin = ct.starts["section:engine"];
          if (end && begin) {
            const dx = Math.round(end.x - begin.x), dy = Math.round(end.y - begin.y),
              tree = (ref) => ref === "day:root" || /^(lane|b|sub|bug):/.test(ref);
            commit((d) => {
              const board = clean(d.canvas?.board4), saved = { ...(board.layouts.mindmap || {}) }, from = engineShift(saved);
              for (const [ref, pos] of Object.entries(saved))
                if (tree(ref) && Number.isFinite(pos?.x) && Number.isFinite(pos?.y)) saved[ref] = { ...pos, x: pos.x + dx, y: pos.y + dy };
              saved["section:engine"] = { ...from, x: from.x + dx, y: from.y + dy };
              board.layouts = { ...board.layouts, mindmap: saved };
              d.canvas = { ...(d.canvas || {}), board4: board };
              return d;
            }, t("Engine moved", "انجین جابه‌جا شد"));
          }
        } else if (ct.kind === "move" && ct.moved && ct.alt) {
          const first = ct.refs.find((r) => preview.current.has(r)), end = first && preview.current.get(first), begin = first && ct.starts[first];
          clearPreview();
          if (end && begin) {
            const payload = standalone(core.copy(boardDocument(), layout.nodes, layout.edges, new Set(ct.refs), mode));
            if (payload) pastePayload(payload, { x: payload.origin.x + end.x - begin.x, y: payload.origin.y + end.y - begin.y });
          }
        } else if (ct.kind === "move" && ct.moved) {
          let foldedInto = "";
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
            habitRefs = new Set(toHabits.map((n) => n.id)),
            madeTasks = [];
          commit((Tt) => {
            // A note dragged into the Engine's section from outside becomes a task
            // there, in the lane it lands nearest to. The note itself is used up.
            const engineArea = mode === "mindmap" && !ct.frame && layout.map.get("section:engine");
            if (engineArea)
              for (const ref of ct.refs) {
                const node = layout.map.get(ref), pos = ot[ref];
                if (!node || !pos || node.kind !== "sticky" || node.memberOf || locked.has(ref) || ct.refs.includes(node.parentId) || within(node, node, engineArea) || !within(pos, node, engineArea)) continue;
                const center = { x: pos.x + node.w / 2, y: pos.y + node.h / 2 },
                  dist = (n) => Math.hypot(n.x + n.w / 2 - center.x, n.y + n.h / 2 - center.y),
                  lane = layout.nodes.filter((n) => n.kind === "lane").sort((a, b) => dist(a) - dist(b))[0],
                  // The task remembers the section the note sat in (or the open section).
                  from = (node.lifeId && Tt.__life.items.find((i) => i.id === node.lifeId)?.parent) || layout.room || "",
                  task = DDengineTaskFromNote(node.title, lane ? lane.laneId || "" : setup.lanes[0]?.id || "", { ...setup, preferences: { ...setup.preferences, defaultMinutes: prefs.defaultMinutes } }, C, from);
                if (node.lifeId) {
                  Tt.__life.items = Tt.__life.items.filter((i) => i.id !== node.lifeId);
                  Tt.__life.links = (Tt.__life.links || []).filter((l) => l.from !== ref && l.to !== ref);
                } else Tt.notes = Tt.notes.filter((n) => n.id !== node.noteId);
                Tt.blocks.push(task);
                madeTasks.push(task.id);
                delete ot[ref];
              }
            const frame = layout.map.get("section:life");
            // Items moved together keep their places relative to each other.
            const movingLife = ct.refs.map((r) => layout.map.get(r)?.lifeId).filter(Boolean);
            // Dropped on a folded section's name on purpose: say where it went.
            const intoFolded = (id) => { const it = Tt.__life.items.find((i) => i.id === id), p = it && Tt.__life.items.find((i) => i.id === it.parent); if (p?.collapsed && p.id !== layout.room) foldedInto = p.text || t("Section", "سکشن"); };
            for (const ref of ct.refs) {
              const node = layout.map.get(ref), pos = ot[ref];
              if (!node || !pos) continue;
              if (node.lifeId) {
                // A parent section carries descendants; do not move them twice.
                if (ct.refs.includes(node.parentId)) continue;
                const target = DDlifeParentAt(Tt.__life.items, pos.x - frame.x + node.w/2, pos.y - frame.y - DDlifeHead + node.h/2, DDlifeDescendants(Tt.__life.items,node.lifeId), layout.room || "");
                const inside = pos.x + node.w/2 >= frame.x && pos.x + node.w/2 <= frame.x + frame.w && pos.y + node.h/2 >= frame.y + DDlifeHead && pos.y + node.h/2 <= frame.y + frame.h;
                if (!inside && !target && !node.lifeSection) {
                  const old = Tt.__life.items.find((i) => i.id === node.lifeId), id=Tt.notes.some((i)=>i.id===old.id)?C():old.id;
                  Tt.notes.push({ id, kind: "sticky", text: old.text, role: old.role, ...(old.goal ? { goal: old.goal } : {}), ...(old.due ? { due: old.due } : {}), at:old.at, baseW:old.baseW, color: old.color || node.color, x: pos.x, y: pos.y, ...(old.syncId ? { syncId: old.syncId } : {}), ...(old.media ? { media: old.media } : {}) });
                  Tt.canvas ||= {}; Tt.canvas.board4 ||= {};
                  Tt.canvas.board4.styles ||= {}; Tt.canvas.board4.styles["sticky:" + id] = { width: old.w, height: old.h, ...old.style };
                  Tt.__life.items = Tt.__life.items.filter((i) => i.id !== old.id);
                  transferRef(Tt,ref,"sticky:"+id);
                } else { Tt.__life.items = DDlifeMoveBy(Tt.__life.items,node.lifeId,pos.x-node.x,pos.y-node.y,movingLife,layout.room || ""); intoFolded(node.lifeId); }
                delete ot[ref];
              } else if (frame && node.noteId && node.kind === "sticky" && !ct.frame) {
                const target = DDlifeParentAt(Tt.__life.items, pos.x - frame.x + node.w/2, pos.y - frame.y - DDlifeHead + node.h/2, undefined, layout.room || "");
                if (target) {
                  const old = Tt.notes.find((i) => i.id === node.noteId), base = DDlifeAbs(Tt.__life.items,target.id),id=Tt.__life.items.some((i)=>i.id===old.id)?"lf-"+C():old.id;
                  Tt.__life.items = DDlifeAdd(Tt.__life.items,{id,type:"sticky",parent:target.id,text:old.text,role:old.role,goal:old.goal,due:old.due,at:old.at,baseW:old.baseW,color:old.color,x:pos.x-frame.x-base.x,y:pos.y-frame.y-DDlifeHead-base.y,w:node.w,h:node.h,style:model.styles[node.id],syncId:old.syncId,media:old.media});
                  Tt.notes = Tt.notes.filter((i) => i.id !== old.id);
                  transferRef(Tt,node.id,"life:"+id); delete ot[ref]; intoFolded(id);
                }
              }
            }
            // A section moved out of the Feed stays where it is dropped, on the
            // board; moved back in, it is part of the Feed again.
            if (frame && !layout.room && movingLife.length) {
              const moved = new Set(movingLife);
              Tt.__life.items = Tt.__life.items.map((i) => {
                if (!moved.has(i.id) || i.type !== "section") return i;
                const cx = i.x + i.w / 2, cy = i.y + (i.collapsed ? 38 : i.h) / 2,
                  out = !i.parent && (cx < 0 || cy < 0 || cx > frame.w || cy > frame.h - DDlifeHead);
                if (out) return i.out ? i : { ...i, out: true };
                if (!i.out) return i;
                const { out: gone, ...rest } = i;
                return rest;
              });
            }
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
          }, madeTasks.length ? t("The note is now a task in the Engine", "یادداشت حالا یک کار در انجین است") : DDUI("\u062C\u0627\u06CC \u0646\u0648\u062F\u0647\u0627 \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F"));
          if (madeTasks.length) (setSelected(new Set(madeTasks.map((id) => "b:" + id))), onSelectBlock?.(madeTasks[0]));
          else if (foldedInto) setStatus(t("Moved into the folded section “" + foldedInto + "” · unfold it to see it", "به سکشن بسته «" + foldedInto + "» رفت؛ برای دیدنش بازش کن"));
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
              bend: (() => { const point = pointerWire.current.point, shift = bendShift(ct.link); return shift ? { x: point.x - shift.x, y: point.y - shift.y } : { ...point }; })(),
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
            St = linkTarget(ot, ct.link[ct.end === "from" ? "to" : "from"]);
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
            target = linkTarget(point, ct.from),
            from = layout.map.get(ct.from);
          hideGhost();
          // FigJam's "+": a click adds the next note, a drag draws a connector.
          if (ct.plus && !ct.moved) { if (from) addNear(from, ct.port); }
          else if (target && ct.moved)
            addLink(ct.from, target.id, {
              fromPort: ct.port,
              toPort: nearestPort(target, point),
            });
          else if (ct.moved && from?.kind === "sticky" && Math.hypot(Y.clientX - ct.sx, Y.clientY - ct.sy) > 30) {
            // Dropped on empty canvas: make the connected note there, as FigJam does.
            const r = dropRect(from, ct.port, point),
              ref = addSticky({ x: r.x + r.w / 2, y: r.y + r.h / 2 }, noteLike(from));
            addLink(ct.from, ref, { fromPort: ct.port, toPort: oppositeSide[ct.port] }, true);
          } else
            setStatus(
              DDlanguage === "fa"
                ? "برای اتصال، نقطه را تا نود مقصد بکش"
                : "Drag the connection point to the target node",
            );
          setConnecting(null);
          setTool("select");
        } else if (ct.kind === "section-create") {
          addLifeSection(ct.moved && ct.box ? ct.box : ct.start);
          setTool("select");
        } else if (ct.kind === "marquee" && ct.moved && ct.box) {
          const ot = ct.box,
            St = DDmarqueeSelection(layout.nodes, ot, locked);
          selectMarquee(new Set([...(ct.shift ? ct.initial : []), ...St]), ot);
        } else if (ct.kind === "marquee" && !ct.moved && !ct.shift) {
          if (doubleTap("board", Y)) noteHere(Y);
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
        } else if (ct.kind === "move" && !ct.moved && !ct.engine && !ct.feed) {
          const node = layout.map.get(ct.tapRef);
          if (doubleTap(ct.tapRef, Y)) {
            if ((node?.lifeSection || node?.kind === "frame") && !ct.onName) noteHere(Y);
            else openEdit(ct.tapRef);
          }
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
          altKey: Y.altKey,
        }),
        moveRAF.current ||
          (moveRAF.current = requestAnimationFrame(() => {
            ((moveRAF.current = 0),
              latestMove.current && paintGesture(latestMove.current));
          })));
      // The sticky tool carries a faint note under the pointer (FigJam).
      if (!gesture.current && tool === "sticky" && Y.pointerType !== "touch") {
        const p = toWorld(Y.clientX, Y.clientY);
        showGhost({ x: p.x - 120, y: p.y - 120, w: 240, h: 240 });
      }
    }
    function pointerUp(Y) {
      if ((touches.current.delete(Y.pointerId), pinch.current)) {
        touches.current.size === 0 && ((pinch.current = null), saveCamera());
        return;
      }
      endGesture(Y);
    }
    function backgroundDown(Y, sectionBackground = false) {
      const nodeEl = Y.target.closest("[data-board-id]"),
        // Right-drag on a section (Feelings, Habits, Notes) pans like the canvas.
        sectionPan =
          Y.button === 2 &&
          nodeEl?.dataset.nodeKind === "frame" &&
          !!nodeEl.dataset.section;
      if (
        Y.target.closest("button,input,textarea,select,[data-wire-id]") ||
        (nodeEl && !sectionPan && !sectionBackground) ||
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
      if (tool === "text") return addText(G);
      if (tool === "section") {
        gesture.current = {kind:"section-create",start:G,sx:Y.clientX,sy:Y.clientY,pointerId:Y.pointerId,moved:false};
        viewport.current.setPointerCapture(Y.pointerId); return;
      }
      if (tool === "feeling") return ddAddFeeling(G);
      if (tool === "block") return addBlock(null, G);
      if (tool === "connector") {
        setConnecting(null);
        return;
      }
      const tapSection = sectionBackground && nodeEl?.dataset.lifeType === "section" && tool === "select" ? nodeEl.dataset.boardId : null;
      if (
        Y.button === 1 ||
        space.current ||
        tool === "hand" ||
        Y.pointerType === "touch"
      ) {
        startPan(Y);
        if (tapSection && Y.button === 0 && !space.current && tool !== "hand") gesture.current.tapSection = tapSection;
        return;
      }
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
          tapSection,
        }),
        viewport.current.setPointerCapture(Y.pointerId),
        viewport.current.focus({ preventScroll: !0 }));
    }
    // FigJam's connector toolbar: color, weight, text, dash, type and both ends.
    const wireColors = ["#1E1E1E", "#757575", "#F24822", "#FFA629", "#FFCD29", "#14AE5C", "#0D99FF", "#9747FF", "#FF24BD"];
    function wireButton(label, content, onClick, pressed) {
      return _.createElement("button", { type: "button", key: label, className: "b2-icon dd-wire-button", "aria-label": label, title: label, ...(pressed === undefined ? {} : { "aria-pressed": pressed }), onClick }, content);
    }
    // Color and weight for one line or many. What you pick last is what new lines get.
    function lineLook(wires, set) {
      const first = wires[0] || {},
        color = wires.every((w) => (w.color || "") === (first.color || "")) ? first.color : "",
        weight = wires.every((w) => (w.width || 3) === (first.width || 3)) ? first.width || 3 : 0,
        toggle = (name) => setWirePop((v) => (v === name ? null : name)),
        note = _.createElement("small", { className: "dd-wire-pop-note" }, t("New lines use this too", "خط‌های تازه هم همین می‌شن"));
      return _.createElement(_.Fragment, null,
        _.createElement("span", { style: { position: "relative", display: "inline-flex" } },
          wireButton(t("Line color", "رنگ خط"), _.createElement("span", { className: "dd-wire-color", style: { background: color || "var(--dd-wire,#4A4843)" } }), () => toggle("color"), wirePop === "color"),
          wirePop === "color" && _.createElement("div", { className: "dd-wire-pop", role: "group", "aria-label": t("Line colors", "رنگ‌های خط") },
            wireColors.map((c) => _.createElement("button", { type: "button", key: c, className: "dd-swatch", style: { background: c }, "aria-label": t("Line color ", "رنگ خط ") + c, "aria-pressed": (color || "#757575").toUpperCase() === c, onClick: () => { set({ color: c }, t("Line color changed", "رنگ خط تغییر کرد")); changeAppearance({ lineColor: c }); setWirePop(null); } })), note)),
        _.createElement("span", { style: { position: "relative", display: "inline-flex" } },
          wireButton(t("Line weight", "ضخامت خط"), _.createElement(controls.Icon,{React:_,name:"weight"}), () => toggle("weight"), wirePop === "weight"),
          wirePop === "weight" && _.createElement("div", { className: "dd-wire-pop", role: "group", "aria-label": t("Line weights", "ضخامت‌های خط") },
            [[2, t("Thin", "نازک")], [3, t("Medium", "متوسط")], [5, t("Thick", "ضخیم")]].map(([w, name]) => _.createElement("button", { type: "button", key: w, "aria-pressed": weight === w, onClick: () => { set({ width: w }, t("Line weight changed", "ضخامت خط تغییر کرد")); changeAppearance({ lineWidth: w }); setWirePop(null); } }, name)), note)));
    }
    function patchWires(ids, patch, message) {
      const list = new Set(ids);
      boardChange((b) => {
        for (const id of list) if (id.startsWith("auto:")) b.overrides = { ...b.overrides, [id]: { ...(b.overrides?.[id] || {}), ...patch } };
        b.links = b.links.map((l) => (list.has(l.id) ? { ...l, ...patch } : l));
        return b;
      }, message);
    }
    function wireToolbar(wire) {
      const ends = wireEnds(wire), style = wire.style || "curve";
      const set = (patch, message) => patchWire(wire.id, patch, message);
      return _.createElement(_.Fragment, null,
        lineLook([wire], set),
        // Text, dashes, the start arrow, details and delete: ⋯ or a right-click.
        _.createElement("span", { className: "b2-sep" }),
        wireButton(t("Straight line", "خط صاف"), _.createElement(controls.Icon,{React:_,name:"straight"}), () => set({ style: "straight", bend: null }, t("Line type changed", "نوع خط تغییر کرد")), style === "straight"),
        wireButton(t("Elbowed line", "خط شکسته"), _.createElement(controls.Icon,{React:_,name:"elbow"}), () => set({ style: "elbow", bend: null }, t("Line type changed", "نوع خط تغییر کرد")), style === "elbow"),
        wireButton(t("Curved line", "خط منحنی"), _.createElement(controls.Icon,{React:_,name:"curve"}), () => set({ style: "curve", bend: null }, t("Line type changed", "نوع خط تغییر کرد")), style === "curve"),
        _.createElement("span", { className: "b2-sep" }),
        wireButton(t("Arrow at end", "پیکان در انتها"), _.createElement(controls.Icon,{React:_,name:"arrow"}), () => setWireEnds(wire, { ...ends, end: !ends.end }), ends.end),
        // Direction matters here (it can mean which task leads), so it stays one click away.
        wireButton(t("Reverse direction", "برعکس کردن جهت"), _.createElement(controls.Icon,{React:_,name:"reverse"}), () => patchWire(wire.id, { from: wire.to, to: wire.from, fromPort: wire.toPort, toPort: wire.fromPort }, t("Connection reversed", "جهت اتصال عوض شد"))),
        toolButton(t("More actions", "گزینه‌های بیشتر"), "more", (event) => openContext(event, { wire: wire.id }), { "data-dock-more": "line" }),
      );
    }
    // Arrowheads at either end. Older links keep one arrow, flipped by arrowReverse.
    function wireEnds(wire) {
      return {
        start: !!(wire.arrowStart || (wire.arrow && wire.arrowReverse)),
        end: !!(wire.arrow && !wire.arrowReverse),
      };
    }
    function setWireEnds(wire, ends) {
      patchWire(wire.id, { arrow: ends.end, arrowReverse: false, arrowStart: ends.start }, t("Line ends changed", "سر خط تغییر کرد"));
    }
    function patchWire(Y, G, ct) {
      const current = layoutRef.current.edges.find((e) => e.id === Y);
      // Visual arrow direction is independent of the task's real parent.
      // Reversing swaps the two ends: a two-way line stays two-way.
      if (current && G.from === current.to && G.to === current.from) {
        const ends = wireEnds(current);
        G = { ...G, arrow: ends.start, arrowStart: ends.end, arrowReverse: false };
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
    function addLink(Y, G, ct = {}, keep = false) {
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
              style: connectionStyle.current,
              arrow: !0,
              label: "",
              color: /^bug:/.test(Y) || /^bug:/.test(G) ? "#D9434A" : appearanceRef.current.lineColor || "#7A5FF5",
              ...(appearanceRef.current.lineWidth ? { width: appearanceRef.current.lineWidth } : {}),
              ...ct,
            },
          ],
        }),
        DDUI(
          "\u0627\u062A\u0635\u0627\u0644 \u0633\u0627\u062E\u062A\u0647 \u0634\u062F",
        ),
      ),
        // FigJam selects the new line and shows only its toolbar. A note made at
        // the end of the line keeps the focus instead, ready for typing.
        keep || (setWireId(ot), setSelected(new Set())),
        setInspector(!1));
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
        day.__life.links=day.__life.links.filter((e)=>!selectedWires.has(e.id));
        for (const edge of layout.edges.filter((e) => selectedWires.has(e.id) && e.automatic))
          day = DDdisconnectRelation(day, edge.from, edge.to, setup);
        const board = day.canvas?.board4;
        if (board) {
          board.links = (board.links || []).filter((e) => !selectedWires.has(e.id));
          if (Array.isArray(board.hidden)) board.hidden = board.hidden.filter((id) => !selectedWires.has(id));
        }
        return core.remove(day, nodes);
      }, nodes.some((n) => n.lifeId) ? t("Deleted · Undo, or find it in Recently deleted", "حذف شد · واگرد کن، یا از «تازه حذف‌شده‌ها» برگردون") : t("Selection deleted · Undo to restore", "انتخاب حذف شد؛ با واگرد برگردان"), { trash: true });
      setSelected(new Set()); setWireSelection(null); onSelectBlock?.(null);
    }
    function duplicate() {
      const payload = standalone(core.copy(
        boardDocument(),
        layout.nodes,
        layout.edges,
        selected,
        mode,
      ));
      // FigJam puts the copy beside the original, one even gap to the right, so
      // repeated duplicates line up in a row instead of piling up.
      const picked = layout.nodes.filter((n) => selected.has(n.id));
      if (payload)
        pastePayload(payload, {
          x: payload.origin.x + (picked.length ? nodeBounds(picked).w : 0) + 40,
          y: payload.origin.y,
        });
    }
    // Linked copies (5.34). Duplicate and Alt+drag make a copy that stands on its own.
    function standalone(payload) {
      return payload && { ...payload, items: payload.items.map((i) => ({ ...i, data: DDsyncForget(i.data) })) };
    }
    // A note (on a day or in the Feed) or a Feed section can have synced copies.
    const syncable = (n) => !!n && ((n.kind === "sticky" && (n.lifeId || (n.noteId && !n.memberOf))) || !!n.lifeSection);
    function planSnapshot() {
      return { setup: { life: DDlifeState(propsRef.current.setup) }, days: { ...(propsRef.current.allDays || {}), [dayRef.current.date]: dayRef.current } };
    }
    // The board document with its notes and sections linked, ready to copy.
    function linkedDocument(nodes) {
      const doc = boardDocument();
      for (const n of nodes) {
        if (n.lifeId) doc.__life.items = DDsyncMarkLife(doc.__life.items, n.lifeId);
        else if (n.noteId) doc.notes = doc.notes.map((x) => (x.id === n.noteId && !DDsyncValid(x.syncId) ? { ...x, syncId: DDsyncNewId() } : x));
      }
      return doc;
    }
    // Ctrl/Cmd+Shift+D: a synced copy beside the original. Edit either one.
    function syncedCopy() {
      const picked = layout.nodes.filter((n) => selected.has(n.id) && syncable(n));
      if (!picked.length) return setStatus(t("Only notes and sections can have synced copies", "فقط نوت و سکشن کپی همگام دارند"));
      const doc = linkedDocument(picked), payload = core.copy(doc, layout.nodes, layout.edges, new Set(picked.map((n) => n.id)), mode);
      if (payload) pastePayload(payload, { x: payload.origin.x + nodeBounds(picked).w + 40, y: payload.origin.y }, doc,
        t("Synced copy made · a change in one shows in all", "کپی همگام ساخته شد؛ تغییر هر کدام در همه دیده می‌شود"));
    }
    // Copy as synced: paste it on any day, in the Feed or in a section.
    function copySynced() {
      const picked = layout.nodes.filter((n) => selected.has(n.id) && syncable(n));
      if (!picked.length) return;
      const doc = linkedDocument(picked);
      commit(() => doc, null);
      const payload = core.copy(doc, layout.nodes, layout.edges, new Set(picked.map((n) => n.id)), mode);
      if (!payload) return;
      clipboard.current = sharedClipboard = payload;
      sharedFresh = true;
      navigator.clipboard?.writeText(payload.text).catch(() => {});
      setStatus(t("Copied as synced · paste on any day or in any section", "همگام کپی شد؛ روی هر روز یا هر سکشنی بچسبان"));
    }
    // Notes that already say the same words (made with Copy and Paste) become one.
    function sameWords(n) {
      if (!n || n.kind !== "sticky" || !(n.title || "").trim()) return [];
      const except = n.lifeId ? { life: n.lifeId } : { date: dayRef.current.date, note: n.noteId };
      return DDsyncSameNotes(planSnapshot(), n.title, except).filter((p) => !n.syncId || p.syncId !== n.syncId);
    }
    function syncSameWords(n) {
      const matches = sameWords(n);
      if (!matches.length) return;
      const snap = planSnapshot(), date = dayRef.current.date;
      const source = n.lifeId ? { kind: "life", id: n.lifeId, syncId: n.syncId } : { kind: "day", date, id: n.noteId, syncId: n.syncId };
      const next = DDsyncJoin(snap, source, matches, DDsyncValid(n.syncId) ? n.syncId : DDsyncNewId());
      for (const [d, value] of Object.entries(next.days)) if (d !== date && value !== snap.days[d]) onUpdateDayOnDate?.(d, () => value);
      const mine = next.days[date];
      commit((d) => { d.notes = mine.notes; d.canvas = mine.canvas; d.__life = { ...d.__life, items: next.setup.life.items }; return d; },
        t(`${matches.length + 1} notes synced · a change in one shows in all`, `${matches.length + 1} نوت همگام شدند`));
    }
    function unsync(n) {
      commit((d) => {
        if (n.lifeId) d.__life.items = d.__life.items.map((i) => (i.id === n.lifeId ? DDsyncForget(i) : i));
        else d.notes = d.notes.map((x) => (x.id === n.noteId ? DDsyncForget(x) : x));
        return d;
      }, t("This copy stands on its own now", "این کپی حالا مستقل است"));
    }
    // Where the other copies are, and a way to go there (Back returns).
    function copyPlaces(n) {
      if (!DDsyncValid(n?.syncId)) return [];
      const items = DDlifeItems(setup), date = dayRef.current.date;
      return DDsyncPlaces(planSnapshot(), n.syncId).map((p) => {
        const here = p.kind === "life" ? n.lifeId === p.id : n.noteId === p.id && p.date === date;
        const label = here ? t("Here", "همین‌جا") : p.kind === "life"
          ? (p.parent ? DDsectionPath(items, p.parent, 36, t("Section", "سکشن")).short : t("Feed", "فید"))
          : p.date === date ? t("This day", "همین روز") : new Date(p.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        return { ...p, here, label };
      });
    }
    function goToCopy(p) {
      if (p.kind === "life") return jumpLife(p.id);
      if (p.date === dayRef.current.date) return revealSearchResult({ id: "sticky:" + p.id, kind: "sticky" });
      DDplaces.mark();
      window.dispatchEvent(new CustomEvent("debug-day-open-note", { detail: { date: p.date, id: p.id } }));
      // Each day has its own board: the other day's opens full screen if this one is.
      if (focus) try { sessionStorage.setItem("debug-day:board-open-fullscreen", "1"); } catch {}
    }
    // Above the note, never on its paper: "◆ 8 days left".
    function dueBadge(Y) {
      const today = new Date().toLocaleDateString("en-CA"), left = DDdueDaysLeft(Y.due, today), text = DDdueText(Y.due, today, DDlanguage);
      if (!text) return null;
      const label = t("Deadline ", "ددلاین ") + DDdueDate(Y.due, DDlanguage) + " · " + text;
      return _.createElement("button", {
          type: "button", className: "dd-due-badge", "data-due-badge": Y.id, "data-left": left < 0 ? "passed" : left <= 3 ? "soon" : "later", title: label, "aria-label": label,
          onPointerDown: (e) => e.stopPropagation(), onDoubleClick: (e) => e.stopPropagation(),
          onClick: (e) => { e.stopPropagation(); const r = root.current.getBoundingClientRect(); setMenu(null); setDueEdit({ ref: Y.id, x: e.clientX - r.left, y: e.clientY - r.top + 12 }); },
        }, "◆ " + text);
    }
    function syncBadge(Y) {
      const n = syncCount.get(Y.syncId) || 0;
      if (n < 2) return null;
      const label = t(`Synced · ${n} copies`, `همگام · ${n} کپی`);
      return _.createElement("button", {
          type: "button", className: "dd-sync-badge", "data-sync-badge": Y.syncId, title: label, "aria-label": label,
          onPointerDown: (e) => { e.stopPropagation(); },
          onDoubleClick: (e) => e.stopPropagation(),
          // It opens the note's menu at its copies.
          onClick: (e) => { e.stopPropagation(); openContext(e, { ref: Y.id }); setTimeout(() => document.querySelector('.b6-context [role=menuitem][aria-haspopup][aria-label="Synced copy…"]')?.click(), 40); },
        },
        _.createElement(controls.Icon, { React: _, name: "sync", size: 12 }),
        _.createElement("b", null, n));
    }
    // The board glides (it never jumps) and stops the moment you move it yourself.
    function glideCamera(target) {
      cancelAnimationFrame(glide.current);
      const el = viewport.current;
      if (!el) return;
      const from = { ...cam.current };
      if (prefs.reducedMotion || matchMedia("(prefers-reduced-motion: reduce)").matches) {
        cam.current = { ...target }; queueCamera(); scheduleCamera(); return;
      }
      glideTo.current = target;
      const w = el.clientWidth / 2, h = el.clientHeight / 2,
        a = { x: (w - from.x) / from.z, y: (h - from.y) / from.z },
        b = { x: (w - target.x) / target.z, y: (h - target.y) / target.z },
        start = performance.now();
      let last = cam.current;
      const step = (now) => {
        if (cam.current !== last) { glide.current = 0; return; }
        const p = Math.min(1, (now - start) / 280), e = 1 - Math.pow(1 - p, 3),
          z = from.z * Math.pow(target.z / from.z, e);
        cam.current = last = p >= 1 ? { ...target } : { x: w - (a.x + (b.x - a.x) * e) * z, y: h - (a.y + (b.y - a.y) * e) * z, z };
        queueCamera();
        if (p < 1) glide.current = requestAnimationFrame(step);
        else { glide.current = 0; scheduleCamera(); }
      };
      glide.current = requestAnimationFrame(step);
    }
    // Writing when zoomed out: the board comes close enough to read what you
    // type, then goes back to where you were when you finish.
    function revealEdit(Y) {
      const el = viewport.current;
      if (!Y || !prefs.boardAutoZoom || Y.lifeSection || Y.kind === "frame" || !el) return;
      const z = cam.current.z, size = Y.kind === "sticky" ? (Y.textSize || 16) * 1.15 : 14;
      if (size * z >= 11) return;
      // A round zoom (90%, not 86.96%), still small enough for the card to fit across.
      const nz = core.zoom(Math.min(Math.ceil((16 / size) * 20) / 20, (el.clientWidth - 48) / Math.max(1, Y.w), 2));
      if (nz <= z * 1.05) return;
      const top = el.clientWidth < 700 ? 150 : 110, fits = Y.h * nz <= el.clientHeight - top - 120,
        target = {
          x: el.clientWidth / 2 - (Y.x + Y.w / 2) * nz,
          y: fits ? el.clientHeight / 2 - (Y.y + Y.h / 2) * nz : top - Y.y * nz,
          z: nz,
        };
      editReturn.current = { back: editReturn.current?.back || { ...cam.current }, at: target };
      glideCamera(target);
    }
    function returnFromEdit() {
      const ret = editReturn.current;
      if (!ret) return;
      requestAnimationFrame(() => {
        // Typing on in the next card keeps the way back for later.
        if (editReturn.current !== ret || editingRef.current) return;
        editReturn.current = null;
        const c = cam.current, a = ret.at, gliding = glide.current && glideTo.current === a;
        // Moved the board while writing, or already working on something else: stay.
        if (gesture.current || (!gliding && (Math.abs(c.x - a.x) > 2 || Math.abs(c.y - a.y) > 2 || Math.abs(c.z - a.z) > 0.001))) return;
        glideCamera(ret.back);
      });
    }
    function openEdit(Y) {
      flushNote();
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
      flushNote();
      const G = editingRef.current;
      if (!G) return;
      ((editingRef.current = null), setEditing(null));
      noteSession.current = null;
      returnFromEdit();
      const ct = layout.map.get(G.ref),
        ot = (Y ?? G.value).trim();
      // An empty text object leaves nothing behind (an empty note stays, as a note).
      if (ct?.kind === "sticky" && ct.plain && !ot) {
        commit((d) => {
          if (ct.lifeId) d.__life.items = d.__life.items.filter((i) => i.id !== ct.lifeId);
          else d.notes = d.notes.filter((n) => n.id !== ct.noteId);
          return d;
        }, null, { history: !1 });
        setSelected(new Set());
        return;
      }
      // A note closed with nothing in it goes away (Undo brings it back).
      if (ct?.kind === "sticky") {
        const src = ct.lifeId ? DDlifeState(propsRef.current.setup).items.find((i) => i.id === ct.lifeId) : (dayRef.current.notes || []).find((n) => n.id === ct.noteId);
        if (src && !String(src.text || "").trim() && !(src.media || []).length && !src.syncId && !(src.tags || []).length && !src.role) {
          commit((d) => core.remove(d, [ct]), t("Empty note removed", "نوت خالی پاک شد"));
          setSelected(new Set());
        }
        return;
      }
      if (ct?.lifeId) { lifeChange((list) => list.map((i) => i.id === ct.lifeId ? { ...i,text:ot } : i)); return; }
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
    // FigJam numbers new sections: Section 1, Section 2, …
    function sectionName(items) {
      const count=items.filter((i)=>i.type==="section").length+1;
      return t("Section ","سکشن ")+count.toLocaleString(DDlanguage==="fa"?"fa-IR":"en-US");
    }
    // Sections that are not in the open section's board, so nothing drops into them.
    const outsideRoom = (items) => { const inside = DDlifeDescendants(items, layout.room); return new Set(items.filter((i) => !inside.has(i.id)).map((i) => i.id)); };
    // A new Life section at a spot on the canvas (inside the section under it, if any).
    function addLifeSection(point) {
      const frame = layout.map.get("section:life"), id = "lf-"+C(), roomNode = layout.room && layout.map.get("life:" + layout.room);
      commit(d=>{
        // A section's own board is all of it: a section drawn anywhere there,
        // even outside the frame, belongs to that section and stays where it was drawn.
        let rel=frame&&point?{x:point.x-frame.x,y:point.y-frame.y-DDlifeHead}:null;
        let parent=rel&&DDlifeParentAt(d.__life.items,rel.x,rel.y,roomNode?outsideRoom(d.__life.items):undefined,layout.room||"");
        if(roomNode&&!parent)parent=d.__life.items.find((i)=>i.id===layout.room);
        if(parent){const base=DDlifeAbs(d.__life.items,parent.id);rel={x:rel.x-base.x,y:rel.y-base.y};}
        const spec={id,type:"section",parent:parent?.id||"",text:sectionName(d.__life.items),
          ...(rel?{x:Math.round(rel.x),y:Math.round(rel.y)}:{}),
          ...(point?.w?{w:Math.max(80,Math.round(point.w)),h:Math.max(60,Math.round(point.h))}:{})};
        // Drawn on the board outside the Feed, the section stays right there: the
        // Feed does not stretch to take it in.
        const w=spec.w||480,h=spec.h||320,cx=point?point.x+w/2:0,cy=point?point.y+h/2:0,
          out=!!(frame&&point&&!parent&&!layout.room&&(cx<frame.x||cx>frame.x+frame.w||cy<frame.y||cy>frame.y+frame.h));
        d.__life.items=DDlifeAdopt(DDlifeAdd(d.__life.items,spec),id);
        if(out){
          d.__life.items=d.__life.items.map((i)=>i.id===id?{...i,out:true}:i);
          // Notes of the day that sit wholly inside it join it, as in FigJam.
          for(const note of [...(d.notes||[])]){
            const n=layout.map.get("sticky:"+note.id);
            if(!n||n.kind!=="sticky"||n.x<point.x||n.y<point.y||n.x+n.w>point.x+w||n.y+n.h>point.y+h)continue;
            const nid=d.__life.items.some((i)=>i.id===note.id)?"lf-"+C():note.id;
            d.__life.items=DDlifeAdd(d.__life.items,{id:nid,type:"sticky",parent:id,text:note.text,role:note.role,goal:note.goal,due:note.due,at:note.at,baseW:note.baseW,color:note.color,x:Math.round(n.x-point.x),y:Math.round(n.y-point.y),w:n.w,h:n.h,style:model.styles[n.id],syncId:note.syncId});
            d.notes=d.notes.filter((i)=>i.id!==note.id);
            transferRef(d,n.id,"life:"+nid);
          }
        }
        if(frame && point && !parent && !layout.room && !out) {
          // Grow the shared canvas around a newly drawn section; existing objects
          // keep their absolute positions even when the origin moves north/west.
          const left=Math.min(frame.x,point.x-24), top=Math.min(frame.y,point.y-DDlifeHead-40);
          const dx=frame.x-left, dy=frame.y-top;
          if(dx||dy)d.__life.items=d.__life.items.map(i=>i.parent?i:{...i,x:i.x+dx,y:i.y+dy});
          const b=DDlifeBounds(d.__life.items);
          d.__life.frame={...d.__life.frame,x:left,y:top,w:Math.max(frame.w+dx,b.w),h:Math.max(frame.h+dy,b.h+DDlifeHead)};
        }
        return d;
      },t("Section added","سکشن اضافه شد"));
      setSelected(new Set(["life:"+id]));
    }
    function addLifeItem(type,parent="") {
      const id="lf-"+C();
      lifeChange((list)=>DDlifeAdd(list.map((i)=>i.id===parent?{...i,collapsed:false}:i),{id,type,parent,w:type==="sticky"?240:480,h:type==="sticky"?240:320,...(type==="sticky"?{color:appearanceRef.current.stickyColor,style:{textSize:16}}:{text:sectionName(list)})}));
      setSelected(new Set(["life:"+id])); setEditing({ref:"life:"+id,value:""});
    }
    // Open a section as its own board (null goes back to the main board). Each
    // board keeps its own camera while you move between them.
    function enterRoom(id, quiet = false) {
      finishEdit();
      const items = DDlifeItems(setup), it = id && items.find((i) => i.id === id && i.type === "section");
      if (id && !it) return;
      // Another section's board is another place: Back comes here again.
      DDplaces.mark();
      roomCams.current[layout.room || ""] = { ...cam.current };
      if (it?.collapsed) lifeChange((list) => list.map((i) => (i.id === id ? { ...i, collapsed: false } : i)));
      if (id && mode !== "mindmap") setMode("mindmap");
      setRoom(id || null);
      try { id ? sessionStorage.setItem("debug-day:board-room", id) : sessionStorage.removeItem("debug-day:board-room"); } catch {}
      setSelected(new Set()); setWireId(null); setConnecting(null); setMenu(null);
      setStatus(it ? t("Inside ", "داخل ") + (it.text || t("Section", "سکشن")) + t(" · Esc goes back", " · Esc برای برگشت") : t("Main board", "برد اصلی"));
      const back = roomCams.current[id || ""];
      // A jump to something on that board sets the camera itself.
      if (!quiet) setTimeout(() => {
        if (back) { cam.current = back; api.current.paintCamera(); api.current.saveCamera(); }
        // A phone shows the section itself first; the Engine is just above it.
        else api.current.fit(false, id && (viewport.current?.clientWidth || 0) < 700 ? "room" : "all");
      }, 0);
    }
    function dropRoom() {
      setRoom(null);
      try { sessionStorage.removeItem("debug-day:board-room"); } catch {}
    }
    function leaveRoom() {
      const it = DDlifeItems(setup).find((i) => i.id === layout.room);
      enterRoom(it?.parent || null);
    }
    function jumpLife(id, again = false) {
      // Go to the board the thing lives on: the main board, or the section whose
      // own board holds it (outside that section's frame).
      if (!again) DDplaces.mark();
      const all = DDlifeItems(setup), target = all.find((i) => i.id === id), home = target ? DDlifeHome(all, id) : "";
      const here = !target || (layout.room ? DDlifeDescendants(all, layout.room).has(id) && DDlifeShown(all, target, layout.room) : DDlifeShown(all, target));
      if (!here && !again) {
        enterRoom(home || null, true);
        return setTimeout(() => api.current.jumpLife?.(id, true), 30);
      }
      const frame=layout.map.get("section:life"), items=DDlifeItems(setup), it=items.find((i)=>i.id===id), el=viewport.current;
      if (!frame || !it || !el) return;
      const a=DDlifeAbs(items,id), z=Math.max(el.clientWidth < 700 ? 1 : .55,Math.min(1.1,(el.clientWidth-80)/it.w));
      const parents=new Set(); let p=it.parent;
      while(p){parents.add(p);p=items.find((i)=>i.id===p)?.parent;}
      if (parents.size) lifeChange((list)=>list.map((i)=>parents.has(i.id)?{...i,collapsed:false}:i));
      cam.current={x:32-(frame.x+a.x)*z,y:180-(frame.y+DDlifeHead+a.y)*z,z};
      setSelected(new Set(["life:"+id])); queueCamera(); scheduleCamera();
    }
    function resizeLifeArea(patch) {
      commit((d)=>{
        const bounds=DDlifeBounds(d.__life.items);
        for(const key of ["w","h"])if(Number.isFinite(patch[key]))d.__life.frame[key]=Math.min(100000,Math.max(key==="w"?bounds.w:bounds.h+DDlifeHead,Math.round(patch[key])));
        return d;
      },t("Feed resized on every day","اندازهٔ فید در همهٔ روزها تغییر کرد"));
    }
    // Text / title: words straight on the board, no note paper (T).
    function addText(point) {
      return addSticky(point, { w: 320, h: 48, textSize: 24, plain: true });
    }
    function addSticky(point, template = {}) {
      const view = viewport.current, rect = view.getBoundingClientRect();
      const at = point || toWorld(rect.left+view.clientWidth/2, rect.top+view.clientHeight/2);
      const id = C(), width=template.w || 240, height=template.h || 240, color=template.color || appearanceRef.current.stickyColor, plain=template.plain?{plain:true}:{}, media=template.media?{media:template.media}:{};
      const frame=layout.map.get("section:life"), items=DDlifeItems(setup), roomNode=layout.room&&layout.map.get("life:"+layout.room);
      const rel=frame?{x:at.x-frame.x,y:at.y-frame.y-DDlifeHead}:null;
      const parent=rel&&DDlifeParentAt(items,rel.x,rel.y,roomNode?outsideRoom(items):undefined,layout.room||"");
      const inLife=frame && (parent || (rel.x>=0 && rel.y>=0 && rel.x<=frame.w && rel.y<=frame.h-DDlifeHead));
      let ref;
      if(roomNode&&!parent){
        // A section's own board is all of it: a note made anywhere there belongs
        // to the section and stays where it was made (outside the frame it lives
        // on this board only).
        ref="life:"+id;const base=DDlifeAbs(items,layout.room);
        commit(d=>{d.__life.items=DDlifeAdd(d.__life.items,{id,type:"sticky",parent:layout.room,x:Math.round(rel.x-base.x-width/2),y:Math.round(rel.y-base.y-height/2),w:width,h:height,text:"",color,...media,style:{textSize:template.textSize||16,...plain}});return d;});
      }else if(inLife){
        const base=parent?DDlifeAbs(items,parent.id):{x:0,y:0};ref="life:"+id;
        commit(d=>{d.__life.items=DDlifeAdd(d.__life.items,{id,type:"sticky",parent:parent?.id || "",x:rel.x-base.x-width/2,y:rel.y-base.y-height/2,w:width,h:height,text:"",color,...media,style:{textSize:template.textSize||16,...plain}});return d;});
      }else{
        ref="sticky:"+id;
        commit(d=>{
          d.notes.push({id,kind:"sticky",x:at.x-width/2,y:at.y-height/2,text:"",color,...media});
          const b=clean(d.canvas?.board4);
          b.styles={...b.styles,[ref]:{width,height,textSize:template.textSize||16,...plain}};
          if(mode==="lanes")b.layouts={...b.layouts,lanes:{...b.layouts.lanes,[ref]:{x:at.x-width/2,y:at.y-height/2}}};
          d.canvas={...d.canvas,board4:b};return d;
        });
      }
      // A photo lands picked, not open for typing (double-click adds a caption).
      if(template.media){setSelected(new Set([ref]));setTool("select");return ref;}
      setSelected(new Set([ref]));setTool("select");setEditing({ref,value:""});
      revealEdit({kind:"sticky",x:at.x-width/2,y:at.y-height/2,w:width,h:height,textSize:template.textSize||16});
      return ref;
    }
    // FigJam previews where a note will land: under the sticky tool, over a "+"
    // beside a note, and at the end of a connector dragged into empty space.
    function showGhost(rect, color) {
      const el = ghostNote.current;
      if (!el) return;
      Object.assign(el.style, { display: "block", left: rect.x + "px", top: rect.y + "px", width: rect.w + "px", height: rect.h + "px", background: color || appearanceRef.current.stickyColor });
    }
    function hideGhost() {
      if (ghostNote.current) ghostNote.current.style.display = "none";
    }
    const oppositeSide = { left: "right", right: "left", top: "bottom", bottom: "top" };
    // A note-sized spot one even gap from a note, on the given side.
    function nearRect(node, side) {
      const gap = 40, w = node.w, h = node.h;
      return side === "right" ? { x: node.x + node.w + gap, y: node.y, w, h }
        : side === "left" ? { x: node.x - gap - w, y: node.y, w, h }
        : side === "bottom" ? { x: node.x, y: node.y + node.h + gap, w, h }
        : { x: node.x, y: node.y - gap - h, w, h };
    }
    // Where a note goes when a connector from `port` is dropped at `p`: its facing side meets the end.
    function dropRect(from, port, p) {
      const w = from.w, h = from.h;
      return port === "right" ? { x: p.x, y: p.y - h / 2, w, h }
        : port === "left" ? { x: p.x - w, y: p.y - h / 2, w, h }
        : port === "bottom" ? { x: p.x - w / 2, y: p.y, w, h }
        : { x: p.x - w / 2, y: p.y - h, w, h };
    }
    function noteLike(node) {
      return { w: node.w, h: node.h, color: node.color, textSize: node.textSize };
    }
    function addNear(node, side) {
      hideGhost();
      const r = nearRect(node, side);
      addSticky({ x: r.x + r.w / 2, y: r.y + r.h / 2 }, noteLike(node));
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
            name: t("New task", "بلاک جدید"),
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
      const parsed=DDengineTaskFromNote(Y.title,setup.lanes[0]?.id||"",setup,C),G=[parsed.name,...parsed.subtasks.map(s=>s.text)],ct=C(),
        from = (Y.lifeId && DDlifeItems(setup).find((i) => i.id === Y.lifeId)?.parent) || layout.room || "";
      (commit(
        (ot) => ({
          ...ot,
          notes: ot.notes.filter((St) => St.id !== Y.noteId),
          ...(Y.lifeId ? { __life: { ...ot.__life, items:ot.__life.items.filter((i)=>i.id!==Y.lifeId), links:ot.__life.links.filter((l)=>l.from!==Y.id&&l.to!==Y.id) } } : {}),
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
              subtasks: G.slice(1).map((St,index) => ({
                id: C(),
                text: St,
                done: parsed.subtasks[index]?.done || false,
                expanded: !0,
                children: [],
              })),
              ...(from ? { from } : {}),
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
    // A note in the Feed stays where it is: "→ Today" adds a task to this day
    // that remembers the note (noteRef), and the note shows that it is on the day.
    function noteOnDay(Y) {
      return Y?.lifeId ? (day.blocks || []).find((b) => b.noteRef === Y.lifeId) : null;
    }
    function sendToToday(Y) {
      if (!Y?.lifeId) return convertSticky(Y);
      const already = noteOnDay(Y);
      if (already) { setSelected(new Set(["b:" + already.id])); onSelectBlock?.(already.id); setStatus(t("Already on this day", "همین حالا در این روز هست")); return; }
      const parsed = DDengineTaskFromNote(Y.title, setup.lanes[0]?.id || "", setup, C), ct = C(),
        from = DDlifeItems(setup).find((i) => i.id === Y.lifeId)?.parent || layout.room || "";
      commit((d) => ({ ...d, blocks: [...d.blocks, { ...parsed, id: ct, name: parsed.name || DDUI("ایده از برد"), min: prefs.defaultMinutes, ...(from ? { from } : {}), noteRef: Y.lifeId }] }),
        t("Added to this day · the note stays in the Feed", "به این روز اضافه شد · نوت در فید می‌مونه"));
      setSelected(new Set(["b:" + ct])); onSelectBlock?.(ct);
    }
    function selectBranch() {
      if (!selectedNode) return;
      const Y = new Set([selectedNode.id]);
      let G = -1;
      for (; Y.size !== G; ) {
        G = Y.size;
        for (const ct of layout.automatic) Y.has(ct.from) && Y.add(ct.to);
        // A note's branch is its sub-notes, theirs, and so on (5.36).
        for (const ref of [...Y]) for (const sub of DDnoteBranch(noteTools.family, ref)) Y.add(sub);
      }
      setSelected(Y);
    }
    function groupSelection(Y = !1) {
      // FigJam: ungrouping a section removes only the frame; what was inside stays.
      const frames = Y ? [...selected].map((ref) => layout.map.get(ref)).filter((n) => n?.lifeSection && !locked.has(n.id)) : [];
      if (frames.length) {
        commit((d) => {
          for (const n of frames) d.__life.items = DDlifeRemove(d.__life.items, n.lifeId);
          d.__life.links = (d.__life.links || []).filter((l) => !frames.some((n) => l.from === n.id || l.to === n.id));
          return d;
        }, t("Section removed; its contents stay", "سکشن برداشته شد؛ محتوایش ماند"));
        setSelected(new Set());
        return;
      }
      boardChange(
        (G) => {
          if (Y)
            for (const [ct, ot] of Object.entries(G.groups))
              ot.some((St) => selected.has(St)) && delete G.groups[ct];
          else if (selected.size > 1) {
            // Adding to a group makes one bigger group, never a second one beside it.
            const members = new Set(selected), groups = { ...G.groups };
            let grew = true;
            while (grew) {
              grew = false;
              for (const [id, g] of Object.entries(groups))
                if (Array.isArray(g) && g.some((r) => members.has(r))) { g.forEach((r) => members.add(r)); delete groups[id]; grew = true; }
            }
            G.groups = { ...groups, [C()]: [...members] };
          }
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
        setTimeout(() => api.current.fit(false,"day"), 0));
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
        ((Tt += `<path d="${yn.d}" fill="none" stroke="${ot(Pt.color === "var(--now)" ? "#7A5FF5" : !Pt.color || Pt.color.startsWith("var(") ? "#4A4843" : Pt.color)}" stroke-width="${Pt.width || 1.8}" opacity="${Pt.opacity ?? 1}" stroke-dasharray="${Pt.pattern === "dotted" ? "1 5" : Pt.dashed || Pt.pattern === "dashed" ? "6 5" : "none"}"/>`),
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
        const size = node.textSize || (node.kind === "sticky" ? 16 : 14),
          color = node.plain ? "none" : ["sticky", "day", "lane"].includes(node.kind)
            ? node.color
            : node.kind === "frame" || node.kind === "emoji"
              ? "none"
              : "#FFFFFF";
        const textColor = node.plain && String(node.textColor).startsWith("var(") ? "#121211" : ["sticky", "day", "lane"].includes(node.kind)
          ? node.textColor
          : "#121211";
        const lines = ((node.emoji ? node.emoji + " " : "") + node.title)
          .split("\n")
          .slice(0, Math.max(1, Math.floor((node.h - 20) / (size * 1.5))));
        Tt += `<g opacity="${node.opacity ?? 1}"><rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="7" fill="${ot(color)}" stroke="${node.plain ? "none" : "#aaa"}"/>`;
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
    // Back to a place on this board: its section, and its camera when it was this day.
    function restorePlace(p) {
      const items = DDlifeItems(setup), room = p.room && items.some((i) => i.id === p.room && i.type === "section") ? p.room : null,
        view = p.cam && p.date === dayRef.current.date ? p.cam : null;
      if ((layout.room || null) !== room) {
        enterRoom(room, !!view);
        if (view) setTimeout(() => { cam.current = { ...view }; api.current.paintCamera(); api.current.saveCamera(); }, 0);
      } else if (view) { setMenu(null); glideCamera(view); }
    }
    ((api.current = {
      // Mid-glide, the place is where the board is going.
      place: () => ({ room: layout.room || null, roomName: (layout.room && DDlifeItems(setup).find((i) => i.id === layout.room)?.text) || "", cam: { ...(glide.current && glideTo.current ? glideTo.current : cam.current) }, date: dayRef.current.date }),
      restorePlace: restorePlace,
      fit: fit,
      jumpLife: jumpLife,
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
        // A search result on a section's own board opens that board; one outside
        // the open section takes you back to the main board.
        if (ddSearchNode && !n && !ddNodeMatches && ddSearchNode.ref?.startsWith("life:")) {
          const items = DDlifeItems(setup), id = ddSearchNode.ref.slice(5), home = items.some((i) => i.id === id) ? DDlifeHome(items, id) : "";
          if (home && home !== layout.room) return enterRoom(home, true);
        }
        if (ddSearchNode && !n && layout.room) return dropRoom();
        if (!n && ddSearchNode?.ref?.startsWith("life:")) {
          const items=DDlifeItems(setup), parents=new Set();let item=items.find((i)=>"life:"+i.id===ddSearchNode.ref);
          while(item?.parent){parents.add(item.parent);item=items.find((i)=>i.id===item.parent);}
          if(items.some((i)=>parents.has(i.id)&&i.collapsed))lifeChange((list)=>list.map((i)=>parents.has(i.id)?{...i,collapsed:false}:i));
          return;
        }
        if (!n || !viewport.current) return;
        // Go to a search result once; a later change in the Feed does not pull the board back.
        if (searchShown.current === ddSearchNode) return;
        searchShown.current = ddSearchNode;
        DDplaces.mark();
        setSelected(new Set([n.id]));
        const z = Math.min(1.2, (viewport.current.clientWidth - 80) / n.w);
        cam.current = {
          x: viewport.current.clientWidth / 2 - (n.x + n.w / 2) * z,
          y: viewport.current.clientHeight / 2 - (n.y + n.h / 2) * z,
          z,
        };
        queueCamera();
        scheduleCamera();
      }, [ddSearchNode, setup.life, layout.room]),
      // A section that is gone (deleted here or on another device) closes its board.
      useEffect(() => {
        if (room && !layout.room && !ddNodeMatches) dropRoom();
      }, [room, layout.room, ddNodeMatches]),
      // Back to where you were (5.33): the board tells the trail which section is
      // open and where the camera is, and goes back to a place when asked.
      useEffect(() => DDplaces.connect({ place: () => api.current.place(), restore: (p) => api.current.restorePlace(p) }), []),
      useEffect(() => {
        DDplaces.note({ room: layout.room || null, roomName: (layout.room && DDlifeItems(setup).find((i) => i.id === layout.room)?.text) || "", cam: { ...cam.current }, date: day.date });
      }, [layout.room, layout.room && DDlifeItems(setup).find((i) => i.id === layout.room)?.text]),
      useLayoutEffect(() => {
        paintCamera();
      }, [layout, mode, wireId, showMap, tick, focus, appearance]),
      useEffect(() => {
        const Y = viewport.current,
          G = (event) => {
            // Text and scrollable note content own their wheel events.
            const editor=event.target.closest("input,textarea,select,[contenteditable=true]");
            const text=event.target.closest(".dd-note-preview");
            if(editor || (text && text.scrollHeight>text.clientHeight+1))return;
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
        // Ctrl/Cmd + = - 0 (caught for the whole app) zoom or fit this Board.
        const keyZoom = (event) => {
            const step = event.detail;
            if (step === 0) api.current.fit(false);
            else api.current.setZoom(core.zoomStep(cam.current.z, step));
          },
          // Safari pinch: zoom around the fingers, never the page.
          pinch = { z: 1 },
          gestureStart = (event) => { event.preventDefault(); pinch.z = cam.current.z; },
          gestureChange = (event) => { event.preventDefault(); if (event.scale) api.current.setZoom(pinch.z * event.scale, event.clientX, event.clientY); };
        window.addEventListener("debug-day-board-zoom", keyZoom);
        Y.addEventListener("gesturestart", gestureStart, { passive: !1 });
        Y.addEventListener("gesturechange", gestureChange, { passive: !1 });
        const ct = new ResizeObserver(() => api.current.paintCamera());
        return (
          ct.observe(Y),
          () => {
            (Y.removeEventListener("wheel", G), ct.disconnect());
            window.removeEventListener("debug-day-board-zoom", keyZoom);
            Y.removeEventListener("gesturestart", gestureStart);
            Y.removeEventListener("gesturechange", gestureChange);
          }
        );
      }, []),
      useEffect(() => {
        const Y = (ot) => {
            if(ot.isComposing)return;
            if(root.current?.contains(ot.target) && (ot.ctrlKey||ot.metaKey) && (ot.target.closest(".dd-note-editor") || (!ot.target.closest("input,textarea,select,[contenteditable=true]") && selectedNode?.kind==="sticky"))) {
              const key=core.shortcutKey(ot),kind=key==="b"&&!ot.shiftKey?"bold":ot.shiftKey&&key==="x"?"strike":ot.shiftKey&&ot.code==="Digit9"?"todo":null;
              if(kind){ot.preventDefault();ot.stopImmediatePropagation();formatSticky(kind);return;}
            }
            if(ot.target.closest("button") && ["Enter"," "].includes(ot.key) && !ot.ctrlKey && !ot.metaKey)return;
            // Undo and redo still work while the Align panel has focus.
            const alignUndo = (ot.ctrlKey || ot.metaKey) && ["z", "y"].includes(core.shortcutKey(ot)) && ot.target.closest(".b6-align");
            if (
              !alignUndo &&
              ot.target.closest(
                "input,textarea,select,[contenteditable=true],.b6-context,.b6-properties,.b6-camera,.b6-view-panel,.dd-sticker-dialog,.dd-board-timer,.dd-board-search,.b4-help-backdrop,.dd-engine-backdrop,.dd-flow-backdrop,.dd-board-rails,.dd-due-editor",
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
            if (ot.key === "Escape" && lifeNav) {
              ot.preventDefault();
              ot.stopImmediatePropagation();
              setLifeNav(false);
              return;
            }
            if (ot.key === "Escape" && engine) {
              ot.preventDefault();
              ot.stopImmediatePropagation();
              setEngine(false);
              return;
            }
            // Esc with nothing selected steps out of a section's own board, one level.
            if (ot.key === "Escape" && layout.room && !gesture.current && !selected.size && !wireId && !connecting && !help && !child && search === null) {
              ot.preventDefault();
              ot.stopImmediatePropagation();
              leaveRoom();
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
            if (St && ot.shiftKey && K === "d" && selected.size) {
              (ot.preventDefault(), ot.stopImmediatePropagation(), syncedCopy());
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
                          !locked.has(Pt.id) && Pt.kind !== "frame" &&
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
            const handled = () => { ot.preventDefault(); ot.stopImmediatePropagation(); };
            if(St && K==="f"){handled();if(ot.shiftKey)setFocus(v=>!v);else{finishEdit();setSearch("");setMenu(null);}return;}
            if(St && ["+","=","-","0"].includes(K)){handled();setZoom(K==="0"?1:core.zoomStep(cam.current.z,K==="-"?-1:1));return;}
            if(St && K==="l" && ot.shiftKey && selected.size){handled();toggleLock();return;}
            if(St && ot.key==="Enter" && selectedNode?.kind==="sticky"){
              handled();addSticky({x:selectedNode.x+selectedNode.w*1.5+24,y:selectedNode.y+selectedNode.h/2},{w:selectedNode.w,h:selectedNode.h,color:selectedNode.color,textSize:selectedNode.textSize});return;
            }
            const bracket=ot.code==="BracketLeft"?"[":ot.code==="BracketRight"?"]":ot.key;
            if(["[","]"].includes(bracket)&&selected.size){handled();reorder(St?(bracket==="]"?"forward":"backward"):(bracket==="]"?"front":"back"));return;}
            if(St && ot.altKey && ["l","t","r"].includes(K)&&selected.size){handled();applyStyle({textAlign:{l:"start",t:"center",r:"end"}[K]});return;}
            if(ot.altKey&&!St&&selected.size){
              const align={a:"left",d:"right",w:"top",s:"bottom",h:"center-x",v:"center-y"}[K];
              if(align){handled();arrangeSelection(align);return;}
            }
            if (St || ot.altKey) return;
            // Tab brings the Sections flowchart over the board, like After Effects. Only on
            // the canvas itself, so Tab still walks through the toolbar and the fields.
            if (ot.key === "Tab" && !ot.shiftKey && (ot.target === document.body || ot.target === viewport.current || ot.target.classList?.contains("b4-node"))) {
              handled(); finishEdit(); cancelGesture(); setMenu(null); setLifeNav((v) => !v);
              return;
            }
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
            if (ot.shiftKey && ["Digit0", "Digit1", "Digit2", "Digit3"].includes(ot.code)) {
              ot.preventDefault();ot.stopImmediatePropagation();
              ot.code === "Digit0" ? setZoom(1) : fit(ot.code === "Digit2",ot.code==="Digit3"?"day":"all");
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
                    for (const ra of DDrootSelection(layout.nodes, selected).map(n=>n.id)) {
                      const ma = layout.map.get(ra);
                      if (!(!ma || locked.has(ra) || ma.memberOf))
                        if (ma.lifeId) {
                          const i = Jt.__life.items.find((i) => i.id === ma.lifeId);
                          if (i && !selected.has(ma.parentId)) {i.x += yn; i.y += An;}
                        } else if (ma.noteId && mode !== "lanes") {
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
            else if (Tt === "g") { ot.preventDefault(); toggleRail(ot.shiftKey ? "note" : "goal"); }
            else if (Tt === "h" && ot.shiftKey) { ot.preventDefault(); toggleRail("habits"); }
            else if (Tt === "h") setTool("hand");
            else if (Tt === "c" || Tt === "x" || Tt === "l") {connectionStyle.current=Tt==="l"&&!ot.shiftKey?"straight":"elbow";setTool("connector");}
            else if (Tt === "b") setTool("block");
            else if (Tt === "s" && ot.shiftKey) setTool("section");
            else if (Tt === "s") setTool("sticky");
            else if (Tt === "t") setTool("text");
            // Pen and comments (5.36): P draws, M comments, Shift+M lists the comments.
            else if (Tt === "p" && !ot.shiftKey) { finishEdit(); setTool((v) => (v === "pen" ? "select" : "pen")); }
            else if (Tt === "m" && ot.shiftKey) { ot.preventDefault(); finishEdit(); comments.toggleList(); }
            else if (Tt === "m") { finishEdit(); setTool((v) => (v === "comment" ? "select" : "comment")); }
            else if (Tt === "e" && ot.shiftKey) { finishEdit(); setStickerPicker({}); }
            else if (Tt === "e") { finishEdit(); cancelGesture(); setMenu(null); setEngine((v) => !v); }
            else if (Tt === "d" && !ot.shiftKey) { ot.preventDefault(); finishEdit(); cancelGesture(); setMenu(null); setLifeNav((v) => !v); }
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
        menu, focus, search, help, engine, lifeNav,
      ]),
      useEffect(() => {
        if (!DDreadBoardView(day.date, day.canvas?.board4).camera) {
          const Y = requestAnimationFrame(() => api.current.fit(false,"day"));
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
    // ⋯ at the end of a dock opens what the dock keeps out of sight (same as a right-click).
    function dockMore(dock) {
      return toolButton(t("More tools · right-click the bar", "ابزارهای بیشتر · راست‌کلیک روی نوار"), "more", (event) => openContext(event, { dock }), { "data-dock-more": dock, "aria-haspopup": "menu", "aria-expanded": menu?.dock === dock });
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
        G &&
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
    // Save the typed text a short moment after the last key; finishing the note,
    // opening another one, any other change, or leaving the page saves it at once.
    function queueNote(node, text) {
      const p = pendingNote.current;
      if (p && p.node.id !== node.id) flushNote();
      if (pendingNote.current) clearTimeout(pendingNote.current.timer);
      pendingNote.current = { node, text, timer: setTimeout(flushNote, 300) };
    }
    function flushNote() {
      const p = pendingNote.current;
      if (!p) return;
      clearTimeout(p.timer);
      pendingNote.current = null;
      saveNote(p.node.noteId, p.text, p.node);
    }
    function saveNote(noteId, text, node = layout.map.get(editingRef.current?.ref || editing?.ref)) {
      if (node?.lifeId) {
        const first = noteSession.current !== node.lifeId;
        commit((d) => { d.__life.items = d.__life.items.map((i) => i.id === node.lifeId ? {...i,text} : i); return d; },null,{history:first});
        noteSession.current = node.lifeId;
        return;
      }
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
    function formatSticky(kind) {
      flushNote();
      const node=layout.map.get(editingRef.current?.ref)||selectedNode;if(node?.kind!=="sticky")return;
      const input=elementRefs.current.get(node.id)?.querySelector("textarea"),text=editingRef.current?.ref===node.id?editingRef.current.value:node.title;
      const next=DDstickyFormat(text,input?.selectionStart??0,input?.selectionEnd??text.length,kind);
      commit(d=>{const list=node.lifeId?d.__life.items:d.notes,n=list.find(n=>n.id===(node.lifeId||node.noteId));if(n)n.text=next.text;return d;});
      if(input){setEditing({ref:node.id,value:next.text});requestAnimationFrame(()=>{input.focus();input.setSelectionRange(next.start,next.end);});}
    }
    function noteEditor(node) {
      // FigJam: you type straight onto the note; it saves as you type, and a
      // click outside (or Esc / Ctrl+Enter) finishes.
      return _.createElement(
        "div",
        { className: "dd-note-editor" },
        _.createElement("textarea", {
          key: node.id,
          autoFocus: true,
          dir: "auto",
          value: editing.value,
          maxLength: 4000,
          "aria-label": DDUI("Sticky note text"),
          placeholder: t("Type anything…", "هر چیزی بنویس…"),
          onPointerDown: (event) => event.stopPropagation(),
          onChange: (event) => {
            const value = event.target.value;
            setEditing({ ref: node.id, value });
            queueNote(node, value);
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
        /(?:^|\n)- \[ \] ?$/.test(editing.value) && _.createElement("small",{className:"dd-sticky-hint"},t("Add a task…","یک کار اضافه کن…")),
      );
    }
    // A section's record, on its own board under the section: every day's tasks
    // that came from it, done or not. Read from the days, so it is the same everywhere.
    function roomHistory() {
      const sec = layout.room && layout.map.get("life:" + layout.room);
      if (!sec) return null;
      const h = _.createElement, entries = sourceHistory.get(layout.room) || [], strip = DDengineStrip(entries, day.date, 14),
        done = strip.reduce((a, d) => a + d.done, 0), total = strip.reduce((a, d) => a + d.total, 0);
      const days = historyAll ? entries.slice(0, 60) : entries.slice(0, 7);
      return h("section", {
          className: "dd-room-history", "data-room-history": layout.room, dir: DDlanguage === "fa" ? "rtl" : "ltr",
          "aria-label": t("Done and not done here", "انجام‌شده و نشده‌های این سکشن"),
          style: { left: sec.x, top: sec.y + sec.h + 64, width: Math.max(360, Math.min(sec.w, 520)) },
        },
        h("header", null,
          h("strong", null, "📅 " + t("Done and not done here", "انجام‌شده و نشده‌های این سکشن")),
          h("small", null, t("Last 14 days: ", "۱۴ روز اخیر: ") + done + "/" + total)),
        h("div", { className: "dd-history-strip", "aria-hidden": true }, strip.map((d) => h("i", { key: d.date, "data-state": d.state, title: ie.format(E(d.date)) + " · " + d.done + "/" + d.total }))),
        entries.length
          ? h("ol", null, days.map((e) => h("li", { key: e.date, "data-date": e.date },
              h("div", { className: "dd-room-history-day" }, h("b", null, e.date === day.date ? t("Today", "امروز") : ie.format(E(e.date))), h("span", null, e.done + "/" + e.total)),
              h("ul", null, e.tasks.map((task) => h("li", { key: task.id, "data-done": task.done },
                h("span", { "aria-hidden": true }, task.done ? "✓" : "○"),
                h("span", { dir: "auto" }, task.name || t("Untitled", "بی‌نام")),
                task.from !== layout.room && sectionNames.has(task.from) && h(DDSectionChip, { React: _, items: DDlifeItems(setup), id: task.from, language: DDlanguage, className: "dd-room-history-from", prefix: "" })))))))
          : h("p", null, t("No tasks from this section yet. Drag a note into the Engine, or press E here and add one.", "هنوز کاری از این سکشن نیامده. یک یادداشت را به انجین بکش، یا همین‌جا E بزن و کار اضافه کن.")),
        entries.length > 7 && h("button", {
            type: "button", className: "dd-room-history-more", "data-history-more": true,
            onPointerDown: (e) => e.stopPropagation(),
            onClick: (e) => { e.stopPropagation(); setHistoryAll((v) => !v); },
          }, historyAll ? t("Show the last 7 days", "فقط ۷ روز آخر") : t(`Show all ${Math.min(entries.length, 60)} days`, `نمایش همهٔ ${Math.min(entries.length, 60)} روز`)),
      );
    }
    // Beside a section's name: the last 14 days of its tasks as dots, how many of
    // this day's tasks came from it, and its soft budget if it has one. Opens its board.
    function sectionStrip(Y) {
      if (Y.collapsed) return null;
      const entries = sourceHistory.get(Y.lifeId) || [], strip = entries.length ? DDengineStrip(entries, day.date, 14) : [],
        done = strip.reduce((a, d) => a + d.done, 0), total = strip.reduce((a, d) => a + d.total, 0),
        here = entries.find((e) => e.date === day.date)?.total || 0, isToday = day.date === new Date().toLocaleDateString("en-CA"),
        budget = DDbudgetOf(DDlifeItems(setup).find((i) => i.id === Y.lifeId)),
        used = budget ? DDbudgetUsed(budgetDays, DDlifeItems(setup), Y.lifeId, day.date, budget, DDlanguage) : 0,
        reached = !!budget && used >= (budget.unit === "h" ? budget.n * 60 : budget.n),
        due = Y.due ? DDdueText(Y.due, new Date().toLocaleDateString("en-CA"), DDlanguage) : "";
      if (!total && !budget && !due) return null;
      const num = (n) => DDlanguage === "fa" ? n.toLocaleString("fa-IR") : String(n),
        hereText = here ? (isToday ? t(num(here) + " today", num(here) + " امروز") : t(num(here) + " on this day", num(here) + " این روز")) : "",
        label = [
          total && t(`Last 14 days: ${done} of ${total} tasks from here done`, `۱۴ روز اخیر: ${done} از ${total} کار این سکشن انجام شد`),
          hereText,
          budget && t("Soft budget ", "بودجهٔ نرم ") + DDbudgetLabel(budget, DDlanguage) + ": " + DDbudgetText(budget, used, DDlanguage),
          due && t("Deadline ", "ددلاین ") + DDdueDate(Y.due, DDlanguage) + " · " + due,
        ].filter(Boolean).join(" · ");
      return _.createElement("button", {
          type: "button", className: "dd-sec-history", "data-section-history": Y.lifeId, title: label, "aria-label": label,
          onPointerDown: (e) => { e.stopPropagation(); if (e.button) return; e.preventDefault(); if (!Y.room) enterRoom(Y.lifeId); },
          onDoubleClick: (e) => e.stopPropagation(),
          onClick: (e) => { e.stopPropagation(); if (!e.detail && !Y.room) enterRoom(Y.lifeId); },
        },
        total > 0 && _.createElement("span", { className: "dd-history-strip" }, strip.map((d) => _.createElement("i", { key: d.date, "data-state": d.state }))),
        total > 0 && _.createElement("b", null, done + "/" + total),
        hereText && _.createElement("span", { className: "dd-sec-today", "data-section-today": here }, "· " + hereText),
        budget && _.createElement("span", { className: "dd-sec-budget", "data-section-budget": Y.lifeId, "data-reached": reached }, DDbudgetText(budget, used, DDlanguage)),
        due && _.createElement("span", { className: "dd-sec-due", "data-section-due": Y.lifeId }, "◆ " + due));
    }
    function renderNode(Y) {
      if (Y.section === "engine") return _.createElement("div", {
        key: Y.id, ref: (el) => el ? elementRefs.current.set(Y.id, el) : elementRefs.current.delete(Y.id),
        className: "dd-engine-area", "data-board-id": Y.id, "data-node-kind": "engine-area", "data-section": "engine",
        style: { position: "absolute", left: Y.x, top: Y.y, width: Y.w, height: Y.h },
        onPointerDown: (e) => { if (!e.target.closest("button")) { e.stopPropagation(); backgroundDown(e, true); } },
        onContextMenu: (e) => openContext(e, {}),
      }, _.createElement("div", { className: "dd-engine-area-title", "data-engine-handle": true,
          title: t("Drag to move the Engine", "برای جابه‌جایی انجین بکشید"),
          onPointerDown: (e) => { if (e.button || e.target.closest("button")) return; e.stopPropagation(); e.preventDefault(); finishEdit(); setMenu(null); startEngineMove(e); } },
        "⚙ ", Y.title, _.createElement("small", null, Y.subtitle),
        _.createElement("button", { type: "button", "data-engine-open": true, title: t("Bring the Engine over the board (E)", "آوردن انجین روی برد (E)"), onPointerDown: (e) => { if (e.button) return; e.stopPropagation(); e.preventDefault(); finishEdit(); setEngine(true); }, onClick: () => { finishEdit(); setEngine(true); } }, t("Open · E", "باز کن · E")),
        // An empty Engine offers what is still open, softly (5.37).
        ((carry) => carry && carry.count > 0 && _.createElement("button", { type: "button", "data-engine-carry": true, title: t("Still open: ", "هنوز باز: ") + [...carry.open, ...carry.waiting].map((b) => b.name).join(" · "), onPointerDown: (e) => { if (e.button) return; e.stopPropagation(); e.preventDefault(); finishEdit(); setEngine(true); }, onClick: () => { finishEdit(); setEngine(true); } }, "↺ " + t(carry.count + " still open", carry.count.toLocaleString("fa-IR") + " باز")))(!day.blocks.length && allDays ? DDengineCarry(allDays, day) : null)),
        mode === "mindmap" && !layout.room && _.createElement("button", { type: "button", className: "dd-area-resize", "data-resize": true, "data-edge": "se",
          "aria-label": t("Resize Engine", "تغییر اندازهٔ انجین"), title: t("Drag to resize the Engine", "برای تغییر اندازهٔ انجین بکشید"),
          onPointerDown: (e) => startAreaResize(e, Y) }));
      if (Y.section === "life") return _.createElement("div", {
        key:Y.id, ref:(el) => el ? elementRefs.current.set(Y.id,el) : elementRefs.current.delete(Y.id),
        className:"dd-life-frame", "data-board-id":Y.id, "data-node-kind":"life-area", "data-section":"life",
        style:{position:"absolute",left:Y.x,top:Y.y,width:Y.w,height:Y.h},
        onPointerDown:(e) => { if (!e.target.closest("button")) { e.stopPropagation(); backgroundDown(e, true); } },
        onContextMenu:(e) => openContext(e,{}),
      }, _.createElement("div",{className:"dd-life-area-title","data-feed-handle":true,
          // When the Engine sits on the Feed's top-left corner, the two names
          // would cover each other: move the Feed's name past the Engine.
          style:((area) => area && area.x < Y.x + 460 && area.x + area.w > Y.x && Math.abs(area.y - Y.y) < 90 ? { left: Math.max(18, area.x + area.w - Y.x + 24) } : undefined)(layout.map.get("section:engine")),
          title:t("Drag to move the Feed","برای جابه‌جایی فید بکشید"),
          onPointerDown:(e) => { if (e.button || e.target.closest("button")) return; e.stopPropagation(); e.preventDefault(); finishEdit(); setMenu(null); startFeedMove(e); } },
        Y.title),
      _.createElement("button",{type:"button",className:"dd-area-resize","data-resize":true,"data-edge":"se","aria-label":t("Resize Feed","تغییر اندازهٔ فید"),
        title:t("Drag to resize the Feed","برای تغییر اندازهٔ فید بکشید"),onPointerDown:(e) => startAreaResize(e, Y)}));
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
        St = Y.kind === "frame" || Y.lifeSection,
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
          "data-life-id": Y.lifeId,
          "data-life-type": Y.lifeId ? (Y.lifeSection ? "section" : "sticky") : undefined,
          "data-engine-section": Y.lifeSection && engineSections.has(Y.lifeId) ? true : undefined,
          "data-collapsed": Y.collapsed,
          // Marks the note that shows the "+" buttons, so CSS can hide its ports
          // without a :has() rule (that rule restyled every port on each key typed).
          "data-add-near-host": Tt && G && !ot && !ct && selected.size === 1 ? true : undefined,
          "aria-selected": G,
          "data-section": Y.section || Y.sectionId,
          "data-member": Y.memberOf ? true : undefined,
          "data-node-done": !!Y.done,
          "data-level": Y.kind === "habit" ? Y.level : undefined,
          // A parent note gets its look around the paper (5.36).
          ...(Tt ? noteTools.attrs(Y) : {}),
          ...(Tt ? photos.attrs(Y) : {}),
          role: "group",
          "aria-label": Y.title + (Y.min ? ", " + w(Y.min) : ""),
          tabIndex: Y.lifeId ? 0 : St ? -1 : 0,
          className:
            "b4-node b4-" +
            Y.kind + (Y.lifeSection ? " b4-frame" : "") + (Y.plain ? " b4-plain" : "") +
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
            // A note without a size of its own reads at 16px, the size new notes get.
            "--object-size": (Y.textSize || (Y.kind === "sticky" ? 16 : 14)) + "px",
            "--object-align": Y.textAlign || "start",
            background: St
              ? "var(--wash)"
              : Tt || Pt || yn
                ? Pt || Y.plain
                  ? "transparent"
                  : core.rgba(Y.color, Y.opacity)
                : `color-mix(in srgb, var(--panel) ${Y.opacity * 100}%, transparent)`,
            color: yn || Tt || Pt ? Y.textColor : "var(--pi)",
            // A selected note sits above its neighbours so its "+" stays reachable.
            // Sections share one layer, painted parent first, so every section's
            // name pill can sit above the notes and sections inside it.
            zIndex: Tt && G && !Y.lifeSection ? 900 : Y.lifeSection ? "auto" : Y.lifeId ? Y.stack : St ? 1 : Y.stack,
          },
          onPointerDown: (Kt) => nodeDown(Kt, Y),
          onDoubleClick: (Kt) => {
            Kt.stopPropagation();
            // The pointer handlers already turn a double-click into an edit, a rename
            // (on a section's name) or a new note (on its empty area).
            if (editingRef.current || (St && !Kt.target.closest(".b4-node-body"))) return;
            openEdit(Y.id);
          },
          onFocus: (e) => { if (e.target === e.currentTarget && (!St || Y.lifeId) && !selected.has(Y.id)) selectOne(Y.id); },
          // A section is a place on the canvas: right-click gives the canvas menu.
          onContextMenu: (event) =>
            openContext(event, Y.section ? {} : { ref: Y.id }),
        },
        Y.lifeSection && sectionStrip(Y),
        Y.syncId && syncBadge(Y),
        Tt && Y.due && dueBadge(Y),
        // Where the task came from: the section's name, on the card's corner.
        Y.kind === "block" && Y.from && sectionNames.has(Y.from) && _.createElement(DDSectionChip, { React: _, items: DDlifeItems(setup), id: Y.from, language: DDlanguage }),
        Tt && Y.at && _.createElement("time",{className:"dd-sticky-footer",dateTime:Y.at},DDstickyDateLabel(Y.at,DDlanguage)),
        // Under the paper: tags, sub-notes and, when picked, its family (5.36).
        Tt && !ot && noteTools.under(Y, G),
        // A photo note: the picture first, its words under it (5.38).
        Tt && photos.layer(Y),
        quickColor === Y.id && _.createElement("div",{className:"dd-native-colors",onPointerDown:(e)=>e.stopPropagation()},
          core.stickyColors.map((color)=>_.createElement("button",{type:"button",key:color,style:{background:color},"aria-label":t("Use color ","انتخاب رنگ ")+color,onClick:(e)=>{e.stopPropagation();commit((d)=>core.setStyle(d,[Y],{fill:color}));setQuickColor(null);}},""))),
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
                        // A section's name is edited at a readable size at any zoom.
                        className: Y.lifeSection ? "dd-section-rename" : undefined,
                        onFocus: Y.lifeSection ? (Kt) => Kt.target.select() : undefined,
                        "aria-label": Y.lifeSection ? t("Section name", "نام سکشن") : DDUI("Node title"),
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
                                  setEditing(null), returnFromEdit()),
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
                            _.createElement("button",{type:"button","aria-label":t("Change color","تغییر رنگ"),onClick:()=>setQuickColor(quickColor===Y.id?null:Y.id)},"●"),
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
                              Y.lifeId ? ((on) => ({
                                type: "button", "data-note-today": on ? (on.done ? "done" : "open") : "",
                                title: on ? t("This note is on this day as a task", "این نوت در این روز یک کار است") : t("Add to this day as a task; the note stays", "به‌عنوان کار به این روز اضافه کن؛ نوت می‌مونه"),
                                onClick: () => sendToToday(Y),
                              }))(noteOnDay(Y)) : {
                                type: "button",
                                title: DDUI("Convert note to plan"),
                                onClick: () => convertSticky(Y),
                              },
                              Y.lifeId ? (noteOnDay(Y) ? (noteOnDay(Y).done ? "✓ " : "● ") + t("Today", "امروز") : t("→ Today", "→ امروز")) : DDUI("→ پلن"),
                            ),
                          ),
                          _.createElement(
                            "div",
                            { className: "dd-note-preview", dir: "auto" },
                            Y.title ? _.createElement(DDStickyText,{React:_,text:Y.title,language:DDlanguage,onToggle:(index)=>commit(d=>{const list=Y.lifeId?d.__life.items:d.notes,note=list.find(i=>i.id===(Y.lifeId||Y.noteId));if(note)note.text=DDstickyTodo(note.text,index);return d;})}) : _.createElement("span", { className: "dd-note-placeholder" }, t("Type anything…", "هر چیزی بنویس…")),
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
                            Y.lifeSection && !Y.room && _.createElement("button", {
                              type: "button", className: "dd-room-enter", "data-enter-section": Y.lifeId, "data-more": offFrame.get(Y.lifeId) || undefined,
                              title: offFrame.get(Y.lifeId)
                                ? t(offFrame.get(Y.lifeId) + " more on its own board · open it", offFrame.get(Y.lifeId).toLocaleString("fa-IR") + " چیز دیگه روی برد خودش · بازش کن")
                                : t("Open this section as its own board", "باز کردن این سکشن در برد خودش"),
                              "aria-label": t("Enter section", "ورود به سکشن"),
                              // Opens on press, so a tap on a phone works even where the board
                              // treats the touch as a pan; Enter/Space still click it.
                              onPointerDown: (e) => { e.stopPropagation(); if (e.button) return; e.preventDefault(); enterRoom(Y.lifeId); },
                              onDoubleClick: (e) => e.stopPropagation(),
                              onClick: (e) => { e.stopPropagation(); if (!e.detail) enterRoom(Y.lifeId); },
                            }, offFrame.get(Y.lifeId) ? "↗ " + offFrame.get(Y.lifeId).toLocaleString(DDlanguage === "fa" ? "fa-IR" : "en-US") : "↗"),
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
        // Resize handles only on a selected card: on any other card they were
        // invisible and could not be touched, yet every zoom step restyled them.
        (Tt || (Y.lifeSection && !Y.collapsed)) &&
          G &&
          !ct &&
          !ot &&
          (Tt ? ["nw","ne","e","se","sw","w"] : Y.memberOf ? ["s"] : Y.room ? ["e", "se", "s"] : ["nw", "n", "ne", "e", "se", "s", "sw", "w"]).map(
            (edge) =>
              _.createElement("button", {
                type: "button",
                key: edge,
                className: "b6-note-resize",
                "data-resize": true,
                "data-edge": edge,
                tabIndex: G ? 0 : -1,
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
                    textSize: Y.textSize || 16,
                    baseW:Y.baseW||240,
                    sx: event.clientX,
                    sy: event.clientY,
                    pointerId: event.pointerId,
                    moved: false,
                  };
                  elementRefs.current.get(Y.id)?.setAttribute("data-resizing","true");
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
            "aria-valuemin": 5,
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
                    ? 5
                    : Kt.key === "End"
                      ? 720
                      : Math.max(
                          5,
                          Math.min(
                            720,
                            Y.min + (Kt.key === "ArrowRight" ? (Y.min >= 30 ? 15 : 5) : -(Y.min > 30 ? 15 : 5)),
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
        // FigJam: a selected sticky offers a "+" on each side for the next note.
        Tt && G && !ot && !ct && selected.size === 1 &&
          ["left", "right", "top", "bottom"].map((side) =>
            _.createElement("button", {
              type: "button",
              key: "add-" + side,
              className: "dd-add-near " + side,
              "data-add-near": side,
              "aria-label": t("Add note ", "افزودن یادداشت ") + { left: t("left", "چپ"), right: t("right", "راست"), top: t("above", "بالا"), bottom: t("below", "پایین") }[side],
              title: t("Add a note here", "افزودن یادداشت اینجا"),
              onPointerDown: (e) => portDown(e, Y, side, true),
              onPointerEnter: () => showGhost(nearRect(Y, side), Y.color),
              onPointerLeave: hideGhost,
              // Pointer clicks are handled when the gesture ends; this keeps the keyboard.
              onClick: (e) => { e.stopPropagation(); if (!e.detail) addNear(Y, side); },
            }, "+"),
          ),
        // Sections show resize handles only; their connection points hid them.
        // The dots show only on a selected card, the card being connected, or with
        // the line tool, so they are made only then (thousands of hidden dots slowed zoom).
        !ct && !Y.lifeSection && (G || connecting === Y.id || tool === "connector") &&
          ["left", "right", "top", "bottom"].map((Kt) =>
            _.createElement("button", {
              type: "button",
              key: Kt,
              className: "b4-port " + Kt,
              "data-port": Kt,
              tabIndex: G || tool === "connector" ? 0 : -1,
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
        feelings = [].filter(
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
    function matchSelectionSize(axis) {
      const nodes = selectedNodes.filter((n) => !locked.has(n.id) && (axis === "height" ? n.lifeSection : (n.kind === "sticky" && !n.memberOf) || n.lifeSection)),
        paper = nodes.find((n) => n.kind === "sticky" && !n.plain);
      let size = core.matchSize(nodes, axis);
      if (!size) return;
      // Notes keep their two widths, so everything takes the note's width.
      if (axis === "width" && paper) size = DDstickySnap(size, paper.baseW || 240);
      commit((d) => core.setStyle(d, nodes, axis === "height" ? { height: size } : { width: size }), axis === "height" ? t("Same height", "هم‌ارتفاع شد") : t("Same width", "هم‌عرض شد"));
    }
    // "Send to section…": notes and sections go inside another section (a note
    // from this day joins the section, so it shows on every day like the rest).
    function sendToSection(targetId) {
      const nodes = selectedNodes.filter((n) => !locked.has(n.id) && (n.lifeId || (n.kind === "sticky" && n.noteId && !n.memberOf)));
      if (!nodes.length) return;
      const items = DDlifeItems(setup), name = targetId ? items.find((i) => i.id === targetId)?.text || t("Section", "سکشن") : "",
        // A section carries what is inside it; do not move those twice.
        life = nodes.filter((n) => n.lifeId && !nodes.some((p) => p.lifeSection && p.lifeId !== n.lifeId && DDlifeDescendants(items, p.lifeId).has(n.lifeId))).map((n) => n.lifeId),
        refs = [];
      commit((d) => {
        d.__life.items = targetId ? DDlifeSendTo(d.__life.items, life, targetId) : DDlifeTakeOut(d.__life.items, life);
        refs.push(...life.map((id) => "life:" + id));
        if (targetId) for (const n of nodes) if (!n.lifeId) {
          const old = d.notes.find((i) => i.id === n.noteId);
          if (!old) continue;
          const id = d.__life.items.some((i) => i.id === old.id) ? "lf-" + C() : old.id;
          d.__life.items = DDlifeAdd(d.__life.items, { id, type: "sticky", parent: targetId, text: old.text, role: old.role, goal: old.goal, due: old.due, at: old.at, baseW: old.baseW, color: old.color, w: n.w, h: n.h, style: model.styles[n.id], syncId: old.syncId });
          d.notes = d.notes.filter((i) => i.id !== old.id);
          transferRef(d, n.id, "life:" + id);
          refs.push("life:" + id);
        }
        return d;
      }, targetId ? t("Sent to ", "فرستاده شد به ") + name : t("Taken out of its section", "از سکشن بیرون اومد"));
      setSelected(new Set(refs));
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
        boardDocument(),
        nodes,
        layout.edges,
        selected,
        mode,
      );
      if (!payload) return;
      clipboard.current = sharedClipboard = payload;
      sharedFresh = true;
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
        const cutNodes=nodes.filter((n)=>selected.has(n.id));
        for(const n of [...cutNodes])if(n.lifeSection)for(const id of DDlifeDescendants(DDlifeItems(setup),n.lifeId))if(!cutNodes.some((i)=>i.lifeId===id))cutNodes.push({id:"life:"+id,lifeId:id});
        commit(
          (d) =>
            core.remove(
              d,
              cutNodes,
            ),
          t("Selection cut", "انتخاب بریده شد"),
        );
        setSelected(new Set());
      } else
        setStatus(
          t("Copied · paste anywhere on the board", "کپی شد؛ هرجای برد بچسبان"),
        );
    }
    function pastePayload(payload, point, base, message) {
      finishEdit();
      const rect = viewport.current.getBoundingClientRect();
      const at =
        point ||
        toWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const result = core.paste(base || boardDocument(), payload, at, mode, C);
      if (!result.refs.length) return;
      const frame=layout.map.get("section:life"), target=frame&&(DDlifeParentAt(result.day.__life.items,at.x-frame.x,at.y-frame.y-DDlifeHead,layout.room?outsideRoom(result.day.__life.items):undefined,layout.room||"")||(layout.room?result.day.__life.items.find((i)=>i.id===layout.room):null));
      if (target) {
        const base=DDlifeAbs(result.day.__life.items,target.id);
        for(const ref of result.refs.filter((r)=>r.startsWith("life:"))){
          const it=result.day.__life.items.find((i)=>"life:"+i.id===ref);
          if(it&&it.type==="sticky"&&!it.parent){it.parent=target.id;it.x-=base.x;it.y-=base.y;}
        }
        for (const ref of [...result.refs]) if(ref.startsWith("sticky:")) {
          const old=result.day.notes.find((i)=>"sticky:"+i.id===ref), style=result.day.canvas?.board4?.styles?.[ref]||{};
          if(!old)continue;
          // Same words and look in the section, and its lines come along.
          const {width,height,...look}=style;
          result.day.__life.items=DDlifeAdd(result.day.__life.items,{id:old.id,type:"sticky",parent:target.id,text:old.text,role:old.role,goal:old.goal,due:old.due,at:old.at,baseW:old.baseW,color:old.color,x:old.x-frame.x-base.x,y:old.y-frame.y-DDlifeHead-base.y,w:width||240,h:height||240,style:look,syncId:old.syncId,media:old.media});
          result.day.notes=result.day.notes.filter((i)=>i!==old);
          transferRef(result.day,ref,"life:"+old.id);result.refs[result.refs.indexOf(ref)]="life:"+old.id;
        }
      }
      commit(() => result.day, message || t("Pasted", "چسبانده شد"));
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
      clipboard.current = sharedClipboard || clipboard.current;
      // Paste from the menu or a non-Latin keyboard: what was copied last wins.
      // The board's own copy goes straight in while it is still the latest one;
      // otherwise read the system clipboard.
      if (!event && clipboard.current && sharedFresh) {
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
        } catch {
          // The browser would not share the clipboard: the board's own copy is all we have.
          if (clipboard.current) { pastePayload(clipboard.current, point); return; }
        }
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
      // What each dock keeps out of sight: right-click the dock, or its ⋯.
      if (menu.dock === "top")
        return [
          item("redo", "Redo", "انجام مجدد", "redo", () => undo(true), { disabled: !history.current.future.length, shortcut: "Ctrl/Cmd+Shift+Z" }),
          item("comments", comments.count ? "Comments · " + comments.count : "Comments", "Comments", "comments", () => comments.openList(), { shortcut: "Shift+M" }),
          // Notes and sections deleted from the Feed in the last 30 days (5.45).
          ((list) => ({ ...item("trash", "Recently deleted", "تازه حذف‌شده‌ها", "trash", null, {
            disabled: !list.length,
            children: list.map((e) => ({ ...item("trash-" + e.id, "", "", "undo", () => restoreTrash(e.id)), label: DDtrashLabel(e, Date.now(), DDlanguage) })),
          }), label: list.length ? t("Recently deleted · " + list.length, "تازه حذف‌شده‌ها · " + list.length.toLocaleString("fa-IR")) : t("Recently deleted", "تازه حذف‌شده‌ها") }))(DDlifeState(setup).trash || []),
          sep("top-view-sep"),
          item("fit-all", "Fit all objects", "نمایش همهٔ اشیا", "fitAll", () => fit(false), { shortcut: "Shift+1" }),
          item("theme", "Toggle light / dark", "تغییر روشن / تیره", (setup.look?.theme === "dark" || (setup.look?.theme !== "light" && matchMedia("(prefers-color-scheme:dark)").matches)) ? "sun" : "moon", toggleBoardTheme),
          item("export", "Export board SVG", "خروجی SVG برد", "export", exportSVG),
          sep("top-help-sep"),
          item("help", "Board help", "راهنمای برد", "help", () => setHelp(true), { shortcut: "?" }),
        ];
      if (menu.dock === "tools")
        return [
          item("snap", "Snap to grid", "چسبیدن به شبکه", "snap", () => toggleView("snap"), { checked: snap }),
          item("grid", "Dot grid", "شبکهٔ نقطه‌ای", "grid", () => toggleView("grid"), { checked: grid }),
          item("minimap", "Minimap", "نقشهٔ کوچک", "map", () => toggleView("map"), { checked: showMap }),
          // How a note that holds sub-notes stands out (5.36). Always outside its paper.
          item("parent-look", "Parent note look", "Parent note look", "parentLook", null, {
            children: DDparentLooks.map(([id, name]) => item("parent-look-" + id, name, name, "parentLook", () => noteTools.setLook(id), { checked: noteTools.look === id })),
          }),
          item("photo", "Photo or video…", "عکس یا ویدیو…", "photo", () => photos.pick()),
          sep("tools-view-sep"),
          item("view", "Canvas settings…", "تنظیمات بوم…", "settings", () => { setViewPanel(true); setProperties(false); setInspector(false); }),
        ];
      const editable = selectedNodes.some((n) => !locked.has(n.id)),
        copyable = selectedNodes.some((n) =>
          ["block", "subtask", "sticky", "emoji", "bug", "life-section"].includes(n.kind),
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
          { id: "line-colors", label: t("Line color", "رنگ خط"), swatches: wireColors, current: String(selectedWire?.color || "").toUpperCase(), onPick: (color) => { patchWire(wireId, { color }, t("Line color changed", "رنگ خط تغییر کرد")); changeAppearance({ lineColor: color }); } },
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
          item("dashed", "Dashed line", "خط‌چین", "dashed", () => { const dashed = selectedWire.dashed || selectedWire.pattern === "dashed"; patchWire(wireId, { dashed: !dashed, pattern: dashed ? "solid" : "dashed" }, t("Line pattern changed", "الگوی خط تغییر کرد")); }, { checked: !!(selectedWire?.dashed || selectedWire?.pattern === "dashed") }),
          item("arrow-start", "Arrow at start", "پیکان در ابتدا", "arrowStart", () => { const ends = wireEnds(selectedWire); setWireEnds(selectedWire, { ...ends, start: !ends.start }); }, { checked: !!selectedWire && wireEnds(selectedWire).start }),
          item("arrow", "Arrow at end", "پیکان در انتها", "arrow", () => { const ends = wireEnds(selectedWire); setWireEnds(selectedWire, { ...ends, end: !ends.end }); }, { checked: !!selectedWire && wireEnds(selectedWire).end }),
          item("reverse", "Reverse direction", "معکوس کردن جهت", "swap", () =>
            patchWire(wireId, {
              from: selectedWire.to,
              to: selectedWire.from,
              fromPort: selectedWire.toPort,
              toPort: selectedWire.fromPort,
            }),
          ),
          item("reset-route", "Reset route", "بازنشانی مسیر", "reset", () =>
            patchWire(wireId, { bend: null, fromPort: null, toPort: null }),
          ),
          sep("line-text-sep"),
          item("line-text", "Add text to line", "افزودن متن به خط", "text", () => { setInspector(true); setTimeout(() => root.current?.querySelector('[aria-label="' + t("Connection label", "عنوان اتصال") + '"]')?.focus(), 0); }),
          item("line-details", "Connection details…", "جزئیات اتصال…", "settings", () => setInspector(true)),
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
        // Only what fits what you right-clicked; the rest waits in More.
        const lifeList = DDlifeItems(setup), sticky = selectedNode?.kind === "sticky",
          colorable = selectedNodes.filter((n) => !locked.has(n.id) && ["sticky", "life-section", "block", "subtask", "bug"].includes(n.kind)),
          palette = colorable.length && colorable.every((n) => n.lifeSection) ? DDsectionPalette : core.stickyColors,
          sameColor = colorable.length && colorable.every((n) => String(n.color).toUpperCase() === String(colorable[0].color).toUpperCase()) ? String(colorable[0].color).toUpperCase() : null,
          movable = selectedNodes.filter((n) => !locked.has(n.id) && (n.lifeId || (n.kind === "sticky" && n.noteId && !n.memberOf))),
          skip = new Set(movable.filter((n) => n.lifeSection).flatMap((n) => [...DDlifeDescendants(lifeList, n.lifeId)])),
          targets = lifeList.filter((i) => i.type === "section" && !skip.has(i.id))
            .map((i) => ({ id: i.id, path: DDsectionPath(lifeList, i.id, 36, t("Section", "سکشن")) }))
            .sort((a, b) => a.path.full.localeCompare(b.path.full)),
          inSection = movable.some((n) => n.lifeId && lifeList.find((i) => i.id === n.lifeId)?.parent),
          movableLife = movable.filter((n) => n.lifeId),
          grouped = Object.values(model.groups).some((refs) => refs.some((ref) => selected.has(ref))),
          plainNow = sticky && !!selectedNode.plain;
        // Linked copies: one note or section seen in many places.
        const linkable = selectedNodes.filter(syncable), places = selectedNodes.length === 1 ? copyPlaces(selectedNode) : [],
          twins = selectedNodes.length === 1 && sticky ? sameWords(selectedNode) : [];
        const syncItems = linkable.length && linkable.length === selectedNodes.length ? [
          item("sync-copy", "Make a synced copy", "ساخت کپی همگام", "sync", syncedCopy, { shortcut: "Ctrl/Cmd+Shift+D" }),
          item("sync-clipboard", "Copy as synced", "کپی همگام برای چسباندن", "copy", copySynced),
          twins.length > 0 && { ...item("sync-same", "", "", "sync", () => syncSameWords(selectedNode)), label: t(`Sync ${twins.length} more with the same words`, `همگام با ${twins.length} نوت هم‌متن`) },
          places.length > 1 && sep("sync-places-sep"),
          ...(places.length > 1 ? places.slice(0, 12).map((p) => ({ ...item("sync-go-" + p.kind + "-" + (p.date || "") + p.id, "", "", p.kind === "life" ? "section" : "note", () => goToCopy(p), { checked: p.here, disabled: p.here }), label: p.label })) : []),
          places.length > 1 && sep("sync-off-sep"),
          places.length > 1 && item("sync-off", "Unsync this copy", "جدا کردن این کپی", "unsync", () => unsync(selectedNode)),
        ].filter(Boolean) : [];
        const dueItem = (sticky || selectedNode?.lifeSection) && selectedNodes.length === 1 && item("deadline", selectedNode.due ? "Deadline · " + DDdueDate(selectedNode.due, "en") : "Deadline…", selectedNode.due ? "ددلاین · " + DDdueDate(selectedNode.due, "fa") : "ددلاین…", "deadline", () => setDueEdit({ ref: selectedNode.id, x: menu.x, y: menu.y }), { checked: !!selectedNode.due });
        const more = [
          !selectedNode?.lifeId && dueItem,
          sticky && item("text-style", "Text style", "سبک متن", "bold", null, {
            disabled: allLocked,
            children: [["bold", "Bold", "پررنگ", "Ctrl/Cmd+B"], ["strike", "Strikethrough", "خط‌خورده", "Ctrl/Cmd+Shift+X"], ["todo", "To-do", "کار", "Ctrl/Cmd+Shift+9"]].map(([kind, en, fa, shortcut]) => item("format-" + kind, en, fa, kind, () => formatSticky(kind), { shortcut })),
          }),
          sticky && item("plain", plainNow ? "Show as a note" : "Show as text (no paper)", plainNow ? "نمایش به شکل نوت" : "نمایش به شکل متن", plainNow ? "note" : "text", () => applyStyle({ plain: plainNow ? null : true }), { disabled: allLocked }),
          ...(sticky ? ["goal", "note"].map((role) => {
            const note = selectedNode.lifeId ? lifeList.find((n) => n.id === selectedNode.lifeId) : day.notes.find((n) => n.id === selectedNode.noteId), active = note?.role === role;
            return item("rail-" + role, active ? (role === "goal" ? "Remove goal role" : "Remove note role") : (role === "goal" ? "Make it the goal" : "Make it a note"), active ? (role === "goal" ? "برداشتن هدف" : "برداشتن نوت") : (role === "goal" ? "هدف کن" : "نوت کن"), role === "goal" ? "goal" : "lines", () => commit((d) => DDsetRailRole(d, selectedNode.id, active ? undefined : role)), { checked: active, disabled: allLocked });
          }) : []),
          selectedNode?.kind === "block" && item("task-symbol","Change task sticker / emoji","تغییر استیکر / ایموجی کار","sticker",()=>{finishEdit();setStickerPicker({target:selectedNode.blockId,current:selectedNode.emoji});},{disabled:allLocked}),
          ...styleItems.slice(1),
          item("layers", "Layer order", "ترتیب لایه‌ها", "layers", null, {
            disabled: !editable,
            children: [
              ["front", "Bring to front", "آوردن به جلو"],
              ["forward", "Bring forward", "یک لایه جلو"],
              ["backward", "Send backward", "یک لایه عقب"],
              ["back", "Send to back", "فرستادن به پشت"],
            ].map(([op, en, fa]) => item(op, en, fa, "layers", () => reorder(op))),
          }),
          selectedNode && item("connect", "Connect from here", "اتصال از اینجا", "connector", () => { setConnecting(selectedNode.id); setTool("connector"); }, { disabled: allLocked }),
          sticky && item("tags", "Tags…", "Tags…", "tag", () => noteTools.editTags(selectedNode.id), { disabled: allLocked }),
          // Several notes: tag them all at once.
          !selectedNode && manyNotes.length > 1 && item("tags", "Tags…", "Tags…", "tag", () => noteTools.editTags(manyNotes.map((n) => n.id)), { disabled: allLocked }),
          selectedNode && item("comment", "Add comment", "Add comment", "comment", () => comments.addOn(selectedNode.id), { shortcut: "M" }),
          item("fit-selection", "Zoom to selection", "زوم روی انتخاب", "fit", () => fit(true), { shortcut: "Shift+2" }),
          selectedNode && mode === "mindmap" && item("branch", "Select branch", "انتخاب شاخه", "branch", selectBranch),
          item("cut", "Cut", "برش", "cut", () => copySelection(null, true), { disabled: !copyable || !editable, shortcut: "Ctrl/Cmd+X" }),
        ].filter(Boolean);
        return [
          colorable.length > 0 && { id: "quick-colors", label: t("Color", "رنگ"), swatches: palette, current: sameColor, onPick: (color) => applyStyle({ fill: color }) },
          colorable.length > 0 && item("properties", "Color & properties…", "رنگ و ویژگی‌ها…", "palette", showProperties),
          colorable.length > 0 && sep("color-sep"),
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
          movable.length > 0 && targets.length > 0 && item("send", "Send to section…", "فرستادن به سکشن…", "sendTo", null, {
            children: [
              ...targets.map((s) => item("send-" + s.id, s.path.short, s.path.short, "section", () => sendToSection(s.id), { checked: movableLife.length === movable.length && movableLife.every((n) => lifeList.find((i) => i.id === n.lifeId)?.parent === s.id) })),
              inSection && sep("send-out-sep"),
              inSection && item("send-out", "Out of its section", "بیرون از سکشن", "unframe", () => sendToSection("")),
            ].filter(Boolean),
          }),
          sticky && selectedNode.lifeId && item("to-today", "Add to this day (note stays)", "افزودن به این روز (نوت می‌مونه)", "toPlan", () => sendToToday(selectedNode), { checked: !!noteOnDay(selectedNode) }),
          // Deadlines belong to the Feed: on a day note the item waits in More.
          selectedNode?.lifeId && dueItem,
          sticky && item("convert", "Convert note to task", "تبدیل نوت به کار", "task", () => convertSticky(selectedNode), { disabled: allLocked }),
          ...(selectedNode?.lifeSection ? [
            item("section-note", "Add sticky note inside", "افزودن یادداشت داخل", "noteAdd", () => addLifeItem("sticky", selectedNode.lifeId)),
            item("section-inside", "Add section inside", "افزودن سکشن داخل", "sectionAdd", () => addLifeItem("section", selectedNode.lifeId)),
            item("section-remove", "Remove section, keep contents", "برداشتن سکشن با حفظ محتوا", "unframe", () => groupSelection(true), { shortcut: "Ctrl/Cmd+Shift+G" }),
            ((id, current) => item("section-budget", "Soft budget", "بودجهٔ نرم", "timer", null, {
              children: [
                item("budget-off", "No budget", "بدون بودجه", "close", () => setBudget(id, null), { checked: !current }),
                sep("budget-sep"),
                ...DDbudgetPresets.map((b, i) => ({ ...item("budget-" + i, "", "", b.unit === "h" ? "timer" : "check", () => setBudget(id, b), { checked: DDbudgetSame(current, b) }), label: DDbudgetLabel(b, DDlanguage) })),
              ],
            }))(selectedNode.lifeId, DDbudgetOf(DDlifeItems(setup).find((i) => i.id === selectedNode.lifeId))),
          ] : []),
          selectedNodes.length > 1 && item("align", "Align & space…", "تراز و فاصله…", "align", () => { setAlignPanel(true); setProperties(false); setViewPanel(false); }, { disabled: selectedNodes.filter((n) => !locked.has(n.id)).length < 2 }),
          selected.size > 1 && !grouped && item("group", "Group", "گروه‌کردن", "group", () => groupSelection(), { shortcut: "Ctrl/Cmd+G" }),
          grouped && item("ungroup", "Ungroup", "بازکردن گروه", "ungroup", () => groupSelection(true), { shortcut: "Ctrl/Cmd+Shift+G" }),
          sep("clipboard-sep"),
          item("copy", "Copy", "کپی", "copy", () => copySelection(), { disabled: !copyable, shortcut: "Ctrl/Cmd+C" }),
          item("duplicate", "Duplicate", "ساخت کپی مستقل", "duplicate", duplicate, { disabled: !copyable, shortcut: "Ctrl/Cmd+D" }),
          syncItems.length > 0 && item("synced", "Synced copy…", "کپی همگام…", "sync", null, { children: syncItems }),
          item("lock", allLocked ? "Unlock" : "Lock", allLocked ? "بازکردن قفل" : "قفل‌کردن", allLocked ? "unlock" : "lock", toggleLock),
          item("more", "More", "بیشتر", "more", null, { children: more }),
          sep("delete-sep"),
          item("delete", "Delete selection", "حذف انتخاب", "trash", deleteNodes, { danger: true, disabled: !editable || !copyable, shortcut: "Delete" }),
        ];
      }
      return [
        item("add-note", "Add note here", "افزودن نوت اینجا", "note", () => addSticky(menu.point)),
        item("add-text", "Add text here", "افزودن متن اینجا", "text", () => addText(menu.point), { shortcut: "T" }),
        item("add-task", "Add task here", "افزودن کار اینجا", "task", () => addBlock(null, menu.point)),
        item("add-symbol","Add sticker / emoji here","افزودن استیکر / ایموجی اینجا","sticker",()=>{finishEdit();setStickerPicker({point:menu.point});}),
        item("add-comment", "Add comment here", "Add comment here", "comment", () => comments.addAt(menu.point), { shortcut: "M" }),
        sep("paste-sep"),
        item("paste", "Paste here", "چسباندن اینجا", "paste", () => pasteClipboard(menu.point), { shortcut: "Ctrl/Cmd+V" }),
        item(
          "select-all",
          "Select all objects",
          "انتخاب همهٔ اشیا",
          "select",
          () => {
            setSelected(
              new Set(
                layout.nodes
                  .filter((n) => !locked.has(n.id) && !["day", "lane", "frame", "section"].includes(n.kind))
                  .map((n) => n.id),
              ),
            );
            setWireId(null);
          },
          { shortcut: "Ctrl/Cmd+A" },
        ),
        sep("view-sep"),
        item("fit-all", "Fit all objects", "نمایش همهٔ اشیا", "fitAll", () => fit(false), { shortcut: "Shift+1" }),
        item("view", "Canvas settings…", "تنظیمات بوم…", "settings", () => {
          setViewPanel(true);
          setProperties(false);
          setInspector(false);
        }),
        item("more", "More", "بیشتر", "more", null, { children: [
          // Photos also drop or paste straight onto the board (5.38).
          item("add-photo", "Add photo here", "افزودن عکس اینجا", "photo", () => photos.pick(menu.point)),
          item("zoom-100", "Zoom to 100%", "زوم ۱۰۰٪", "zoom", () => setZoom(1), { shortcut: "0" }),
          item("fit-day","Fit current day","نمای روز جاری","fitDay",()=>fit(false,"day"),{shortcut:"Shift+3"}),
          item("grid", "Dot grid", "شبکهٔ نقطه‌ای", "grid", () => toggleView("grid"), { checked: grid }),
          item("undo", "Undo", "واگرد", "undo", () => undo(), { disabled: !history.current.past.length, shortcut: "Ctrl/Cmd+Z" }),
          item("redo", "Redo", "انجام مجدد", "redo", () => undo(true), { disabled: !history.current.future.length, shortcut: "Ctrl/Cmd+Shift+Z" }),
          item("help", "Board help", "راهنمای برد", "help", () => setHelp(true), { shortcut: "?" }),
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

        ] }),
      ];
    }

    // Ctrl+Space can ask for the Engine while this board is already open.
    useEffect(() => DDengineBus.on(() => DDengineBus.take() && setEngine(true)), []);
    useEffect(() => DDsectionsBus.on(() => DDsectionsBus.take() && setLifeNav(true)), []);
    const selectedNodes = [...selected]
        .map((Y) => layout.map.get(Y))
        .filter(Boolean),
      manyNotes = selectedNodes.filter((n) => n.kind === "sticky"),
      titleFor = (Y) => layout.map.get(Y)?.title || Y;
    useLayoutEffect(() => {
      const row=pendingReveal.current, n=row&&layout.map.get(row.id);
      if(n && viewport.current) {
        pendingReveal.current=null;
        cam.current=core.fit([n],viewport.current.clientWidth,viewport.current.clientHeight,{left:32,right:32,top:140,bottom:130,maxZoom:1.3});
        setSelected(new Set([n.id]));setWireId(null);queueCamera();scheduleCamera();viewport.current.focus({preventScroll:true});
      }
      paintSelection();
    },[layout,selected,wireId,wireSelection,focus,properties,tick,setup.preferences]);
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
          // Full screen hides the tabs, so Back comes along (5.33).
          focus && _.createElement(DDPlacesBack, { React: _ }),
          _.createElement(
            "div",
            null,
            // The board's name is its day (5.43).
            _.createElement("strong", null, ie.format(E(day.date))),
            _.createElement(
              "small",
              null,
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
                    setTimeout(() => api.current.fit(false,"day"), 0));
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
                    setTimeout(() => api.current.fit(false,"day"), 0));
                },
              },
              DDUI("\u0644\u0627\u06CC\u0646\u200C\u0647\u0627"),
            ),
          ),
        ),
        // Daily tools stay in sight; the rest is one right-click (or ⋯) away.
        _.createElement(
          "div",
          { className: "b2-top-actions", "data-dock": "top", onContextMenu: (event) => openContext(event, { dock: "top" }) },
          toolButton(DDUI("Undo"), "undo", () => undo(), {
            disabled: !history.current.past.length,
          }),
          onTimerChange && _.createElement(DDBoardTimerButton,{React:_,Icon:controls.Icon,language:DDlanguage,timer,open:timerOpen,onOpenChange:setTimerOpen,buttonRef:timerButton}),
          _.createElement("span", { className: "b2-sep" }),
          toolButton(
            DDUI("Search board"),
            "search",
            () => setSearch((Y) => (Y === null ? "" : null)),
            {},
            DDUI("Search"),
          ),
          toolButton(t("Go to the Engine (E brings it over the board)", "رفتن به انجین (E آن را روی برد می‌آورد)"),"engine",()=>{finishEdit();setEngine(false);fit(false,"day");},{"data-engine-jump":true},t("Engine","انجین")),
          toolButton(t("Go to Feed", "رفتن به فید"),"leaf",()=>{const first=DDlifeItems(setup).find((i)=>i.type==="section"&&!i.parent);if(first)jumpLife(first.id);else addLifeItem("section");},{"data-life-jump":true},t("Feed","فید")),
          toolButton(t("Sections flowchart (Tab or D)","فلوچارت سکشن‌ها (Tab یا D)"),"sections",()=>{finishEdit();setLifeNav((v)=>!v);},{"aria-expanded":lifeNav,"data-sections-button":true},t("Sections","سکشن‌ها")),
          toolButton(
            DDUI(focus ? "Exit full screen" : "Full screen"),
            focus ? "shrink" : "expand",
            () => setFocus((Y) => !Y),
            {},
            DDUI(focus ? "Exit full screen" : "Full screen"),
          ),
          dockMore("top"),
        ),
        // Where you are: the main board, then each section down to the open one.
        layout.room && _.createElement("div",{className:"dd-room-break","aria-hidden":true}),
        layout.room && _.createElement("nav",{className:"dd-room-bar",dir:"ltr","aria-label":t("Where you are","کجای برد هستی"),onPointerDown:(e)=>e.stopPropagation()},
          _.createElement("button",{type:"button",className:"dd-room-back","data-room-back":true,title:t("Back one level (Esc)","یک سطح برگشت (Esc)"),"aria-label":t("Back","برگشت"),onClick:leaveRoom},"←"),
          _.createElement("button",{type:"button",dir:"auto","data-room-crumb":"main",onClick:()=>enterRoom(null)},t("Main board","برد اصلی")),
          DDlifePath(DDlifeItems(setup),layout.room).map((s,i,all)=>_.createElement(_.Fragment,{key:s.id},
            _.createElement("span",{className:"dd-room-sep","aria-hidden":true},"›"),
            _.createElement("button",{type:"button",dir:"auto","data-room-crumb":s.id,"aria-current":i===all.length-1?"page":undefined,onClick:()=>{if(i<all.length-1)enterRoom(s.id);}},s.text||t("Section","سکشن")))),
          // This whole board is the section's; what sits outside its frame shows only here.
          _.createElement("small",{className:"dd-room-note",dir:"auto"},t("Everything here is in this section · outside its frame stays on this board only","همه‌چیز اینجا مال این سکشنه · بیرون قاب فقط روی همین برد می‌مونه"))),
      ),
      _.createElement(DDBoardRails, {
        React: _, day, items: DDlifeItems(setup), room: layout.room, sharedLinks: DDlifeState(setup).links,
        nodes: layout.nodes, preferences: setup.preferences, language: DDlanguage,
        onToggle: toggleRail, onReveal: revealRail, days: allDays, habits: setup.habits || [],
        today: new Date().toLocaleDateString("en-CA"),
        onGoalChange: (ref, goal) => commit((d) => {
          const life = ref.startsWith("life:"), id = ref.slice(life ? 5 : 7), note = (life ? d.__life.items : d.notes).find((i) => i.id === id);
          if (!note) return;
          if (goal) note.goal = goal; else delete note.goal;
          return d;
        }),
        habitDay: day.date === railDate ? day : allDays?.[railDate] || { date: railDate, blocks: [], notes: [], bugs: [] },
        onHabitChange: (id, patch) => {
          const date = new Date().toLocaleDateString("en-CA"), update = (d) => deps.habits.DDsetHabitEntry(d, id, patch);
          if (day.date === date) commit(update);
          else onUpdateDayOnDate?.(date, update);
        },
      }),
      lifeNav && _.createElement(DDSectionsFlowchart, {
        React: _, items: DDlifeItems(setup), room: layout.room, language: DDlanguage, frame: layout.map.get("section:life"), quiet: [...engineSections],
        onShow: (id) => jumpLife(id),
        onEnter: (id) => enterRoom(id),
        onColor: (id, color) => lifeChange((list) => DDsetSectionColor(list, id, color)),
        onEnlarge: () => { const area = layout.map.get("section:life"); if (area) resizeLifeArea({ w: area.w * 1.25, h: area.h * 1.25 }); },
        onSize: (patch) => resizeLifeArea(patch),
        onCompact: () => commit((d) => { d.__life.items = DDlifeCompact(d.__life.items); delete d.__life.frame.w; delete d.__life.frame.h; return d; }),
        onClose: () => { setLifeNav(false); viewport.current?.focus({ preventScroll: true }); },
      }),
      (selected.size > 0 || selectedWire || selectedWires.size > 0) &&
        _.createElement(
          "div",
          {
            className: "b4-selectionbar",
            ref: selectionbar,
            role: "toolbar",
            onPointerDown:e=>{e.stopPropagation();if(editingRef.current)e.preventDefault();},
            onContextMenu:(event)=>openContext(event,selectedWire?{wire:selectedWire.id}:selectedNode?{ref:selectedNode.id}:{selection:true}),
            "aria-label": "Selection actions",
          },
          selectedWire
            ? wireToolbar(selectedWire)
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
                      ? (selectedNode.kind === "sticky" ? String(selectedNode.title || "").replace(/\*\*|~~/g, "").replace(/^\s*- \[[ xX]\]\s*/gm, "") : selectedNode.title)
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
                // Only what a card is opened for stays here; lock, layers, the
                // section's add / remove and note styling outside typing live in ⋯
                // (or a right-click on this bar).
                selectedNode &&
                  ["block", "subtask", "bug", "habit"].includes(selectedNode.kind) &&
                  toolButton(
                    t("Card details", "جزئیات کارت"),
                    "info",
                    () => {
                      setDetails(!details);
                      setProperties(false);
                    },
                    { "aria-pressed": details },
                  ),
                selectedNode &&
                  (selectedNode.kind === "block" || selectedNode.kind === "subtask") &&
                  toolButton(
                    t("Add a step", "افزودن قدم"),
                    "addStep",
                    () => setChild({ blockId: selectedNode.blockId, subId: selectedNode.subId || null, value: "" }),
                    { "data-add-step": true },
                    t("Step", "قدم"),
                  ),
                selected.size > 0 && toolButton(
                  t("Color & properties", "رنگ و ویژگی‌ها"),
                  "palette",
                  () => {
                    restoreStylePreview();
                    setProperties(!properties);
                    setAlignPanel(false);
                    setViewPanel(false);
                  },
                  { "aria-pressed": properties },
                ),
                // Left / center / right for the words in a note or a text object.
                selectedNodes.some((n) => n.kind === "sticky") && (() => {
                  const now = selectedNodes.find((n) => n.kind === "sticky").textAlign || "start",
                    order = ["start", "center", "end"], names = { start: "left", center: "center", end: "right" },
                    next = order[(order.indexOf(now) + 1) % 3];
                  return toolButton(
                    t("Text align " + names[now] + " · click for " + names[next], "تراز متن"),
                    now === "center" ? "textCenter" : now === "end" ? "textRight" : "textLeft",
                    () => applyStyle({ textAlign: next }),
                    { "data-text-align": now, disabled: selectedNodes.every((n) => n.kind !== "sticky" || locked.has(n.id)) },
                  );
                })(),
                // Tags on a note: they show under it, outside the paper (5.36).
                !selectedNode && manyNotes.length > 1 && toolButton("Tags", "tag", () => (noteTools.group ? noteTools.stopTags() : noteTools.editTags(manyNotes.map((n) => n.id))), { "aria-pressed": !!noteTools.group, "data-note-tags": "many", disabled: manyNotes.every((n) => locked.has(n.id)) }),
                selectedNode?.kind === "sticky" && toolButton("Tags", "tag", () => (noteTools.editing === selectedNode.id ? noteTools.stopTags() : noteTools.editTags(selectedNode.id)), { "aria-pressed": noteTools.editing === selectedNode.id, "data-note-tags": true, disabled: locked.has(selectedNode.id) }),
                // Line things up, space them evenly, match sizes (like a design app).
                selectedNodes.length > 1 && toolButton(
                  t("Align & space", "تراز و فاصله"),
                  "align",
                  () => { restoreStylePreview(); alignClosed.current = alignPanel; setAlignPanel(!alignPanel); setProperties(false); setViewPanel(false); },
                  { "aria-pressed": alignPanel, "data-align-panel": true },
                ),
                // Lines picked up with the selection: one color and weight for all of them.
                selectedWires.size > 0 && _.createElement(_.Fragment, null,
                  _.createElement("span", { className: "b2-sep" }),
                  lineLook(layout.edges.filter((e) => selectedWires.has(e.id)), (patch, message) => patchWires([...selectedWires], patch, message))),
                // The note's own bar stays out of sight on desktop (FigJam), so its
                // "to plan" action lives here.
                selectedNode?.kind === "sticky" && toolButton(DDUI("Convert note to plan"), "toPlan", () => convertSticky(selectedNode), {}, DDUI("→ پلن")),
                // Section actions live in the selection toolbar, as in FigJam; the
                // section itself carries only its title.
                selectedNode?.lifeSection && _.createElement(_.Fragment,null,
                  toolButton(t("Open as its own board","ورود به برد سکشن"),"enter",()=>enterRoom(selectedNode.lifeId),{"data-enter-section":selectedNode.lifeId}),
                  toolButton(t(selectedNode.collapsed ? "Expand section" : "Collapse section",selectedNode.collapsed ? "باز کردن سکشن" : "بستن سکشن"),selectedNode.collapsed?"expandDown":"collapse",()=>lifeChange((list)=>list.map((i)=>i.id===selectedNode.lifeId?{...i,collapsed:!i.collapsed}:i)))),
                // Bold, strike and to-do sit here while you type in a note.
                selectedNode?.kind === "sticky" && editing?.ref === selectedNode.id && _.createElement(_.Fragment,null,
                  ...["bold","strike","todo"].map((kind)=>toolButton(t(kind==="bold"?"Bold":kind==="strike"?"Strikethrough":"To-do",kind==="bold"?"پررنگ":kind==="strike"?"خط‌خورده":"کار"),kind,()=>formatSticky(kind),{"data-note-format":kind}))),
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
                  { "data-dock-more": "selection" },
                ),
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
          onPointerLeave: () => { if (!gesture.current) hideGhost(); },
          onPointerUp: pointerUp,
          onPointerCancel: (Y) => {
            (touches.current.delete(Y.pointerId), api.current.cancelGesture());
          },
          onLostPointerCapture: (Y) => {
            gesture.current?.pointerId === Y.pointerId &&
              api.current.cancelGesture();
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
                  refX: "8",
                  refY: "5",
                  markerWidth: "4",
                  markerHeight: "4",
                  orient: "auto-start-reverse",
                  markerUnits: "strokeWidth",
                },
                // A clear filled arrowhead in the line's own colour.
                _.createElement("path", {
                  d: "M1 1.2L9 5 1 8.8z",
                  fill: "context-stroke",
                  stroke: "context-stroke",
                  strokeWidth: "0.8",
                  strokeLinejoin: "round",
                }),
              ),
            ),
            layout.edges.map((Y) => {
              const G = wireGeometry(Y, paintObstacles),
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
                      // FigJam lines are grey and keep their weight relative to the canvas.
                      stroke: Y.color || "var(--dd-wire,#757575)",
                      // Width is set in CSS from --w so it never gets too thin on screen.
                      style: { "--w": Y.width || 3, opacity: Y.opacity ?? 1 },
                      strokeDasharray:
                        Y.pattern === "dotted"
                          ? "1 5"
                          : Y.dashed || Y.pattern === "dashed"
                            ? "6 5"
                            : void 0,
                      strokeLinecap: "round",
                      markerStart: wireEnds(Y).start ? "url(#b4-arrow)" : void 0,
                      markerEnd: wireEnds(Y).end ? "url(#b4-arrow)" : void 0,
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
              // While dragging, FigJam already shows the real grey line with its arrow.
              stroke: "var(--dd-wire,#757575)",
              strokeWidth: 3,
              strokeLinecap: "round",
              markerEnd: "url(#b4-arrow)",
            }),
          ),
          _.createElement("svg", {
            className: "b6-guides",
            ref: guideSvg,
            "aria-hidden": true,
          }),
          paintOrder.map(renderNode),
          pen.world(),
          comments.world(),
          photos.world(),
          roomHistory(),
          _.createElement("div", { className: "dd-ghost-note", ref: ghostNote, "aria-hidden": true, style: { display: "none" } }),
          _.createElement("div", {
            className: "b4-marquee",
            ref: marquee,
            style: { display: "none" },
          }),
        ),
        // While the pen or the comment tool is on, it takes the pointer (5.36).
        pen.capture(),
        comments.capture(),
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
      alignPanel && !properties && selectedNodes.length > 1 &&
        _.createElement(controls.AlignPanel, {
          React: _,
          language: DDlanguage,
          nodes: selectedNodes.map((n) => ({ ...n, locked: locked.has(n.id) })),
          onArrange: arrangeSelection,
          onSize: matchSelectionSize,
          onClose: () => { alignClosed.current = true; setAlignPanel(false); viewport.current?.focus({ preventScroll: true }); },
        }),
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
          startFullscreen,
          onStartFullscreen:()=>{const next=!startFullscreen;setStartFullscreen(next);core.remember("debug-day:board-start-fullscreen",next);},
          onClose: () => {
            setViewPanel(false);
            viewport.current?.focus({ preventScroll: true });
          },
        }),
      onTimerChange && _.createElement(DDBoardTimer,{React:_,Icon:controls.Icon,language:DDlanguage,timer,onChange:onTimerChange,defaultMinutes:prefs.timerMinutes,open:timerOpen,onOpenChange:setTimerOpen,buttonRef:timerButton}),
      search !== null && _.createElement(DDBoardSearch,{
        React:_,language:DDlanguage,rows:DDboardSearchRows(day,DDlifeItems(setup),layout.nodes),items:DDlifeItems(setup),query:search,onQuery:setSearch,
        onReveal:revealSearchResult,onClose:()=>{setSearch(null);viewport.current?.focus({preventScroll:true});}
      }),
      pen.bar(),
      comments.screen(),
      noteTools.screen(),
      photos.screen(),
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
      // With the sticky tool, FigJam offers the note colors right above the dock.
      tool === "sticky" && _.createElement("div", { className: "dd-sticky-colors", role: "radiogroup", "aria-label": t("Sticky note color", "رنگ یادداشت"), onPointerDown: (e) => e.stopPropagation() },
        core.stickyColors.map((color) => _.createElement("button", {
          type: "button", key: color, role: "radio", style: { background: color },
          "aria-checked": appearanceRef.current.stickyColor === color,
          "aria-label": t("Sticky color ", "رنگ یادداشت ") + color,
          onClick: () => changeAppearance({ stickyColor: color }),
        }))),
      _.createElement(
        "div",
        {
          className: "b2-dock",
          role: "toolbar",
          "aria-label": DDUI("Canvas tools"),
          "data-dock": "tools",
          onContextMenu: (event) => openContext(event, { dock: "tools" }),
        },
        [
          ["select", DDUI("\u0627\u0646\u062A\u062E\u0627\u0628"), "sort"],
          ["hand", DDUI("\u062F\u0633\u062A"), "hand"],
          // Like FigJam, connectors start from a note's side points (or X / L),
          // so the dock keeps no connector or feeling tool.
          ["block", DDUI("\u0628\u0644\u0627\u06A9"), "task"],
          [
            "sticky",
            DDUI("\u06CC\u0627\u062F\u062F\u0627\u0634\u062A"),
            "sticky",
          ],
          ["text", t("Text", "متن"), "text"],
          ["section", t("Section", "سکشن"), "section"],
          // Draw freehand (P) and leave a comment (M), 5.36.
          ["pen", "Pen", "draw"],
          ["comment", "Comment", "comment"],
        ].map(([Y, G, ct]) =>
          _.createElement(
            "button",
            {
              type: "button",
              key: Y,
              className: "b2-icon",
              "aria-label": Y === "pen" ? "Pen tool" : Y === "comment" ? "Comment tool" : DDUI(
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
                            : Y === "text"
                              ? "Text tool"
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
                  sort: "select",
                  sticky: "note",
                }[ct] || ct,
            }),
            _.createElement("span", null, Y === "connector" ? t("Connect","اتصال") : G),
          ),
        ),
        _.createElement("span", { className: "b2-sep" }),
        toolButton(t("Stickers & emoji","استیکر و ایموجی"),"sticker",()=>{finishEdit();setMenu(null);setStickerPicker({target:selectedNode?.kind==="block"?selectedNode.blockId:""});},{},t("Stickers","استیکر")),
        // Snap, grid, minimap and canvas settings: right-click the dock, or ⋯.
        dockMore("tools"),
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
          title: menu.dock === "top"
            ? t("Board tools", "ابزارهای برد")
            : menu.dock === "tools"
            ? t("Canvas tools", "ابزارهای بوم")
            : menu.wire
            ? t("Connection", "اتصال")
            : menu.ref || menu.selection
              ? selected.size > 1
                ? selected.size + t(" selected objects", " شیء انتخاب‌شده")
                : selectedNode?.title || t("Object", "شیء")
              : t("Canvas", "بوم"),
        }),
      dueEdit && ((n) => n && _.createElement(DDDueEditor, {
        React: _, item: { type: n.lifeSection ? "section" : "sticky", text: n.title, due: n.due }, today: new Date().toLocaleDateString("en-CA"), language: DDlanguage,
        style: { left: Math.max(8, Math.min(dueEdit.x, (root.current?.clientWidth || 600) - 276)), top: Math.max(8, Math.min(dueEdit.y, (root.current?.clientHeight || 600) - 250)) },
        onChange: (due) => setDue(n.id, due), onClose: () => setDueEdit(null),
      }))(layout.map.get(dueEdit.ref)),
      stickerPicker && _.createElement(playful.Picker,{current:stickerPicker.current,target:stickerPicker.target || "",targets:stickerPicker.replace?[]:day.blocks,onClose:()=>setStickerPicker(null),onPick:(value,target)=>{const rect=viewport.current.getBoundingClientRect(),point=stickerPicker.point || toWorld(rect.left+rect.width/2,rect.top+rect.height/2),id=stickerPicker.replace || C(),size=playful.isSticker(value)?128:76;commit(d=>playful.data.put(d,value,{id,replace:stickerPicker.replace,taskId:target,x:point.x-size/2,y:point.y-size/2}),t("A little personality added","کمی حال‌وهوا اضافه شد"));setSelected(new Set([target?"b:"+target:"sticky:"+id]));setWireId(null);setTool("select");onSelectBlock?.(target || null);}}),
      help &&
        _.createElement(
          "div",
          {
            className: "b4-help-backdrop",
            role: "dialog",
            "aria-modal": "true",
            "aria-label": "Board help",
            onKeyDown:e=>{if(e.key==="Escape"){e.preventDefault();e.stopPropagation();setHelp(false);viewport.current?.focus({preventScroll:true});}},
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
            _.createElement("dl",{className:"dd-shortcut-list"},DDboardShortcuts.flatMap(([keys,en,fa])=>[
              _.createElement("dt",{key:keys,dir:"ltr"},keys),_.createElement("dd",{key:keys+"-label",dir:DDlanguage==="fa"?"rtl":"ltr"},t(en,fa))
            ])),
            _.createElement(
              "p",
              null,
              DDUI(
                "\u062F\u0631 \u0645\u0648\u0628\u0627\u06CC\u0644: \u06CC\u06A9 \u0627\u0646\u06AF\u0634\u062A \u0628\u0631\u0627\u06CC \u062D\u0631\u06A9\u062A \u0631\u0648\u06CC \u0641\u0636\u0627\u06CC \u062E\u0627\u0644\u06CC\u060C \u062F\u0648 \u0627\u0646\u06AF\u0634\u062A \u0628\u0631\u0627\u06CC \u0632\u0648\u0645\u060C \u062F\u0648 \u0636\u0631\u0628\u0647 \u0631\u0648\u06CC \u0646\u0648\u062F \u0628\u0631\u0627\u06CC \u0648\u06CC\u0631\u0627\u06CC\u0634.",
              ),
            ),
          ),
        ),
      engine &&
        _.createElement(DDEngineOverlay, {
          React: _,
          day,
          setup,
          language: DDlanguage,
          dateLabel: ie.format(E(day.date)),
          days: allDays,
          dateFormat: (date) => ie.format(E(date)),
          makeId: C,
          sources: DDengineSources(DDlifeItems(setup)),
          measure,
          setDone: DDsetTaskDone,
          onChange: (change) => commit((d) => change(d), t("Engine updated", "انجین به‌روز شد")),
          onAdd: (name, lane) => {
            // Made inside a section's board, the task comes from that section.
            const task = DDengineTask(name, lane, { ...setup, preferences: { ...setup.preferences, defaultMinutes: prefs.defaultMinutes } }, C(), layout.room || "");
            commit((d) => { d.blocks.push(task); return d; }, t("Added to the Engine", "به انجین اضافه شد"));
          },
          onReveal: (blockId) => {
            setEngine(false);
            revealBoardResult({ id: "b:" + blockId, blockId, kind: "block" });
          },
          onClose: () => {
            setEngine(false);
            viewport.current?.focus({ preventScroll: true });
          },
        }),
    );
  };
}
