const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// Section tags (5.53): a task gets its section from the card's panel with a
// quick search, no dragging. The tag is the task's `from`, so the Board card,
// the Engine and Lanes show it at once, and a click on it (on the card, in the
// Engine overlay or on the Engine page) goes into that section's own board.
// Notes made on the Engine stay on the Engine inside every section's board.
(async()=>{
 const h=await start();
 try{
  for(const mobile of [false,true]){
   const {page,errors}=await h.context(mobile),f=await fixture(page,h.origin);
   page.setDefaultTimeout(10000);
   const section=(id,text,x,extra={})=>({id,type:'section',parent:'',x,y:60,w:420,h:300,text,...extra});
   f.data.setup.life={v:2,items:[section('a','Studio',40,{color:'#9DD6FF'}),section('c','Sketches',20,{parent:'a',w:300,h:200}),section('b','Clients',500)],links:[],frame:{x:24,y:1200}};
   await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
   await page.reload();await page.waitForSelector('#qa',{state:'attached'});
   const tap=async(locator)=>mobile?locator.tap():locator.click(),
    day=()=>page.evaluate((date)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date],f.date),
    task=async(id)=>(await day()).blocks.find((b)=>b.id===id),
    room=()=>page.evaluate(()=>sessionStorage.getItem('debug-day:board-room')),
    view=page.locator('.b2-viewport'),
    card=page.locator('[data-board-id="b:writing"]');
   await page.locator('[role=tab][data-panel=board]').click();await view.waitFor();

   // Move Orbit idea off the Engine: a note of the main board only.
   await page.evaluate((date)=>{const d=JSON.parse(localStorage.getItem('debug-day:v2'));Object.assign(d.days[date].notes[0],{x:-900,y:2400});localStorage.setItem('debug-day:v2',JSON.stringify(d));},f.date);
   await page.reload();await page.waitForSelector('#qa',{state:'attached'});await page.locator('[role=tab][data-panel=board]').click();await view.waitFor();
   if(mobile){
    // A phone's board starts zoomed out; its tag still comes from the same field.
    await page.evaluate((date)=>{const d=JSON.parse(localStorage.getItem('debug-day:v2'));d.days[date].blocks[0].from='c';localStorage.setItem('debug-day:v2',JSON.stringify(d));},f.date);
    await page.reload();await page.waitForSelector('#qa',{state:'attached'});await page.locator('[role=tab][data-panel=board]').click();await view.waitFor();
   }else{
   // 1. Pick the card; its panel has the Section field first.
   await tap(card.locator('.b4-node-body').first());
   const panel=page.locator('.dd-card-details');
   if(!await panel.count())await tap(page.getByRole('button',{name:'Card details'}));
   await panel.waitFor();
   assert.match(await panel.locator('.dd-card-field').first().innerText(),/Section/);
   await tap(panel.locator('[data-section-tag-add]'));
   const find=panel.locator('.dd-section-tag-pick input');
   await find.fill('sket');
   assert.deepEqual(await panel.locator('[data-section-choice]').evaluateAll((els)=>els.map((e)=>e.dataset.sectionChoice)),['c'],'the search reads the whole path');
   await find.press('Enter');
   await page.waitForFunction((date)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].blocks[0].from==='c',f.date);
   assert.match(await panel.locator('[data-go-section="c"]').innerText(),/Studio › Sketches/);
   // The card shows the same tag at once.
   const chip=card.locator('button.dd-task-from[data-from="c"]');
   await chip.waitFor();
   // Tags replaced categories (5.54): the card wears its section's colour, and
   // the panel has no category to pick.
   await page.waitForFunction(()=>document.querySelector('[data-board-id="b:writing"]')?.style.getPropertyValue('--node-color'));
   const nodeColor=await card.evaluate((el)=>el.style.getPropertyValue('--node-color').toLowerCase());
   const tint=await page.evaluate(async()=>{const {DDsectionTint}=await import('/life-board.js');return DDsectionTint(JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items,'c').fill.toLowerCase();});
   assert.equal(nodeColor,tint,'the card is the colour of Sketches');
   assert.equal(await panel.getByRole('combobox',{name:'Category',exact:true}).count(),0);
   // Change it from the list, then take it off and put it back.
   await tap(panel.locator('[data-section-tag-change]'));
   await tap(panel.locator('[data-section-choice="b"]'));
   await page.waitForFunction((date)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].blocks[0].from==='b',f.date);
   await tap(panel.locator('[data-section-tag-clear]'));
   await page.waitForFunction((date)=>!('from' in JSON.parse(localStorage.getItem('debug-day:v2')).days[date].blocks[0]),f.date);
   await panel.locator('[data-section-tag-add]').waitFor();
   await tap(panel.locator('[data-section-tag-add]'));
   await find.fill('sketches');await find.press('Enter');
   await page.waitForFunction((date)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].blocks[0].from==='c',f.date);

   // 2. A click on the card's tag goes into Sketches.
   await tap(chip);
   await page.waitForFunction(()=>sessionStorage.getItem('debug-day:board-room')==='c');
   await page.locator('.dd-room-bar').waitFor();

    // 3. A note made on the Engine inside Sketches is the Engine's: a day note,
    // and it is still there on the main board and in Clients.
    const area=await page.locator('[data-board-id="section:engine"]').boundingBox();
    const notes0=(await day()).notes.length;
    await view.focus();await page.keyboard.press('s');await page.locator('.dd-sticky-colors').waitFor();
    await page.mouse.move(area.x+area.width-90,area.y+area.height-70);await page.mouse.click(area.x+area.width-90,area.y+area.height-70);
    const typing=page.locator('.dd-note-editor textarea');await typing.waitFor();
    await typing.fill('Engine thought');await page.keyboard.press('Escape');
    await page.waitForFunction(([date,n])=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].notes.length===n+1,[f.date,notes0]);
    const note=(await day()).notes.at(-1);
    assert.equal(note.text,'Engine thought');
    const life=await page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.filter((i)=>i.type==='sticky').length);
    assert.equal(life,0,'not a note of the section');
    await page.keyboard.press('Escape');
    const shown=page.locator(`[data-board-id="sticky:${note.id}"]`);
    await shown.waitFor();
    // Clients' board shows it too; the main board's other notes stay on the main board.
    await view.focus();await page.keyboard.press('Tab');await page.locator('.dd-flow').waitFor();
    await page.locator('[data-flow-node="b"] .dd-flow-pill').click();
    await page.waitForFunction(()=>sessionStorage.getItem('debug-day:board-room')==='b');
    await shown.waitFor();
    assert.equal(await page.locator('[data-board-id="sticky:note"]').count(),0,'Orbit idea is off the Engine, so it stays on the main board');
    await page.locator('[data-room-crumb="main"]').click();
    await page.waitForFunction(()=>!sessionStorage.getItem('debug-day:board-room'));
    await shown.waitFor();await page.locator('[data-board-id="sticky:note"]').waitFor({state:'attached'});
   }

   // 4. The Engine over the board: the row's tag goes into Sketches.
   await view.focus();await page.keyboard.press('e');
   const engine=page.getByRole('dialog',{name:'Engine'});await engine.waitFor();
   await tap(engine.locator('[data-engine-task="writing"] button.dd-engine-tag[data-from="c"]'));
   await engine.waitFor({state:'detached'});
   await page.waitForFunction(()=>sessionStorage.getItem('debug-day:board-room')==='c');

   // 5. The Engine page: its tag opens the Board inside Sketches.
   await page.locator('[data-room-crumb="main"]').click();
   await page.waitForFunction(()=>!sessionStorage.getItem('debug-day:board-room'));
   await page.locator('[role=tab][data-panel=engine]').click();
   if(!mobile){
    await tap(page.locator('#plan [data-engine-task="writing"] button.dd-engine-tag[data-from="c"]'));
    await view.waitFor();
    await page.waitForFunction(()=>sessionStorage.getItem('debug-day:board-room')==='c');
    assert.equal(await room(),'c');
   }
   assert.equal((await task('writing')).from,'c');

   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
   assert.equal(overflow,false,'no sideways scroll');
   assert.deepEqual(errors,[]);
   await page.context().close();
   console.log('section tag ok',mobile?'phone':'desktop');
  }
 }finally{await h.stop();}
})().catch((error)=>{console.error(error);process.exit(1);});
