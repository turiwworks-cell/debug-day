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
   if(!mobile){await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),`engine-${language}.png`)});}
   assert.deepEqual(errors,[]);
   await page.context().close();
  }
  console.log('engine ok');
 } finally {await h.stop();}
})().catch((e)=>{console.error(e);process.exit(1);});
