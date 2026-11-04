const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// Focus timer (5.30): one clock that survives a reload and a second tab, a clear
// end (system notice, chime event, tab title, banner), bar mode and presets.
(async()=>{
 const h=await start();
 try{
  const {page,errors,context}=await h.context(false);
  await context.addInitScript(()=>{
   window.__notices=[];
   class FakeNotice{constructor(title,options){window.__notices.push({title,...options});}close(){}}
   FakeNotice.permission='granted';FakeNotice.requestPermission=()=>Promise.resolve('granted');
   window.Notification=FakeNotice;
   window.__ends=[];window.addEventListener('debug-day-timer-end',e=>window.__ends.push(e.detail));
  });
  const f=await fixture(page,h.origin);
  page.setDefaultTimeout(10000);
  await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
  await page.reload();await page.waitForSelector('#qa',{state:'attached'});
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:timer')||'null'));
  const chip=page.locator('.dchip').filter({hasText:'Focus'});
  const options=()=>page.getByRole('button',{name:'Timer options',exact:true});
  const plan=page.getByRole('dialog',{name:'Timer',exact:true});

  // Presets sit on the timer itself and start right away.
  await options().click();
  await plan.getByRole('button',{name:'Start 45 minutes',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('debug-day:timer')||'{}').running===true);
  assert.equal((await saved()).total,2700);
  assert.equal(await plan.getByRole('button',{name:'Start 45 minutes',exact:true}).getAttribute('aria-pressed'),'true');
  assert.ok(/(44:5\d|45:00)/.test(await chip.innerText()),await chip.innerText());

  // A reload keeps the running clock.
  await page.reload();await page.waitForSelector('#qa',{state:'attached'});
  assert.equal((await saved()).running,true);
  assert.ok(/44:\d\d|45:00/.test(await chip.innerText()),'still running after a reload: '+await chip.innerText());

  // Pause, reload, and the paused time is still there.
  await chip.click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('debug-day:timer')).running===false);
  const pausedAt=(await saved()).seconds;
  await page.reload();await page.waitForSelector('#qa',{state:'attached'});
  assert.ok((await chip.innerText()).includes(String(Math.floor(pausedAt/60)).padStart(2,'0')+':'+String(pausedAt%60).padStart(2,'0')),'paused time kept');

  // A second tab shares the same clock.
  const other=await context.newPage();
  await other.goto(h.origin);await other.waitForSelector('#qa',{state:'attached'});
  await chip.click();
  await other.waitForFunction(()=>document.querySelector('.dchip .dd-timer-mini')&&[...document.querySelectorAll('.dchip')].some(b=>b.getAttribute('style')?.includes('--now')));
  await chip.click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('debug-day:timer')).running===false);
  await other.close();

  // Bar mode: no numbers anywhere, only a bar.
  await options().click();
  await plan.getByRole('button',{name:'Bar',exact:true}).click();
  assert.equal(await plan.getByRole('textbox',{name:'Timer duration (mm:ss)',exact:true}).count(),0);
  assert.equal(await plan.getByRole('progressbar',{name:'Time left',exact:true}).count(),1);
  assert.equal(await chip.locator('.dd-timer-mini-bar').count(),1);
  assert.ok(!/\d\d:\d\d/.test(await chip.innerText()),'no numbers on the chip in bar mode');
  await page.locator('.views button[data-panel="board"]').click();
  const boardButton=page.getByRole('button',{name:'Board timer',exact:true});
  await boardButton.waitFor();
  assert.equal(await boardButton.locator('.dd-timer-mini-bar').count(),1,'the Board button follows bar mode');
  await boardButton.click();
  const panel=page.locator('.dd-board-timer');
  await panel.getByRole('button',{name:'Numbers',exact:true}).click();
  assert.ok(/\d\d:\d\d/.test(await boardButton.innerText()));

  // The end: banner, system notice, chime event and tab title, also when the window is not in front.
  const duration=panel.getByRole('textbox',{name:'Timer duration (mm:ss)',exact:true});
  await duration.fill('00:02');await duration.press('Enter');
  await panel.getByRole('button',{name:'Start timer',exact:true}).click();
  await page.evaluate(()=>{document.hasFocus=()=>false;});
  const banner=page.getByRole('alert').filter({hasText:'Time’s up'});
  await banner.waitFor({timeout:6000});
  assert.ok((await banner.innerText()).includes('are done'));
  assert.deepEqual(await page.evaluate(()=>window.__notices.map(n=>n.title)),['Time’s up']);
  assert.equal(await page.evaluate(()=>window.__ends.length),1);
  assert.equal(await page.evaluate(()=>window.__ends[0].notice),true);
  assert.ok((await page.title()).startsWith('Time’s up'),await page.title());
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  assert.ok(!(await page.title()).startsWith('Time’s up'),'the title comes back when you look');
  await banner.getByRole('button',{name:'Five more minutes',exact:true}).click();
  assert.equal(await page.locator('.dd-timer-notice').count(),0);
  assert.equal((await saved()).running,true);
  assert.equal((await saved()).total,300);
  if(!await panel.count())await boardButton.click();
  await panel.getByRole('button',{name:'Pause timer',exact:true}).click();

  // Ended while away: the banner says when, with no new sound or notice.
  await page.evaluate(()=>localStorage.setItem('debug-day:timer',JSON.stringify({running:true,deadline:Date.now()-10*60e3,total:1500,base:1500})));
  await page.reload();await page.waitForSelector('#qa',{state:'attached'});
  await page.getByRole('alert').filter({hasText:'ended at'}).waitFor();
  assert.equal(await page.evaluate(()=>window.__notices.length),0,'no late notice');
  await page.locator('.dd-timer-notice').getByRole('button',{name:'Done',exact:true}).click();
  assert.equal(await page.locator('.dd-timer-notice').count(),0);
  assert.equal((await saved()).ended,0);

  // Sound can be turned off and stays off.
  await page.getByRole('button',{name:'Board timer',exact:true}).click();
  await panel.getByRole('button',{name:'Sound when time is up',exact:true}).click();
  assert.equal((await saved()).sound,false);
  assert.ok((await panel.innerText()).includes('Notices on'));

  const out=process.env.DEBUG_DAY_SCREENSHOTS;
  if(out){
   const {mkdirSync}=require('node:fs'),{join}=require('node:path');mkdirSync(out,{recursive:true});
   await panel.getByRole('button',{name:'Sound when time is up',exact:true}).click();
   await page.screenshot({path:join(out,'timer-board.png')});
   await panel.getByRole('button',{name:'Start 25 minutes',exact:true}).click();
   await page.waitForTimeout(1200);
   await page.screenshot({path:join(out,'timer-board-running.png')});
   await panel.getByRole('button',{name:'Bar',exact:true}).click();
   await page.waitForTimeout(300);
   await page.screenshot({path:join(out,'timer-board-bar.png')});
   await panel.getByRole('button',{name:'Numbers',exact:true}).click();
   await page.keyboard.press('Escape');
   await page.locator('.views button[data-panel="plan"]').click();
   await options().click();
   await page.waitForTimeout(300);
   await page.screenshot({path:join(out,'timer-plan.png')});
   await page.evaluate(()=>localStorage.setItem('debug-day:timer',JSON.stringify({running:true,deadline:Date.now()+1200,total:1500,base:1500})));
   await page.reload();await page.waitForSelector('#qa',{state:'attached'});
   await page.getByRole('alert').filter({hasText:'Time’s up'}).waitFor();
   await page.waitForTimeout(500);
   await page.screenshot({path:join(out,'timer-banner.png')});
  }
  assert.deepEqual(errors,[]);await context.close();

  // Phone: the banner fits and the Today clock follows bar mode.
  const phone=await h.context(true);
  await phone.page.goto(h.origin);await phone.page.waitForSelector('#qa',{state:'attached'});
  await phone.page.evaluate(()=>localStorage.setItem('debug-day:timer',JSON.stringify({running:true,deadline:Date.now()+1500,total:1500,base:1500})));
  await phone.page.reload();await phone.page.waitForSelector('#qa',{state:'attached'});
  const end=phone.page.getByRole('alert').filter({hasText:'Time’s up'});
  await end.waitFor();
  const box=await end.boundingBox();
  assert.ok(box.x>=0&&box.x+box.width<=390,'banner fits the phone');
  if(out)await phone.page.screenshot({path:require('node:path').join(out,'timer-banner-phone.png')});
  assert.deepEqual(phone.errors,[]);await phone.context.close();
  console.log('Timer: reload, second tab, presets, bar mode, end notice, away notice and phone banner passed');
 }finally{await h.stop()}
})().catch(e=>{console.error(e);process.exit(1)});
