// One word for each thing (5.43). A piece of work is a Task, the parts of a
// task are Steps. The timer is Focus, and "Life happened" is Pause the day.
// DDUI reads these first, so an old label that still passes through DDUI
// comes out in the new words. See DESIGN.md › Words.
export const DDwords = {
  en: {
    "Add block": "Add task",
    "New block": "New task",
    "Block": "Task",
    "Block name": "Task name",
    "Delete block": "Delete task",
    "Isolate Block": "Isolate task",
    "Edit block & iPhone Emoji": "Edit task & emoji",
    "Edit block and emoji": "Edit task and emoji",
    "Untitled Block": "Untitled task",
    "Find a block": "Find a task",
    "Find a block or sub-node": "Find a task or step",
    "+ Sub-node": "+ Step",
    "↗ Block": "↗ Task",
    "+ Node": "Add",
    "Nodes": "Steps",
    "nodes": "steps",
    "Sub-step": "Step",
    "Sub-step text": "Step text",
    "Time block tool": "Task tool",
    "Smart Calendar · Drag blocks or reminders between days": "Calendar · drag tasks or reminders between days",
    "Pull this reminder into this day's Plan as a block": "Pull this reminder into this day's Engine as a task",
    // Plan became part of the Engine (5.50).
    "+ Pull into Plan": "+ Pull into the Engine",
    "+ Pull into today\u2019s Plan": "+ Pull into today\u2019s Engine",
    "Click cell to preview \xB7 Double-click to open Plan": "Click a day to preview \xB7 double-click to open the Engine",
    "Open Day in Plan \u203A": "Open the day in the Engine \u203A",
    "Open Full Day in Plan \u203A": "Open the full day in the Engine \u203A",
    "No blocks or reminders on this date yet. Add a reminder above, drag blocks from another date, or click \u201COpen Full Day in Plan\u201D.": "No tasks or reminders on this day yet. Add a reminder above, drag tasks from another day, or open the full day in the Engine.",

    "Drag to move block to another date": "Drag to move the task to another day",
    "Friction by block type": "Friction by kind of task",
    "Stillness": "Focus",
    "Life happened": "Pause the day",
  },
  fa: {
    "Add block": "افزودن کار",
    "New block": "کار جدید",
    "Block": "کار",
    "Block name": "نام کار",
    "Delete block": "حذف کار",
    "Isolate Block": "فقط همین کار",
    "Edit block & iPhone Emoji": "ویرایش کار و ایموجی",
    "Edit block and emoji": "ویرایش کار و ایموجی",
    "Untitled Block": "کار بی‌نام",
    "Find a block": "پیدا کردن کار",
    "Find a block or sub-node": "پیدا کردن کار یا قدم",
    "+ Sub-node": "+ قدم",
    "↗ Block": "↗ کار",
    "+ Node": "افزودن",
    "Nodes": "قدم‌ها",
    "nodes": "قدم",
    "Sub-step": "قدم",
    "Sub-step text": "متن قدم",
    "Time block tool": "ابزار کار",
    "Life happened": "روز را نگه دار",
    "+ Pull into Plan": "+ آوردن به انجین",
    "+ Pull into today\u2019s Plan": "+ آوردن به انجین امروز",
    "Click cell to preview \xB7 Double-click to open Plan": "برای پیش‌نمایش روی روز بزن \xB7 با دوبار زدن انجین باز می‌شود",
    "Open Day in Plan \u203A": "باز کردن روز در انجین \u203A",
    "Open Full Day in Plan \u203A": "باز کردن کل روز در انجین \u203A",
    "Pull this reminder into this day's Plan as a block": "این یادآور را به‌عنوان کار به انجین این روز بیاور",
    "No blocks or reminders on this date yet. Add a reminder above, drag blocks from another date, or click \u201COpen Full Day in Plan\u201D.": "هنوز کار یا یادآوری برای این روز نیست. بالا یادآور اضافه کن، کاری را از روز دیگر بکش یا کل روز را در انجین باز کن.",
  },
};

export function DDword(text, language) {
  return DDwords[language === "fa" ? "fa" : "en"][text];
}
