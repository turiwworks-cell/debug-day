// How a task is measured. Three kinds (5.16): ticked ("time", the default,
// with optional minutes), scored out of 10, or waited for ("reply from the
// client"). Older counted cards ("3 times") still work but are no longer offered.
export const DDmeasures = ["time", "score", "wait"];
export const DDscoreMax = 10;

export function DDmeasureOf(block) {
  return ["count", "wait", "score"].includes(block?.measure)
    ? block.measure
    : "time";
}

// The score a task got, 0 when it has none yet.
export function DDscoreOf(block) {
  return Math.max(0, Math.min(DDscoreMax, Math.round(+block?.score || 0)));
}

// A scored task is done once it has a score; 0 clears it.
export function DDsetScore(block, score) {
  const value = Math.max(0, Math.min(DDscoreMax, Math.round(+score || 0)));
  const next = { ...block, score: value, done: value > 0 };
  if (!value) delete next.score;
  return next;
}

// Minutes a card takes from the day. Scored, counted and waiting cards take none.
export function DDplanMinutes(block) {
  return DDmeasureOf(block) === "time" ? Number(block?.min) || 0 : 0;
}

export function DDcountOf(block) {
  const times = Math.max(1, Math.min(99, Math.round(+block?.times || 1)));
  const count = Math.max(0, Math.min(times, Math.round(+block?.count || 0)));
  return { count, times };
}

export function DDsetMeasure(block, measure, now = new Date()) {
  const next = { ...block, measure };
  if (measure === "time") delete next.measure;
  if (measure === "count") {
    next.times = DDcountOf(block).times;
    next.count = Math.min(DDcountOf(block).count, next.times);
  }
  if (measure === "wait" && !next.waitSince) next.waitSince = now.toISOString();
  return next;
}

export function DDsetCount(block, count) {
  const { times } = DDcountOf(block);
  const value = Math.max(0, Math.min(times, Math.round(count)));
  return { ...block, count: value, done: value >= times };
}

export function DDsetTimes(block, times) {
  const value = Math.max(1, Math.min(99, Math.round(+times) || 1));
  const count = Math.min(DDcountOf(block).count, value);
  return { ...block, times: value, count, done: count >= value };
}

function DDsince(iso, language) {
  const date = new Date(iso);
  if (!Number.isFinite(+date)) return "";
  const days = Math.floor((Date.now() - +date) / 86400000);
  if (days >= 1)
    return language === "fa" ? days + " روز" : days + (days === 1 ? " day" : " days");
  return new Intl.DateTimeFormat(language === "fa" ? "fa-IR" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// Short text for a card's size: "45m", "2/3 times" or "Waiting · 2 days".
export function DDmeasureText(block, language, formatMinutes) {
  const measure = DDmeasureOf(block);
  if (measure === "score") {
    const score = DDscoreOf(block);
    if (!score) return language === "fa" ? "بدون نمره" : "No score yet";
    return (language === "fa" ? "نمره " : "Score ") + score + "/" + DDscoreMax;
  }
  if (measure === "count") {
    const { count, times } = DDcountOf(block);
    return count + "/" + times + (language === "fa" ? " بار" : " times");
  }
  if (measure === "wait") {
    const since = block?.waitSince ? DDsince(block.waitSince, language) : "",
      today = /\d:\d|[۰-۹]:[۰-۹]/.test(since),
      fa = language === "fa";
    if (!since) return fa ? "در انتظار" : "Waiting";
    // Same day: "Waiting since 14:20"; later: "Waiting · 2 days".
    return today
      ? (fa ? "در انتظار از " : "Waiting since ") + since
      : (fa ? "در انتظار · " : "Waiting · ") + since;
  }
  return formatMinutes ? formatMinutes(block?.min || 0) : (block?.min || 0) + "m";
}

const DDmeasureLabels = {
  time: ["Tick", "تیکی"],
  score: ["Score", "نمره‌ای"],
  count: ["Times", "دفعه"],
  wait: ["Waiting", "ویتینگ"],
};
const DDmeasureIcons = { time: "✓", score: "★", count: "×", wait: "⏳" };

// Pick how a card is measured; for counted cards also set how many times.
export function DDMeasurePicker({ React: R, block, language, onChange }) {
  const measure = DDmeasureOf(block),
    t = (pair) => (language === "fa" ? pair[1] : pair[0]);
  return R.createElement(
    "div",
    { className: "dd-measure", role: "group", "aria-label": language === "fa" ? "نوع اندازه" : "Measure" },
    R.createElement(
      "div",
      { className: "dd-measure-seg" },
      (measure === "count" ? [...DDmeasures, "count"] : DDmeasures).map((value) =>
        R.createElement(
          "button",
          {
            key: value,
            type: "button",
            "aria-pressed": measure === value,
            "data-measure": value,
            onClick: () => onChange((b) => DDsetMeasure(b, value)),
          },
          R.createElement("span", { "aria-hidden": true }, DDmeasureIcons[value]),
          " ",
          t(DDmeasureLabels[value]),
        ),
      ),
    ),
    measure === "count" &&
      R.createElement(
        "label",
        { className: "dd-measure-times" },
        R.createElement("input", {
          type: "number",
          min: 1,
          max: 99,
          value: DDcountOf(block).times,
          "aria-label": language === "fa" ? "چند بار" : "How many times",
          onChange: (event) => onChange((b) => DDsetTimes(b, event.target.value)),
        }),
        language === "fa" ? "بار" : "times",
      ),
  );
}

// The row control: score dots for scored cards, tally for counted cards,
// "arrived" for waiting ones.
export function DDMeasureControl({ React: R, block, language, onChange }) {
  const measure = DDmeasureOf(block),
    fa = language === "fa";
  if (measure === "score") {
    const score = DDscoreOf(block);
    return R.createElement(
      "div",
      { className: "step dd-score", role: "group", "aria-label": (fa ? "نمره: " : "Score: ") + block.name },
      Array.from({ length: DDscoreMax }, (_, i) =>
        R.createElement("button", {
          key: i,
          type: "button",
          "data-on": i < score,
          "aria-pressed": i + 1 === score,
          "aria-label": (fa ? "نمره " : "Score ") + (i + 1),
          title: String(i + 1),
          // Tapping the current score again clears it.
          onClick: () => onChange((b) => DDsetScore(b, DDscoreOf(b) === i + 1 ? 0 : i + 1)),
        }),
      ),
      R.createElement("b", { "aria-live": "polite" }, score ? score + "/" + DDscoreMax : "–"),
    );
  }
  if (measure === "count") {
    const { count, times } = DDcountOf(block);
    return R.createElement(
      "div",
      { className: "step dd-tally", role: "group", "aria-label": fa ? "شمارش" : "Tally" },
      R.createElement(
        "button",
        {
          type: "button",
          "aria-label": (fa ? "یکی کمتر: " : "One less: ") + block.name,
          disabled: count <= 0,
          onClick: () => onChange((b) => DDsetCount(b, DDcountOf(b).count - 1)),
        },
        "−",
      ),
      R.createElement(
        "span",
        { className: "dd-tally-dots", "aria-live": "polite" },
        times <= 8
          ? Array.from({ length: times }, (_, i) =>
              R.createElement("i", { key: i, "data-on": i < count }),
            )
          : null,
        R.createElement("b", null, count + "/" + times),
      ),
      R.createElement(
        "button",
        {
          type: "button",
          "aria-label": (fa ? "یکی بیشتر: " : "One more: ") + block.name,
          disabled: count >= times,
          onClick: () => onChange((b) => DDsetCount(b, DDcountOf(b).count + 1)),
        },
        "+",
      ),
    );
  }
  if (measure === "wait")
    return R.createElement(
      "div",
      { className: "step dd-waiting" },
      R.createElement(
        "span",
        null,
        "⏳ ",
        DDmeasureText(block, language),
      ),
      !block.done &&
        R.createElement(
          "button",
          {
            type: "button",
            onClick: () => onChange((b) => ({ ...b, done: true })),
          },
          fa ? "رسید" : "Arrived",
        ),
    );
  return null;
}
