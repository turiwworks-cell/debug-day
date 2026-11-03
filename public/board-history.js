// Undo takes back one action and nothing else.
// An undo step keeps the state before the action and right after it. Undo puts
// back only what that action changed, so a note that arrived from the phone (or
// any change made since) stays as it is.
const MISSING = Symbol("missing");
const same = (a, b) => a === b || (a !== MISSING && b !== MISSING && JSON.stringify(a) === JSON.stringify(b));
const plain = (v) => v && typeof v === "object" && !Array.isArray(v);
const keyed = (...lists) => lists.every((l) => l === MISSING || (Array.isArray(l) && l.every((x) => plain(x) && typeof x.id === "string")));

function revert(cur, after, before) {
  if (same(after, before)) return cur; // the action did not touch this
  if (same(cur, after)) return before; // nothing else touched it since
  if (cur === MISSING || after === MISSING || before === MISSING) return before;
  if (plain(cur) && plain(after) && plain(before)) {
    const out = { ...cur };
    for (const k of new Set([...Object.keys(after), ...Object.keys(before)])) {
      const v = revert(k in cur ? cur[k] : MISSING, k in after ? after[k] : MISSING, k in before ? before[k] : MISSING);
      if (v === MISSING) delete out[k];
      else out[k] = v;
    }
    return out;
  }
  if (Array.isArray(cur) && Array.isArray(after) && Array.isArray(before) && keyed(cur, after, before)) return revertList(cur, after, before);
  return before; // both changed the same value: the undo wins, as before
}

function revertList(cur, after, before) {
  const byId = (l) => new Map(l.map((x) => [x.id, x])), C = byId(cur), A = byId(after), B = byId(before);
  const order = (l, keep) => l.map((x) => x.id).filter((id) => keep.has(id));
  const common = new Set([...A.keys()].filter((id) => B.has(id)));
  const moved = order(after, common).join("\n") !== order(before, common).join("\n");
  let ids;
  if (moved) {
    // The action reordered things (front / back): bring back the old order.
    ids = before.map((x) => x.id).filter((id) => C.has(id) || !A.has(id));
    for (const x of cur) if (!B.has(x.id) && !A.has(x.id)) ids.push(x.id);
  } else {
    ids = cur.map((x) => x.id).filter((id) => B.has(id) || !A.has(id));
    // What the action removed goes back next to what stood before it.
    before.forEach((x, i) => {
      if (A.has(x.id) || ids.includes(x.id)) return;
      let at = 0;
      for (let j = i - 1; j >= 0; j--) {
        const k = ids.indexOf(before[j].id);
        if (k >= 0) { at = k + 1; break; }
      }
      ids.splice(at, 0, x.id);
    });
  }
  const out = [];
  for (const id of ids) {
    const v = revert(C.has(id) ? C.get(id) : MISSING, A.has(id) ? A.get(id) : MISSING, B.has(id) ? B.get(id) : MISSING);
    if (v !== MISSING) out.push(v);
  }
  return out;
}

// Undo one step on `current`. `after` is the state right after the action and
// `before` the state before it. Returns the new state.
export function DDundoRevert(current, after, before) {
  const v = revert(current === undefined ? MISSING : current, after === undefined ? MISSING : after, before === undefined ? MISSING : before);
  return v === MISSING ? undefined : structuredClone(v);
}
