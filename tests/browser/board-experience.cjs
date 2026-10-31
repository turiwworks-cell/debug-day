const assert=require("node:assert/strict");
const {start,fixture}=require("./harness.cjs");
const {mkdirSync}=require("node:fs");
const {join}=require("node:path");
(async()=>{
 const h=await start();
 try{
  for(const mobile of [false,true]){
   const {page,context,errors}=await h.context(mobile);page.setDefaultTimeout(8000);
   const f=await fixture(page,h.origin),data=f.data;
   data.setup.look.theme="light";
   data.setup.life={v:2,frame:{x:1400,y:300},links:[],items:[
    {id:"area",type:"section",parent:"",x:40,y:60,w:700,h:500,text:"Creative area",collapsed:true,color:"#A8DAFF"},
    {id:"inner",type:"section",parent:"area",x:30,y:70,w:600,h:380,text:"Inner area",collapsed:true,color:"#D3BDFF"},
    {id:"hidden",type:"sticky",parent:"inner",x:50,y:80,w:240,h:240,text:"کار 123",color:"#FFE299",collapsed:false}
   ]};
   data.days[f.date].blocks[0].expanded=false;
   await page.evaluate(({data,date})=>{
    localStorage.setItem("debug-day:v2",JSON.stringify(data));
    localStorage.setItem("debug-day:board-view:"+date,JSON.stringify({mode:"mindmap",camera:{x:30,y:180,z:.8}}));
    localStorage.setItem("debug-day:board-snap","false");
    localStorage.setItem("debug-day:board-appearance",JSON.stringify({guides:false}));
   },{data,date:f.date});
   await page.reload();await page.waitForSelector("#qa",{state:"attached"});
   await page.getByRole("button",{name:"Open board full screen",exact:true}).click();
   assert.equal(await page.locator(".b6.focus-mode").count(),1,"direct entry opens full-screen board");
   const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem("debug-day:v2")));
   assert.deepEqual((await read()).setup.life,data.setup.life,"opening the board does not rearrange Life data");
   const viewport=page.locator(".b2-viewport"),world=()=>page.locator(".b2-world").getAttribute("style");
   const search=async(text)=>{
    await viewport.focus();await page.keyboard.press("Control+f");
    const input=page.getByRole("textbox",{name:"Search board nodes",exact:true});await input.fill(text);return input;
   };
   await (await search("كار ۱۲۳")).press("Enter");
   const hidden=page.locator('[data-life-id="hidden"]');
   await hidden.waitFor();assert.equal(await hidden.getAttribute("aria-selected"),"true");
   assert.equal(await page.locator(".dd-board-search").count(),0);
   assert.ok((await read()).setup.life.items.filter(i=>i.type==="section").every(i=>!i.collapsed));
   await (await search("Nested outline")).press("Enter");
   await page.locator('[data-board-id="sub:writing:nested"]').waitFor();
   assert.equal((await read()).days[f.date].blocks[0].expanded,true);
   await (await search("zzzzz no result")).fill("zzzzz no result");
   assert.ok((await page.locator(".dd-board-search").innerText()).includes("No matching objects"));
   await page.getByRole("textbox",{name:"Search board nodes",exact:true}).press("Escape");

   await page.locator('[data-dock-more="top"]').click();await page.getByRole("menuitem",{name:"Toggle light / dark",exact:true}).click();
   await page.waitForFunction(()=>document.documentElement.dataset.theme==="dark");
   const dark=await viewport.evaluate(el=>getComputedStyle(el).backgroundColor);
   await page.locator('[data-dock-more="top"]').click();await page.getByRole("menuitem",{name:"Toggle light / dark",exact:true}).click();
   await page.waitForFunction(()=>document.documentElement.dataset.theme==="light");
   assert.notEqual(await viewport.evaluate(el=>getComputedStyle(el).backgroundColor),dark,"theme changes the board canvas too");

   await page.getByRole("button",{name:"Board timer",exact:true}).click();
   assert.ok(await page.getByRole("button",{name:"Board timer",exact:true}).locator("svg").evaluate(el=>el.getBoundingClientRect().width>=16));
   const panelBox=await page.locator(".dd-board-timer").boundingBox();
   assert.ok(panelBox.x>=0&&panelBox.y>=0&&panelBox.x+panelBox.width<=(mobile?390:1440),"timer panel fits the viewport");
   const duration=page.getByRole("textbox",{name:"Timer duration (mm:ss)",exact:true});
   await duration.fill("00:04");await duration.press("Enter");
   await page.getByRole("button",{name:"Start timer",exact:true}).click();
   await page.getByRole("button",{name:"Close timer",exact:true}).click();
   await page.getByRole("button",{name:"Board timer",exact:true}).click();
   await page.waitForTimeout(1150);
   await page.getByRole("button",{name:"Pause timer",exact:true}).click();
   const paused=await duration.inputValue();assert.ok(["00:02","00:03"].includes(paused),paused);
   await page.getByRole("button",{name:"Close timer",exact:true}).click();
   await page.getByRole("button",{name:"Exit full screen",exact:true}).click();
   await page.locator('.views button[data-panel="plan"]').click();
   await page.locator('.views button[data-panel="board"]').click();
   await page.getByRole("button",{name:"Board timer",exact:true}).click();
   assert.equal(await duration.inputValue(),paused,"Plan and Board keep the same paused clock");
   await page.getByRole("button",{name:"+1 min",exact:true}).click();
   assert.equal(await duration.inputValue(),"01:"+paused.slice(-2));
   await page.getByRole("button",{name:"Reset timer",exact:true}).click();
   await duration.fill("00:01");await duration.press("Enter");
   await page.getByRole("button",{name:"Start timer",exact:true}).click();
   await page.waitForFunction(()=>document.querySelector(".dd-timer-clock input").value==="00:00");
   assert.equal(await page.getByRole("button",{name:"Start timer",exact:true}).isDisabled(),true);
   await duration.fill("15:00");await duration.press("Enter");
   await page.getByRole("button",{name:"Close timer",exact:true}).click();
   await page.getByRole("button",{name:"Full screen",exact:true}).click();

   await page.locator('[data-dock-more="tools"]').click();await page.getByRole("menuitem",{name:"Canvas settings…",exact:true}).click();
   await page.getByRole("checkbox",{name:"Open board in full screen",exact:true}).check();
   await page.getByRole("button",{name:"Close canvas settings",exact:true}).click();
   await page.getByRole("button",{name:"Exit full screen",exact:true}).click();
   await page.locator('.views button[data-panel="plan"]').click();
   await page.locator('.views button[data-panel="board"]').click();
   assert.equal(await page.locator(".b6.focus-mode").count(),1,"saved preference opens Board full screen");

   if(!mobile){
    await (await search("Inner area")).press("Enter");
    const beforeResize=(await read()).setup.life;
    const container=page.locator('[data-life-id="inner"]');
    const nw=await container.locator('[data-edge="nw"]').boundingBox();
    await page.mouse.move(nw.x+nw.width/2,nw.y+nw.height/2);await page.mouse.down();
    await page.mouse.move(nw.x-55,nw.y-45,{steps:10});await page.mouse.up();
    const afterResize=(await read()).setup.life;
    const abs=(state,id)=>{let x=state.frame.x||0,y=(state.frame.y||0)+90,i=state.items.find(i=>i.id===id);while(i){x+=i.x;y+=i.y;i=state.items.find(p=>p.id===i.parent);}return {x,y};};
    assert.deepEqual(abs(afterResize,"hidden"),abs(beforeResize,"hidden"),"north-west section resize keeps children in world coordinates");
    await viewport.focus();await page.keyboard.press("Control+z");
    assert.deepEqual((await read()).setup.life,beforeResize,"a section resize is exactly one undo");
    await page.keyboard.press("Control+Shift+z");assert.deepEqual((await read()).setup.life,afterResize);
    await page.keyboard.press("Control+z");
    const beforeDraw=(await read()).setup.life;
    await viewport.focus();await page.keyboard.press("Shift+s");
    await page.mouse.move(100,210);await page.mouse.down();await page.mouse.move(340,400,{steps:10});await page.mouse.up();
    const drawn=(await read()).setup.life;
    assert.equal(drawn.items.length,beforeDraw.items.length+1,"section tool draws a new section");
    assert.deepEqual(abs(drawn,"hidden"),abs(beforeDraw,"hidden"),"drawing outside Life grows its frame without moving existing content");
    await viewport.focus();await page.keyboard.press("Control+z");
    assert.deepEqual((await read()).setup.life,beforeDraw);
    await (await search("کار 123")).press("Enter");
    const noteBox=await hidden.boundingBox(),beforeMarquee=await world(),marqueeData=(await read()).setup.life;
    // Since 5.15 a plain drag on a section's body moves the section (FigJam);
    // Shift+drag on its empty space draws a marquee instead.
    await viewport.focus();await page.keyboard.press("Escape");
    assert.notEqual(await hidden.getAttribute("aria-selected"),"true");
    await page.keyboard.down("Shift");
    await page.mouse.move(noteBox.x-30,noteBox.y+noteBox.height/4);await page.mouse.down();
    await page.mouse.move(noteBox.x+100,noteBox.y+noteBox.height/4+40,{steps:10});await page.mouse.up();
    await page.keyboard.up("Shift");
    assert.equal(await hidden.getAttribute("aria-selected"),"true","Shift on empty section space starts a marquee in Select");
    assert.equal(await world(),beforeMarquee,"a marquee inside a section does not pan");
    assert.deepEqual((await read()).setup.life,marqueeData,"marquee changes selection only");
    await viewport.focus();await page.keyboard.press("Control+Alt+t");
    assert.equal((await read()).setup.life.items.find(i=>i.id==="hidden").style.textAlign,"center");
    await page.keyboard.press("Control+z");
    await (await search("کار 123")).press("Enter");
    const count=(await read()).setup.life.items.length;
    await viewport.focus();await page.keyboard.press("Control+Enter");
    const newNotes=(await read()).setup.life.items;
    assert.equal(newNotes.length,count+1);
    const added=newNotes.find(i=>!["area","inner","hidden"].includes(i.id));
    assert.equal(added.w,240);assert.equal(added.h,240);assert.equal(added.style.textSize,16);
    await page.locator('[data-life-id="'+added.id+'"] textarea').fill("Adjacent idea");
    await page.locator('[data-life-id="'+added.id+'"] textarea').press("Control+Enter");
    await (await search("Orbit idea")).press("Enter");
    const note=page.locator('[data-board-id="sticky:note"]');
    // Stickies grow with their text, so only sides and corners resize them (5.21).
    assert.equal(await note.locator('[data-edge]').count(),6);
    assert.equal(await note.locator('[data-edge="n"],[data-edge="s"]').count(),0);
    await note.locator(".dd-note-preview").dblclick();
    const text=note.locator("textarea");await text.fill("Long paragraph\n".repeat(80));
    const before=await world();await text.hover();await page.mouse.wheel(0,220);await page.waitForTimeout(50);
    assert.equal(await world(),before,"scrolling the editor does not pan the board");
    await text.press("End");await text.press("Space");
    assert.ok((await text.inputValue()).includes(" "));
    // Notes grow with their text (5.21); keep this one short again so the fit checks below stay meaningful.
    await text.fill("Orbit idea");
    await text.press("Control+Enter");
    await note.locator(".dd-note-preview").click();
    await viewport.focus();await page.keyboard.press("Control+Shift+l");
    assert.ok((await read()).days[f.date].canvas.board4.locked.includes("sticky:note"));
    await page.keyboard.press("Escape");await viewport.focus();await page.keyboard.press("Control+a");
    assert.equal(await note.getAttribute("aria-selected"),"false","select-all skips a locked note");
    await page.keyboard.press("Escape");
    await (await search("کار 123")).press("Enter");
    const bar=page.locator(".b4-selectionbar"),b1=await bar.boundingBox();
    await viewport.focus();await page.mouse.move(500,500);await page.mouse.wheel(80,100);await page.waitForTimeout(80);
    const b2=await bar.boundingBox();assert.notEqual(b1.x+b1.y,b2.x+b2.y,"selection toolbar follows the camera");
    await viewport.focus();await page.keyboard.press("Shift+1");
    await page.waitForTimeout(80);
    const boxes=await page.locator('[data-life-id="area"], [data-board-id="b:writing"]').evaluateAll(es=>es.map(e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom};}));
    assert.ok(boxes.every(b=>b.x>=0&&b.y>=0&&b.right<=1440&&b.bottom<=900),JSON.stringify(boxes));
    const allZoom=Number(await viewport.getAttribute("data-zoom"));
    await page.keyboard.press("Shift+3");await page.waitForTimeout(80);
    assert.ok(Number(await viewport.getAttribute("data-zoom"))>allZoom,"Fit current day is distinct from Fit all including Life");
    await page.keyboard.press("Shift+0");
    await page.waitForTimeout(80);
    assert.equal(await viewport.getAttribute("data-zoom"),"1");
    await page.keyboard.press("x");assert.equal(await viewport.getAttribute("data-tool"),"connector");
    await page.keyboard.press("v");await page.keyboard.press("?");
    assert.ok((await page.locator(".dd-shortcut-list dt").count())>30);
    await page.getByRole("dialog",{name:"Board help",exact:true}).press("Escape");
    assert.equal(await page.getByRole("dialog",{name:"Board help",exact:true}).count(),0);
   }

   await (await search("کار 123")).press("Enter");
   await page.getByRole("button",{name:"Board timer",exact:true}).click();
   const out=process.env.DEBUG_DAY_SCREENSHOTS;
   if(out){
    mkdirSync(out,{recursive:true});await page.screenshot({path:join(out,`board-experience-${mobile?"phone":"desktop"}-light.png`)});
    await page.locator('[data-dock-more="top"]').click();await page.getByRole("menuitem",{name:"Toggle light / dark",exact:true}).click();
    await page.waitForFunction(()=>document.documentElement.dataset.theme==="dark");
    await page.getByRole("button",{name:"Board timer",exact:true}).click();
    await page.waitForTimeout(200);
    await page.screenshot({path:join(out,`board-experience-${mobile?"phone":"desktop"}-dark.png`)});
   }
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log("Board experience: search, collapsed results, full screen, themes, shared timer, shortcuts, editor ownership and fit passed");
 }finally{await h.stop()}
})().catch(error=>{console.error(error);process.exit(1)});
