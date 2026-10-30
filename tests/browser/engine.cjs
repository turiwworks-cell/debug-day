const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// The Engine (5.16): E brings today's tasks over the dimmed board, where they
// can be ticked, scored, moved to their one lane and added; Ctrl+Space lists
// the Engine first and opens it from any view; Feelings is gone.
(async()=>{
 const h=await start();
 try {
  for(const [language,mobile] of [['en',false],['fa',false],['fa',true]]){
   const {page,errors}=await h.context(mobile),f=await fixture(page,h.origin),t=(en,fa)=>language==='fa'?fa:en;
   f.data.setup.preferences.language=language;
   await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
   await page.reload();await page.waitForSelector('#qa',{state:'attached'});
   const day=async()=>(await page.evaluate((date)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date],f.date));
   // Ctrl+Space: the Engine is the first row and opens the Board with the Engine on top.
   await page.keyboard.press('Control+Space');
   const first=page.locator('[role=option]').first();await first.waitFor();
   assert.match(await first.innerText(),new RegExp(t('Engine','انجین')),'Engine is the first command');
   assert.equal(await page.locator('[role=option]',{hasText:t('Feelings','احساسات')}).count(),0,'no Feelings panel row');
   await first.click();
   const engine=page.getByRole('dialog',{name:t('Engine','انجین')});await engine.waitFor();
   assert.ok(await page.locator('.b2-viewport').count(),'the Board is open behind it');
   // Tick a task; Plan and the Board share the change.
   const row=engine.locator('[data-engine-task="writing"]');
   await row.locator('.dd-engine-check').click();
   assert.equal((await day()).blocks.find(b=>b.id==='writing').done,true);
   // Score: switch kind, pick 8.
   await row.getByRole('button',{name:t('Score','نمره‌ای'),exact:true}).click();
   await row.getByRole('button',{name:t('Score 8','نمره 8'),exact:true}).click();
   let w=(await day()).blocks.find(b=>b.id==='writing');
   assert.equal(w.measure,'score');assert.equal(w.score,8);assert.equal(w.done,true);
   // One lane only: moving it to Life takes it out of Work.
   await row.locator('select.dd-engine-lane').selectOption('life');
   assert.equal((await day()).blocks.find(b=>b.id==='writing').lane,'life');
   assert.equal(await engine.locator('[data-lane="life"] [data-engine-task="writing"]').count(),1);
   // Add a task straight into a lane.
   const add=engine.locator('[data-lane="work"] .dd-engine-add input');
   await add.fill('Ink the keyframes');await add.press('Enter');
   const added=(await day()).blocks.find(b=>b.name==='Ink the keyframes');
   assert.ok(added,'new task saved');assert.equal(added.lane,'work');
   // Typing E in a field does not close; Escape does.
   await add.fill('e');assert.ok(await engine.isVisible());await add.fill('');
   await page.keyboard.press('Escape');await engine.waitFor({state:'detached'});
   // E on the board brings it back; E again closes it.
   await page.locator('.b2-viewport').focus();await page.keyboard.press('e');await engine.waitFor();
   const dim=await page.locator('.dd-engine-backdrop').evaluate(e=>getComputedStyle(e).backgroundColor);
   assert.match(dim,/rgba\(18, 18, 17, 0\.55\)/,'the board behind is dimmed');
   await engine.locator('.dd-engine-name').first().focus();await page.keyboard.press('e');await engine.waitFor({state:'detached'});
   // Shift+E still opens stickers.
   await page.locator('.b2-viewport').focus();await page.keyboard.press('Shift+E');
   await page.locator('.dd-sticker-dialog').waitFor();await page.keyboard.press('Escape');
   // The toolbar Engine button jumps to the engine; the day root is named Engine.
   assert.ok(await page.locator('[data-engine-jump]').count(),'Engine button in the board toolbar');
   assert.match(await page.locator('[data-board-id="day:root"]').innerText(),new RegExp(t('Engine','انجین')));
   // Feelings are gone from the Board.
   assert.equal(await page.locator('[data-board-id="section:feelings"]').count(),0,'no Feelings section');
   assert.equal(await page.locator('[data-board-id="bug:feeling"]').count(),0,'no feeling cards');
   assert.equal((await day()).bugs.length,1,'old feelings stay in the data');
   // Phase 2: the Engine has its own section around today's tree.
   await page.locator('.b2-viewport').focus();await page.keyboard.press('Shift+Digit3');await page.waitForTimeout(300);
   const area=page.locator('[data-board-id="section:engine"]');await area.waitFor();
   const ab=await area.boundingBox(),rb=await page.locator('[data-board-id="day:root"]').boundingBox();
   assert.ok(rb.x>=ab.x&&rb.y>=ab.y&&rb.x+rb.width<=ab.x+ab.width&&rb.y+rb.height<=ab.y+ab.height,'the day root sits inside the Engine section');
   assert.match(await area.innerText(),new RegExp(t('Engine','انجین')));
   // Its button brings the Engine over the board.
   if(mobile){await page.locator('.b2-viewport').focus();await page.keyboard.press('e');}
   else await area.locator('.dd-engine-area-title button').click();
   await engine.waitFor();
   // Earlier Engine: copy last week's task into today.
   await engine.getByRole('button',{name:t('Earlier Engine','انجین روزهای قبل'),exact:true}).click();
   const earlier=engine.locator('.dd-engine-earlier');await earlier.waitFor();
   assert.equal(await earlier.getAttribute('data-earlier-date'),f.last);
   await earlier.locator('[data-earlier-task="archive"] .dd-engine-copy').click();
   const copied=(await day()).blocks.filter(b=>b.name==='Last week outreach');
   assert.equal(copied.length,1,'copied once');assert.notEqual(copied[0].id,'archive');assert.equal(copied[0].done,false);
   await earlier.locator('[data-earlier-task="archive"] .dd-engine-here').waitFor();
   assert.ok(await engine.locator('.dd-engine-name',{hasText:'Last week outreach'}).count(),'it shows in today\'s Engine');
   await page.keyboard.press('Escape');await engine.waitFor({state:'detached'});
   if(!mobile){
    // A note dropped into the Engine's section becomes a task there.
    // A note that already sits inside stays a note when nudged.
    const world=await page.locator('[data-board-id="section:engine"]').evaluate(el=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top),w:parseFloat(el.style.width),h:parseFloat(el.style.height)}));
    await page.evaluate(([date,w])=>{const d=JSON.parse(localStorage.getItem('debug-day:v2'));d.days[date].notes.push({id:'drop',kind:'sticky',text:'Find reference films\nCollect three',color:'#FFE299',x:1500,y:120},{id:'stay',kind:'sticky',text:'Keep me',color:'#FFE299',x:w.x+w.w/2-110,y:w.y+w.h-170});localStorage.setItem('debug-day:v2',JSON.stringify(d));},[f.date,world]);
    await page.reload();await page.waitForSelector('#qa',{state:'attached'});
    await page.locator('.views button').nth(1).click();
    await page.locator('.b2-viewport').focus();await page.keyboard.press('Shift+Digit1');await page.waitForTimeout(400);
    const stay=page.locator('[data-board-id="sticky:stay"]'),sb=await stay.boundingBox();
    await page.mouse.move(sb.x+sb.width/2,sb.y+8);await page.mouse.down();
    await page.mouse.move(sb.x+sb.width/2-12,sb.y+10,{steps:6});await page.mouse.up();await page.waitForTimeout(300);
    assert.ok((await day()).notes.some(n=>n.id==='stay'),'a note moved inside the Engine stays a note');
    assert.ok(!(await day()).blocks.some(b=>b.name==='Keep me'));
    const note=page.locator('[data-board-id="sticky:drop"]');await note.waitFor();
    const nb=await note.boundingBox(),eb=await page.locator('[data-board-id="section:engine"]').boundingBox();
    await page.mouse.move(nb.x+nb.width/2,nb.y+8);await page.mouse.down();
    await page.mouse.move(eb.x+eb.width-60,eb.y+eb.height-40,{steps:14});await page.mouse.up();
    await page.waitForFunction((date)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].blocks.some(b=>b.name==='Find reference films'),f.date);
    const made=(await day()).blocks.find(b=>b.name==='Find reference films');
    assert.deepEqual(made.subtasks.map(s=>s.text),['Collect three']);
    assert.ok(['work','life'].includes(made.lane),'it joins a lane');
    assert.ok(!(await day()).notes.some(n=>n.id==='drop'),'the note is used up');
   }
   if(!mobile){await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),`engine-${language}.png`)});}
   assert.deepEqual(errors,[]);
   await page.context().close();
  }
  console.log('engine ok');
 } finally {await h.stop();}
})().catch((e)=>{console.error(e);process.exit(1);});
