// Small React controls are kept separate from pointer/gesture handling.
export function DDcreateBoardControls(core) {
  const icons = {
    select: "M4 3l5 14 2-6 6-2z",
    hand: "M7 10V5a1.5 1.5 0 013 0v4-6a1.5 1.5 0 013 0v6-4a1.5 1.5 0 013 0v7l-2 5H8l-4-5a1.5 1.5 0 012-2l1 1",
    download: "M10 2v10M6 8l4 4 4-4M3 14v4h14v-4",
    copy: "M7 7h10v10H7zM4 13V4h9",
    cut: "M7 7l10 10M7 13L17 3M6 3a3 3 0 110 6 3 3 0 010-6zM6 11a3 3 0 110 6 3 3 0 010-6z",
    paste: "M7 5H4v13h12V5h-3M7 3h6v4H7z",
    duplicate: "M7 7h10v10H7zM3 11V3h8M9 12h6M12 9v6",
    trash: "M4 6h12M8 6V3h4v3M6 6l1 12h6l1-12M9 9v6M12 9v6",
    edit: "M4 14l-1 4 4-1L17 7l-3-3zM12 6l3 3",
    connect: "M4 4h4v4H4zM12 12h4v4h-4zM8 6h6v6",
    palette:
      "M10 3a7 7 0 100 14h1a2 2 0 001-3 1 1 0 011-2h2c4 0 2-9-5-9zM6 8h.1M9 6h.1M13 7h.1M5 11h.1",
    opacity: "M10 2c-2 3-6 7-6 10a6 6 0 0012 0c0-3-4-7-6-10zM10 6v10",
    lock: "M5 9h10v9H5zM7 9V6a3 3 0 016 0v3",
    unlock: "M5 9h10v9H5zM7 9V6a3 3 0 015-2",
    group: "M3 3h5v5H3zM12 12h5v5h-5zM12 3h5v5h-5zM3 12h5v5H3z",
    ungroup: "M2 6V2h4M14 2h4v4M2 14v4h4M14 18h4v-4M7 7h6v6H7z",
    front: "M6 6h11v11H6zM3 11V3h8M10 10l3-3 3 3M13 7v7",
    back: "M3 3h11v11H3zM7 17h10V7M5 8l3 3 3-3M8 5v6",
    forward: "M5 5h12v12H5zM2 10V2h8M8 11l3-3 3 3",
    backward: "M3 3h12v12H3zM7 18h11V7M6 8l3 3 3-3",
    left: "M3 3v14M6 6h10v3H6zM6 12h7v3H6z",
    centerX: "M10 2v16M4 5h12v3H4zM6 12h8v3H6z",
    right: "M17 3v14M4 6h10v3H4zM7 12h7v3H7z",
    top: "M3 3h14M6 6h3v10H6zM12 6h3v7h-3z",
    centerY: "M2 10h16M5 4h3v12H5zM12 6h3v8h-3z",
    bottom: "M3 17h14M6 4h3v10H6zM12 7h3v7h-3z",
    distributeX: "M3 3v14M17 3v14M6 6h2v8H6zM12 6h2v8h-2z",
    distributeY: "M3 3h14M3 17h14M6 6h8v2H6zM6 12h8v2H6z",
    fit: "M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4M7 7h6v6H7z",
    zoom: "M8.5 3a5.5 5.5 0 110 11 5.5 5.5 0 010-11zM13 13l4 4",
    grid: "M4 4h1M9 4h1M14 4h1M4 9h1M9 9h1M14 9h1M4 14h1M9 14h1M14 14h1",
    settings:
      "M10 6a4 4 0 110 8 4 4 0 010-8zM10 2v2M10 16v2M2 10h2M16 10h2M4 4l1 1M15 15l1 1M4 16l1-1M15 5l1-1",
    check: "M4 10l4 4 8-9",
    close: "M5 5l10 10M15 5L5 15",
    more: "M4 10h.1M10 10h.1M16 10h.1",
    chevron: "M7 4l6 6-6 6",
    arrow: "M3 10h14M12 5l5 5-5 5",
    reverse: "M3 6h14l-3-3M17 14H3l3 3",
    undo: "M7 4L3 8l4 4M3 8h8a5 5 0 010 10",
    redo: "M13 4l4 4-4 4M17 8H9a5 5 0 000 10",
    note: "M4 3h12v10l-4 4H4zM12 17v-4h4",
    task: "M3 4h14v13H3zM6 8l1 1 2-2M11 8h3M6 13h8",
    text: "M4 4h12M10 4v13M7 17h6",
    eye: "M2 10c5-8 11-8 16 0-5 8-11 8-16 0zM10 7a3 3 0 110 6 3 3 0 010-6z",
    eyedropper: "M13 3l4 4-2 2-4-4zM12 7L4 15v2h2l8-8",
    spark: "M10 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z",
    help: "M7 6a3 3 0 015 1c0 2-2 2-2 5M10 16h.1M10 2a8 8 0 110 16 8 8 0 010-16z",
    plus: "M10 3v14M3 10h14",
    reset: "M4 5v5h5M4 10a6 6 0 116 6",
    pin: "M6 3h8M7 3v6l-3 3h12l-3-3V3M10 12v6",
    align: "M4 3v14M7 6h10M7 10h7M7 14h10",
  };
  function ui(R, language) {
    return {
      h: R.createElement,
      t: (en, fa) => (language === "fa" ? fa : en),
      fa: language === "fa",
    };
  }
  function Icon({ React: R, name, size = 18 }) {
    return R.createElement(
      "svg",
      {
        width: size,
        height: size,
        viewBox: "0 0 20 20",
        "data-icon": name,
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.6,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": true,
      },
      R.createElement("path", {
        d:
          icons[
            {
              connector: "connect",
              sort: "select",
              tree: "connect",
              smile: "spark",
              layers: "front",
              branch: "group",
              feeling: "spark",
              swap: "reverse",
              map: "eye",
              snap: "pin",
              block: "task",
              gridDots: "grid",
              minimap: "eye",
              search: "zoom",
              expand: "fit",
              shrink: "fit",
              fitAll: "fit",
              gear: "settings",
              "?": "help",
            }[name] || name
          ] || icons.more,
      }),
    );
  }
  function NumberField({
    React: R,
    language,
    label,
    value,
    min,
    max,
    step = 1,
    onCommit,
    disabled = false,
    suffix,
  }) {
    const { h } = ui(R, language),
      [draft, setDraft] = R.useState(String(value ?? "")),
      cancelled = R.useRef(false);
    R.useEffect(
      () =>
        setDraft(value == null ? "" : String(Math.round(value * 100) / 100)),
      [value],
    );
    function save() {
      if (cancelled.current) {
        cancelled.current = false;
        return;
      }
      const text = core.digits(draft);
      if (text.trim() && Number.isFinite(+text)) {
        const n = Math.max(min ?? -100000, Math.min(max ?? 100000, +text));
        onCommit(n);
        setDraft(String(n));
      } else setDraft(value == null ? "" : String(value));
    }
    return h(
      "label",
      { className: "b6-number" },
      h("span", null, label),
      h(
        "span",
        { className: "b6-number-input" },
        h("input", {
          inputMode: "decimal",
          type: "text",
          "aria-label": label,
          value: draft,
          disabled,
          onChange: (e) => setDraft(e.target.value),
          onBlur: save,
          onKeyDown: (e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              e.target.blur();
            }
            if (e.key === "Escape") {
              cancelled.current = true;
              setDraft(value == null ? "" : String(value));
              e.target.blur();
            }
            if (["ArrowUp", "ArrowDown"].includes(e.key)) {
              e.preventDefault();
              const n = Math.max(
                min ?? -100000,
                Math.min(
                  max ?? 100000,
                  Number(core.digits(draft) || value || 0) +
                    (e.key === "ArrowUp" ? step : -step) *
                      (e.shiftKey ? 10 : 1),
                ),
              );
              setDraft(String(n));
              onCommit(n);
            }
          },
        }),
        suffix && h("small", null, suffix),
      ),
    );
  }
  function ColorPicker({
    React: R,
    language,
    value = "#FFFFFF",
    onPreview,
    onCommit,
    disabled = false,
  }) {
    const { h, t } = ui(R, language),
      [color, setColor] = R.useState(value),
      [hex, setHex] = R.useState(value),
      [mode, setMode] = R.useState("hex"),
      [error, setError] = R.useState(""),
      [recent, setRecent] = R.useState(() => core.recent()),
      active = R.useRef(false),
      hsv = R.useRef(core.hsv(value)),
      surface = R.useRef(null);
    R.useEffect(() => {
      if (!active.current) {
        setColor(value);
        setHex(value);
        hsv.current = core.hsv(value);
      }
    }, [value]);
    function update(next, commit = false, alpha) {
      const clean = core.color(next);
      if (!clean || disabled) return;
      setColor(clean.hex);
      setHex(clean.hex);
      if (commit) {
        onCommit(clean.hex, alpha ?? clean.alpha);
        setRecent(core.recent(clean.hex));
        active.current = false;
      } else onPreview?.(clean.hex);
    }
    function move(event) {
      if (disabled) return;
      const rect = surface.current.getBoundingClientRect(),
        next = {
          ...hsv.current,
          s: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
          v:
            1 -
            Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
        };
      hsv.current = next;
      update(core.fromHSV(next));
    }
    const rgb = core.rgb(color),
      hue = core.fromHSV({ h: hsv.current.h, s: 1, v: 1 });
    return h(
      "div",
      { className: "b6-color-picker" },
      h(
        "div",
        {
          className: "b6-sv",
          ref: surface,
          role: "slider",
          tabIndex: disabled ? -1 : 0,
          "aria-label": t("Saturation and brightness", "اشباع و روشنایی"),
          "aria-valuetext":
            Math.round(hsv.current.s * 100) +
            "%, " +
            Math.round(hsv.current.v * 100) +
            "%",
          style: { backgroundColor: hue },
          onPointerDown: (e) => {
            if (disabled) return;
            e.preventDefault();
            active.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            move(e);
          },
          onPointerMove: (e) => {
            if (
              active.current &&
              e.currentTarget.hasPointerCapture(e.pointerId)
            )
              move(e);
          },
          onPointerUp: (e) => {
            if (!active.current) return;
            move(e);
            update(core.fromHSV(hsv.current), true);
          },
          onPointerCancel: () => {
            active.current = false;
            update(value);
          },
          onKeyDown: (e) => {
            if (
              !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
                e.key,
              )
            )
              return;
            e.preventDefault();
            e.stopPropagation();
            const amount = e.shiftKey ? 0.1 : 0.01;
            hsv.current = {
              ...hsv.current,
              s: Math.max(
                0,
                Math.min(
                  1,
                  hsv.current.s +
                    (e.key === "ArrowRight"
                      ? amount
                      : e.key === "ArrowLeft"
                        ? -amount
                        : 0),
                ),
              ),
              v: Math.max(
                0,
                Math.min(
                  1,
                  hsv.current.v +
                    (e.key === "ArrowUp"
                      ? amount
                      : e.key === "ArrowDown"
                        ? -amount
                        : 0),
                ),
              ),
            };
            update(core.fromHSV(hsv.current), true);
          },
        },
        h("span", { className: "b6-sv-white" }),
        h("span", { className: "b6-sv-black" }),
        h("i", {
          style: {
            left: hsv.current.s * 100 + "%",
            top: (1 - hsv.current.v) * 100 + "%",
            background: color,
          },
        }),
      ),
      h("input", {
        className: "b6-hue",
        type: "range",
        min: 0,
        max: 359,
        step: 1,
        value: Math.round(hsv.current.h),
        disabled,
        "aria-label": t("Hue", "فام رنگ"),
        onChange: (e) => {
          active.current = true;
          hsv.current = { ...hsv.current, h: +e.target.value };
          update(core.fromHSV(hsv.current));
        },
        onPointerUp: () => update(core.fromHSV(hsv.current), true),
        onKeyUp: () => update(core.fromHSV(hsv.current), true),
        onBlur: () => {
          if (active.current) update(core.fromHSV(hsv.current), true);
        },
      }),
      h(
        "div",
        { className: "b6-color-code" },
        h(
          "select",
          {
            value: mode,
            "aria-label": t("Color format", "فرمت رنگ"),
            onChange: (e) => setMode(e.target.value),
          },
          h("option", { value: "hex" }, "HEX"),
          h("option", { value: "rgb" }, "RGB"),
        ),
        mode === "hex"
          ? h("input", {
              className: "b6-hex",
              value: hex,
              dir: "ltr",
              "aria-label": t("Hex color", "کد رنگ"),
              maxLength: 9,
              disabled,
              onChange: (e) => {
                active.current = true;
                setHex(e.target.value);
                setError("");
              },
              onBlur: () => {
                const parsed = core.color(hex);
                if (!parsed) {
                  setError(
                    t("Enter a valid hex color.", "کد رنگ معتبر وارد کن."),
                  );
                  active.current = false;
                  setHex(color);
                  return;
                }
                hsv.current = core.hsv(parsed.hex);
                update(parsed.hex, true, parsed.alpha);
              },
              onKeyDown: (e) => {
                e.stopPropagation();
                if (e.key === "Enter") e.target.blur();
              },
            })
          : h(
              "div",
              { className: "b6-rgb" },
              rgb.map((n, index) =>
                h(NumberField, {
                  key: index,
                  React: R,
                  language,
                  label: ["R", "G", "B"][index],
                  value: n,
                  min: 0,
                  max: 255,
                  onCommit: (number) => {
                    const next = [...rgb];
                    next[index] = number;
                    const hex = core.fromRGB(next);
                    hsv.current = core.hsv(hex);
                    update(hex, true);
                  },
                  disabled,
                }),
              ),
            ),
        typeof window !== "undefined" &&
          window.EyeDropper &&
          h(
            "button",
            {
              type: "button",
              className: "b6-icon-button",
              "aria-label": t("Pick a screen color", "برداشتن رنگ از صفحه"),
              disabled,
              onClick: async () => {
                try {
                  const result = await new window.EyeDropper().open();
                  hsv.current = core.hsv(result.sRGBHex);
                  update(result.sRGBHex, true);
                } catch (error) {
                  if (error.name !== "AbortError")
                    setError(
                      t(
                        "Color sampling is unavailable.",
                        "برداشتن رنگ در دسترس نیست.",
                      ),
                    );
                }
              },
            },
            h(Icon, { React: R, name: "eyedropper" }),
          ),
      ),
      error && h("p", { className: "b6-error", role: "alert" }, error),
      h(
        "div",
        {
          className: "b6-swatches",
          role: "group",
          "aria-label": t("Color palette", "پالت رنگ"),
        },
        [...new Set([...core.stickyColors, ...core.colors])].map((c) =>
          h(
            "button",
            {
              type: "button",
              key: c,
              style: { "--swatch": c },
              disabled,
              "aria-label": t("Use color ", "انتخاب رنگ ") + c,
              "aria-pressed": c === color,
              onClick: () => {
                hsv.current = core.hsv(c);
                update(c, true);
              },
            },
            c === color && h(Icon, { React: R, name: "check", size: 14 }),
          ),
        ),
      ),
      recent.length > 0 &&
        h(
          "div",
          { className: "b6-recent-colors" },
          h("small", null, t("Recent colors", "رنگ‌های اخیر")),
          h(
            "div",
            {
              className: "b6-swatches",
              role: "group",
              "aria-label": t("Recent colors", "رنگ‌های اخیر"),
            },
            recent.map((c) =>
              h("button", {
                type: "button",
                key: c,
                style: { "--swatch": c },
                disabled,
                "aria-label": t("Recent color ", "رنگ اخیر ") + c,
                onClick: () => {
                  hsv.current = core.hsv(c);
                  update(c, true);
                },
              }),
            ),
          ),
        ),
    );
  }
  function Opacity({
    React: R,
    language,
    value,
    onPreview,
    onCommit,
    disabled = false,
    label,
  }) {
    const { h, t } = ui(R, language),
      [draft, setDraft] = R.useState(value ?? 1),
      latest = R.useRef(value ?? 1),
      editing = R.useRef(false);
    R.useEffect(() => {
      if (!editing.current) {
        setDraft(value ?? 1);
        latest.current = value ?? 1;
      }
    }, [value]);
    function save() {
      if (!editing.current) return;
      editing.current = false;
      onCommit(latest.current);
    }
    return h(
      "div",
      { className: "b6-opacity" },
      h(NumberField, {
        React: R,
        language,
        label: label || t("Opacity", "شفافیت"),
        value: (value ?? 1) * 100,
        min: 0,
        max: 100,
        suffix: "%",
        disabled,
        onCommit: (n) => {
          latest.current = n / 100;
          setDraft(n / 100);
          onCommit(n / 100);
        },
      }),
      h("input", {
        type: "range",
        min: 0,
        max: 100,
        value: Math.round(draft * 100),
        disabled,
        "aria-label":
          (label || t("Opacity", "شفافیت")) + t(" slider", " با اسلایدر"),
        onChange: (e) => {
          editing.current = true;
          latest.current = +e.target.value / 100;
          setDraft(latest.current);
          onPreview?.(latest.current);
        },
        onPointerUp: save,
        onKeyUp: save,
        onBlur: save,
        onPointerCancel: () => {
          editing.current = false;
          setDraft(value ?? 1);
          onPreview?.(value ?? 1);
        },
      }),
    );
  }
  function PropertiesPanel(props) {
    const {
        React: R,
        language,
        nodes = [],
        wire,
        onStyle,
        onPreview,
        onWirePatch,
        onWirePreview,
        onPosition,
        onClose,
        category,
        onCategory,
      } = props,
      { h, t } = ui(R, language),
      node = nodes.length === 1 ? nodes[0] : null,
      locked = nodes.length > 0 && nodes.every((n) => n.locked),
      base = wire?.color || node?.fill || node?.color || "#FFFFFF",
      opacity = wire
        ? (wire.opacity ?? 1)
        : (node?.opacity ??
          (nodes.every((n) => n.opacity === nodes[0]?.opacity)
            ? nodes[0]?.opacity
            : 1)),
      box = core.bounds(nodes),
      note = node?.kind === "sticky" || node?.kind === "emoji";
    const preview = (patch) =>
        wire ? onWirePreview?.(patch) : onPreview?.(patch),
      apply = (patch) => (wire ? onWirePatch(patch) : onStyle(patch));
    return h(
      "aside",
      {
        className: "b6-properties" + (wire ? " b4-inspector" : ""),
        dir: language === "fa" ? "rtl" : "ltr",
        "aria-label": wire
          ? t("Connection inspector", "تنظیمات اتصال")
          : t("Object properties", "ویژگی‌های اشیا"),
        onPointerDown: (e) => e.stopPropagation(),
        onKeyDown: (e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        },
      },
      h(
        "div",
        { className: "b6-panel-heading" },
        h(
          "div",
          null,
          h(
            "strong",
            null,
            wire
              ? t("Connection", "اتصال")
              : nodes.length === 1
                ? t("Object properties", "ویژگی‌های شیء")
                : t("Selection properties", "ویژگی‌های انتخاب"),
          ),
          h(
            "small",
            null,
            wire
              ? t("Appearance & route", "ظاهر و مسیر")
              : node?.title || nodes.length + t(" objects", " شیء"),
          ),
        ),
        h(
          "button",
          {
            type: "button",
            className: "b6-icon-button",
            "aria-label": t("Close properties", "بستن ویژگی‌ها"),
            onClick: onClose,
          },
          h(Icon, { React: R, name: "close" }),
        ),
      ),
      wire &&
        h(
          "label",
          { className: "b6-label" },
          t("Connection label", "عنوان اتصال"),
          h("input", {
            key: wire.id,
            defaultValue: wire.label || "",
            dir: "auto",
            maxLength: 200,
            "aria-label": t("Connection label", "عنوان اتصال"),
            onBlur: (e) => {
              if (e.target.value !== (wire.label || ""))
                onWirePatch({ label: e.target.value });
            },
            onKeyDown: (e) => {
              e.stopPropagation();
              if (e.key === "Enter") e.target.blur();
            },
          }),
        ),
      h(
        "section",
        { className: "b6-property-section" },
        h("h3", null, t("Color", "رنگ")),
        nodes.length > 1 &&
          h(
            "small",
            null,
            t(
              "Applies to all unlocked objects in the selection.",
              "روی همهٔ اشیای بازِ انتخاب‌شده اعمال می‌شود.",
            ),
          ),
        h(ColorPicker, {
          React: R,
          language,
          value: base,
          disabled: locked,
          onPreview: (color) => preview(wire ? { color } : { fill: color }),
          onCommit: (color, alpha) =>
            apply({
              ...(wire ? { color } : { fill: color }),
              ...(alpha === undefined ? {} : { opacity: alpha }),
            }),
        }),
        h(Opacity, {
          React: R,
          language,
          value: opacity,
          disabled: locked,
          onPreview: (value) => preview({ opacity: value }),
          onCommit: (value) => apply({ opacity: value }),
        }),
        !wire &&
          h(
            "button",
            {
              type: "button",
              className: "b6-text-button",
              disabled: locked,
              onClick: () =>
                onStyle({
                  fill: null,
                  opacity: null,
                  textColor: null,
                  textSize: null,
                  textAlign: null,
                }),
            },
            t("Reset appearance", "بازنشانی ظاهر"),
          ),
      ),
      wire
        ? h(
            "section",
            { className: "b6-property-section" },
            h("h3", null, t("Line", "خط")),
            h(
              "label",
              { className: "b6-label" },
              t("Route", "مسیر"),
              h(
                "select",
                {
                  "aria-label": t("Connection style", "شکل اتصال"),
                  value: wire.style || "curve",
                  onChange: (e) => onWirePatch({ style: e.target.value }),
                },
                [
                  ["curve", "Curved", "منحنی"],
                  ["straight", "Straight", "مستقیم"],
                  ["elbow", "Elbow", "زاویه‌دار"],
                ].map(([id, en, fa]) =>
                  h("option", { key: id, value: id }, t(en, fa)),
                ),
              ),
            ),
            h("label", { className: "b6-label" }, t("Attachment", "اتصال به لبه"),
              h("select", { "aria-label": t("Connection attachment", "جای اتصال به لبه"), value: wire.routing === "fixed" ? "fixed" : "auto", onChange: (e) => onWirePatch({ routing: e.target.value, bend: null, fromPort: wire.fromPort || "right", toPort: wire.toPort || "left" }) },
                h("option", { value: "auto" }, t("Nearest edges · automatic", "نزدیک‌ترین لبه‌ها · خودکار")),
                h("option", { value: "fixed" }, t("Fixed sides", "لبه‌های ثابت")))),
            h("button", { type: "button", className: "b6-text-button", onClick: () => onWirePatch({ routing: "auto", bend: null, fromPort: null, toPort: null }) }, t("Reset to smart route", "بازگشت به مسیر هوشمند")),
            h(NumberField, {
              React: R,
              language,
              label: t("Line width", "ضخامت خط"),
              value: wire.width ?? 1.8,
              min: 1,
              max: 12,
              step: 0.5,
              onCommit: (value) => onWirePatch({ width: value }),
              suffix: "px",
            }),
            h(
              "label",
              { className: "b6-label" },
              t("Line pattern", "نوع خط"),
              h(
                "select",
                {
                  value: wire.pattern || (wire.dashed ? "dashed" : "solid"),
                  "aria-label": t("Line pattern", "نوع خط"),
                  onChange: (e) =>
                    onWirePatch({
                      pattern: e.target.value,
                      dashed: e.target.value === "dashed",
                    }),
                },
                [
                  ["solid", "Solid", "پیوسته"],
                  ["dashed", "Dashed", "خط‌چین"],
                  ["dotted", "Dotted", "نقطه‌چین"],
                ].map(([id, en, fa]) =>
                  h("option", { key: id, value: id }, t(en, fa)),
                ),
              ),
            ),
            h(
              "label",
              { className: "b6-check" },
              h("input", {
                type: "checkbox",
                checked: !!wire.arrow,
                onChange: (e) => onWirePatch({ arrow: e.target.checked }),
              }),
              t("Arrow at the end", "فلش در انتها"),
            ),
          )
        : h(
            "details",
            { className: "b6-property-section" },
            h("summary", null, t("Position & text", "موقعیت و متن")),
            category &&
              h(
                "label",
                { className: "b6-label" },
                t("Task category", "دستهٔ کار"),
                h(
                  "select",
                  {
                    "aria-label": t("Task category", "دستهٔ کار"),
                    value: category.value,
                    disabled: locked,
                    onChange: (e) => onCategory(e.target.value),
                  },
                  category.options.map((item) =>
                    h(
                      "option",
                      { key: item.id, value: item.id },
                      item.name || item.id,
                    ),
                  ),
                ),
              ),
            h(
              "div",
              { className: "b6-field-grid" },
              h(NumberField, {
                React: R,
                language,
                label: "X",
                value: box.x,
                disabled: locked,
                onCommit: (x) => onPosition({ x }),
              }),
              h(NumberField, {
                React: R,
                language,
                label: "Y",
                value: box.y,
                disabled: locked,
                onCommit: (y) => onPosition({ y }),
              }),
            ),
            note &&
              h(
                "div",
                { className: "b6-field-grid" },
                h(NumberField, {
                  React: R,
                  language,
                  label: t("Note width", "عرض نوت"),
                  value: node.w,
                  min: node.kind === "emoji" ? 32 : 144,
                  max: 1200,
                  step: 8,
                  disabled: locked,
                  onCommit: (width) => onStyle({ width }),
                }),
                h(NumberField, {
                  React: R,
                  language,
                  label: t("Note height", "ارتفاع نوت"),
                  value: node.h,
                  min: node.kind === "emoji" ? 32 : 96,
                  max: 1800,
                  step: 8,
                  disabled: locked,
                  onCommit: (height) => onStyle({ height }),
                }),
              ),
            !node || node.kind !== "emoji"
              ? h(NumberField, {
                  React: R,
                  language,
                  label: t("Text size", "اندازهٔ متن"),
                  value: node?.textSize ?? 14,
                  min: 12,
                  max: 40,
                  disabled: locked,
                  onCommit: (textSize) => onStyle({ textSize }),
                  suffix: "px",
                })
              : null,
            h(
              "label",
              { className: "b6-label" },
              t("Text alignment", "تراز متن"),
              h(
                "select",
                {
                  value: node?.textAlign || "start",
                  "aria-label": t("Text alignment", "تراز متن"),
                  disabled: locked,
                  onChange: (e) => onStyle({ textAlign: e.target.value }),
                },
                h("option", { value: "start" }, t("Start", "ابتدای متن")),
                h("option", { value: "center" }, t("Center", "وسط")),
                h("option", { value: "end" }, t("End", "انتهای متن")),
              ),
            ),
          ),
    );
  }
  function ZoomControl({
    React: R,
    language,
    viewport,
    getCamera,
    onZoom,
    onFit,
    onView,
  }) {
    const { h, t } = ui(R, language),
      [value, setValue] = R.useState(() => getCamera().z),
      [draft, setDraft] = R.useState(() =>
        String(Math.round(getCamera().z * 10000) / 100),
      ),
      [open, setOpen] = R.useState(false),
      editing = R.useRef(false),
      root = R.useRef(null),
      cancelled = R.useRef(false);
    R.useEffect(() => {
      const node = viewport.current,
        change = (e) => {
          setValue(e.detail.z);
          if (!editing.current)
            setDraft(String(Math.round(e.detail.z * 10000) / 100));
        };
      node?.addEventListener("debug-day-camera", change);
      return () => node?.removeEventListener("debug-day-camera", change);
    }, [viewport]);
    R.useEffect(() => {
      if (!open) return;
      const close = (e) => {
        if (!root.current?.contains(e.target)) setOpen(false);
      };
      document.addEventListener("pointerdown", close);
      return () => document.removeEventListener("pointerdown", close);
    }, [open]);
    function save() {
      editing.current = false;
      if (cancelled.current) {
        cancelled.current = false;
        return;
      }
      const next = core.zoomInput(draft);
      if (next !== null) onZoom(next);
      else setDraft(String(Math.round(getCamera().z * 10000) / 100));
    }
    return h(
      "div",
      {
        className: "b2-camera b6-camera",
        ref: root,
        dir: "ltr",
        onKeyDown: (e) => {
          if (e.key === "Escape") {
            setOpen(false);
            e.stopPropagation();
          }
        },
      },
      h(
        "button",
        {
          type: "button",
          "aria-label": t("Zoom out", "کوچک‌نمایی"),
          title: t("Zoom out", "کوچک‌نمایی"),
          onClick: () => onZoom(core.zoomStep(getCamera().z, -1)),
        },
        "−",
      ),
      h(
        "label",
        { className: "b6-zoom-input" },
        h("input", {
          "aria-label": t("Zoom percentage", "درصد زوم"),
          value: draft,
          dir: "ltr",
          inputMode: "decimal",
          onFocus: () => {
            editing.current = true;
          },
          onChange: (e) => setDraft(e.target.value),
          onBlur: save,
          onKeyDown: (e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              e.target.blur();
            }
            if (e.key === "Escape") {
              cancelled.current = true;
              editing.current = false;
              setDraft(String(Math.round(getCamera().z * 10000) / 100));
              e.target.blur();
            }
          },
        }),
        h("span", null, "%"),
      ),
      h(
        "button",
        {
          type: "button",
          "aria-label": t("Zoom in", "بزرگ‌نمایی"),
          title: t("Zoom in", "بزرگ‌نمایی"),
          onClick: () => onZoom(core.zoomStep(getCamera().z, 1)),
        },
        "+",
      ),
      h(
        "button",
        {
          type: "button",
          "aria-label": t("Zoom options", "گزینه‌های زوم"),
          "aria-expanded": open,
          onClick: () => setOpen(!open),
        },
        h(Icon, { React: R, name: "chevron", size: 14 }),
      ),
      open &&
        h(
          "div",
          { className: "b6-zoom-menu", dir: language === "fa" ? "rtl" : "ltr" },
          h(
            "div",
            { className: "b6-zoom-presets" },
            [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 8].map((z) =>
              h(
                "button",
                {
                  type: "button",
                  key: z,
                  "aria-pressed": Math.abs(value - z) < 0.001,
                  onClick: () => {
                    onZoom(z);
                    setOpen(false);
                  },
                },
                Math.round(z * 100) + "%",
              ),
            ),
          ),
          h(
            "button",
            {
              type: "button",
              onClick: () => {
                onFit(false);
                setOpen(false);
              },
            },
            t("Fit all objects", "نمایش همهٔ اشیا"),
            h("kbd", null, "⇧1"),
          ),
          h(
            "button",
            {
              type: "button",
              onClick: () => {
                onFit(true);
                setOpen(false);
              },
            },
            t("Zoom to selection", "زوم روی انتخاب"),
            h("kbd", null, "⇧2"),
          ),
          h(
            "button",
            {
              type: "button",
              onClick: () => {
                onView();
                setOpen(false);
              },
            },
            t("Canvas settings", "تنظیمات بوم"),
          ),
        ),
    );
  }
  function ContextMenu({
    React: R,
    language,
    menu,
    items,
    onClose,
    boardRef,
    title,
  }) {
    const { h, t, fa } = ui(R, language),
      root = R.useRef(null),
      [section, setSection] = R.useState(null),
      [position, setPosition] = R.useState({ x: menu.x, y: menu.y }),
      rows = section
        ? items.find((item) => item?.id === section)?.children || []
        : items;
    R.useLayoutEffect(() => {
      const el = root.current,
        board = boardRef.current;
      if (!el || !board) return;
      const rect = board.getBoundingClientRect(),
        left = Math.max(8, -rect.left + 8),
        top = Math.max(8, -rect.top + 8),
        right = Math.min(rect.width, innerWidth - rect.left) - 8,
        bottom = Math.min(rect.height, innerHeight - rect.top) - 8;
      el.style.maxHeight = Math.max(120, bottom - top) + "px";
      const width = el.offsetWidth,
        height = Math.min(el.scrollHeight, bottom - top);
      setPosition({
        x: Math.max(
          left,
          Math.min(fa ? menu.x - width : menu.x, right - width),
        ),
        y: Math.max(top, Math.min(menu.y, bottom - height)),
      });
      el.querySelector("[role=menuitem]:not([disabled])")?.focus({
        preventScroll: true,
      });
    }, [menu, section, fa]);
    R.useEffect(() => {
      const close = (e) => {
        if (!root.current?.contains(e.target)) onClose(false);
      };
      document.addEventListener("pointerdown", close, true);
      return () => document.removeEventListener("pointerdown", close, true);
    }, [onClose]);
    function run(item) {
      if (item.disabled) return;
      if (item.children) {
        setSection(item.id);
        return;
      }
      onClose(true);
      item.action?.();
    }
    return h(
      "div",
      {
        className: "b4-context b6-context",
        ref: root,
        role: "menu",
        dir: fa ? "rtl" : "ltr",
        "aria-label": t("Board context menu", "منوی راست‌کلیک برد"),
        style: { left: position.x, top: position.y },
        onContextMenu: (e) => e.preventDefault(),
        onPointerDown: (e) => e.stopPropagation(),
        onKeyDown: (e) => {
          e.stopPropagation();
          const buttons = [
              ...e.currentTarget.querySelectorAll(
                "[role=menuitem]:not([disabled])",
              ),
            ],
            current = buttons.indexOf(document.activeElement);
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            const i =
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? buttons.length - 1
                  : (current +
                      (e.key === "ArrowDown" ? 1 : -1) +
                      buttons.length) %
                    buttons.length;
            buttons[i]?.focus();
          } else if (e.key === "Escape" || e.key === "Tab") {
            e.preventDefault();
            if (section) setSection(null);
            else onClose(true);
          } else if (
            (fa ? e.key === "ArrowRight" : e.key === "ArrowLeft") &&
            section
          ) {
            e.preventDefault();
            setSection(null);
          }
        },
      },
      h(
        "div",
        { className: "b6-context-heading" },
        section
          ? h(
              "button",
              {
                type: "button",
                role: "menuitem",
                className: "b6-menu-back",
                onClick: () => setSection(null),
              },
              h(Icon, { React: R, name: "chevron", size: 14 }),
              t("Back", "برگشت"),
            )
          : h("span", null, title || t("Canvas", "بوم")),
      ),
      rows.filter(Boolean).map((item, index) =>
        item.separator
          ? h("div", {
              key: item.id || index,
              role: "separator",
              className: "b6-menu-separator",
            })
          : h(
              "button",
              {
                key: item.id || index,
                type: "button",
                role: "menuitem",
                "aria-label": item.label,
                disabled: !!item.disabled,
                title: item.reason || "",
                className:
                  (item.danger ? "danger " : "") +
                  (item.checked ? "checked" : ""),
                "aria-haspopup": item.children ? "menu" : undefined,
                onClick: () => run(item),
              },
              h(Icon, { React: R, name: item.icon || "more", size: 17 }),
              h("span", null, item.label),
              item.shortcut && h("kbd", { dir: "ltr" }, item.shortcut),
              item.children && h(Icon, { React: R, name: "chevron", size: 13 }),
              item.checked && h(Icon, { React: R, name: "check", size: 14 }),
            ),
      ),
    );
  }
  function ViewPanel({
    React: R,
    language,
    value,
    onChange,
    grid,
    snap,
    map,
    onGrid,
    onSnap,
    onMap,
    onClose,
  }) {
    const { h, t } = ui(R, language);
    return h(
      "aside",
      {
        className: "b6-view-panel",
        dir: language === "fa" ? "rtl" : "ltr",
        "aria-label": t("Canvas settings", "تنظیمات بوم"),
        onPointerDown: (e) => e.stopPropagation(),
        onKeyDown: (e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        },
      },
      h(
        "div",
        { className: "b6-panel-heading" },
        h("strong", null, t("Canvas settings", "تنظیمات بوم")),
        h(
          "button",
          {
            type: "button",
            className: "b6-icon-button",
            "aria-label": t("Close canvas settings", "بستن تنظیمات بوم"),
            onClick: onClose,
          },
          h(Icon, { React: R, name: "close" }),
        ),
      ),
      [
        [grid, onGrid, "Dot grid", "شبکهٔ نقطه‌ای"],
        [snap, onSnap, "Snap to grid", "چسبیدن به شبکه"],
        [map, onMap, "Minimap", "نقشهٔ کوچک"],
        [
          value.guides,
          () => onChange({ guides: !value.guides }),
          "Smart alignment guides",
          "راهنماهای تراز هوشمند",
        ],
        [
          value.wheelZoom,
          () => onChange({ wheelZoom: !value.wheelZoom }),
          "Use scroll wheel to zoom",
          "زوم با چرخ ماوس",
        ],
        [
          value.rightDragPan,
          () => onChange({ rightDragPan: !value.rightDragPan }),
          "Right-click and drag to pan",
          "حرکت بوم با کشیدن راست‌کلیک",
        ],
      ].map(([checked, change, en, fa]) =>
        h(
          "label",
          { key: en, className: "b6-check" },
          h("input", { type: "checkbox", checked, onChange: change }),
          t(en, fa),
        ),
      ),
      h(Opacity, {
        React: R,
        language,
        label: t("Grid dot opacity", "شفافیت نقاط شبکه"),
        value: value.gridOpacity / 100,
        onPreview: (n) => onChange({ gridOpacity: Math.round(n * 100) }),
        onCommit: (n) => onChange({ gridOpacity: Math.round(n * 100) }),
      }),
      h(NumberField, {
        React: R,
        language,
        label: t("Grid spacing", "فاصلهٔ نقاط شبکه"),
        value: value.gridSize,
        min: 8,
        max: 80,
        step: 4,
        suffix: "px",
        onCommit: (gridSize) => onChange({ gridSize }),
      }),
      h(
        "small",
        null,
        t(
          "View settings stay on this device.",
          "تنظیمات نمایش روی همین دستگاه می‌مانند.",
        ),
      ),
    );
  }
  return {
    Icon,
    ColorPicker,
    NumberField,
    Opacity,
    PropertiesPanel,
    ZoomControl,
    ContextMenu,
    ViewPanel,
  };
}
