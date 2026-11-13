const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// Order (5.51): a task or a step can come "after" another, even in another task.
// The Engine shows the day in waves (side by side now, then what follows), the
// Board draws each order as a dashed arrow, and both edit the same `after`.
(async()=>{
 const h=await start();
 try{
  for(const mobile of [false,true]){
   const {page,errors}=await h.context(mobile),f=await fixture(page,h.origin);
   page.setDefaultTimeout(10000);
   const step=(id,text,extra={})=>({id,text,done:false,children:[],...extra});
   const task=(id,name,extra={})=>({id,name,type:'writing',lane:'work',min:45,note:'',pri:0,emo:'',done:false,expanded:true,subtasks:[],...extra});
   f.data.days[f.date].blocks=[
    task('sk','Sketch the poster',{pri:1,subtasks:[step('th','Thumbnails',{done:true}),step('li','Clean lines')]}),
    task('co','Colour pass'),
    task('em','Reply to emails'),
   ];
   await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
   await page.reload();await page.waitForSelector('#qa',{state:'attached'});
   const day=()=>page.evaluate((date)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date],f.date),
    tap=async(locator)=>mobile?locator.tap():locator.click(),
    find=(blocks,id)=>blocks.find((b)=>b.id===id);
   await page.locator('[role=tab][data-panel=board]').click();
   const view=page.locator('.b2-viewport');await view.waitFor();
   const openEngine=async()=>{await view.focus();await page.keyboard.press('e');const e=page.getByRole('dialog',{name:'Engine'});await e.waitFor();return e;};
   let engine=await openEngine();
   // No order yet: one plain list, no waves.
   assert.equal(await engine.locator('.dd-engine-wave-head').count(),0,'a day without order stays a plain list');

   // 1. Colour pass comes after Sketch: picked in its details.
   const colour=engine.locator('[data-engine-task="co"]');
   await tap(colour.locator('.dd-engine-more'));
   await colour.locator('.dd-engine-details select.dd-engine-after-pick').selectOption('b:sk');
   assert.deepEqual(find((await day()).blocks,'co').after,['b:sk']);
   await engine.locator('[data-engine-task="co"][data-wave="1"]').waitFor();
   assert.match(await engine.locator('[data-wave-head="0"]').innerText(),/Now[\s\S]*2 side by side/);
   assert.match(await engine.locator('[data-wave-head="1"]').innerText(),/Next/);
   assert.match(await colour.locator('.dd-engine-after[data-waiting]').innerText(),/After Sketch the poster/);
   assert.equal(await colour.getAttribute('data-waiting-on'),'b:sk');
   // The chip in the details takes it away again, and puts it back.
   await tap(colour.locator('.dd-engine-after-chip button'));
   await page.waitForFunction((date)=>!('after' in JSON.parse(localStorage.getItem('debug-day:v2')).days[date].blocks[1]),f.date);
   await engine.locator('.dd-engine-wave-head').first().waitFor({state:'detached'});
   await colour.locator('.dd-engine-details select.dd-engine-after-pick').selectOption('b:sk');
   await engine.locator('[data-engine-task="co"][data-wave="1"]').waitFor();

   // 2. A step waits for a task in another wave: Clean lines after Reply to emails.
   const sketch=engine.locator('[data-engine-task="sk"]');
   await tap(sketch.locator('.dd-engine-steps-toggle'));
   const lines=sketch.locator('[data-step="li"]');
   await tap(lines.locator('[data-step-order="li"]'));
   await lines.locator('select.dd-engine-after-pick').selectOption('b:em');
   let blocks=(await day()).blocks;
   assert.deepEqual(find(blocks,'sk').subtasks[1].after,['b:em']);
   await lines.locator('.dd-engine-step-after[data-waiting]').waitFor();
   // Sketch waits for its step's order, so it moves to the next wave after Emails.
   await engine.locator('[data-engine-task="sk"][data-wave="1"]').waitFor();
   await engine.locator('[data-engine-task="co"][data-wave="2"]').waitFor();
   assert.match(await engine.locator('[data-wave-head="2"]').innerText(),/After that/);
   assert.equal(await engine.locator('[data-engine-task="em"]').getAttribute('data-next'),'true','the first task that can start is up next');
   // Ticking Emails frees the step: Sketch is up next again.
   await tap(engine.locator('[data-engine-task="em"] .dd-engine-check'));
   await engine.locator('[data-engine-task="sk"][data-wave="0"]').waitFor();
   assert.equal(await sketch.getAttribute('data-next'),'true');
   assert.equal(await lines.locator('.dd-engine-step-after[data-waiting]').count(),0);
   await page.keyboard.press('Escape');await engine.waitFor({state:'detached'});

   // 3. The Board draws both orders as dashed arrows, read from the same data.
   const orders=page.locator('[data-wire-kind="order"]');
   await page.waitForFunction(()=>document.querySelectorAll('[data-wire-kind="order"]').length===2);
   assert.equal(await orders.count(),2);
   assert.equal(await page.locator('[data-wire-id="auto:after:b:sk->b:co"] .b4-wire-line').getAttribute('stroke-dasharray'),'6 5');
   if(!mobile){
    // Deleting the line removes the order and keeps both tasks; undo brings it back.
    await page.locator('[data-wire-id="auto:after:b:sk->b:co"] .b4-wire-hit').focus();
    await page.keyboard.press('Delete');
    await page.waitForFunction((date)=>!('after' in JSON.parse(localStorage.getItem('debug-day:v2')).days[date].blocks.find((b)=>b.id==='co')),f.date);
    assert.equal((await day()).blocks.length,3,'tasks stay');
    await view.focus();await page.keyboard.press('Control+z');
    await page.waitForFunction((date)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].blocks.find((b)=>b.id==='co').after?.[0]==='b:sk',f.date);
    // Picking a card brings its own lines forward and lets the rest step back.
    await page.locator('[data-board-id="b:em"] .b4-node-body').first().click();
    await page.waitForFunction(()=>Number(document.querySelector('[data-wire-id="auto:after:b:sk->b:co"] .b4-wire-line')?.style.opacity)<1);
    assert.equal(await page.locator('[data-wire-id="auto:after:b:em->sub:sk:li"] .b4-wire-line').evaluate((e)=>e.style.opacity),'1');
    await page.keyboard.press('Escape');
    // The Engine page (the tab) shows the same waves.
    await page.locator('[role=tab][data-panel=engine]').click();
    await page.locator('#plan [data-engine-task="co"][data-wave="1"]').waitFor();
   }

   // 4. Deleting a task takes the orders that point at it along.
   engine=mobile?await openEngine():page.locator('#plan');
   const sk=engine.locator('[data-engine-task="sk"]');
   await tap(sk.locator('.dd-engine-more'));
   await tap(sk.locator('[data-action="remove"]'));
   await page.waitForFunction((date)=>!JSON.parse(localStorage.getItem('debug-day:v2')).days[date].blocks.some((b)=>b.id==='sk'),f.date);
   if(mobile){await page.keyboard.press('Escape');await engine.waitFor({state:'detached'});}
   else{await page.locator('[role=tab][data-panel=board]').click();await view.waitFor();}
   await page.waitForFunction((date)=>!('after' in JSON.parse(localStorage.getItem('debug-day:v2')).days[date].blocks.find((b)=>b.id==='co')),f.date);
   assert.equal(await orders.count(),0,'no line left pointing at nothing');

   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
   assert.equal(overflow,false,'no sideways scroll');
   assert.deepEqual(errors,[]);
   await page.context().close();
   console.log('engine flow ok',mobile?'phone':'desktop');
  }
 }finally{await h.stop();}
})().catch((error)=>{console.error(error);process.exit(1);});
