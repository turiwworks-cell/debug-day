import { DDlifeItems, DDlifeRemoveTree, DDlifeHistory, DDlifeState } from "./life-board.js";
// Readable, additive search and command palette. React is supplied by the app.
export function DDsearchDigits(value = "") {
  return String(value).replace(/[۰-۹٠-٩]/g, (c) =>
    String(c.charCodeAt(0) - (c >= "۰" ? 1776 : 1632)),
  );
}
export function DDsearchText(value = "") {
  return DDsearchDigits(value)
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u200b-\u200f\u202a-\u202e]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
export function DDshiftDate(date, offset) {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}
const DDpersianCalendar = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  numberingSystem: "latn",
  timeZone: "UTC",
});
export function DDsearchDate(value, today) {
  value = DDsearchText(value).replace(/^date:/, "");
  const relative = {
    today: 0,
    امروز: 0,
    tomorrow: 1,
    فردا: 1,
    yesterday: -1,
    دیروز: -1,
  };
  if (Object.hasOwn(relative, value))
    return DDshiftDate(today, relative[value]);
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (year >= 1900 && year <= 9999) {
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    return date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
      ? date.toISOString().slice(0, 10)
      : null;
  }
  if (
    year < 1200 ||
    year > 1699 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  )
    return null;
  const start = Date.UTC(year + 621, 2, 1, 12);
  for (let n = 0; n < 400; n++) {
    const date = new Date(start + n * 86400000),
      parts = Object.fromEntries(
        DDpersianCalendar.formatToParts(date).map((p) => [p.type, p.value]),
      );
    if (+parts.year === year && +parts.month === month && +parts.day === day)
      return date.toISOString().slice(0, 10);
  }
  return null;
}
export function DDparseSearch(
  raw = "",
  today = new Date().toISOString().slice(0, 10),
) {
  const query = {
    raw,
    terms: [],
    categories: [],
    lanes: [],
    priority: null,
    done: null,
    date: null,
    commandsOnly: false,
    invalidDate: false,
  };
  let text = DDsearchText(raw);
  if (text.startsWith(">")) {
    query.commandsOnly = true;
    text = text.slice(1).trim();
  }
  for (const token of text.match(/"[^"]*"|\S+/g) || []) {
    if (token.startsWith("#")) {
      if (token.length > 1) query.categories.push(token.slice(1));
      continue;
    }
    if (token.startsWith("@")) {
      if (token.length > 1) query.lanes.push(token.slice(1));
      continue;
    }
    if (/^!(?:[123]|high|normal|low)?$/.test(token)) {
      query.priority =
        token === "!"
          ? "any"
          : { high: 1, normal: 2, low: 3 }[token.slice(1)] || +token.slice(1);
      continue;
    }
    if (token === "is:done" || token === "is:open") {
      query.done = token === "is:done";
      continue;
    }
    if (
      token.startsWith("date:") ||
      /^\d{4}-\d{1,2}-\d{1,2}$/.test(token) ||
      ["today", "tomorrow", "yesterday", "امروز", "فردا", "دیروز"].includes(
        token,
      )
    ) {
      if (token !== "date:") {
        query.date = DDsearchDate(token, today);
        query.invalidDate = !query.date;
      }
      continue;
    }
    query.terms.push(token.replace(/^"|"$/g, ""));
  }
  return query;
}
function DDsubText(items = []) {
  return items.flatMap((s) => [s.text, DDsubText(s.children)]).join(" ");
}
export function DDbuildSearchIndex(data, today) {
  const index = [],
    setup = data.setup || {},
    types = new Map((setup.types || []).map((t) => [t.id, t.name])),
    lanes = new Map((setup.lanes || []).map((l) => [l.id, l.name]));
  function add(row) {
    row.searchText = DDsearchText(
      [
        row.title,
        row.detail,
        row.note,
        row.category,
        row.type,
        types.get(row.type),
        row.lane,
        lanes.get(row.lane),
        row.extra,
        ...(row.tags || []),
      ]
        .filter(Boolean)
        .join(" "),
    );
    row.categoryText = DDsearchText(
      [row.type, types.get(row.type), row.category, row.tag, ...(row.tags || [])]
        .filter(Boolean)
        .join(" "),
    );
    row.laneText = DDsearchText(
      [row.lane, lanes.get(row.lane)].filter(Boolean).join(" "),
    );
    index.push(row);
  }
  for (const date of Object.keys(data.days || {})
    .sort()
    .reverse()) {
    const day = data.days[date];
    for (const block of day.blocks || []) {
      const common = {
        date,
        blockId: block.id,
        type: block.type,
        lane: block.lane,
        priority: block.pri || 0,
        tags: block.tags || [],
        detail: [
          date,
          types.get(block.type) || block.type,
          lanes.get(block.lane),
          block.measure === "count"
            ? (block.count || 0) + "/" + (block.times || 1) + "×"
            : block.measure === "wait"
              ? "⏳"
              : block.min + "m",
        ]
          .filter(Boolean)
          .join(" · "),
      };
      add({
        ...common,
        id: "block:" + date + ":" + block.id,
        itemId: block.id,
        kind: "block",
        title: block.name || "Untitled",
        done: !!block.done,
        note: block.note,
        extra: DDsubText(block.subtasks),
        group: date === today ? "today" : "other",
      });
      function subs(items, path = []) {
        for (const sub of items || []) {
          add({
            ...common,
            id: "sub:" + date + ":" + block.id + ":" + sub.id,
            itemId: sub.id,
            kind: "subtask",
            title: sub.text,
            done: !!sub.done,
            note: block.note,
            detail: [date, block.name, ...path].join(" › "),
            extra: DDsubText(sub.children),
            group: date === today ? "today" : "other",
          });
          subs(sub.children, [...path, sub.text]);
        }
      }
      subs(block.subtasks);
    }
    for (const bug of day.bugs || [])
      add({
        id: "bug:" + date + ":" + bug.id,
        itemId: bug.id,
        kind: "bug",
        date,
        title: bug.text,
        detail: date + " · " + (bug.triggerTag || bug.category || ""),
        category: bug.category,
        tag: bug.triggerTag,
        type: bug.type,
        done: !!bug.fixed,
        note: [bug.on, bug.antidote].join(" "),
        group: "feelings",
      });
    for (const note of day.notes || [])
      add({
        id: "note:" + date + ":" + note.id,
        itemId: note.id,
        kind: "note",
        date,
        title: note.label || note.text,
        extra: note.kind === "emoji" ? note.text : undefined,
        detail: date,
        done: false,
        group: "notes",
      });
    if (day.focus || day.journal)
      add({
        id: "journal:" + date,
        itemId: date,
        kind: "journal",
        date,
        title: day.focus || day.journal,
        detail: date,
        note: day.journal,
        group: "notes",
      });
  }
  for (const feedback of setup.feedbacks || []) {
    const row = {
      id: "feedback:" + feedback.id,
      itemId: feedback.id,
      kind: "feedback",
      date: feedback.createdAt,
      title: feedback.text,
      detail: feedback.createdAt,
      done: !!feedback.done,
      priority: feedback.priority === "high" ? 1 : 0,
      group: "notes",
    };
    add({
      ...row,
      extra: (feedback.thread || []).map((t) => t.text).join(" "),
    });
    for (const reply of feedback.thread || [])
      add({
        ...row,
        id: "thread:" + feedback.id + ":" + reply.id,
        kind: "thread",
        itemId: reply.id,
        feedbackId: feedback.id,
        title: reply.text,
        detail: feedback.text + " · " + reply.at,
        date: reply.at,
      });
  }
  for (const worry of setup.worries || [])
    add({
      id: "worry:" + worry.id,
      itemId: worry.id,
      kind: "worry",
      title: worry.text,
      date: worry.createdAt,
      detail: worry.createdAt,
      done: !!worry.closed,
      category: "worry",
      group: "feelings",
    });
  for (const block of setup.later || [])
    add({
      id: "later:" + block.id,
      itemId: block.id,
      blockId: block.id,
      kind: "later",
      title: block.name,
      note: block.note,
      type: block.type,
      lane: block.lane,
      priority: block.pri || 0,
        tags: block.tags || [],
      done: !!block.done,
      detail: "Later",
      extra: DDsubText(block.subtasks),
      group: "notes",
    });
  for (const it of DDlifeItems(setup)) add({ id:"life:"+it.id,kind:"life",itemId:it.id,title:it.text || "Section",detail:"Life · زندگی",category:"life",group:"life",extra:it.type });
  return index;
}
export function DDmatchSearch(row, query) {
  if (
    query.invalidDate ||
    (query.commandsOnly && row.kind !== "command") ||
    (!query.commandsOnly &&
      row.kind === "command" &&
      (query.categories.length ||
        query.lanes.length ||
        query.priority !== null ||
        query.done !== null ||
        query.date))
  )
    return false;
  if (query.date && row.date !== query.date) return false;
  if (query.done !== null && row.done !== query.done) return false;
  if (
    (query.priority === "any" && !row.priority) ||
    (typeof query.priority === "number" && row.priority !== query.priority)
  )
    return false;
  if (
    !query.categories.every(
      (tag) =>
        row.categoryText?.includes(tag) ||
        DDsearchText(row.title + " " + (row.note || "")).includes("#" + tag),
    )
  )
    return false;
  if (!query.lanes.every((lane) => row.laneText?.includes(lane))) return false;
  const hay = row.searchText || DDsearchText(row.title + " " + row.detail),
    compact = hay.replace(/\s/g, "");
  return query.terms.every(
    (term) => hay.includes(term) || compact.includes(term.replace(/\s/g, "")),
  );
}
// A panel whose name matches what was typed comes before one that only mentions it.
export function DDrankPanels(rows, query) {
  const named = (row) =>
    query.terms.length > 0 &&
    query.terms.every((term) =>
      DDsearchText((row.names || [row.title]).join(" ")).includes(term),
    );
  return [...rows.filter(named), ...rows.filter((row) => !named(row))];
}
export function DDmatchesBlock(block, raw, setup, date, today) {
  return DDmatchSearch(
    DDbuildSearchIndex(
      { setup, days: { [date]: { blocks: [block] } } },
      today,
    )[0],
    DDparseSearch(raw, today),
  );
}
function DDfindSub(items, id) {
  for (const item of items || []) {
    if (item.id === id) return item;
    const sub = DDfindSub(item.children, id);
    if (sub) return sub;
  }
  return null;
}
function DDsetSubDone(items, done) {
  for (const item of items || []) {
    item.done = done;
    DDsetSubDone(item.children, done);
  }
}
// All entry points use the same completion rules: whole tasks cascade down;
// a subtask updates its branch and recomputes the containing task's status.
export function DDsetTaskDone(block, done) {
  const next = structuredClone(block);
  next.done = !!done;
  DDsetSubDone(next.subtasks, next.done);
  // A counted card ("3 times") fills its tally when ticked, and opens one back up when unticked.
  if (next.measure === "count") {
    const times = Math.max(1, Math.min(99, Math.round(+next.times || 1)));
    next.count = next.done ? times : Math.min(Math.round(+next.count || 0), times - 1);
  }
  return next;
}
export function DDtoggleSubtask(block, id) {
  const next = structuredClone(block);
  function visit(items) {
    for (const item of items || []) {
      if (item.id === id) {
        item.done = !item.done;
        DDsetSubDone(item.children, item.done);
        return true;
      }
      if (visit(item.children)) {
        item.done = item.children.every((child) => child.done);
        return true;
      }
    }
    return false;
  }
  if (!visit(next.subtasks)) return block;
  next.done = next.subtasks.every((item) => item.done);
  return next;
}
function DDremoveSub(items, id) {
  return (items || [])
    .filter((item) => item.id !== id)
    .map((item) => ({ ...item, children: DDremoveSub(item.children, id) }));
}
function DDsubRefs(items, blockId) {
  return (items || []).flatMap((sub) => [
    "sub:" + blockId + ":" + sub.id,
    ...DDsubRefs(sub.children, blockId),
  ]);
}
export function DDcleanBoard(day, refs) {
  const board = day.canvas?.board4;
  if (!board) return;
  const removed = new Set(refs);
  board.links = (board.links || []).filter(
    (link) => !removed.has(link.from) && !removed.has(link.to),
  );
  for (const positions of Object.values(board.layouts || {}))
    for (const ref of refs) delete positions[ref];
  for (const ref of refs) if (board.styles) delete board.styles[ref];
  if (Array.isArray(board.stack))
    board.stack = board.stack.filter((ref) => !removed.has(ref));
  for (const [key, value] of Object.entries(board.overrides || {}))
    if (removed.has(value.from) || removed.has(value.to))
      delete board.overrides[key];
  for (const field of ["locked", "hidden"])
    if (board[field])
      board[field] = board[field].filter((ref) => !removed.has(ref));
  for (const [key, group] of Object.entries(board.groups || {})) {
    board.groups[key] = group.filter((ref) => !removed.has(ref));
    if (board.groups[key].length < 2) delete board.groups[key];
  }
}
// Always resolve a result against the latest snapshot before applying an action.
export function DDeditSearchResult(snapshot, row, action, value, ensureDay) {
  if (row.kind === "life") {
    const data=structuredClone(snapshot), before=DDlifeItems(data.setup);
    // Deleting a section deletes its contents, the same as on the Board.
    const items=action==="delete" ? DDlifeRemoveTree(before,row.itemId) : action==="rename" || action==="text" ? before.map((i)=>i.id===row.itemId?{...i,text:String(value).slice(0,4000)}:i) : before;
    if (items===before) return snapshot;
    const kept=new Set(items.map((i)=>"life:"+i.id)), live=(ref)=>!String(ref).startsWith("life:")||kept.has(ref);
    data.setup.life={...data.setup.life,v:2,items,...(Array.isArray(data.setup.life?.links)?{links:data.setup.life.links.filter((l)=>live(l.from)&&live(l.to))}:{})}; return data;
  }
  if (
    action === "move" &&
    (value === row.date || DDsearchDate(value, row.date) !== value)
  )
    return snapshot;
  if (action === "duration" && !Number.isFinite(Number(value))) return snapshot;
  const data = structuredClone(snapshot),
    setup = data.setup,
    day = data.days[row.date];
  function destination(date) {
    return (
      data.days[date] || (data.days[date] = structuredClone(ensureDay(date)))
    );
  }
  if (row.kind === "block" || row.kind === "subtask") {
    if (!day) return snapshot;
    const block = day.blocks.find((b) => b.id === row.blockId);
    if (!block) return snapshot;
    const target =
      row.kind === "subtask" ? DDfindSub(block.subtasks, row.itemId) : block;
    if (!target) return snapshot;
    if (action === "done") {
      day.blocks[day.blocks.indexOf(block)] =
        row.kind === "subtask"
          ? DDtoggleSubtask(block, target.id)
          : DDsetTaskDone(block, !block.done);
    } else if (action === "category") block.type = value;
    else if (action === "duration") {
      const minutes = Math.max(
        15,
        Math.min(720, Math.round(Number(value) / 15) * 15),
      );
      if (!Number.isFinite(minutes)) return snapshot;
      if (row.kind === "subtask") target.min = minutes;
      else block.min = minutes;
    } else if (action === "delete" || action === "move") {
      if (row.kind === "block") {
        day.blocks = day.blocks.filter((b) => b.id !== block.id);
        DDcleanBoard(day, [
          "b:" + block.id,
          ...DDsubRefs(block.subtasks, block.id),
        ]);
        if (action === "move") {
          const moved = structuredClone(block);
          delete moved.bx;
          delete moved.by;
          const dest = destination(value);
          if (dest.blocks.some((b) => b.id === moved.id))
            moved.id = crypto.randomUUID();
          dest.blocks.push(moved);
        }
      } else {
        block.subtasks = DDremoveSub(block.subtasks, target.id);
        DDcleanBoard(day, [
          "sub:" + block.id + ":" + target.id,
          ...DDsubRefs(target.children, block.id),
        ]);
        if (action === "move")
          destination(value).blocks.push({
            id: crypto.randomUUID(),
            name: target.text,
            type: block.type,
            lane: block.lane,
            min: target.min || 30,
            note: "",
            pri: block.pri || 0,
            emo: "",
            done: !!target.done,
            expanded: true,
            subtasks: target.children || [],
          });
      }
    } else return snapshot;
  } else if (row.kind === "bug") {
    const bug = day?.bugs?.find((b) => b.id === row.itemId);
    if (!bug) return snapshot;
    if (action === "done") bug.fixed = !bug.fixed;
    else if (action === "category") bug.category = value;
    else if (action === "delete") {
      day.bugs = day.bugs.filter((b) => b.id !== row.itemId);
      DDcleanBoard(day, ["bug:" + row.itemId]);
    } else return snapshot;
  } else if (row.kind === "note") {
    const note = day?.notes?.find((n) => n.id === row.itemId);
    if (!note) return snapshot;
    if (action === "delete" || action === "move") {
      day.notes = day.notes.filter((n) => n.id !== note.id);
      DDcleanBoard(day, ["sticky:" + note.id, "note:" + note.id]);
      if (action === "move") {
        const dest = destination(value);
        if (dest.notes.some((n) => n.id === note.id))
          note.id = crypto.randomUUID();
        dest.notes.push(note);
      }
    } else return snapshot;
  } else if (row.kind === "feedback" || row.kind === "thread") {
    const feedback = (setup.feedbacks || []).find(
      (f) => f.id === (row.feedbackId || row.itemId),
    );
    if (!feedback) return snapshot;
    if (action === "done") feedback.done = !feedback.done;
    else if (action === "delete") {
      if (row.kind === "thread")
        feedback.thread = (feedback.thread || []).filter(
          (t) => t.id !== row.itemId,
        );
      else setup.feedbacks = setup.feedbacks.filter((f) => f.id !== row.itemId);
    } else return snapshot;
  } else if (row.kind === "journal" && action === "delete") {
    if (day) {
      day.focus = "";
      day.journal = "";
    } else return snapshot;
  } else if (row.kind === "worry") {
    const worry = (setup.worries || []).find((w) => w.id === row.itemId);
    if (!worry) return snapshot;
    if (action === "done") worry.closed = !worry.closed;
    else if (action === "delete")
      setup.worries = setup.worries.filter((w) => w.id !== row.itemId);
    else return snapshot;
  } else if (row.kind === "later") {
    const block = (setup.later || []).find((b) => b.id === row.itemId);
    if (!block) return snapshot;
    if (action === "done") {
      block.done = !block.done;
      DDsetSubDone(block.subtasks, block.done);
    } else if (action === "category") block.type = value;
    else if (action === "duration")
      block.min = Math.max(
        15,
        Math.min(720, Math.round(Number(value) / 15) * 15),
      );
    else if (action === "delete" || action === "move") {
      setup.later = setup.later.filter((b) => b.id !== row.itemId);
      if (action === "move") {
        const dest = destination(value);
        if (dest.blocks.some((b) => b.id === block.id))
          block.id = crypto.randomUUID();
        dest.blocks.push(block);
      }
    } else return snapshot;
  } else return snapshot;
  return data;
}
const DDcommandNames = {
  "cmd-map": ["Open app map", "نقشهٔ اپ"],
  "cmd-iso-clear": ["Show all", "نمایش همه"],
};
function DDsearchStored(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return Array.isArray(value)
      ? value.filter((x) => typeof x === "string").slice(0, 16)
      : fallback;
  } catch {
    return fallback;
  }
}
function DDrememberSearch(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
export function DDCommandPalette(props) {
  const {
      React: R,
      data,
      selectedDay,
      date,
      today,
      language,
      commands,
      onClose,
      onOpen,
      onIsolate,
      onFocus,
      setData,
      ensureDay,
      parseQuick,
    } = props,
    h = R.createElement,
    fa = language === "fa",
    t = (en, fr) => (fa ? fr : en);
  const [raw, setRaw] = R.useState(""),
    [active, setActive] = R.useState(0),
    [menu, setMenu] = R.useState(null),
    [menuIndex, setMenuIndex] = R.useState(0),
    [edit, setEdit] = R.useState(null),
    [amount, setAmount] = R.useState("60"),
    [error, setError] = R.useState(""),
    [expanded, setExpanded] = R.useState({}),
    [recent, setRecent] = R.useState(() =>
      DDsearchStored("debug-day:search-recent", []),
    ),
    [pins, setPins] = R.useState(() =>
      DDsearchStored("debug-day:search-pins", ["cmd-map"]),
    );
  const input = R.useRef(null),
    opener = R.useRef(null);
  R.useEffect(() => {
    opener.current = document.activeElement;
    input.current?.focus();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
      if (opener.current?.isConnected) opener.current.focus();
    };
  }, []);
  const indexed = R.useMemo(
    () =>
      DDbuildSearchIndex(
        {
          ...data,
          days: { ...data.days, [date]: data.days[date] || selectedDay },
        },
        today,
      ),
    [data, date, selectedDay, today],
  );
  const commandRows = commands.map((command) => {
    const names = command.names ||
        DDcommandNames[command.id] || [command.title, command.title],
      lane = command.id.startsWith("lane-")
        ? data.setup.lanes.find((l) => command.id === "lane-" + l.id)
        : null;
    return {
      ...command,
      kind: "command",
      title: lane
        ? t("Isolate lane: ", "فقط بخش: ") + lane.name
        : names[fa ? 1 : 0],
      detail: command.panel ? command.subtitle : lane ? "@" + lane.id : "",
      group: command.panel
        ? "panels"
        : command.id === "cmd-iso-clear"
          ? "actions"
          : "goto",
      searchText: DDsearchText(
        [
          command.id,
          command.title,
          command.subtitle,
          ...names,
          command.words,
          lane?.name,
          lane?.id,
        ].join(" "),
      ),
    };
  });
  const query = R.useMemo(() => DDparseSearch(raw, today), [raw, today]),
    all = [...commandRows, ...indexed],
    matches = all.filter((row) => DDmatchSearch(row, query));
  const groups = [],
    panelLabel = t("Panels", "پنل‌ها");
  if (!raw.trim()) {
    // First page: every panel, one tap to isolate it. Panels are not repeated below.
    const byId = new Map(all.map((row) => [row.id, row])),
      notPanel = (row) => row && !row.panel;
    groups.push({
      id: "panels",
      label: panelLabel,
      rows: commandRows.filter((row) => row.panel),
    });
    groups.push({
      id: "recent",
      label: t("Recent items", "موارد اخیر"),
      rows: recent.map((id) => byId.get(id)).filter(notPanel),
    });
    groups.push({
      id: "pinned",
      label: t("Pinned commands", "دستورهای سنجاق‌شده"),
      rows: pins.map((id) => byId.get(id)).filter(notPanel),
    });
  }
  const labels = {
    panels: panelLabel,
    actions: t("Actions", "عملیات"),
    goto: t("Go to / Isolate", "رفتن به / ایزوله"),
    today: t("Today's tasks", "کارهای امروز"),
    other: t("Other days", "روزهای دیگر"),
    feelings: t("Feelings & issues", "احساسات و مسائل"),
    notes: t("Notes & ideas", "یادداشت‌ها و ایده‌ها"),
    life: t("Life · shared across days", "زندگی · مشترک بین روزها"),
  };
  const order =
    raw.trim() && !query.commandsOnly
      ? ["panels", "today", "other", "feelings", "notes", "life", "actions", "goto"]
      : Object.keys(labels).filter((id) => raw.trim() || id !== "panels");
  // On the first page, a row shown in Panels, Recent or Pinned is not listed again.
  const shown = new Set(
    raw.trim() ? [] : groups.flatMap((group) => group.rows.map((row) => row.id)),
  );
  for (const id of order) {
    const label = labels[id];
    const rows = matches.filter(
      (row) => row.group === id && !shown.has(row.id),
    );
    groups.push({ id, label, rows: id === "panels" ? DDrankPanels(rows, query) : rows });
  }
  const visibleGroups = groups
      .filter((group) => group.rows.length)
      .map((group) => ({
        ...group,
        visible:
          group.id === "panels"
            ? group.rows
            : group.rows.slice(0, expanded[group.id] || 5),
      })),
    flat = visibleGroups.flatMap((group) =>
      group.visible.map((row) => ({ ...row, groupKey: group.id })),
    ),
    selected = flat[Math.min(active, flat.length - 1)];
  R.useEffect(() => {
    setActive(0);
    setExpanded({});
    setMenu(null);
    setEdit(null);
    setError("");
  }, [raw]);
  R.useEffect(() => {
    if (active >= flat.length) setActive(Math.max(0, flat.length - 1));
  }, [flat.length, active]);
  R.useEffect(() => {
    document
      .getElementById("dd-result-" + active)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);
  R.useEffect(() => {
    if (menu && !edit)
      input.current
        ?.closest(".dd-command-modal")
        ?.querySelectorAll("[role=menuitem]")
        [menuIndex]?.focus();
    else if (!menu) input.current?.focus();
  }, [menu, menuIndex, edit]);
  function remember(row) {
    const next = [row.id, ...recent.filter((id) => id !== row.id)].slice(0, 12);
    setRecent(next);
    DDrememberSearch("debug-day:search-recent", next);
  }
  function run(row, mode) {
    if (!row) return;
    remember(row);
    if (row.kind === "command") row.action();
    else onOpen(row, mode);
    onClose();
  }
  function isolate() {
    if (
      !raw.trim() ||
      query.commandsOnly ||
      !matches.some((row) => row.kind !== "command")
    )
      return;
    onIsolate(raw);
    onClose();
  }
  function change(row, action, value) {
    setData((previous) =>
      {
        const next=DDeditSearchResult(previous,row,action,value,ensureDay);
        if(row.kind==="life"&&next!==previous){const state=DDlifeState(previous.setup);DDlifeHistory.past.push({day:null,life:state,bytes:JSON.stringify(state).length});DDlifeHistory.past=DDlifeHistory.past.slice(-50);DDlifeHistory.future=[];}
        return next;
      },
    );
    setMenu(null);
    setEdit(null);
    setError("");
  }
  function actionList(row) {
    const list = [
      { key: "open", label: t("Open", "باز کردن"), run: () => run(row) },
    ];
    if (row.kind === "command") {
      if (row.panel?.isolate) list[0].label = t("Isolate", "ایزوله کردن");
      if (row.showWithRest)
        list.push({
          key: "rest",
          label: t("Show with the rest", "با بقیه ببین"),
          run: () => {
            remember(row);
            row.showWithRest();
            onClose();
          },
        });
      return list;
    }
    list.push({
      key: "isolate",
      label: t("Isolate", "ایزوله کردن"),
      run: () => run(row, "isolate"),
    });
    if (
      [
        "block",
        "subtask",
        "bug",
        "feedback",
        "thread",
        "worry",
        "later",
      ].includes(row.kind)
    )
      list.push({
        key: "done",
        label: row.done
          ? t("Mark open", "باز کردن دوباره")
          : t("Mark done", "انجام شد"),
        run: () => change(row, "done"),
      });
    if (["block", "subtask", "note", "later", "life"].includes(row.kind))
      list.push({
        key: "move",
        label: t("Move to tomorrow", "انتقال به فردا"),
        run: () => change(row, "move", DDshiftDate(today, 1)),
      });
    if (["block", "subtask", "later"].includes(row.kind))
      list.push({
        key: "focus",
        label:
          data.days[row.date || today]?.pause?.active ||
          data.days[row.date || today]?.pause?.closed
            ? t("Continue the day", "ادامهٔ روز")
            : t("Start focus timer", "شروع زمان‌سنج تمرکز"),
        run: () => {
          remember(row);
          onFocus(row);
          onClose();
        },
      });
    if (["block", "subtask", "bug", "later"].includes(row.kind))
      list.push({
        key: "category",
        label: t("Change category", "تغییر دسته"),
        run: () => setEdit("category"),
      });
    if (["block", "subtask", "later"].includes(row.kind))
      list.push({
        key: "duration",
        label: t("Change duration", "تغییر مدت"),
        run: () => {
          setAmount("60");
          setEdit("duration");
        },
      });
    if (["block", "subtask", "note", "bug"].includes(row.kind))
      list.push({
        key: "board",
        label: t("Open on board", "باز کردن روی برد"),
        run: () => run(row, "board"),
      });
    list.push({
      key: "delete",
      label: t("Delete…", "حذف…"),
      run: () => setEdit("delete"),
    });
    return list;
  }
  const menuActions = menu ? actionList(menu) : [];
  function trapTab(event) {
    if (event.key !== "Tab") return;
    const modal = event.currentTarget;
    const nodes = [
      ...modal.querySelectorAll('button,input,select,textarea,[tabindex="0"]'),
    ].filter(
      (node) =>
        !node.disabled && node.tabIndex >= 0 && node.getClientRects().length,
    );
    const next = event.shiftKey ? nodes.at(-1) : nodes[0];
    if (
      (event.shiftKey && event.target === nodes[0]) ||
      (!event.shiftKey && event.target === nodes.at(-1))
    ) {
      event.preventDefault();
      next?.focus();
    }
  }
  function key(event) {
    if (event.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (edit) setEdit(null);
      else if (menu) {
        setMenu(null);
        input.current?.focus();
      } else onClose();
      return;
    }
    if (event.target.closest("[data-dd-editor]")) {
      trapTab(event);
      return;
    }
    // Native buttons keep their Enter/Space behavior. Result navigation belongs
    // to the search input and action menu, not every control in the dialog.
    if (
      event.target !== input.current &&
      !event.target.closest('[role="menuitem"]')
    ) {
      trapTab(event);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      if (menu)
        setMenuIndex(
          (n) => (n + delta + menuActions.length) % menuActions.length,
        );
      else
        setActive((n) =>
          flat.length ? (n + delta + flat.length) % flat.length : 0,
        );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (menu) menuActions[menuIndex]?.run();
      else if (event.shiftKey) isolate();
      else run(selected);
      return;
    }
    if (
      (event.key === "Tab" || event.key === "ArrowRight") &&
      !event.shiftKey &&
      !menu &&
      selected
    ) {
      event.preventDefault();
      event.stopPropagation();
      setMenu(selected);
      setMenuIndex(0);
      return;
    }
    if (event.key === "Tab" && menu) {
      event.preventDefault();
      setMenuIndex(
        (n) =>
          (n + (event.shiftKey ? -1 : 1) + menuActions.length) %
          menuActions.length,
      );
      return;
    }
    if (event.key === "ArrowLeft" && menu) {
      event.preventDefault();
      setMenu(null);
      input.current?.focus();
    }
    trapTab(event);
  }
  function chip(prefix) {
    setRaw((value) =>
      prefix === ">"
        ? "> " + value.trim().replace(/^>\s*/, "")
        : (value.trim() ? value.trim() + " " : "") + prefix,
    );
    input.current?.focus();
  }
  function create(kind, targetDate) {
    try {
      // Parse before entering React's updater so invalid input can stay in the
      // dialog with an error, even when React evaluates updates later.
      const task =
        kind === "task"
          ? parseQuick(
              DDsearchDigits(raw),
              data.days[targetDate] || ensureDay(targetDate),
            )
          : null;
      if (kind === "task" && !task)
        throw Error(t("Enter a task name", "نام کار را بنویس"));
      setData((previous) => {
        const next = structuredClone(previous);
        if (kind === "task") {
          const day =
            next.days[targetDate] ||
            (next.days[targetDate] = structuredClone(ensureDay(targetDate)));
          day.blocks.push(structuredClone(task));
        }
        if (kind === "feeling") {
          const day =
            next.days[today] ||
            (next.days[today] = structuredClone(ensureDay(today)));
          day.bugs.push({
            id: crypto.randomUUID(),
            text: raw.trim(),
            type: "",
            on: "",
            fixed: false,
            category: "inner",
            triggerTag: "",
            antidote: "",
          });
        }
        if (kind === "idea") {
          next.setup.feedbacks ||= [];
          next.setup.feedbacks.unshift({
            id: crypto.randomUUID(),
            text: raw.trim(),
            kind: "future_change",
            emoji: "💡",
            priority: "normal",
            done: false,
            createdAt: today,
            thread: [],
          });
        }
        return next;
      });
      onClose();
    } catch (e) {
      setError(e.message);
    }
  }
  const noItems = !matches.some((row) => row.kind !== "command"),
    canCreate =
      raw.trim() &&
      !query.commandsOnly &&
      !query.invalidDate &&
      query.terms.length > 0 &&
      noItems;
  function rowView(row, index) {
    const isCommand = row.kind === "command",
      panel = row.panel,
      pinned = pins.includes(row.id);
    return h(
      "div",
      {
        key: row.groupKey + row.id,
        id: "dd-result-" + index,
        role: "option",
        "aria-selected": active === index,
        className:
          "dd-command-row" +
          (panel ? " dd-panel-row" : "") +
          (active === index ? " active" : ""),
        "data-panel": panel?.id,
        dir: "auto",
        onMouseEnter: () => setActive(index),
      },
      h(
        "button",
        {
          type: "button",
          className: "dd-command-open",
          tabIndex: -1,
          onClick: () => run(row),
        },
        panel
          ? h(
              "span",
              { className: "dd-result-symbol dd-panel-icon", "aria-hidden": true },
              panel.icon,
            )
          : h(
              "span",
              { className: "dd-result-symbol", "aria-hidden": true },
              isCommand
                ? "⌘"
                : row.kind === "subtask"
                  ? "↳"
                  : row.done
                    ? "✓"
                    : "·",
            ),
        h(
          "span",
          { className: "dd-result-body" },
          h("strong", { dir: "auto" }, row.title),
          row.detail && h("small", { dir: "auto" }, row.detail),
        ),
        h(
          "span",
          { className: "dd-default-action" },
          panel
            ? panel.isolate
              ? t("↵ Isolate", "↵ ایزوله")
              : t("↵ Open", "↵ باز کردن")
            : row.id === "cmd-iso-clear"
              ? t("↵ Show", "↵ نمایش")
              : isCommand &&
                  (row.id.includes("iso") || row.id.startsWith("lane-"))
                ? t("↵ Isolate", "↵ ایزوله")
                : t("↵ Open", "↵ باز کردن"),
        ),
      ),
      isCommand &&
        !panel &&
        h(
          "button",
          {
            type: "button",
            className: "dd-pin",
            tabIndex: -1,
            "aria-label": pinned
              ? t("Unpin command", "برداشتن سنجاق")
              : t("Pin command", "سنجاق کردن دستور"),
            "aria-pressed": pinned,
            onClick: () => {
              const next = pinned
                ? pins.filter((id) => id !== row.id)
                : [...pins, row.id];
              setPins(next);
              DDrememberSearch("debug-day:search-pins", next);
            },
          },
          pinned ? "★" : "☆",
        ),
      h(
        "button",
        {
          type: "button",
          className: "dd-result-more",
          "aria-label": t("Actions for ", "عملیات برای ") + row.title,
          onClick: () => {
            setActive(index);
            setMenu(row);
            setMenuIndex(0);
          },
        },
        "⋯",
      ),
    );
  }
  let runningIndex = 0;
  return h(
    "div",
    {
      className: "cmd-backdrop dd-command-backdrop",
      role: "dialog",
      "aria-modal": true,
      "aria-label": t("Search and commands", "جست‌وجو و دستورها"),
      dir: fa ? "rtl" : "ltr",
      onClick: onClose,
    },
    h(
      "div",
      {
        className: "cmd-modal dd-command-modal",
        onClick: (e) => e.stopPropagation(),
        onKeyDown: key,
      },
      h(
        "div",
        { className: "cmd-input-row" },
        h("input", {
          ref: input,
          role: "combobox",
          "aria-expanded": true,
          "aria-controls": "dd-command-results",
          "aria-activedescendant": flat.length
            ? "dd-result-" + Math.min(active, flat.length - 1)
            : undefined,
          "aria-label": t("Search everything", "جست‌وجوی همه‌چیز"),
          dir: "auto",
          value: raw,
          onChange: (e) => setRaw(e.target.value),
          placeholder: t(
            "Find anything, or do something…",
            "چیزی پیدا کن یا کاری انجام بده…",
          ),
        }),
        h(
          "button",
          {
            type: "button",
            className: "dd-command-close",
            "aria-label": t("Close search", "بستن جست‌وجو"),
            onClick: onClose,
          },
          "×",
        ),
      ),
      h(
        "div",
        { className: "dd-search-chips" },
        [
          [">", t("Actions", "دستورها")],
          ["#", t("Category / tag", "دسته / برچسب")],
          ["@", t("Lane", "بخش")],
          ["!", t("Priority", "اولویت")],
          ["date:", t("Date", "تاریخ")],
          ["is:open", t("Open", "باز")],
          ["is:done", t("Done", "انجام‌شده")],
        ].map(([prefix, label]) =>
          h(
            "button",
            { type: "button", key: prefix, onClick: () => chip(prefix) },
            h("bdi", null, prefix),
            " ",
            label,
          ),
        ),
      ),
      /(?:^|\s)#\S*$/.test(raw) &&
        h(
          "div",
          { className: "dd-search-suggestions" },
          data.setup.types.map((type) =>
            h(
              "button",
              {
                type: "button",
                key: type.id,
                onClick: () =>
                  setRaw(raw.replace(/#\S*$/, "#" + type.id + " ")),
              },
              type.name,
            ),
          ),
        ),
      /(?:^|\s)@\S*$/.test(raw) &&
        h(
          "div",
          { className: "dd-search-suggestions" },
          data.setup.lanes.map((lane) =>
            h(
              "button",
              {
                type: "button",
                key: lane.id,
                onClick: () =>
                  setRaw(raw.replace(/@\S*$/, "@" + lane.id + " ")),
              },
              lane.name,
            ),
          ),
        ),
      /(?:^|\s)!$/.test(raw) &&
        h(
          "div",
          { className: "dd-search-suggestions" },
          [1, 2, 3].map((priority) =>
            h(
              "button",
              {
                type: "button",
                key: priority,
                onClick: () => setRaw(raw.replace(/!$/, "!" + priority + " ")),
              },
              "P" + priority,
            ),
          ),
        ),
      /date:\S*$/.test(raw) &&
        h(
          "div",
          { className: "dd-search-suggestions" },
          ["today", "tomorrow", "yesterday"].map((value) =>
            h(
              "button",
              {
                type: "button",
                key: value,
                onClick: () =>
                  setRaw(raw.replace(/date:\S*$/, "date:" + value + " ")),
              },
              t(
                value,
                { today: "امروز", tomorrow: "فردا", yesterday: "دیروز" }[value],
              ),
            ),
          ),
          h(
            "small",
            null,
            t("Gregorian or Jalali: YYYY-MM-DD", "شمسی یا میلادی: YYYY-MM-DD"),
          ),
        ),
      query.invalidDate &&
        h(
          "p",
          { role: "alert", className: "dd-search-error" },
          t(
            "That date is not valid. Use YYYY-MM-DD.",
            "این تاریخ معتبر نیست. از YYYY-MM-DD استفاده کن.",
          ),
        ),
      error && h("p", { role: "alert", className: "dd-search-error" }, error),
      h(
        "div",
        {
          className: "cmd-list",
          id: "dd-command-results",
          role: "listbox",
          "aria-label": t("Results", "نتیجه‌ها"),
        },
        visibleGroups.map((group) =>
          h(
            "section",
            {
              key: group.id,
              className: "dd-result-group",
              "data-group": group.id,
            },
            h(
              "h3",
              null,
              group.label,
              h("small", null, " " + group.rows.length),
            ),
            group.visible.map((row) =>
              rowView({ ...row, groupKey: group.id }, runningIndex++),
            ),
            group.rows.length > group.visible.length &&
              h(
                "button",
                {
                  type: "button",
                  className: "dd-show-more",
                  onClick: () =>
                    setExpanded((old) => ({
                      ...old,
                      [group.id]: (old[group.id] || 5) + 5,
                    })),
                },
                t("Show more", "نمایش بیشتر"),
              ),
          ),
        ),
        !flat.length &&
          h("p", { className: "empty" }, t("No matches", "نتیجه‌ای پیدا نشد")),
        canCreate &&
          h(
            "section",
            { className: "dd-quick-create" },
            h("h3", null, t("Capture this", "ثبت همین مورد")),
            h("p", { dir: "auto" }, raw),
            h(
              "button",
              { type: "button", onClick: () => create("task", today) },
              t("Add as a task today", "افزودن به کارهای امروز"),
            ),
            h(
              "button",
              {
                type: "button",
                onClick: () => create("task", DDshiftDate(today, 1)),
              },
              t("Add as a task tomorrow", "افزودن به کارهای فردا"),
            ),
            h(
              "button",
              { type: "button", onClick: () => create("feeling") },
              t("Log as a feeling", "ثبت به‌عنوان احساس"),
            ),
            h(
              "button",
              { type: "button", onClick: () => create("idea") },
              t("Add as an idea", "ثبت به‌عنوان ایده"),
            ),
          ),
      ),
      raw.trim() &&
        !query.commandsOnly &&
        matches.some((row) => row.kind !== "command") &&
        h(
          "button",
          { type: "button", className: "dd-isolate-matches", onClick: isolate },
          t("Show only these matches", "فقط همین نتیجه‌ها را نشان بده"),
        ),
      h(
        "footer",
        { className: "dd-command-legend" },
        h(
          "span",
          null,
          t(
            "↑↓ move · ↵ run · Tab actions · ⇧↵ isolate matches · Esc close",
            "↑↓ حرکت · ↵ اجرا · Tab عملیات · ⇧↵ ایزولهٔ نتیجه‌ها · Esc بستن",
          ),
        ),
      ),
      menu &&
        h(
          "div",
          {
            className: "dd-command-actions",
            role: "region",
            "aria-label": t("Item actions", "عملیات مورد"),
            dir: fa ? "rtl" : "ltr",
          },
          h(
            "div",
            { className: "dd-actions-title" },
            h("b", { dir: "auto" }, menu.title),
            h(
              "button",
              {
                type: "button",
                onClick: () => {
                  setMenu(null);
                  setEdit(null);
                },
              },
              t("Back", "بازگشت"),
            ),
          ),
          !edit &&
            h(
              "div",
              { role: "menu" },
              menuActions.map((action, i) =>
                h(
                  "button",
                  {
                    type: "button",
                    role: "menuitem",
                    key: action.key,
                    className: i === menuIndex ? "active" : "",
                    onMouseEnter: () => setMenuIndex(i),
                    onClick: action.run,
                  },
                  action.label,
                ),
              ),
            ),
          edit === "category" &&
            h(
              "div",
              { "data-dd-editor": true },
              (menu.kind === "bug"
                ? [
                    { id: "inner", name: t("Inner", "درونی") },
                    { id: "plan", name: t("Planning", "برنامه") },
                    { id: "creative", name: t("Creative", "خلاقیت") },
                    { id: "energy", name: t("Energy", "انرژی") },
                  ]
                : data.setup.types
              ).map((type) =>
                h(
                  "button",
                  {
                    type: "button",
                    key: type.id,
                    onClick: () => change(menu, "category", type.id),
                  },
                  type.name,
                ),
              ),
            ),
          edit === "duration" &&
            h(
              "form",
              {
                "data-dd-editor": true,
                onSubmit: (e) => {
                  e.preventDefault();
                  if (
                    !/^\d+$/.test(DDsearchDigits(amount)) ||
                    +DDsearchDigits(amount) < 15 ||
                    +DDsearchDigits(amount) > 720
                  ) {
                    setError(
                      t(
                        "Use 15–720 minutes",
                        "مدت باید بین ۱۵ تا ۷۲۰ دقیقه باشد",
                      ),
                    );
                    return;
                  }
                  change(menu, "duration", +DDsearchDigits(amount));
                },
              },
              h(
                "label",
                null,
                t("Minutes (15–720)", "دقیقه (۱۵ تا ۷۲۰)"),
                h("input", {
                  autoFocus: true,
                  inputMode: "numeric",
                  value: amount,
                  onChange: (e) => setAmount(e.target.value),
                  "aria-label": t("Minutes", "دقیقه"),
                }),
              ),
              h("button", { type: "submit" }, t("Save duration", "ذخیرهٔ مدت")),
            ),
          edit === "delete" &&
            h(
              "div",
              {
                "data-dd-editor": true,
                role: "alertdialog",
                "aria-label": t("Confirm deletion", "تأیید حذف"),
              },
              h("p", null, t("Delete this item?", "این مورد حذف شود؟")),
              h(
                "button",
                {
                  type: "button",
                  className: "danger",
                  onClick: () => change(menu, "delete"),
                },
                t("Delete item", "حذف مورد"),
              ),
              h(
                "button",
                { type: "button", onClick: () => setEdit(null) },
                t("Cancel", "لغو"),
              ),
            ),
        ),
    ),
  );
}
export function DDSearchIsolation({
  React: R,
  data,
  query,
  ids,
  today,
  language,
  onOpen,
}) {
  const h = R.createElement,
    [limit, setLimit] = R.useState(20),
    fa = language === "fa",
    rows = R.useMemo(
      () =>
        DDbuildSearchIndex(data, today).filter((row) =>
          ids
            ? ids.includes(row.id)
            : DDmatchSearch(row, DDparseSearch(query, today)),
        ),
      [data, query, ids, today],
    );
  return h(
    "section",
    {
      className: "dd-search-isolation",
      dir: fa ? "rtl" : "ltr",
      "aria-label": fa ? "نتیجه‌های ایزوله‌شده" : "Isolated search results",
    },
    h(
      "h3",
      null,
      fa ? "نتیجه‌ها در همهٔ روزها" : "Matches across all days",
      " · ",
      rows.length,
    ),
    rows.slice(0, limit).map((row) =>
      h(
        "button",
        {
          type: "button",
          key: row.id,
          dir: "auto",
          onClick: () => onOpen(row),
        },
        h("span", null, row.title),
        h("small", null, row.date || ""),
      ),
    ),
    rows.length > limit &&
      h(
        "button",
        { type: "button", onClick: () => setLimit((n) => n + 20) },
        fa ? "نمایش بیشتر" : "Show more",
      ),
  );
}
