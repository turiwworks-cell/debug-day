const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// Where tasks come from (5.19): every Engine task can carry the section it came
// from. Each section shows its last 14 days as dots beside its name, and its
// own board lists every day's done and not-done tasks from it. Nothing is a
// copy: it is all read from the days, so every view agrees.
(async()=>{
 const h=await start();
 try {
  for(const [language,mobile] of [['en',false],['fa',false],['fa',true]]){
   const {page,errors}=await h.context(mobile),f=await fixture(page,h.origin),t=(en,fa)=>language==='fa'?fa:en;
   f.data.setup.preferences.language=language;
   f.data.setup.life={v:2,items:[
    {id:'a',type:'section',parent:'',x:40,y:60,w:900,h:620,text:'Creative life',color:'#9DD6FF'},
    {id:'c',type:'section',parent:'a',x:420,y:80,w:420,h:320,text:'Sketches',color:'#D3B8FF'},
    {id:'n',type:'sticky',parent:'c',x:40,y:90,w:220,h:160,text:'Line study',color:'#A8E6B8'},
    {id:'b',type:'section',parent:'',x:1040,y:60,w:420,h:350,text:'Work & play',color:'#FFA6D9'}
   ],links:[],frame:{x:24,y:1200}};
   // Today's "Portfolio writing" came from Sketches; last week's outreach too, and it was done.
   f.data.days[f.date].blocks.find(b=>b.id==='writing').from='c';
   Object.assign(f.data.days[f.last].blocks.find(b=>b.id==='archive'),{from:'c',done:true});
   await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
   await page.reload();await page.waitForSelector('#qa',{state:'attached'});
   const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2'))),
    block=async(id)=>(await read()).days[f.date].blocks.find(b=>b.id===id),
    tap=async(locator)=>mobile?locator.tap():locator.click(),
    strip=(id)=>page.locator(`[data-section-history="${id}"]`);
   assert.equal((await block('writing')).from,'c','the source survives loading');
   await page.locator('.views button').nth(1).click();
   await page.locator('.b2-viewport').focus();await page.keyboard.press('Control+Shift+F');await page.locator('.b2.focus-mode').waitFor();
   // The card says where it came from, in both board views.
   if((await page.locator('.b2-viewport').getAttribute('data-mode'))!=='mindmap')await page.locator('.b4-modes button').nth(0).click();
   const chip=page.locator('.dd-task-from[data-from="c"]');
   await chip.first().waitFor({state:'attached'});
   assert.match(await chip.first().innerText(),/Sketches/);
   await page.locator('.b4-modes button').nth(1).click();
   await page.locator('.b2-viewport[data-mode=lanes]').waitFor();
   assert.ok(await chip.count()>=1,'Lanes shows the same source');
   await page.locator('.b4-modes button').nth(0).click();
   await page.locator('.b2-viewport[data-mode=mindmap]').waitFor();
   // Each section shows its last 14 days; a big section counts its small ones.
   await page.locator('[data-life-jump]').click();await page.waitForTimeout(300);
   await strip('a').waitFor({state:'attached'});
   assert.match(await strip('a').innerText(),/1\/2/);
   assert.match(await strip('c').innerText(),/1\/2/);
   assert.equal(await strip('b').count(),0,'no dots for a section with no tasks yet');
   assert.equal(await strip('a').locator('i').count(),14);
   assert.equal(await strip('a').locator('i[data-state=done]').count(),1);
   assert.equal(await strip('a').locator('i[data-state=open]').count(),1);
   // The dots open the section's own board, with its record under it.
   if(mobile)await strip('a').dispatchEvent('pointerdown',{button:0});
   else await strip('a').click();
   const bar=page.locator('.dd-room-bar');await bar.waitFor();
   assert.match(await bar.innerText(),/Creative life/);
   const record=page.locator('[data-room-history="a"]');await record.waitFor();
   assert.match(await record.innerText(),new RegExp(t('Done and not done here','انجام‌شده و نشده‌های این سکشن')));
   assert.equal(await record.locator(':scope > ol > li').count(),2,'today and last week');
   const today=record.locator(`li[data-date="${f.date}"]`);
   assert.match(await today.innerText(),/Portfolio writing[\s\S]*Sketches/,'a task from a smaller section says which');
   assert.equal(await today.locator('li[data-done=false]').count(),1);
   assert.equal(await record.locator(`li[data-date="${f.last}"] li[data-done=true]`).count(),1,'last week\'s done task is there');
   if(!mobile){
    // The section's camera fit runs after its content is rendered. Keep the
    // bounds assertion, but let that scheduled fit finish before measuring it.
    await page.waitForFunction(()=>{
     const record=document.querySelector('[data-room-history="a"]'),viewport=document.querySelector('.b2-viewport');
     if(!record||!viewport)return false;
     const r=record.getBoundingClientRect(),v=viewport.getBoundingClientRect();
     return r.left>=v.left-1&&r.right<=v.right+1&&r.bottom<=v.bottom+1;
    });
    const rb=await record.boundingBox(),vb=await page.locator('.b2-viewport').boundingBox();
    assert.ok(rb.x>=vb.x-1&&rb.x+rb.width<=vb.x+vb.width+1&&rb.y+rb.height<=vb.y+vb.height+1,'the record fits on screen');
   }
   // In the Engine, every task shows where it came from and it can be changed.
   await page.locator('.b2-viewport').focus();await page.keyboard.press('e');
   const engine=page.getByRole('dialog',{name:t('Engine','انجین')});await engine.waitFor();
   const from=engine.locator('[data-engine-task="writing"] select.dd-engine-from');
   assert.equal(await from.inputValue(),'c');
   assert.equal(await from.locator('option').count(),4,'main board plus three sections');
   await from.selectOption('a');
   assert.equal((await block('writing')).from,'a');
   // A task added inside a section's board comes from that section.
   const add=engine.locator('[data-lane="work"] .dd-engine-add input');
   await add.fill('Colour script');await add.press('Enter');
   await page.waitForFunction((date)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].blocks.some(b=>b.name==='Colour script'),f.date);
   const made=(await read()).days[f.date].blocks.find(b=>b.name==='Colour script');
   assert.equal(made.from,'a');
   await page.keyboard.press('Escape');await engine.waitFor({state:'detached'});
   // The record follows at once.
   await page.waitForFunction((date)=>/Colour script/.test(document.querySelector(`[data-room-history] li[data-date="${date}"]`)?.innerText||''),f.date);
   assert.doesNotMatch(await today.innerText(),/Sketches/,'writing now comes from the big section itself');
   // A note turned into a task with "→ Plan" comes from the section it sat in.
   let fromSketches=0;
   if(!mobile){
    const note=page.locator('[data-board-id="life:n"]');
    await note.click();await note.locator('button',{hasText:'→'}).dispatchEvent('click');
    await page.waitForFunction((date)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].blocks.some(b=>b.name==='Line study'),f.date);
    assert.equal((await read()).days[f.date].blocks.find(b=>b.name==='Line study').from,'c');
    await page.waitForFunction(()=>/Line study/.test(document.querySelector('[data-room-history]')?.innerText||''));
    fromSketches=1;
   }
   // A reload keeps every source.
   await page.reload();await page.waitForSelector('#qa',{state:'attached'});
   await page.locator('.views button').nth(1).click();await record.waitFor();
   assert.equal((await block('writing')).from,'a');
   assert.equal((await read()).days[f.date].blocks.find(b=>b.name==='Colour script').from,'a');
   assert.match(await record.innerText(),/Colour script/);
   // Back on the main board the dots agree: a big section counts its small ones.
   await tap(bar.locator('[data-room-crumb="main"]'));await bar.waitFor({state:'detached'});
   await strip('a').waitFor({state:'attached'});
   // Zoomed out a small inner section hides its dots (5.23); they still count the same.
   assert.match(await strip('a').textContent(),new RegExp('1/'+(3+fromSketches)));
   assert.match(await strip('c').textContent(),new RegExp('1/'+(1+fromSketches)));
   // Moving a task back to the main board takes it out of the record.
   await page.locator('.b2-viewport').focus();await page.keyboard.press('e');await engine.waitFor();
   await engine.locator('[data-engine-task="writing"] select.dd-engine-from').selectOption('');
   assert.equal('from' in (await block('writing')),false);
   await page.keyboard.press('Escape');await engine.waitFor({state:'detached'});
   await page.waitForFunction((n)=>new RegExp('1/'+n).test(document.querySelector('[data-section-history="a"]')?.innerText||''),2+fromSketches);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
   assert.equal(overflow,false,'no sideways scroll');
   assert.deepEqual(errors,[]);
   await page.context().close();
  }
  console.log('sources ok');
 } finally {await h.stop();}
})().catch((e)=>{console.error(e);process.exit(1);});
