// One place to review captured ideas, unscheduled work and worries. It reads
// the existing Capture/Feed/Later stores; opening it never copies the data.
import { DDinboxId } from "./capture.js";
import { DDlifeItems } from "./life-board.js";

export const DDcaptureHubBus = {
  pending: false, listeners: new Set(),
  request() { this.pending = true; for (const fn of [...this.listeners]) fn(); },
  take() { const value = this.pending; this.pending = false; return value; },
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
};

export function DDcaptureSummary(setup = {}) {
  const items = DDlifeItems(setup);
  return {
    ideas: items.filter((note) => note.parent === DDinboxId && note.type === "sticky"),
    later: setup.later || [],
    worries: setup.worries || [],
  };
}

export function DDCaptureHub({ React: R, setup = {}, language = "en", onClose, onCapture, onLater, onWorries, onOpenInbox, onPromote }) {
  const h = R.createElement, fa = language === "fa", t = (en, f) => fa ? f : en,
    [filter, setFilter] = R.useState("ideas"),
    data = DDcaptureSummary(setup),
    tabs = [["ideas", t("Ideas", "ایده‌ها"), data.ideas.length], ["later", t("Later", "بعداً"), data.later.length],
      ["worries", t("Worries", "نگرانی‌ها"), data.worries.filter((w) => !w.closed).length]],
    open = (kind) => { onClose(); kind === "capture" ? onCapture?.() : kind === "later" ? onLater?.() : onWorries?.(); };
  const list = filter === "ideas" ? data.ideas : filter === "later" ? data.later : data.worries;
  return h("div", { className: "dd-capture-backdrop", onPointerDown: (event) => { event.stopPropagation(); if (event.target === event.currentTarget) onClose(); },
    onKeyDown: (event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } } },
    h("section", { className: "dd-capture-hub", role: "dialog", "aria-modal": "true", "aria-label": t("Capture", "ثبت ایده"), dir: fa ? "rtl" : "ltr" },
      h("header", null, h("div", null, h("strong", null, t("Capture", "ثبت ایده")),
        h("small", null, t("Keep thoughts. Decide later.", "فکرها را نگه دار؛ بعد تصمیم بگیر."))),
        h("button", { type: "button", className: "dd-capture-add", onClick: () => open("capture") }, t("+ Capture", "+ ثبت جدید")),
        h("button", { type: "button", className: "dd-capture-close", "aria-label": t("Close", "بستن"), onClick: onClose }, "×")),
      h("nav", { className: "dd-capture-categories", "aria-label": t("Capture categories", "دسته‌بندی ثبت‌ها") },
        tabs.map(([id, label, count]) => h("button", { key: id, type: "button", "aria-pressed": filter === id,
          onClick: () => setFilter(id) }, label, h("span", null, count)))),
      h("div", { className: "dd-capture-list" },
        list.length ? list.map((item) => h("article", { className: "dd-capture-item", key: item.id, "data-capture-item": item.id, "data-closed": !!item.closed },
          h("div", { dir: "auto" }, filter === "ideas" ? item.text : filter === "later" ? item.name : item.text),
          h("div", { className: "dd-capture-item-actions" },
            filter === "later" && !item.done && ["today", "park"].map((zone) => h("button", {
              key: zone, type: "button", onClick: () => onPromote?.(item.id, zone)
            }, zone === "today" ? t("+ Today", "+ امروز") : t("+ Park", "+ پارک"))),
            filter === "worries" && item.closed && h("small", null, t("Closed", "بسته")),
            filter === "ideas" && item.at && h("small", null, item.at)))) :
          h("p", { className: "dd-capture-empty" }, t("Nothing here yet.", "هنوز چیزی اینجا نیست."))),
      h("footer", null,
        h("button", { type: "button", onClick: () => { onClose(); onOpenInbox?.(); } }, t("Open Inbox board", "باز کردن برد ایده‌ها")),
        h("button", { type: "button", onClick: () => open(filter === "worries" ? "worries" : "later") },
          filter === "worries" ? t("Manage worries", "مدیریت نگرانی‌ها") : t("Manage Later", "مدیریت بعداً")))));
}

export const DDcaptureHubCSS = `
.dd-capture-backdrop{position:absolute;inset:0;z-index:105;display:flex;align-items:center;justify-content:center;background:rgba(17,17,16,.5);padding:20px}
.dd-capture-hub{display:flex;flex-direction:column;width:min(740px,100%);max-height:min(84vh,100%);background:var(--paper,#fff);color:var(--ink,#111);border-radius:17px;overflow:hidden;box-shadow:0 22px 60px #0005}
.dd-capture-hub header{display:flex;align-items:center;gap:10px;padding:18px 20px;border-bottom:1px solid var(--rule-2,#0002)}
.dd-capture-hub header>div{flex:1;display:flex;flex-direction:column;gap:3px}
.dd-capture-hub header strong{font-size:19px}.dd-capture-hub header small{font-size:12px;color:var(--ink-3,#777)}
.dd-capture-hub button{border-radius:8px;padding:7px 12px;background:var(--wash,#eee);color:var(--ink,#111);font-size:12px}
.dd-capture-hub .dd-capture-add{background:#237d64;color:#fff}
.dd-capture-hub .dd-capture-close{padding:3px 10px;font-size:23px;background:transparent}
.dd-capture-categories{display:flex;gap:5px;padding:10px 20px;border-bottom:1px solid var(--rule-2,#0001)}
.dd-capture-categories button{display:flex;align-items:center;gap:10px}
.dd-capture-categories button[aria-pressed=true]{background:var(--ink,#111);color:var(--paper,#fff)}
.dd-capture-categories span{opacity:.68;font-variant-numeric:tabular-nums}
.dd-capture-list{padding:14px 20px;display:flex;flex-direction:column;gap:7px;overflow:auto;min-height:100px}
.dd-capture-item{padding:12px 14px;background:var(--wash,#f5f4f2);border-radius:10px;display:flex;align-items:center;gap:10px;min-width:0}
.dd-capture-item>div:first-child{flex:1;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px}
.dd-capture-item[data-closed=true]{opacity:.55}
.dd-capture-item-actions{display:flex;align-items:center;gap:8px;flex:none}.dd-capture-item-actions small{font-size:11px;color:var(--ink-3,#666)}
.dd-capture-empty{color:var(--ink-3,#777);font-size:13px}
.dd-capture-hub footer{padding:12px 20px;display:flex;justify-content:space-between;gap:10px;border-top:1px solid var(--rule-2,#0001)}
@media(max-width:640px){.dd-capture-backdrop{padding:9px}.dd-capture-hub{max-height:95vh}.dd-capture-hub header{padding:14px}.dd-capture-categories{padding:9px}.dd-capture-list{padding:10px}.dd-capture-hub footer{padding:12px;flex-wrap:wrap}}
`;

export function DDinstallCaptureHubStyles() {
  if (typeof document === "undefined" || document.getElementById("dd-capture-hub-css")) return;
  document.head.append(Object.assign(document.createElement("style"), { id: "dd-capture-hub-css", textContent: DDcaptureHubCSS }));
}
