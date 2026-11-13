// How a task looks (5.54): its section tag gives it its colour. Section tags
// replaced categories, so a task is no longer given a category; one with a
// section wears that section's colour (the same tint as its tag, the Feed and
// the Tab flowchart). A colour picked for the task itself still wins. Old tasks
// without a section keep the colour of the category they were saved with, so
// past days look the way they did. Nothing is removed from the saved data.
import { DDlifeItems, DDsectionTint, DDsectionPath } from "./life-board.js";

const PLAIN = { id: "", name: "", color: "#8E8A80", icon: "dot", emo: "" };

export function DDtaskLook(block, setup, items = DDlifeItems(setup)) {
  const tint = block?.from ? DDsectionTint(items, block.from) : null;
  if (tint) {
    const look = { id: block.type || "", name: DDsectionPath(items, block.from, 28).short, color: tint.fill, icon: "dot", emo: "", section: block.from };
    return block.color ? { ...look, color: block.color } : look;
  }
  const type = (setup?.types || []).find((t) => t.id === block?.type);
  const look = type ? { ...PLAIN, ...type, section: "" } : { ...PLAIN, id: block?.type || "", name: "Other", section: "" };
  return block?.color ? { ...look, color: block.color } : look;
}
