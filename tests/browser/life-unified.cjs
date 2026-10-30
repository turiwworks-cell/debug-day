const assert = require("node:assert/strict");
const {start,fixture}=require("./harness.cjs");
(async()=>{
 const h=await start();
 try {
  for (const language of ["en","fa"]) {
   const {page,context,errors}=await h.context(false), f=await fixture(page,h.origin);
   const t=(en,fa)=>language==="fa"?fa:en;
   f.data.setup.preferences.language=language;
   f.data.setup.life={v:2,items:[
    {id:"a",type:"section",parent:"",x:40,y:60,w:420,h:400,text:"Creative life",color:"#9DD6FF"},
    {id:"b",type:"section",parent:"",x:560,y:60,w:420,h:400,text:"Work & play",color:"#D3B8FF"},
    {id:"n",type:"sticky",parent:"a",x:40,y:70,w:220,h:160,text:"Shared idea",color:"#FFE08A"},
    {id:"m",type:"sticky",parent:"b",x:40,y:70,w:220,h:160,text:"Shared second",color:"#FFA799"}
   ],links:[],frame:{x:24,y:1200}};
   f.data.days[f.date].notes=[{id:"daily",kind:"sticky",text:"Daily idea",color:"#A8E6B8",x:1120,y:1360}];
   await page.evaluate((d)=>localStorage.setItem("debug-day:v2",JSON.stringify(d)),f.data);
   await page.reload(); await page.waitForSelector("#qa",{state:"attached"});
   const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem("debug-day:v2")));
   await page.locator(".views button").nth(1).click();
   await page.getByRole("button",{name:t("Full screen","تمام‌صفحه"),exact:true}).click();
   await page.locator("[data-life-jump]").click();
   const n=page.locator('[data-life-id="n"]'), a=page.locator('[data-life-id="a"]');
   assert.ok(await n.evaluate((e)=>e.classList.contains("b4-sticky")),"Life notes use the native note component");
   assert.equal(await page.locator('[data-board-id="section:life"]').getAttribute("tabindex"),null,"outer Life area cannot be selected");
   await n.locator(".dd-note-preview").click();
   assert.equal(await n.getAttribute("aria-selected"),"true");
   assert.match(await n.evaluate((e)=>getComputedStyle(e).outlineColor),/23, 156, 242/);
   await page.locator(".b4-selectionbar").getByRole("button",{name:t("Change color","تغییر رنگ"),exact:true}).click();
   await n.getByRole("button",{name:t("Use color ","انتخاب رنگ ")+"#D3BDFF",exact:true}).click();
   assert.equal((await read()).setup.life.items.find((i)=>i.id==="n").color,"#D3BDFF");
   await page.keyboard.press("Control+z");
   assert.equal((await read()).setup.life.items.find((i)=>i.id==="n").color,"#FFE08A");
   await n.focus(); await page.keyboard.press("Delete");
   assert.equal((await read()).setup.life.items.some((i)=>i.id==="n"),false);
   await page.keyboard.press("Control+z"); assert.equal(await n.count(),1);
   await n.focus(); await page.keyboard.press("Control+d");
   assert.equal((await read()).setup.life.items.length,5,"duplicate preserves Life note data");
   await page.keyboard.press("Control+z");
   await page.locator(".b2-viewport").focus();await n.focus();
   await n.evaluate((el)=>{const clip=new DataTransfer();el.dispatchEvent(new ClipboardEvent("copy",{bubbles:true,cancelable:true,clipboardData:clip}));el.dispatchEvent(new ClipboardEvent("paste",{bubbles:true,cancelable:true,clipboardData:clip}));});
   assert.equal((await read()).setup.life.items.length,5,"copy and paste use the native clipboard");
   await page.keyboard.press("Control+z");
   await n.locator(".dd-note-preview").click();
   await page.locator('[data-life-id="m"] .dd-note-preview').click({modifiers:["Shift"]});
   assert.equal(await page.locator('[data-life-id][aria-selected="true"]').count(),2,"Life notes support multi-selection");
   await page.keyboard.press("Escape");
   const before=await read();
   const from=await page.locator('[data-board-id="sticky:daily"] .dd-note-preview').boundingBox();
   const box=await a.boundingBox();
   await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();
   await page.mouse.move(box.x+box.width*.75,box.y+box.height*.75,{steps:12});await page.mouse.up();
   let data=await read();
   assert.equal(data.days[f.date].notes.length,0,"daily note moved into Life");
   assert.equal(data.setup.life.items.find((i)=>i.id==="daily").parent,"a");
   await page.keyboard.press("Control+z");
   data=await read();assert.deepEqual(data.days[f.date].notes,before.days[f.date].notes,"one undo restores both sides of a transfer");
   assert.equal(data.setup.life.items.some((i)=>i.id==="daily"),false);
   // Section actions live in the selection toolbar (FigJam), not inside the section.
   assert.equal(await a.locator(".b4-node-actions button").count(),0,"no extra toolbar inside a section");
   await a.focus();
   const bar=page.locator(".b4-selectionbar");
   await bar.getByRole("button",{name:t("Collapse section","بستن سکشن"),exact:true}).click();
   assert.equal(await n.count(),0,"collapsed contents are hidden");
   await bar.getByRole("button",{name:t("Expand section","باز کردن سکشن"),exact:true}).click();
   assert.equal(await n.count(),1);
   await page.locator("[data-drawer-button]").click();await page.locator("[data-drawer-list]").click();
   await page.locator(".dd-life-nav").getByRole("button",{name:/Work & play/}).click();
   assert.equal(await page.locator('[data-life-id="b"]').getAttribute("aria-selected"),"true");
   await page.getByRole("button",{name:t("Exit full screen","بستن تمام‌صفحه"),exact:true}).click();
   await page.locator("[data-life-jump]").click();
   await n.focus();await page.keyboard.press("Delete");
   await page.getByRole("button",{name:t("Previous day","روز قبل"),exact:true}).click();
   await page.locator(".b2-viewport").click({position:{x:5,y:150}});await page.keyboard.press("Control+z");
   assert.equal((await read()).setup.life.items.some((i)=>i.id==="n"),true,"Undo works on another day");
   assert.equal(await page.locator('[data-board-id="section:life"]').evaluate((e)=>e.style.top),"1200px","frame position is shared across days");
   await page.locator(".views button").first().click();
   await page.locator(".dd-plan-life").waitFor();
   assert.equal(await page.locator('.dd-plan-life input').first().inputValue(),"Creative life");
   assert.equal(await page.locator('.dd-plan-life textarea').first().inputValue(),"Shared idea");
   await page.keyboard.press("Control+Space");
   await page.getByRole("combobox",{name:t("Search everything","جست‌وجوی همه‌چیز"),exact:true}).fill("Shared idea");
   await page.locator(".dd-command-modal").getByText("Shared idea",{exact:true}).click();
   await page.waitForSelector('[data-life-id="n"][aria-selected="true"]');
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log("Unified Life: native selection, colors, transfer undo, collapse, navigation and Plan passed (en/fa)");
 }finally{await h.stop();}
})().catch((e)=>{console.error(e);process.exit(1)});

