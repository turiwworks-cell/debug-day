// A small hook runtime for tests: enough of React to render the new pages,
// call their handlers and re-render the tree after a state change.
//
// State lives in a store per component instance (identified by its position in
// the tree), so expanding the tree twice keeps what a handler just changed.

export function createHarness() {
  const store = new Map();
  let key = "";
  let cursor = 0;
  let pending = [];
  let rerender = () => {};

  const hooks = {
    useState(init) {
      const at = `${key}#${cursor++}`;
      if (!store.has(at)) store.set(at, typeof init === "function" ? init() : init);
      const set = (next) => {
        const value = typeof next === "function" ? next(store.get(at)) : next;
        if (value === store.get(at)) return;
        store.set(at, value);
        rerender();
      };
      return [store.get(at), set];
    },
    useRef(init) {
      const at = `${key}ref#${cursor++}`;
      if (!store.has(at)) store.set(at, { current: init });
      return store.get(at);
    },
    useEffect(fn) {
      pending.push(fn);
    },
    useLayoutEffect(fn) {
      pending.push(fn);
    },
    useMemo(fn) {
      return fn();
    },
    useCallback(fn) {
      return fn;
    },
  };

  const React = {
    Fragment: "Fragment",
    createElement: (type, props, ...children) => ({
      type,
      props: { ...(props || {}), children: children.length > 1 ? children : children[0] },
    }),
    ...hooks,
  };

  // Expand every function component into plain elements, in tree order.
  const expand = (tree) => {
    cursor = 0;
    pending = [];
    let seen = 0;
    const one = (node) => {
      if (node == null || node === false || node === true) return node;
      if (Array.isArray(node)) return node.map(one);
      if (typeof node !== "object") return node;
      const props = node.props || {};
      if (typeof node.type === "function") {
        const at = `${++seen}:${node.type.name || "C"}`;
        const before = key;
        key = at;
        cursor = 0;
        const rendered = node.type({ ...props }, React);
        const effects = pending;
        pending = [];
        key = before;
        const out = one(rendered);
        for (const effect of effects) {
          try {
            effect();
          } catch {}
        }
        return out;
      }
      return { ...node, props: { ...props, children: one(props.children) } };
    };
    return one(tree);
  };

  return { React, expand, render: (tree) => expand(tree) };
}

// A hook runtime whose `rerender` walks the whole tree again.
export function paint(harness, makeTree, onError) {
  let tree = harness.expand(makeTree());
  let depth = 0;
  const again = () => {
    if (depth > 20) throw new Error("re-render loop");
    depth += 1;
    try {
      tree = harness.expand(makeTree());
    } catch (error) {
      if (onError) onError(error);
      else throw error;
    }
    depth -= 1;
  };
  harness.Rerender = again;
  return {
    get tree() {
      return tree;
    },
    again,
  };
}

export function walk(node, visit) {
  if (node == null || node === false || node === true) return;
  if (Array.isArray(node)) return node.forEach((one) => walk(one, visit));
  if (typeof node !== "object") return;
  visit(node);
  walk(node.props && node.props.children, visit);
}

export const findAll = (tree, predicate) => {
  const out = [];
  walk(tree, (node) => {
    if (predicate(node)) out.push(node);
  });
  return out;
};
