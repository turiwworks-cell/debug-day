const assert=require('node:assert/strict');
const {start,fixture,openEngine}=require('./harness.cjs');
// The daily routine (5.56). The Engine's Routine panel sets how mornings
// start: "Bring them to Today" brings the last day's open tasks in by itself
// the next time today opens. A task's ⋯ can make it repeat every day; it goes
// into the day templates and the panel lists it, with Stop.
(async()=>{
 const h=await start();
 try{
  for(const mobile of [false,true]){
   const {page,errors}=await h.context(mobile),f=await fixture(page,h.origin);
   page.setDefaultTimeout(10000);
   await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
   await page.reload();await page.waitForSelector('.views',{state:'attached'});
   const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2'))),
    engine=page.locator('.dd-engine');
   await openEngine(page);
   await engine.waitFor();
   const open=(await saved()).days[f.last].blocks.filter((b)=>!b.done&&b.name.trim()).map((b)=>b.name);
   assert.ok(open.length>0);

   // 1. Routine: bring the last day's open tasks by themselves.
   await engine.locator('[data-routine-toggle]').click();
   const panel=page.getByRole('dialog',{name:'Daily routine',exact:true});
   await panel.waitFor();
   assert.equal(await panel.locator('[data-routine-mode="ask"]').getAttribute('aria-checked'),'true','asking is the default');
   await panel.locator('[data-routine-mode="bring"]').click();
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.preferences.routine?.leftovers==='bring');
   await panel.getByRole('button',{name:'Close',exact:true}).click();
   // Next morning (here: the next load of today) they are in today, once.
   await page.evaluate(()=>localStorage.removeItem('debug-day:routine-ran'));
   await page.reload();await page.waitForSelector('.views',{state:'attached'});
   await page.waitForFunction(([date,names])=>{const day=JSON.parse(localStorage.getItem('debug-day:v2')).days[date];return day&&names.every((n)=>day.blocks.some((b)=>b.name===n));},[f.date,open]);
   const count=(await saved()).days[f.date].blocks.length;
   await page.evaluate(()=>localStorage.removeItem('debug-day:routine-ran'));
   await page.reload();await page.waitForSelector('.views',{state:'attached'});
   await page.waitForTimeout(500);
   assert.equal((await saved()).days[f.date].blocks.length,count,'running again brings nothing twice');

   // 2. Repeat every day from a task's ⋯.
   await openEngine(page);
   const row=engine.locator('[data-engine-task="writing"]');
   await row.waitFor();
   await row.locator('.dd-engine-more').click();
   await row.getByRole('group',{name:'Repeat',exact:true}).getByRole('button',{name:'Every day',exact:true}).click();
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.templates.every((tp)=>tp.blocks.some((b)=>b.id==='rtwriting')));
   assert.equal(await row.getByRole('group',{name:'Repeat',exact:true}).getByRole('button',{name:'Every day',exact:true}).getAttribute('aria-pressed'),'true');
   await engine.locator('[data-routine-toggle]').click();
   await panel.waitFor();
   assert.match(await panel.locator('[data-routine-repeat="rtwriting"]').innerText(),/Portfolio writing/);
   await panel.locator('[data-routine-repeat="rtwriting"] button').click();
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('debug-day:v2')).setup.templates.every((tp)=>!tp.blocks.some((b)=>b.id==='rtwriting')));
   await panel.locator('.dd-routine-empty').waitFor();

   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
   assert.equal(overflow,false,'no sideways scroll');
   assert.deepEqual(errors,[]);
   await page.context().close();
   console.log('routine ok',mobile?'phone':'desktop');
  }
 }finally{await h.stop();}
})().catch((error)=>{console.error(error);process.exit(1);});
