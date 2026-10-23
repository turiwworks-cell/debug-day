import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DDreviewValidDate,
  DDreviewShift,
  DDreviewMonth,
  DDreviewParts,
  DDreviewDateLabel,
  DDreviewEmptyDay,
  DDreviewSummary,
  DDreviewReminders,
  DDreviewField,
  DDreviewSaveFeeling,
  DDreviewFeelingAction,
  DDreviewScheduleReminder,
  DDreviewSetReminderDone,
  DDreviewDraft,
} from "../public/day-review.js";
const date = "2026-10-23";
function fixture() {
  const day = DDreviewEmptyDay(date);
  day.blocks = [
    {
      id: "task",
      name: "Write",
      lane: "work",
      type: "creative",
      min: 60,
      done: false,
      subtasks: [{ id: "step", text: "Draft", done: false, children: [] }],
    },
  ];
  day.bugs = [
    {
      id: "feeling",
      text: "Rushed",
      type: "creative",
      category: "energy",
      triggerTag: "sleep",
      on: "An older task name",
      antidote: "Rest",
      fixed: true,
      color: "#7A5FF5",
    },
  ];
  day.canvas = {
    board4: {
      links: [
        { from: "bug:feeling", to: "b:task" },
        { from: "b:task", to: "day:" },
      ],
      layouts: {
        mindmap: {
          "bug:feeling": { x: 10, y: 20 },
          "b:task": { x: 30, y: 40 },
        },
      },
      overrides: { old: { from: "bug:feeling", to: "b:task" } },
      locked: ["bug:feeling", "b:task"],
      hidden: ["bug:feeling"],
      groups: { g: ["bug:feeling", "b:task"] },
    },
  };
  return {
    setup: {
      lanes: [{ id: "work" }],
      types: [{ id: "creative" }],
      reminders: [],
      worries: [],
    },
    days: { [date]: day },
  };
}
test("month navigation handles Gregorian leap years and Persian New Year without overflowing dates", () => {
  assert.equal(DDreviewValidDate("2026-02-30"), false);
  assert.equal(DDreviewValidDate("2024-02-29"), true);
  assert.equal(DDreviewValidDate("2026-2-03"), false);
  assert.equal(DDreviewValidDate("1899-12-31"), false);
  assert.equal(DDreviewShift("2024-02-29", 1), "2024-03-01");
  const february = DDreviewMonth("2024-02-29", "gregory", 1);
  assert.equal(february.length, 29);
  assert.equal(february.previous, "2024-01-31");
  assert.equal(february.next, "2024-03-01");
  assert.equal(february.cells.length, 42);
  assert.equal(new Date(february.cells[0].date + "T12:00:00Z").getUTCDay(), 1);
  for (const [last, length] of [
    ["2025-03-20", 30],
    ["2026-03-20", 29],
  ]) {
    const month = DDreviewMonth(last, "persian", 6);
    assert.equal(month.length, length);
    assert.equal(month.next, last.slice(0, 4) + "-03-21");
    assert.equal(month.cells.filter((cell) => cell.inMonth).length, length);
    assert.deepEqual(DDreviewParts(month.next, "persian"), {
      year: +last.slice(0, 4) - 621,
      month: 1,
      day: 1,
    });
  }
  assert.match(DDreviewDateLabel(date, "fa"), /^جمعه،/);
});
test("reading summaries and browsing calendar months never creates days or changes board data", () => {
  const data = fixture(),
    before = structuredClone(data);
  for (const current of [date, "2026-10-20", "2026-11-01"]) {
    DDreviewMonth(current, "persian");
    DDreviewSummary(data.days[current], data.setup);
  }
  assert.deepEqual(data, before);
  assert.equal(data.days["2026-10-20"], undefined);
  assert.deepEqual(DDreviewSummary(undefined, data.setup), {
    tasks: 0,
    completed: 0,
    plannedMinutes: 0,
    doneMinutes: 0,
    parked: 0,
    feelings: 0,
    openFeelings: 0,
    notes: 0,
  });
});
test("saving mood or a journal on an empty day creates only that day without template tasks", () => {
  const base = fixture(),
    other = "2026-10-20";
  const next = DDreviewField(
    DDreviewField(base, other, "journal", "A quiet day"),
    other,
    "mood",
    "🙂",
  );
  assert.deepEqual(next.days[other].blocks, []);
  assert.equal(next.days[other].journal, "A quiet day");
  assert.equal(next.days[other].mood, "🙂");
  assert.deepEqual(next.days[date], base.days[date]);
  assert.equal(base.days[other], undefined);
  for (const [target, field, value] of [
    ["2026-02-30", "mood", "🙂"],
    [other, "blocks", "oops"],
    [other, "journal", 4],
    [date, "focus", ""],
  ])
    assert.equal(DDreviewField(base, target, field, value), base);
});
test("editing an older feeling preserves its task context, colour, status, and board connections", () => {
  const base = fixture(),
    next = DDreviewSaveFeeling(base, {
      date,
      id: "feeling",
      text: "Less rushed now",
    });
  assert.equal(next.days[date].bugs[0].on, "An older task name");
  assert.equal(next.days[date].bugs[0].antidote, "Rest");
  assert.equal(next.days[date].bugs[0].category, "energy");
  assert.equal(next.days[date].bugs[0].fixed, true);
  assert.equal(next.days[date].bugs[0].color, "#7A5FF5");
  assert.deepEqual(next.days[date].canvas, base.days[date].canvas);
  assert.equal(base.days[date].bugs[0].text, "Rushed");
  const linked = DDreviewSaveFeeling(next, {
    date,
    id: "feeling",
    text: "Less rushed now",
    blockId: "task",
  });
  assert.equal(linked.days[date].bugs[0].blockId, "task");
  assert.equal(linked.days[date].bugs[0].on, "Write");
  assert.equal(
    DDreviewSaveFeeling(linked, {
      date,
      id: "feeling",
      text: "Better",
      blockId: "",
    }).days[date].bugs[0].on,
    "",
  );
});
test("a feeling is saved to its chosen day; stale edits and blank input never resurrect deleted entries", () => {
  const base = fixture(),
    other = "2026-10-20",
    next = DDreviewSaveFeeling(base, {
      date: other,
      text: "  Worried about tomorrow  ",
    });
  assert.equal(next.days[other].bugs[0].text, "Worried about tomorrow");
  assert.deepEqual(next.days[other].blocks, []);
  assert.deepEqual(next.days[date], base.days[date]);
  for (const change of [
    { date: other, id: "gone", text: "Resurrect" },
    { date: "2026-02-30", text: "Bad date" },
    { date, text: "  " },
    { date, text: 17 },
  ])
    assert.equal(DDreviewSaveFeeling(base, change), base);
  const concurrent = structuredClone(base);
  concurrent.days[date].journal = "Added elsewhere";
  assert.equal(
    DDreviewSaveFeeling(concurrent, { date, id: "feeling", text: "Updated" })
      .days[date].journal,
    "Added elsewhere",
  );
});
test("closing and deleting an entry affect only that entry and remove its obsolete references", () => {
  const base = fixture(),
    open = DDreviewFeelingAction(base, date, "feeling", "toggle");
  assert.equal(open.days[date].bugs[0].fixed, false);
  assert.equal(base.days[date].bugs[0].fixed, true);
  const removed = DDreviewFeelingAction(open, date, "feeling", "delete"),
    board = removed.days[date].canvas.board4;
  assert.equal(removed.days[date].bugs.length, 0);
  assert.deepEqual(board.links, [{ from: "b:task", to: "day:" }]);
  assert.deepEqual(board.layouts.mindmap, { "b:task": { x: 30, y: 40 } });
  assert.deepEqual(board.locked, ["b:task"]);
  assert.deepEqual(board.hidden, []);
  assert.deepEqual(board.groups, {});
  assert.deepEqual(board.overrides, {});
  assert.deepEqual(removed.days[date].blocks, base.days[date].blocks);
  assert.equal(
    DDreviewFeelingAction(removed, date, "feeling", "toggle"),
    removed,
  );
});
test("recurring reminders match only eligible days and scheduling is atomic and idempotent", () => {
  const base = fixture();
  base.setup.reminders = [
    {
      id: "weekly",
      date,
      title: "Call",
      repeat: "weekly",
      done: false,
      min: 45,
    },
  ];
  assert.equal(DDreviewReminders(base.setup.reminders, "2026-10-16").length, 0);
  assert.equal(DDreviewReminders(base.setup.reminders, "2026-10-24").length, 0);
  assert.equal(DDreviewReminders(base.setup.reminders, "2026-10-30").length, 1);
  const next = DDreviewScheduleReminder(
    base,
    "2026-10-30",
    "weekly",
    "call-task",
  );
  assert.equal(next.setup.reminders[0].done, false);
  assert.deepEqual(next.setup.reminders[0].completedDates, ["2026-10-30"]);
  assert.equal(
    DDreviewReminders(next.setup.reminders, "2026-10-30")[0].done,
    true,
  );
  assert.equal(
    DDreviewReminders(next.setup.reminders, "2026-11-06")[0].done,
    false,
  );
  assert.deepEqual(
    next.days["2026-10-30"].blocks.map((block) => block.id),
    ["call-task"],
  );
  assert.equal(next.days["2026-10-30"].blocks[0].min, 45);
  assert.equal(base.setup.reminders[0].done, false);
  assert.equal(
    DDreviewScheduleReminder(next, "2026-10-30", "weekly", "duplicate"),
    next,
  );
  const reopened = DDreviewSetReminderDone(next, "2026-10-30", "weekly", false);
  assert.equal(
    DDreviewReminders(reopened.setup.reminders, "2026-10-30")[0].done,
    false,
  );
  assert.equal(
    DDreviewSetReminderDone(reopened, "2026-10-30", "weekly", false),
    reopened,
  );
  assert.equal(DDreviewScheduleReminder(base, "2026-10-24", "weekly"), base);
  assert.equal(
    DDreviewReminders([{ date, repeat: "alternate" }], "2026-10-25").length,
    1,
  );
});
test("corrupt or partial local drafts recover as usable fields without losing valid text", () => {
  assert.deepEqual(DDreviewDraft(null), {
    text: "",
    category: "inner",
    blockId: undefined,
    antidote: "",
  });
  assert.equal(
    DDreviewDraft({ text: "Keep this", category: "nonsense", antidote: 33 })
      .text,
    "Keep this",
  );
  assert.equal(DDreviewDraft({ text: 33 }).text, "");
  assert.equal(
    DDreviewDraft({ category: "creative", blockId: "task" }).category,
    "creative",
  );
});
