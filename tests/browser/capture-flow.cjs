const assert=require('node:assert/strict');
const {start,fixture,openEngine}=require('./harness.cjs');
// Capture and the daily flow (5.55). Capture is its own section, drawn apart
// above the Main board in Tab (C goes in, even before the first idea). An idea
// waiting there shows in the Engine; from its note it goes to Today or to Park.
// Pause the day sits on the board's top bar.
(async()=>{
 const h=await start();
 try{
  for(const mobile of [false,true]){
   const {page,errors}=await h.context(mobile),f=await fixture(page,h.origin);
   page.setDefaultTimeout(10000);
   const section=(id,text,x,extra={})=>({id,type:'section',parent:'',x,y:60,w:420,h:300,text,...extra});
   f.data.setup.life={v:2,items:[section('a','Studio',40)],links:[],frame:{x:24,y:1200}};
   await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
   await page.reload();await page.waitForSelector('.views',{state:'attached'});
   const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2'))),
    room=()=>page.evaluate(()=>sessionStorage.getItem('debug-day:board-room')),
    view=page.locator('.b2-viewport'),
    openTab=async()=>{await view.focus();await page.keyboard.press('Tab');await page.locator('.dd-flow').waitFor();await page.waitForFunction(()=>document.activeElement?.closest('.dd-flow'));};
   await page.locator('[role=tab][data-panel=board]').click();await view.waitFor();

   // 1. Before the first idea, Tab shows Capture as a dashed space above the Main board.
   await openTab();
   const ghost=page.locator('[data-flow-node="lf-inbox"]');
   assert.match(await ghost.getAttribute('class'),/is-ghost/);
   const [capBox,mainBox]=await Promise.all([ghost.boundingBox(),page.locator('[data-flow-node=""]').boundingBox()]);
   assert.ok(capBox.y<mainBox.y,'Capture sits above the Main board');
   // C makes it and goes in.
   await page.keyboard.press('c');
   await page.waitForFunction(()=>sessionStorage.getItem('debug-day:board-room')==='lf-inbox');
   const made=(await saved()).setup.life.items.find((i)=>i.id==='lf-inbox');
   assert.equal(made.type,'section');assert.equal(made.text,'Capture');
   await page.locator('[data-room-crumb="main"]').click();
   await page.waitForFunction(()=>!sessionStorage.getItem('debug-day:board-room'));

   // 2. Ideas in Capture: the pill is drawn apart, with how many wait there.
   await page.evaluate((date)=>{const d=JSON.parse(localStorage.getItem('debug-day:v2'));d.setup.life.items.push({id:'idea1',type:'sticky',parent:'lf-inbox',x:20,y:40,w:240,h:200,text:'Poster with moving type',color:'#FFE299',at:date},{id:'idea2',type:'sticky',parent:'lf-inbox',x:280,y:40,w:240,h:200,text:'Call the printer',color:'#FFE299',at:date});localStorage.setItem('debug-day:v2',JSON.stringify(d));},f.date);
   await page.reload();await page.waitForSelector('.views',{state:'attached'});await page.locator('[role=tab][data-panel=board]').click();await view.waitFor();
   await openTab();
   const cap=page.locator('[data-flow-node="lf-inbox"]');
   assert.match(await cap.getAttribute('class'),/is-capture/);
   assert.doesNotMatch(await cap.getAttribute('class'),/is-ghost/);
   assert.equal(await cap.locator('.dd-flow-notes').innerText(),'2');
   assert.equal(await page.locator('[data-flow-node="a"]').getAttribute('class').then((c)=>/is-capture/.test(c)),false,'other sections look as before');
   await page.keyboard.press('Escape');await page.locator('.dd-flow').waitFor({state:'detached'});

   // 3. The Engine says two ideas wait in Capture; "Sort them" opens it on the board.
   await openEngine(page);
   if(mobile){await page.keyboard.press('Escape');await page.locator('.dd-engine').waitFor({state:'detached'});}
   else{
    const line=page.locator('.dd-engine .dd-engine-capture');
    await line.waitFor();
    assert.equal(await line.getAttribute('data-capture-waiting'),'2');
    await line.locator('[data-capture-open]').click();
    await view.waitFor();
    await page.waitForFunction(()=>sessionStorage.getItem('debug-day:board-room')==='lf-inbox');

    // 4. From a note in Capture: one idea to Park, one to Today.
    const note=(id)=>page.locator(`[data-board-id="sticky:life:${id}"], [data-board-id="life:${id}"]`).first();
    await note('idea1').waitFor({state:'attached'});
    await note('idea1').locator('[data-note-park]').dispatchEvent('click');
    await page.waitForFunction(()=>(JSON.parse(localStorage.getItem('debug-day:v2')).setup.later||[]).some((b)=>b.noteRef==='idea1'));
    const parked=(await saved()).setup.later.find((b)=>b.noteRef==='idea1');
    assert.equal(parked.name,'Poster with moving type');
    await page.waitForFunction(()=>document.querySelector('[data-note-park="parked"]'));
    await note('idea2').locator('[data-note-today]').dispatchEvent('click');
    await page.waitForFunction((date)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].blocks.some((b)=>b.noteRef==='idea2'),f.date);
    const task=(await saved()).days[f.date].blocks.find((b)=>b.noteRef==='idea2');
    assert.equal('from' in task,false,'Capture is not a section tag');
    assert.equal((await saved()).setup.life.items.filter((i)=>i.parent==='lf-inbox').length,2,'the notes stay in Capture');
    // Both are sorted, so the Engine has nothing waiting.
    await openEngine(page);
    await page.locator('.dd-engine [data-engine-task]').first().waitFor();
    assert.equal(await page.locator('.dd-engine .dd-engine-capture').count(),0);
    await page.keyboard.press('Escape');await page.locator('.dd-engine').waitFor({state:'detached'});
    await page.locator('[data-room-crumb="main"]').click();
    await page.waitForFunction(()=>!sessionStorage.getItem('debug-day:board-room'));
   }

   // 5. Pause the day on the board's top bar.
   if(mobile){await page.locator('[role=tab][data-panel=board]').click();await view.waitFor();}
   const pause=page.locator('[data-pause-day]');
   if(mobile&&!await pause.isVisible())await page.locator('.b2-top-actions [aria-label="More"], .b2-top-actions .b2-more').first().click().catch(()=>{});
   await pause.click();
   const dialog=page.getByRole('dialog',{name:'Pause the day',exact:true});
   await dialog.waitFor();
   await dialog.getByRole('button',{name:'Close today, keep the tasks',exact:true}).click();
   await page.waitForFunction((date)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].pause?.closed===true,f.date);
   await page.waitForFunction(()=>document.querySelector('[data-pause-day]')?.dataset.pauseDay==='closed');
   assert.equal(await pause.getAttribute('aria-pressed'),'true');
   await pause.click();
   await dialog.waitFor();
   await dialog.getByRole('button',{name:'Continue the day',exact:true}).click();
   await page.waitForFunction((date)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].pause?.closed===false,f.date);
   assert.equal(await room(),null);

   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
   assert.equal(overflow,false,'no sideways scroll');
   assert.deepEqual(errors,[]);
   await page.context().close();
   console.log('capture flow ok',mobile?'phone':'desktop');
  }
 }finally{await h.stop();}
})().catch((error)=>{console.error(error);process.exit(1);});
