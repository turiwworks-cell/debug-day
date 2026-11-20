// MCP tools for what the app grew lately (5.79): notes as documents, to-do
// lists and text, deadlines, comments, reminders and habits. Each handler
// changes `data` in place and returns what changed; worker.js checks the
// revision first and saves after. Planner content stays untrusted user data.

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const validDay = (v) => typeof v === "string" && DAY.test(v) && new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v;
const CARD = /^(?:sticky|b|sub|bug|life):[A-Za-z0-9_:.-]+$/;

const daySchema = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" };
const dueSchema = { type: "string", pattern: "^(?:\\d{4}-\\d{2}-\\d{2})?$", description: "A deadline day (YYYY-MM-DD) shown as ◆ days left; an empty string clears it." };
const colorSchema = { type: "string", pattern: "^#[0-9a-fA-F]{6}$" };
const lookSchema = { type: "string", enum: ["note", "document", "todo", "text"], description: "How the note shows on the board: a sticky note, a document, a to-do list (one '- [ ] item' per line) or plain text with no paper." };
const pos = { type: "number", minimum: -100000, maximum: 100000 };
const str = { type: "string", maxLength: 80 };

// The look of a note lives in its style (board styles for a day note, item.style for a Feed note).
const LOOKS = { note: {}, document: { doc: true }, todo: { todo: true }, text: { plain: true } };
function withLook(style, look) {
  const next = { ...(style || {}) };
  for (const k of ["doc", "docView", "todo", "plain"]) delete next[k];
  return { ...next, ...LOOKS[look] };
}
const lookOf = (style) => (style?.doc ? "document" : style?.todo ? "todo" : style?.plain ? "text" : "note");

export function DDmcpMoreTools(tool, revisionSchema) {
  const w = (name, description, properties, required) => tool(name, description, { expected_revision: revisionSchema, ...properties }, ["expected_revision", ...required], true);
  return [
    w("update_note", "Edit a sticky note of a day: text, colour, place, role, deadline or look (note, document, to-do list, text). Read get_day first. Requires explicit user intent.", {
      date: daySchema, note_id: str, text: { type: "string", maxLength: 20000 }, color: colorSchema, x: pos, y: pos,
      role: { type: "string", enum: ["", "goal", "note"] }, due: dueSchema, look: lookSchema,
    }, ["date", "note_id"]),
    w("delete_note", "Delete a day's sticky note with its lines, comments and board place. Only after the user explicitly asks.", {
      date: daySchema, note_id: str, confirm: { type: "boolean", const: true },
    }, ["date", "note_id", "confirm"]),
    w("set_feed_note", "Set the deadline or look (note, document, to-do list, text) of a Feed (Life) note or section. Read get_life first. Requires explicit user intent.", {
      item_id: str, due: dueSchema, look: lookSchema,
    }, ["item_id"]),
    w("add_comment", "Comment on the board: on a card (on = 'sticky:<id>', 'b:<id>', 'sub:<task>:<step>' on a day; 'life:<id>' in the Feed) or at a free spot (x, y). Give date for a day's board, or feed:true for the Feed. Requires explicit user intent.", {
      date: daySchema, feed: { type: "boolean" }, on: { type: "string", maxLength: 200 }, x: pos, y: pos, parent: str,
      text: { type: "string", minLength: 1, maxLength: 2000 },
    }, ["text"]),
    w("update_comment", "Reply to a comment, resolve or reopen it, or delete it (delete:true, only when the user asks). Give date for a day's board, or feed:true.", {
      date: daySchema, feed: { type: "boolean" }, comment_id: str, reply: { type: "string", minLength: 1, maxLength: 2000 },
      done: { type: "boolean" }, delete: { type: "boolean" },
    }, ["comment_id"]),
    w("add_reminder", "Add a reminder for any day, near or far, once, every week or every other day. Read get_setup first. Requires explicit user intent.", {
      date: daySchema, title: { type: "string", minLength: 1, maxLength: 300 }, repeat: { type: "string", enum: ["once", "weekly", "alternate"] },
    }, ["date", "title"]),
    w("update_reminder", "Edit a reminder (setup.reminders): title, day, repeat, done for a day (date_done) or delete it (delete:true, only when asked).", {
      reminder_id: str, title: { type: "string", minLength: 1, maxLength: 300 }, date: daySchema,
      repeat: { type: "string", enum: ["once", "weekly", "alternate"] }, done: { type: "boolean" }, date_done: daySchema, delete: { type: "boolean" },
    }, ["reminder_id"]),
    w("add_habit", "Add a habit beside the board (Today's habits). Read get_setup first. Requires explicit user intent.", {
      name: { type: "string", minLength: 1, maxLength: 120 }, color: colorSchema, goal_minutes: { type: "integer", minimum: 5, maximum: 600 },
    }, ["name"]),
    w("update_habit", "Rename a habit, change its colour or daily goal, or remove it (remove:true, only when asked; past days keep their record).", {
      habit_id: str, name: { type: "string", minLength: 1, maxLength: 120 }, color: colorSchema, goal_minutes: { type: "integer", minimum: 5, maximum: 600 }, remove: { type: "boolean" },
    }, ["habit_id"]),
    w("log_habit", "Tick a habit for a day, with minutes if any (done:false clears it). The day must exist.", {
      date: daySchema, habit_id: str, done: { type: "boolean" }, minutes: { type: "integer", minimum: 0, maximum: 1440 },
    }, ["date", "habit_id", "done"]),
  ];
}

function needDay(data, date) {
  const day = data.days[date];
  if (!day) throw Error("Date not found. Use create_day first.");
  return day;
}
const board = (day) => {
  day.canvas = day.canvas && typeof day.canvas === "object" ? day.canvas : {};
  return (day.canvas.board4 = day.canvas.board4 && typeof day.canvas.board4 === "object" ? day.canvas.board4 : { version: 1 });
};
// The comments of a day's board, or of the Feed.
function commentsOf(data, args) {
  if (args.feed) {
    data.setup.life ||= {};
    return { list: (data.setup.life.comments ||= []), feed: true };
  }
  if (!args.date) throw Error("Give date or feed:true");
  return { list: (board(needDay(data, args.date)).comments ||= []), feed: false };
}
function tidyComments(data, args) {
  if (args.feed) { if (!data.setup.life.comments.length) delete data.setup.life.comments; }
  else { const b = board(data.days[args.date]); if (!b.comments.length) delete b.comments; }
}
// A note goes with everything that points at it.
function forget(day, ref) {
  const b = day.canvas?.board4;
  if (!b) return;
  b.links = (b.links || []).filter((l) => l.from !== ref && l.to !== ref);
  for (const positions of Object.values(b.layouts || {})) if (positions) delete positions[ref];
  if (b.styles) delete b.styles[ref];
  if (Array.isArray(b.stack)) b.stack = b.stack.filter((r) => r !== ref);
  for (const field of ["locked", "hidden"]) if (Array.isArray(b[field])) b[field] = b[field].filter((r) => r !== ref);
  for (const [k, refs] of Object.entries(b.groups || {})) { b.groups[k] = refs.filter((r) => r !== ref); if (b.groups[k].length < 2) delete b.groups[k]; }
  for (const [k, o] of Object.entries(b.overrides || {})) if (o?.from === ref || o?.to === ref) delete b.overrides[k];
  if (Array.isArray(b.comments)) { b.comments = b.comments.filter((c) => c.on !== ref); if (!b.comments.length) delete b.comments; }
}

// Returns undefined for a tool this module does not handle.
export function DDmcpMoreCall(name, args, data) {
  if (name === "update_note") {
    const day = needDay(data, args.date), note = (day.notes || []).find((n) => n.id === args.note_id);
    if (!note) throw Error("Note not found");
    const before = JSON.stringify([note, day.canvas?.board4?.styles?.["sticky:" + note.id]]);
    for (const k of ["text", "color", "x", "y"]) if (Object.hasOwn(args, k)) note[k] = args[k];
    if (Object.hasOwn(args, "role")) { if (args.role) note.role = args.role; else delete note.role; }
    if (Object.hasOwn(args, "due")) { if (validDay(args.due)) note.due = args.due; else delete note.due; }
    if (args.look) { const b = board(day); b.styles ||= {}; b.styles["sticky:" + note.id] = withLook(b.styles["sticky:" + note.id], args.look); }
    const changed = JSON.stringify([note, day.canvas?.board4?.styles?.["sticky:" + note.id]]) !== before;
    return { id: note.id, day: args.date, changed, look: lookOf(day.canvas?.board4?.styles?.["sticky:" + note.id]) };
  }
  if (name === "delete_note") {
    const day = needDay(data, args.date);
    if (!(day.notes || []).some((n) => n.id === args.note_id)) throw Error("Note not found");
    day.notes = day.notes.filter((n) => n.id !== args.note_id);
    forget(day, "sticky:" + args.note_id);
    return { id: args.note_id, day: args.date, changed: true };
  }
  if (name === "set_feed_note") {
    const items = data.setup.life?.items || [], item = items.find((i) => i.id === args.item_id);
    if (!item) throw Error("Life item not found");
    const before = JSON.stringify(item);
    if (Object.hasOwn(args, "due")) { if (validDay(args.due)) item.due = args.due; else delete item.due; }
    if (args.look) { if (item.type !== "sticky") throw Error("Only a note has a look"); item.style = withLook(item.style, args.look); }
    return { id: item.id, changed: JSON.stringify(item) !== before, look: lookOf(item.style) };
  }
  if (name === "add_comment") {
    const { list, feed } = commentsOf(data, args), message = { id: "m-" + id(), text: args.text.trim(), at: now() };
    let anchor;
    if (args.on) {
      if (!CARD.test(args.on) || (feed && !args.on.startsWith("life:")) || (!feed && args.on.startsWith("life:"))) throw Error("Invalid card for on");
      anchor = { on: args.on, fx: 0.92, fy: 0.08 };
    } else {
      if (!Number.isFinite(args.x) || !Number.isFinite(args.y)) throw Error("Give on (a card) or x and y");
      anchor = feed ? { parent: args.parent || "", x: args.x, y: args.y } : { x: args.x, y: args.y };
    }
    const comment = { id: "c-" + id(), ...anchor, thread: [message] };
    list.push(comment);
    return { id: comment.id, changed: true };
  }
  if (name === "update_comment") {
    const { list } = commentsOf(data, args), c = list.find((x) => x.id === args.comment_id);
    if (!c) throw Error("Comment not found");
    if (args.delete) {
      const at = list.indexOf(c); list.splice(at, 1); tidyComments(data, args);
      return { id: c.id, changed: true, deleted: true };
    }
    if (!Object.hasOwn(args, "reply") && !Object.hasOwn(args, "done")) throw Error("Provide reply, done or delete");
    const before = JSON.stringify(c);
    if (args.reply) c.thread = [...(c.thread || []), { id: "m-" + id(), text: args.reply.trim(), at: now() }];
    if (Object.hasOwn(args, "done")) { if (args.done) c.done = true; else delete c.done; }
    return { id: c.id, changed: JSON.stringify(c) !== before };
  }
  if (name === "add_reminder") {
    data.setup.reminders ||= [];
    const item = { id: id(), date: args.date, title: args.title.trim(), repeat: args.repeat || "once", done: false,
      type: data.setup.types?.[0]?.id || "other", lane: data.setup.lanes?.[0]?.id || "", min: 0, note: "" };
    data.setup.reminders.unshift(item);
    return { id: item.id, changed: true };
  }
  if (name === "update_reminder") {
    const list = data.setup.reminders || [], item = list.find((r) => r.id === args.reminder_id);
    if (!item) throw Error("Reminder not found");
    if (args.delete) { data.setup.reminders = list.filter((r) => r !== item); return { id: item.id, changed: true, deleted: true }; }
    const before = JSON.stringify(item);
    if (args.title) item.title = args.title.trim();
    if (args.date) item.date = args.date;
    if (args.repeat) item.repeat = args.repeat;
    if (Object.hasOwn(args, "done")) {
      // A repeating reminder is done one day at a time, like in the Calendar.
      if (item.repeat === "once") item.done = args.done;
      else {
        if (!args.date_done) throw Error("A repeating reminder needs date_done");
        const dates = new Set(item.completedDates || []);
        if (args.done) dates.add(args.date_done); else dates.delete(args.date_done);
        item.completedDates = [...dates].sort();
      }
    }
    return { id: item.id, changed: JSON.stringify(item) !== before };
  }
  if (name === "add_habit") {
    data.setup.habits ||= [];
    if (data.setup.habits.length >= 40) throw Error("Too many habits");
    const palette = ["#E2683C", "#3C8DE2", "#4FA36B", "#B05FD1", "#D9A52B", "#D1557F"];
    const habit = { id: "h" + id().slice(0, 8), name: args.name.trim(), emo: "", color: args.color || palette[data.setup.habits.length % palette.length], ...(args.goal_minutes ? { goal: args.goal_minutes } : {}) };
    data.setup.habits.push(habit);
    return { id: habit.id, changed: true };
  }
  if (name === "update_habit") {
    const list = data.setup.habits || [], habit = list.find((h) => h.id === args.habit_id);
    if (!habit) throw Error("Habit not found");
    if (args.remove) { data.setup.habits = list.filter((h) => h !== habit); return { id: habit.id, changed: true, removed: true }; }
    const before = JSON.stringify(habit);
    if (args.name) habit.name = args.name.trim();
    if (args.color) habit.color = args.color;
    if (args.goal_minutes) habit.goal = args.goal_minutes;
    return { id: habit.id, changed: JSON.stringify(habit) !== before };
  }
  if (name === "log_habit") {
    const day = needDay(data, args.date);
    if (!(data.setup.habits || []).some((h) => h.id === args.habit_id)) throw Error("Habit not found");
    const before = JSON.stringify(day.habits?.[args.habit_id] || null);
    day.habits = day.habits && typeof day.habits === "object" ? day.habits : {};
    if (!args.done && !args.minutes) delete day.habits[args.habit_id];
    else day.habits[args.habit_id] = { done: !!args.done, ...(args.minutes ? { min: args.minutes } : {}) };
    return { id: args.habit_id, day: args.date, changed: JSON.stringify(day.habits[args.habit_id] || null) !== before };
  }
  return undefined;
}
