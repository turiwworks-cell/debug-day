// Light and heavy tasks (5.46). For an artist, how much energy a task takes
// matters more than how many minutes it takes. A task can be marked light or
// heavy (optional); on a low day the app points to the light ones.

export const DDenergyOf = (block) => (block?.energy === "light" || block?.energy === "heavy" ? block.energy : "");

export function DDsetEnergy(block, energy) {
  const { energy: _old, ...rest } = block || {};
  return energy === "light" || energy === "heavy" ? { ...rest, energy } : rest;
}

export function DDenergyLabel(energy, language) {
  const fa = language === "fa";
  return energy === "light" ? (fa ? "سبک" : "light") : energy === "heavy" ? (fa ? "سنگین" : "heavy") : "";
}

// The two tired faces in the mood picker (😫 😕).
export const DDlowMoods = ["\u{1F62B}", "\u{1F615}"];
export const DDlowDay = (day) => DDlowMoods.includes(day?.mood);

export function DDlightTasks(day) {
  return (day?.blocks || []).filter((b) => !b.done && DDenergyOf(b) === "light" && String(b.name || "").trim());
}

// Put the light tasks first, keeping the order inside each group.
export function DDlightFirst(day) {
  const blocks = day?.blocks || [], light = blocks.filter((b) => !b.done && DDenergyOf(b) === "light");
  return { ...day, blocks: [...light, ...blocks.filter((b) => !light.includes(b))] };
}

export const DDenergyCSS = `
.dd-energy{display:inline-flex;align-items:center;margin-inline-start:6px;padding:0 6px;border-radius:999px;font:500 10.5px/1.6 var(--sans,system-ui);color:var(--ink-3,#77746b);box-shadow:inset 0 0 0 1px var(--rule-2,#dcd9cf);vertical-align:middle;white-space:nowrap;letter-spacing:0}
.dd-energy[data-energy=heavy]{color:var(--ink-2,#4a4843);box-shadow:inset 0 0 0 1px var(--ink-3,#77746b)}
`;
if (typeof document !== "undefined" && !document.getElementById("dd-energy-styles"))
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-energy-styles", textContent: DDenergyCSS }));
