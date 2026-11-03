const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// A quieter, stronger Engine (5.37). Sections drawn inside the Engine's frame are
// the Engine's own: the Tab flowchart lists them last, in one folded "Engine"
// row, and the board draws them as a soft dashed outline. Nothing is stored for
// that: a section dragged out of the Engine is an ordinary section again.
// An empty Engine offers what is still open from the last day and the waiting
// tasks left behind on older days, brought in with one tap (and one undo).
// Engine rows show the name first; kind, lane and "show" wait for hover or ⋯.
(async()=>{
 const h=await start();
 try {
  for(const mobile of [false,true]){
   console.log('engine quiet:',mobile?'phone':'desktop');
   const {page,errors}=await h.context(mobile),f=await fixture(page,h.origin);
   page.setDefaultTimeout(10000);
   const iso=(n)=>{const d=new Date();d.setDate(d.getDate()-n);return d.toLocaleDateString('en-CA');};
   const task=(id,name,lane,extra={})=>({id,name,type:'work',lane,min:60,note:'',pri:0,emo:'',done:false,expanded:true,subtasks:[],...extra});
   const since=new Date(Date.now()-5*864e5).toISOString();
   f.data.setup.preferences.language='en';
   f.data.setup.lanes=[{id:'work',name:'Work'},{id:'life',name:'Life'}];
   f.data.days[f.date]={...f.data.days[f.date],blocks:[],bugs:[],notes:[],canvas:{board4:{version:1,mode:'mindmap',layouts:{mindmap:{'section:engine':{x:0,y:0,w:1500,h:900}}},links:[],hidden:[],overrides:{},locked:[],groups:{},styles:{}}}};
   // Yesterday: one open task, one done. Older days: a reply still awaited, one
   // that was carried on (only its latest copy counts) and one that arrived.
   const day=(date,blocks)=>({date,heavy:0,tpl:'normal',focus:'',mood:'',journal:'',blocks,bugs:[],notes:[],canvas:null});
   f.data.days[iso(1)]=day(iso(1),[task('y1','Ink the keyframes','work',{from:'studio'}),task('y2','Colour pass','work',{done:true})]);
   f.data.days[iso(4)]=day(iso(4),[task('w4','Hear back from the print shop','work',{measure:'wait',waitSince:since,done:true})]);
   f.data.days[iso(5)]=day(iso(5),[task('w5','Reply from the gallery','work',{measure:'wait',waitSince:since})]);
   f.data.days[iso(6)]=day(iso(6),[task('w6','Reply from the gallery','work',{measure:'wait',waitSince:since})]);
   const feed=(secs)=>({v:2,frame:{x:2200,y:-100},links:[],items:[
    {id:'studio',type:'section',parent:'',x:40,y:60,w:700,h:420,text:'Studio',color:'#FFE08A'},
    {id:'clients',type:'section',parent:'studio',x:40,y:80,w:320,h:260,text:'Clients'},
    {id:'ideas',type:'section',parent:'',x:40,y:560,w:500,h:300,text:'Ideas'},
    ...secs]});
   f.data.setup.life=feed([]);
   const save=async(d)=>{await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),d);await page.reload();await page.waitForSelector('#qa',{state:'attached'});},
    read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2'))),
    tap=async(locator)=>mobile?locator.tap():locator.click(),
    modal=page.locator('.dd-command-modal'),
    flow=page.locator('.dd-flow'),
    openFlow=async()=>{await page.keyboard.press('Control+Space');await modal.waitFor();await tap(modal.locator('.dd-panel-row[data-panel="sections"] .dd-command-open'));await flow.waitFor();},
    closeFlow=async()=>{await tap(flow.locator('.dd-flow-close'));await flow.waitFor({state:'detached'});},
    shown=()=>flow.locator('[data-flow-node]').evaluateAll((els)=>els.map((el)=>el.dataset.flowNode)),
    group=flow.locator('[data-flow-group]');
   await save(f.data);
   // Find the Engine's frame and the Feed's corner on the board, then draw two
   // sections inside the Engine and one outside both.
   await openFlow();await closeFlow();
   const area=await page.locator('[data-board-id="section:engine"]').evaluate((el)=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top),w:parseFloat(el.style.width),h:parseFloat(el.style.height)}));
   const corner=await page.locator('[data-board-id="section:life"]').evaluate((el)=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top)}));
   const at=(x,y)=>({x:Math.round(x-corner.x),y:Math.round(y-corner.y-90)});
   const inside=(id,text,i)=>({id,type:'section',parent:'',out:true,...at(area.x+area.w-460,area.y+80+i*300),w:400,h:240,text,color:'#A8DAFF'});
   const data=await read();
   data.setup.life=feed([inside('em','Morning',0),inside('ea','Afternoon',1),
    {id:'eanote',type:'sticky',parent:'ea',x:30,y:60,w:200,h:150,text:'Keep going from the plan',color:'#FFC943'},
    {id:'away',type:'section',parent:'',out:true,...at(area.x-900,area.y),w:400,h:240,text:'Far away'}]);
   await save(data);

   // Tab: the main tree first, the Engine's own sections in one quiet folded row at the end.
   await openFlow();
   assert.deepEqual(await shown(),['','away','studio','clients','ideas'],'Engine sections leave the main tree; a section outside the Engine stays');
   assert.equal(await group.getAttribute('aria-expanded'),'false');
   assert.match(await group.innerText(),/Engine · 2[\s\S]*Morning, Afternoon/);
   const lastNode=await flow.locator('[data-flow-node="ideas"]').boundingBox(),groupBox=await group.boundingBox();
   assert.ok(groupBox.y>lastNode.y+lastNode.height-1,'the Engine row comes after every other section');
   assert.equal(await group.evaluate((el)=>getComputedStyle(el).borderTopStyle),'dashed','a quiet dashed row');
   await tap(group);
   await flow.locator('[data-flow-node="em"]').waitFor();
   assert.deepEqual(await shown(),['','away','studio','clients','ideas','em','ea']);
   assert.ok(await flow.locator('[data-flow-node="em"]').evaluate((el)=>el.classList.contains('is-quiet')),'shown softer when open');
   assert.equal(await group.getAttribute('aria-expanded'),'true');
   await closeFlow();
   // Opening is remembered; folding again too.
   await openFlow();
   assert.equal(await group.getAttribute('aria-expanded'),'true');
   await tap(group);await flow.locator('[data-flow-node="em"]').waitFor({state:'detached'});
   // A search finds an Engine section and opens the row for it.
   await flow.locator('.dd-flow-find input').fill('after');
   await flow.locator('[data-flow-node="ea"].is-found').waitFor();
   await flow.locator('.dd-flow-find input').fill('');
   await flow.locator('[data-flow-node="ea"]').waitFor({state:'detached'});
   if(!mobile){
    // Keyboard: down from the Main board reaches the row, Enter opens it, down goes in.
    await flow.locator('[data-flow-node=""] .dd-flow-pill').focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-flow-group')),true);
    await page.keyboard.press('Enter');await flow.locator('[data-flow-node="em"]').waitFor();
    await group.focus();await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(()=>document.activeElement?.closest('[data-flow-node]')?.dataset.flowNode),'em');
    await page.keyboard.press('Enter');// goes into Morning's board
    await page.locator('.dd-room-bar').waitFor();
    await openFlow();
    assert.equal(await group.getAttribute('aria-expanded'),'true','inside an Engine section the row stays open');
    assert.ok(await flow.locator('[data-flow-node="em"]').evaluate((el)=>el.classList.contains('is-here')));
    await closeFlow();
    await tap(page.locator('.dd-room-bar [data-room-crumb="main"]'));await page.locator('.dd-room-bar').waitFor({state:'detached'});
    await openFlow();await tap(group);await closeFlow();
   } else await closeFlow();

   // On the board the Engine's sections are a soft dashed outline; the note inside keeps its look.
   const em=page.locator('[data-board-id="life:em"]'),studio=page.locator('[data-board-id="life:studio"]');
   await em.waitFor({state:'attached'});
   assert.equal(await em.getAttribute('data-engine-section'),'true');
   assert.equal(await studio.getAttribute('data-engine-section'),null);
   assert.equal(await page.locator('[data-board-id="life:away"]').getAttribute('data-engine-section'),null);
   const look=await em.evaluate((el)=>({bg:getComputedStyle(el).backgroundColor,border:getComputedStyle(el).borderTopStyle}));
   assert.equal(look.border,'dashed');
   assert.equal(look.bg,'rgba(0, 0, 0, 0)','no fill');
   assert.notEqual(await studio.evaluate((el)=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)','an ordinary section keeps its fill');
   assert.equal(await page.locator('[data-board-id="life:eanote"]').evaluate((el)=>getComputedStyle(el).backgroundColor),'rgb(255, 201, 67)','the note inside is unchanged');

   // An empty Engine offers what is still open: yesterday's open task and the
   // reply still awaited from an older day (once, its latest copy).
   const chip=page.locator('[data-engine-carry]');
   await chip.waitFor();
   assert.match(await chip.innerText(),/2 still open/);
   await tap(chip);
   const engine=page.getByRole('dialog',{name:'Engine'});await engine.waitFor();
   const carry=engine.locator('.dd-engine-carry');
   await carry.waitFor();
   assert.match(await carry.innerText(),/1 still open from[\s\S]*1 still waiting/);
   assert.match(await carry.innerText(),/Ink the keyframes · Reply from the gallery/);
   assert.doesNotMatch(await carry.innerText(),/Colour pass|print shop/,'done and arrived tasks stay where they are');
   await tap(carry.locator('.dd-engine-carry-all'));
   await carry.waitFor({state:'detached'});
   let today=(await read()).days[f.date].blocks;
   assert.deepEqual(today.map((b)=>b.name),['Ink the keyframes','Reply from the gallery']);
   const ink=today[0],reply=today[1];
   assert.notEqual(ink.id,'y1','a copy with its own id');
   assert.equal(ink.from,'studio','keeps where it came from');
   assert.equal(reply.measure,'wait');assert.equal(reply.waitSince,since,'still waiting since the same day');
   assert.equal((await read()).days[iso(1)].blocks.find((b)=>b.id==='y1').done,false,'the earlier day is left as it was');
   // The same tasks everywhere: Engine rows, the board, Lanes.
   await engine.locator(`[data-engine-task="${ink.id}"]`).waitFor();
   await page.keyboard.press('Escape');await engine.waitFor({state:'detached'});
   await page.locator(`[data-board-id="b:${reply.id}"]`).waitFor({state:'attached'});
   assert.equal(await chip.count(),0,'the Engine is not empty any more');

   if(!mobile){
    // One undo takes the whole bring back; redo brings it again.
    await page.locator('.b2-viewport').focus();await page.keyboard.press('Control+z');
    await page.waitForFunction((date)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].blocks.length===0,f.date);
    await chip.waitFor();
    await page.keyboard.press('Control+Shift+z');
    await page.waitForFunction((date)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].blocks.length===2,f.date);
    await chip.waitFor({state:'detached'});
   }

   // Calm rows: kind, lane and "show" wait for hover or ⋯; the source stays in sight.
   await page.locator('.b2-viewport').focus();await page.keyboard.press('e');await engine.waitFor();
   const row=engine.locator(`[data-engine-task="${ink.id}"]`),lane=row.locator('select.dd-engine-lane');
   if(!mobile){await page.mouse.move(2,2);}
   assert.equal(await lane.isVisible(),false,'lane picker out of sight');
   assert.equal(await row.locator('.dd-engine-kinds').isVisible(),false);
   assert.equal(await row.locator('select.dd-engine-from').isVisible(),true,'where it came from stays in sight');
   assert.equal(await engine.locator(`[data-engine-task="${reply.id}"] select.dd-engine-from`).isVisible(),false,'"Main board" only with the tools');
   if(!mobile){
    await row.hover();
    assert.equal(await lane.isVisible(),true,'hover shows the tools');
    await page.mouse.move(2,2);
    assert.equal(await lane.isVisible(),false);
   }
   const more=row.locator('.dd-engine-more');
   await tap(more);
   assert.equal(await more.getAttribute('aria-expanded'),'true');
   if(!mobile)await page.mouse.move(2,2);
   assert.equal(await lane.isVisible(),true,'⋯ keeps the tools open');
   await lane.selectOption('life');
   assert.equal((await read()).days[f.date].blocks.find((b)=>b.id===ink.id).lane,'life');
   await engine.locator(`[data-lane="life"] [data-engine-task="${ink.id}"]`).waitFor();
   await page.keyboard.press('Escape');await engine.waitFor({state:'detached'});

   // "Not today" puts the line away for the rest of the day, on this device.
   const fresh=await read();fresh.days[f.date].blocks=[];await save(fresh);
   await page.locator('.views button').nth(1).click();
   await page.locator('[data-board-id="section:engine"]').waitFor({state:'attached'});
   await page.locator('.b2-viewport').focus();await page.keyboard.press('e');await engine.waitFor();
   await tap(carry.locator('.dd-engine-carry-hide'));await carry.waitFor({state:'detached'});
   await page.keyboard.press('Escape');await engine.waitFor({state:'detached'});
   await page.locator('.b2-viewport').focus();await page.keyboard.press('e');await engine.waitFor();
   assert.equal(await carry.count(),0,'still put away');
   // Earlier Engine is still there for picking by hand.
   await tap(engine.locator('.dd-engine-earlier-toggle'));
   await engine.locator('[data-earlier-task="y1"]').waitFor();
   await page.keyboard.press('Escape');await engine.waitFor({state:'detached'});

   // Dragged out of the Engine (here: its place changed), Morning is an ordinary section again.
   const moved=await read();
   moved.setup.life.items=moved.setup.life.items.map((i)=>i.id==='em'?{...i,...at(area.x-900,area.y+400)}:i);
   await save(moved);
   await openFlow();
   assert.deepEqual(await shown(),['','away','studio','clients','em','ideas'],'Morning is back in the main tree');
   assert.match(await group.innerText(),/Engine · 1/);
   await closeFlow();
   assert.equal(await page.locator('[data-board-id="life:em"]').getAttribute('data-engine-section'),null);

   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
   assert.equal(overflow,false,'no sideways scroll');
   assert.deepEqual(errors,[]);
   await page.context().close();
  }
  console.log('engine quiet ok');
 } finally {
  await h.stop();
 }
})().catch((error)=>{console.error(error);process.exit(1);});
