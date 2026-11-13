const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// Light and heavy tasks, deadlines and the Week view (5.46): a task can be
// marked light or heavy in the Engine; a tired day offers the light ones first; a
// Feed note or section can carry a deadline; the Calendar shows section colors,
// deadlines and a Week view with a short look back and next week's focus.
(async()=>{
 const h=await start();
 try{
  for(const mobile of [false,true]){
   const {page,errors,context}=await h.context(mobile),f=await fixture(page,h.origin);
   page.setDefaultTimeout(10000);
   const shift=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*864e5).toISOString().slice(0,10),
    weekStart=(d)=>shift(d,-((new Date(d+'T12:00:00Z').getUTCDay()+6)%7)),
    // A day inside this week other than today, so a task can move there.
    other=shift(f.date,new Date(f.date+'T12:00:00Z').getUTCDay()===0?-1:1);
   f.data.setup.life={v:2,items:[
    {id:'s',type:'section',parent:'',x:40,y:60,w:620,h:380,text:'Client work',color:'#9DD6FF',due:shift(f.date,8)},
    {id:'fox',type:'sticky',parent:'s',x:30,y:80,w:200,h:200,text:'Deliver fox loop',color:'#FFE08A',due:shift(f.date,2)},
    {id:'owl',type:'sticky',parent:'s',x:270,y:80,w:200,h:200,text:'Owl',color:'#A8E6B8'},
   ],links:[],frame:{x:24,y:700,w:1420,h:700}};
   f.data.days[f.date].mood='😕';
   f.data.days[f.date].blocks=[
    {id:'a',name:'Animate fox loop',type:'writing',lane:'work',min:120,done:false,from:'s',subtasks:[],expanded:false},
    {id:'b',name:'Reply to emails',type:'writing',lane:'work',min:30,done:false,subtasks:[],expanded:false},
   ];
   if(mobile)f.data.days[f.date].blocks[1].energy='light';
   await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
   await page.reload();await page.waitForSelector('#qa',{state:'attached'});
   const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2'))),
    nudge=(id)=>page.locator(`[data-nudge="${id}"]:visible`);
   if(!mobile){
    // 1. Light or heavy, from the task's details in the Engine.
    const row=page.locator('.dd-engine [data-engine-task="b"]');
    await row.locator('.dd-engine-more').click();
    await row.getByRole('group',{name:'Energy'}).getByRole('button',{name:'light',exact:true}).click();
    await page.waitForFunction((d)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[d].blocks.find((b)=>b.id==='b').energy==='light',f.date);
    assert.equal(await row.locator('.dd-engine-meta .dd-energy').innerText(),'light');
    const other=page.locator('.dd-engine [data-engine-task="a"]');
    await other.locator('.dd-engine-more').click();
    await other.getByRole('group',{name:'Energy'}).getByRole('button',{name:'heavy',exact:true}).click();
    await page.waitForFunction((d)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[d].blocks.find((b)=>b.id==='a').energy==='heavy',f.date);
   }
   // 2. A tired day points to the light tasks and can put them first.
   await nudge('low').waitFor();
   assert.match(await nudge('low').innerText(),/A tired day[\s\S]*Reply to emails/);
   await nudge('low').getByRole('button',{name:'Light ones first'}).click();
   await page.waitForFunction((d)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[d].blocks[0].id==='b',f.date);
   await nudge('low').waitFor({state:'detached'});
   if(!mobile){
    // 3. A deadline on a Feed note, from its menu; it shows above the note.
    await page.locator('.views button',{hasText:'Board'}).click();
    const view=page.locator('.b2-viewport');await view.waitFor();
    await view.focus();await page.keyboard.press('Control+Shift+F');await page.locator('.b2.focus-mode').waitFor();
    await view.focus();await page.keyboard.press('Shift+1');await page.waitForTimeout(350);
    assert.equal(await page.locator('[data-due-badge="life:fox"]').innerText(),'◆ 2 days left');
    assert.match(await page.locator('[data-section-due="s"]').innerText(),/◆ 8 days left/);
    const owl=await page.locator('[data-board-id="life:owl"]>.b4-node-body').boundingBox();
    await page.mouse.click(owl.x+owl.width/2,owl.y+40,{button:'right'});
    await page.getByRole('menuitem',{name:'Deadline…',exact:true}).click();
    const editor=page.locator('.dd-due-editor');await editor.waitFor();
    await editor.getByRole('button',{name:'In a week'}).click();
    await editor.waitFor({state:'detached'});
    await page.waitForFunction((d)=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.find((i)=>i.id==='owl').due===d,shift(f.date,7));
    assert.equal(await page.locator('[data-due-badge="life:owl"]').innerText(),'◆ 7 days left');
    // The badge opens the same card; a date can be typed, and taken away.
    await page.locator('[data-due-badge="life:owl"]').click();
    await editor.waitFor();
    await editor.getByLabel('Due on').fill(shift(f.date,20));
    await page.waitForFunction((d)=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.find((i)=>i.id==='owl').due===d,shift(f.date,20));
    await editor.getByRole('button',{name:'No deadline'}).click();
    await page.waitForFunction(()=>!('due' in JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.find((i)=>i.id==='owl')));
    await page.locator('[data-due-badge="life:owl"]').waitFor({state:'detached'});
    // The Plan task card on the Board says it is heavy.
    assert.match(await page.locator('[data-board-id="b:a"] .b4-node-subtitle').textContent(),/heavy/);
    await page.keyboard.press('Escape');
    await view.focus();await page.keyboard.press('Control+Shift+F');
   }
   // 4. The month shows deadlines and section colors.
   await page.locator('.views button',{hasText:'Calendar'}).click();
   await page.locator('.dd-review-calendar').waitFor();
   if(await page.locator('[data-cal-mode="month"][aria-pressed="true"]').count()===0)await page.locator('[data-cal-mode="month"]').click();
   await page.locator(`[data-review-date="${f.date}"] .dd-cal-sections`).waitFor();
   assert.equal(await page.locator(`[data-review-date="${f.date}"] .dd-cal-sections`).getAttribute('data-cal-sections'),'s');
   assert.match(await page.locator(`[data-review-date="${shift(f.date,2)}"]`).getAttribute('aria-label'),/deadline: Deliver fox loop/);
   // 5. The Week view: tasks by day, ticked off or moved, and the same everywhere.
   await page.locator('[data-cal-mode="week"]').click();
   const week=page.locator('.dd-week');await week.waitFor();
   const today=page.locator(`[data-week-date="${f.date}"]`);
   assert.match(await today.innerText(),/Reply to emails[\s\S]*Animate fox loop/);
   await today.locator('[data-week-task="b"] .dd-week-check').click();
   await page.waitForFunction((d)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[d].blocks.find((b)=>b.id==='b').done===true,f.date);
   if(!mobile){
    await today.locator('[data-week-task="a"]').dragTo(page.locator(`[data-week-date="${other}"]`));
    await page.waitForFunction((d)=>(JSON.parse(localStorage.getItem('debug-day:v2')).days[d]?.blocks||[]).some((b)=>b.id==='a'),other);
    assert.equal((await read()).days[f.date].blocks.some((b)=>b.id==='a'),false,'moved, not copied');
    await page.locator(`[data-week-date="${other}"] [data-week-task="a"]`).waitFor();
   }
   // 6. The look back, and a focus for next week that greets that week.
   const review=page.locator('.dd-week-review');
   assert.match(await review.locator('.dd-week-total').innerText(),/1 of 2 tasks done · 30m/);
   assert.match(await review.innerText(),/Deadlines[\s\S]*Deliver fox loop/);
   const focus=review.getByRole('textbox');
   await focus.fill('Finish the fox loop');
   await review.locator('h2').click();
   const next=shift(weekStart(f.date),7);
   await page.waitForFunction((d)=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.reviews?.[d]?.focus==='Finish the fox loop',next);
   await week.getByRole('button',{name:'Next week'}).click();
   await page.waitForFunction(()=>/This week: Finish the fox loop/.test(document.querySelector('.dd-week-head p')?.textContent||''));
   // The Week view is remembered.
   await page.reload();
   await page.locator('.dd-week').waitFor();
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
   assert.equal(overflow,false);
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('week: light and heavy, tired-day nudge, deadlines, calendar colors, Week view and look back');
 }finally{await h.stop();}
})().catch((error)=>{console.error(error);process.exitCode=1;});
