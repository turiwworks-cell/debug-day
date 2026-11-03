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
    "Pull this reminder into this day's Plan as a block": "Pull this reminder into this day's Plan as a task",
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
  },
};

export function DDword(text, language) {
  return DDwords[language === "fa" ? "fa" : "en"][text];
}
