// Every note shows its date, so the label is kept once per date, language and
// calendar instead of building a new date formatter for each note on each render.
const ddStickyLabels=new Map();
export function DDstickyDateLabel(date,language) {
 let calendar=language==="fa"?"persian":"gregory";
 try{const value=JSON.parse(localStorage.getItem("debug-day:review-calendar"));if(["persian","gregory"].includes(value))calendar=value;}catch{}
 const key=date+"|"+language+"|"+calendar;
 let label=ddStickyLabels.get(key);
 if(label===undefined){
  label=new Intl.DateTimeFormat(language==="fa"?"fa-IR":"en-GB",{calendar,weekday:"short",day:"numeric",month:"short",timeZone:"UTC"}).format(new Date(date+"T12:00:00Z"));
  if(ddStickyLabels.size>500)ddStickyLabels.clear();
  ddStickyLabels.set(key,label);
 }
 return label;
}
// Canonical sticky text stays plain markdown; rendering never stores a second copy.
export const DDstickyToday = () => new Date().toLocaleDateString("en-CA");
export const DDstickyDate = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v+"T12:00:00Z")) ? v : undefined;
export const DDstickyHeight = (width, content) => Math.ceil(Math.max(width, content));
export const DDstickySnap = (width, base = 240) => Math.abs(width-base) <= Math.abs(width-base*1.5) ? base : base*1.5;
export function DDstickyFormat(text, start, end, kind) {
 if(kind === "todo") {
  const a=text.lastIndexOf("\n",start-1)+1,b=text.indexOf("\n",end),stop=b<0?text.length:b;
  // Lines that are already tasks stay as they are (never "- [ ] - [ ] x"), and
  // empty lines between parts of a note stay empty.
  const lines=text.slice(a,stop).split("\n"),todo=l=>/^\s*- \[[ xX]\]( |$)/.test(l),filled=lines.filter(l=>l.trim()),remove=filled.length?filled.every(todo):lines.every(todo);
  const value=lines.map(l=>remove?l.replace(/^(\s*)- \[[ xX]\] ?/,"$1"):todo(l)||(!l.trim()&&lines.length>1)?l:l.replace(/^(\s*)(.*)$/,(_,s,t)=>s+"- [ ] "+t)).join("\n");
  return {text:text.slice(0,a)+value+text.slice(stop),start:a,end:a+value.length};
 }
 const mark=kind==="bold"?"**":"~~",selected=text.slice(start,end);
 if(selected.includes("\n") || /^- \[[ xX]\] /.test(selected)) {
  const value=selected.split("\n").map(line=>{const m=line.match(/^(\s*- \[[ xX]\] )?(.*)$/),prefix=m[1]||"",v=m[2];return prefix+(v.startsWith(mark)&&v.endsWith(mark)?v.slice(2,-2):v?mark+v+mark:"");}).join("\n");
  return {text:text.slice(0,start)+value+text.slice(end),start,end:start+value.length};
 }
 if(selected.startsWith(mark)&&selected.endsWith(mark)&&selected.length>=4)return {text:text.slice(0,start)+selected.slice(2,-2)+text.slice(end),start,end:end-4};
 if(text.slice(start-2,start)===mark&&text.slice(end,end+2)===mark)return {text:text.slice(0,start-2)+selected+text.slice(end+2),start:start-2,end:end-2};
 return {text:text.slice(0,start)+mark+selected+mark+text.slice(end),start:start+2,end:end+2};
}
export function DDstickyTodo(text, index) {
 return text.split("\n").map((line,i)=>i===index?line.replace(/^(\s*- \[)([ xX])(\])/,(all,a,c,b)=>a+(c===" "?"x":" ")+b):line).join("\n");
}
export function DDStickyText({React:R,text,onToggle,language}) {
 const h=R.createElement,inline=s=>s.split(/(\*\*[^*]+\*\*|~~[^~]+~~)/g).map((v,i)=>v.startsWith("**")?h("strong",{key:i},inline(v.slice(2,-2))):v.startsWith("~~")?h("s",{key:i},inline(v.slice(2,-2))):v);
 return text.split("\n").map((line,i)=>{
  const m=line.match(/^\s*- \[([ xX])\]\s?(.*)$/);
  return m?h("label",{key:i,className:"dd-sticky-todo","data-done":m[1]!==" "},h("input",{type:"checkbox",checked:m[1]!==" ","aria-label":m[2]||(language==="fa"?"یک کار اضافه کن…":"Add a task…"),onPointerDown:e=>e.stopPropagation(),onClick:e=>e.stopPropagation(),onDoubleClick:e=>e.stopPropagation(),onChange:()=>onToggle(i)}),h("span",null,m[2]?inline(m[2]):h("span",{className:"dd-sticky-hint"},language==="fa"?"یک کار اضافه کن…":"Add a task…"))):h("div",{key:i},line?inline(line):"\u00a0");
 });
}
export function DDinstallStickyStyles(){
 if(document.getElementById("dd-sticky-styles"))return;
 const s=document.createElement("style");s.id="dd-sticky-styles";s.textContent=`
.b6 .b4-sticky>.b4-node-body{position:relative;inset:0;width:100%;height:max-content!important;flex:0 0 auto!important;min-height:0!important;overflow:visible;display:block;padding:0;box-sizing:border-box}
.b6 .b4-sticky .dd-note-preview{position:relative;inset:auto;height:auto;min-height:0;max-height:none;overflow:visible;white-space:pre-wrap;overflow-wrap:anywhere;padding:20px 20px 8px;line-height:1.5;box-sizing:border-box}
.b6 .b4-sticky .dd-note-editor{position:relative;inset:auto;min-height:0;padding:20px 20px 8px}.b6 .dd-note-editor textarea{height:auto;min-height:0;overflow:hidden;resize:none;line-height:1.5}
/* While typing, the note grows with its text: the box and its text field take their own height (not squeezed to the old note size and scrolled, which cut lines in half), and the text sits exactly where it sits on the note. */
.b6 .b4-sticky .dd-note-editor{display:block;height:auto;flex:none;overflow:visible}.b6 .b4-sticky .dd-note-editor textarea{display:block;flex:none;width:100%;padding:0;margin:0;border:0;box-sizing:border-box}
.b6 .b4-sticky-head{top:4px;bottom:auto!important;pointer-events:none}.b6 .b4-sticky-head button:not(.dd-note-drag){display:none}.b6 .b4-sticky-head .dd-note-drag{pointer-events:auto}.dd-sticky-footer{display:block;position:absolute;bottom:0;left:0;right:0;pointer-events:none;padding:8px 16px 12px;color:#121211a6;font-size:11px;line-height:1.3;text-align:start}
.b6 .b4-sticky .dd-note-preview,.b6 .b4-sticky .dd-note-editor textarea{font-size:calc(var(--object-size,16px) * 1.15);font-weight:500;color:#141414;letter-spacing:-.005em}
.dd-sticky-todo{display:flex;align-items:flex-start;gap:8px;white-space:pre-wrap}.dd-sticky-todo input{flex:none;margin-top:.35em;accent-color:var(--accent)}
/* A to-do box is a checkbox, not a text field: never stretch it across the note (that squeezed the words into one letter per line). */
.b6 .b4-node-body .dd-sticky-todo input[type=checkbox]{font-size:inherit;width:.9em;height:.9em;min-width:0;min-height:0;flex:none;padding:0;margin:.3em 0 0;border:0;border-radius:3px;background:none;box-shadow:none;cursor:pointer}
.dd-sticky-todo>span{flex:1 1 auto;min-width:0}.dd-sticky-todo[data-done=true]>span{text-decoration:line-through;opacity:.55}.dd-sticky-hint{opacity:.5}
.b6 .b4-sticky{transition:width 120ms ease}.b6 .b4-sticky:has(textarea),.b6 .b4-sticky[data-resizing=true]{transition:none}
.b6 .b4-node.selected>.b6-note-resize[data-edge]{transform:none;opacity:1;position:absolute;background:transparent;border:0;margin:0;padding:0;min-width:0;min-height:0}
.b6 .b4-node.selected>.b6-note-resize[data-edge=e],.b6 .b4-node.selected>.b6-note-resize[data-edge=w]{top:0;bottom:auto;width:calc(8px * var(--b4-inverse));height:100%;cursor:ew-resize}
.b6 .b6-note-resize[data-edge=e]{left:auto;right:calc(-4px * var(--b4-inverse))}.b6 .b6-note-resize[data-edge=w]{left:calc(-4px * var(--b4-inverse));right:auto}
.b6 .b4-node.selected>.b6-note-resize[data-edge=n],.b6 .b4-node.selected>.b6-note-resize[data-edge=s]{left:0;right:auto;width:100%;height:calc(8px * var(--b4-inverse));cursor:ns-resize}
.b6 .b6-note-resize[data-edge=n]{top:calc(-4px * var(--b4-inverse));bottom:auto}.b6 .b6-note-resize[data-edge=s]{top:auto;bottom:calc(-4px * var(--b4-inverse))}
.b6 .b4-node.selected>.b6-note-resize[data-edge=nw],.b6 .b4-node.selected>.b6-note-resize[data-edge=ne],.b6 .b4-node.selected>.b6-note-resize[data-edge=sw],.b6 .b4-node.selected>.b6-note-resize[data-edge=se]{width:calc(12px * var(--b4-inverse));height:calc(12px * var(--b4-inverse))}
.b6 .b6-note-resize[data-edge=nw],.b6 .b6-note-resize[data-edge=sw]{left:calc(-6px * var(--b4-inverse));right:auto}.b6 .b6-note-resize[data-edge=ne],.b6 .b6-note-resize[data-edge=se]{left:auto;right:calc(-6px * var(--b4-inverse))}
.b6 .b6-note-resize[data-edge=nw],.b6 .b6-note-resize[data-edge=ne]{top:calc(-6px * var(--b4-inverse));bottom:auto}.b6 .b6-note-resize[data-edge=sw],.b6 .b6-note-resize[data-edge=se]{top:auto;bottom:calc(-6px * var(--b4-inverse))}
.b6 .b6-note-resize:after{pointer-events:none;position:absolute;left:50%;top:50%;width:calc(5px * var(--b4-inverse));height:calc(5px * var(--b4-inverse));transform:translate(-50%,-50%)}
.b6 .b4-selectionbar{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;gap:2px}.b6 .b4-selectionbar>.b2-icon{flex:none;min-width:28px;padding:0 5px}.b6 .b4-selectionbar>strong{max-width:70px}
@media(pointer:coarse){.b6 .b4-sticky .dd-note-preview,.b6 .b4-sticky .dd-note-editor{padding-top:44px}.b6 .b4-sticky-head{justify-content:flex-end}}
`;document.head.append(s);
}
