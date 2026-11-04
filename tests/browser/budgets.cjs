const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// Soft budgets and goals (5.44): a section can carry a gentle budget ("2h a
// week"); it adds up the done tasks that came from it, read from the days, so
// nothing is copied. "→ Today" on a Feed note adds a task and keeps the note.
// A goal note counts up in the Goals rail. No red, no warnings.
(async()=>{
 const h=await start();
 try{
  for(const mobile of [false,true]){
   const {page,errors,context}=await h.context(mobile),f=await fixture(page,h.origin);
   page.setDefaultTimeout(10000);
   f.data.setup.life={v:2,items:[
    {id:'s',type:'section',parent:'',x:40,y:60,w:620,h:380,text:'Drawing',color:'#9DD6FF',budget:{n:2,unit:'h',per:'week'}},
    {id:'idea',type:'sticky',parent:'s',x:30,y:80,w:200,h:200,text:'Ink test\n- [ ] Brush pens',color:'#FFE08A'},
    {id:'goal',type:'sticky',parent:'',x:760,y:60,w:220,h:220,text:'35 drawings',color:'#A8E6B8',role:'goal',goal:{n:3,of:35,junk:1}},
   ],links:[],frame:{x:24,y:700,w:1420,h:700}};
   Object.assign(f.data.days[f.date].blocks.find((b)=>b.id==='writing'),{from:'s',done:true,min:90});
   f.data.days[f.date].canvas={board4:{layouts:{mindmap:{}},locked:[],styles:{},links:[]}};
   await page.evaluate((d)=>{localStorage.setItem('debug-day:v2',JSON.stringify(d.data));localStorage.setItem('debug-day:board-view:'+d.date,JSON.stringify({camera:{x:40,y:150,z:0.5},mode:'mindmap'}));localStorage.setItem('debug-day:ui',JSON.stringify({view:'board'}));},{data:f.data,date:f.date});
   await page.reload();await page.waitForSelector('#qa',{state:'attached'});
   const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2'))),
    section=async()=>(await read()).setup.life.items.find((i)=>i.id==='s'),
    node=(ref)=>page.locator(`[data-board-id="${ref}"]`),
    view=page.locator('.b2-viewport'),
    settle=()=>page.waitForTimeout(350),
    menu=()=>page.getByRole('menu',{name:'Board context menu'}),
    menuItem=(name)=>menu().getByRole('menuitem',{name,exact:true}),
    openMenu=async(ref)=>{const target=node(ref).locator(':scope>.b4-node-body');if(mobile)await target.dispatchEvent('contextmenu');else await target.click({button:'right'});await menu().waitFor();},
    pick=async(ref)=>{const b=await node(ref).locator(':scope>.b4-node-body').boundingBox();if(mobile)await page.touchscreen.tap(b.x+b.width/2,b.y+Math.min(30,b.height/2));else await page.mouse.click(b.x+b.width/2,b.y+Math.min(30,b.height/2));await page.waitForTimeout(150);},
    budget=page.locator('[data-section-budget="s"]');
   await view.waitFor();
   if(!mobile){await view.focus();await page.keyboard.press('Control+Shift+F');await page.locator('.b2.focus-mode').waitFor();}
   await view.focus();await page.keyboard.press('Shift+1');await settle();
   // The goal survives loading, without unknown fields.
   assert.deepEqual((await read()).setup.life.items.find((i)=>i.id==='goal').goal,{n:3,of:35});
   // 1. Beside the section's name: today's count and the budget, from the done task.
   await budget.waitFor({state:'attached'});
   assert.equal(await budget.textContent(),'1h 30m / 2h · week');
   assert.equal(await budget.getAttribute('data-reached'),'false','not reached yet, and nothing is red');
   assert.match(await page.locator('[data-section-history="s"] [data-section-today]').textContent(),/1 today/);
   // 2. The menu changes the budget; "No budget" takes it away.
   await pick('life:s');await openMenu('life:s');
   await menuItem('Soft budget').click();
   await menuItem('1h a day').click();await settle();
   assert.deepEqual((await section()).budget,{n:1,unit:'h',per:'day'});
   assert.equal(await budget.textContent(),'1h 30m / 1h · today');
   assert.equal(await budget.getAttribute('data-reached'),'true');
   await openMenu('life:s');await menuItem('Soft budget').click();
   assert.match(await menuItem('1h a day').getAttribute('class'),/checked/,'the menu shows the budget it has');
   await menuItem('3 times a week').click();await settle();
   assert.deepEqual((await section()).budget,{n:3,unit:'tasks',per:'week'});
   assert.equal(await budget.textContent(),'1 / 3 · week');
   await openMenu('life:s');await menuItem('Soft budget').click();await menuItem('No budget').click();await settle();
   assert.equal('budget' in (await section()),false);
   assert.equal(await budget.count(),0);
   // 3. "→ Today" on a Feed note: a task for the day, the note stays.
   await page.keyboard.press('Escape');await pick('life:idea');
   const toToday=node('life:idea').locator('.b4-sticky-head button',{hasText:'Today'});
   assert.equal((await toToday.textContent()).trim(),'→ Today');
   await toToday.dispatchEvent('click');
   await page.waitForFunction((date)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].blocks.some((b)=>b.noteRef==='idea'),f.date);
   let data=await read(),made=data.days[f.date].blocks.find((b)=>b.noteRef==='idea');
   assert.equal(made.name,'Ink test');
   assert.equal(made.from,'s','the task comes from the note’s section');
   assert.deepEqual(made.subtasks.map((s)=>s.text),['Brush pens']);
   assert.ok(data.setup.life.items.some((i)=>i.id==='idea'),'the note stays in the Feed');
   await page.waitForFunction(()=>/● Today/.test(document.querySelector('[data-board-id="life:idea"] [data-note-today]')?.textContent||''));
   await toToday.dispatchEvent('click');await settle();
   assert.equal((await read()).days[f.date].blocks.filter((b)=>b.noteRef==='idea').length,1,'a second tap does not add it twice');
   assert.match(await page.locator('[data-section-history="s"] [data-section-today]').textContent(),/2 today/);
   // 4. The goal counts up in the Goals rail.
   await page.keyboard.press('Escape');
   await page.locator('[data-rail-toggle="goal"]').click();
   const counter=page.locator('[data-goal-counter="goal"]');await counter.waitFor();
   assert.equal(await counter.locator('b').textContent(),'3 of 35');
   await counter.getByRole('button',{name:'One more'}).click();
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.life.items.find((i)=>i.id==='goal').goal.n===4);
   assert.equal(await counter.locator('b').textContent(),'4 of 35');
   await counter.getByRole('button',{name:'Target and date'}).click();
   const until=new Date(Date.parse(f.date+'T12:00:00Z')+9*864e5).toISOString().slice(0,10);
   await counter.getByLabel('Until').fill(until);
   await page.waitForFunction(()=>/9 days left/.test(document.querySelector('[data-goal-counter="goal"] b')?.textContent||''));
   // 5. A reload keeps all of it, and the task in Plan is the same task.
   await page.reload();await page.waitForSelector('#qa',{state:'attached'});
   data=await read();
   assert.equal(data.days[f.date].blocks.find((b)=>b.id===made.id).noteRef,'idea');
   assert.deepEqual(data.setup.life.items.find((i)=>i.id==='goal').goal,{n:4,of:35,until});
   await page.locator('.views button',{hasText:'Plan'}).click();await settle();
   const row=page.locator(`#plan .item[data-block-id="${made.id}"]`);await row.waitFor({state:'attached'});
   if(!mobile)assert.equal(await row.isVisible(),true,'Plan shows the task from the note');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
   assert.equal(overflow,false);
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('budgets: soft section budgets, → Today keeps the note, goal counter');
 }finally{await h.stop();}
})().catch((error)=>{console.error(error);process.exitCode=1;});
