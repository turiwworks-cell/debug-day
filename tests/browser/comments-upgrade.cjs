const assert = require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
const {mkdirSync}=require('node:fs');
const {join}=require('node:path');
(async()=>{
 const h=await start();
 try {
  for(const mobile of [false,true]){
   const {page,context,errors}=await h.context(mobile),f=await fixture(page,h.origin);
   page.setDefaultTimeout(7000);
   const msg=text=>[{id:'m1',text,at:'2026-11-11T08:00:00.000Z'}];
   f.data.setup.life={v:2,items:[],links:[],comments:[{id:'shared',parent:'',x:300,y:180,pinned:true,thread:msg('A shared thought')}],frame:{x:900,y:100,w:700,h:700}};
   f.data.days[f.date].canvas={board4:{layouts:{mindmap:{}},comments:[
    {id:'first',x:110,y:240,pinned:true,thread:msg('Maybe give this idea a little more room.')},
    {id:'second',x:650,y:240,pinned:true,thread:msg('Try a slower rhythm here.')},
    {id:'resolved',x:200,y:600,pinned:true,done:true,thread:msg('Already settled')},
   ]}};
   await page.evaluate(f=>{
    localStorage.setItem('debug-day:v2',JSON.stringify(f.data));
    localStorage.setItem('debug-day:ui',JSON.stringify({view:'board'}));
    localStorage.setItem('debug-day:board-view:'+f.date,JSON.stringify({mode:'mindmap',camera:{x:10,y:60,z:0.6}}));
   },f);
   await page.reload();await page.waitForSelector('.b2-viewport');
   const thread=id=>page.locator(`[data-comment-thread="${id}"]`);
   const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2')));
   const comments=async()=>(await read()).days[f.date].canvas.board4.comments;
   await thread('first').waitFor();
   assert.equal(await page.locator('.dd-thread').count(),3,'all three pinned conversations open after reload');
   assert.equal(await thread('resolved').count(),0,'resolved pinned conversations stay hidden');
   assert.equal(await page.evaluate(()=>document.activeElement?.tagName),'BODY','restored cards do not steal focus');
   if(process.env.DEBUG_DAY_SCREENSHOTS){
    mkdirSync(process.env.DEBUG_DAY_SCREENSHOTS,{recursive:true});
    await page.locator('.b2-viewport').focus();await page.keyboard.press('Control+Shift+F');
    await page.waitForTimeout(200);
    await page.screenshot({path:join(process.env.DEBUG_DAY_SCREENSHOTS,'comments-open'+(mobile?'-phone':'')+'.png')});
   }
   const first=thread('first'),second=thread('second');
   // A reply on a restored, inactive card must go to that card, not the current pin.
   const reply=first.getByRole('textbox',{name:'Reply',exact:true});
   await reply.fill('First line');await reply.press('Shift+Enter');await reply.press('A');
   assert.equal(await reply.inputValue(),'First line\nA');
   await page.reload();await thread('first').waitFor();
   assert.equal(await thread('first').getByRole('textbox',{name:'Reply',exact:true}).inputValue(),'First line\nA','unsent reply survives reload');
   await thread('first').getByRole('textbox',{name:'Reply',exact:true}).press('Enter');
   await thread('first').getByRole('textbox',{name:'Reply',exact:true}).press('Escape');
   assert.equal((await comments()).find(c=>c.id==='first').pinned,true,'Escape in a composer never unpins');
   assert.equal((await comments()).find(c=>c.id==='first').thread.at(-1).text,'First line\nA');
   assert.equal((await comments()).find(c=>c.id==='second').thread.length,1,'another pinned thread was not changed');
   await second.getByRole('textbox',{name:'Reply',exact:true}).fill('For the second idea');
   await second.getByRole('textbox',{name:'Reply',exact:true}).press('Enter');
   assert.equal((await comments()).find(c=>c.id==='second').thread.at(-1).text,'For the second idea');
   await thread('shared').getByRole('textbox',{name:'Reply',exact:true}).fill('Shared reply');
   await thread('shared').getByRole('textbox',{name:'Reply',exact:true}).press('Enter');
   assert.equal((await read()).setup.life.comments[0].thread.at(-1).text,'Shared reply');
   await page.locator('.b2-viewport').focus();await page.keyboard.press('Escape');
   assert.equal(await page.locator('.dd-thread').count(),3,'Escape leaves pinned cards on the board');
   await first.getByRole('textbox',{name:'Reply',exact:true}).focus();
   if(mobile)await page.screenshot({path:join(process.env.DEBUG_DAY_SCREENSHOTS || require('node:os').tmpdir(),'comments-before-close.png')});
   await first.getByRole('button',{name:'Close comment',exact:true}).click();
   await first.waitFor({state:'detached'});
   assert.equal((await comments()).find(c=>c.id==='first').pinned,undefined,'explicit Close unpins');
   await page.reload();await second.waitFor();assert.equal(await first.count(),0);
   // Pinning is an ordinary, undoable data change.
   await second.getByRole('button',{name:'Unpin comment',exact:true}).click();
   assert.equal((await comments()).find(c=>c.id==='second').pinned,undefined);
   await second.getByRole('button',{name:'Keep comment open',exact:true}).click();
   assert.equal((await comments()).find(c=>c.id==='second').pinned,true);
   await second.getByRole('button',{name:'Resolve comment',exact:true}).click();
   assert.equal(await second.count(),0);
   await page.reload();assert.equal(await second.count(),0,'resolved cards do not reopen on reload');
   assert.deepEqual(errors,[]);
   if(mobile)assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal page overflow');
   if(process.env.DEBUG_DAY_SCREENSHOTS){mkdirSync(process.env.DEBUG_DAY_SCREENSHOTS,{recursive:true});await page.screenshot({path:join(process.env.DEBUG_DAY_SCREENSHOTS,'comments-upgrade'+(mobile?'-phone':'')+'.png')});}
   await context.close();
   console.log('Comments upgrade: '+(mobile?'mobile':'desktop')+' passed');
  }
  {
   const {page,context,errors}=await h.context(false),f=await fixture(page,h.origin);
   f.data.setup.preferences.language='fa';
   f.data.days[f.date].canvas={board4:{layouts:{mindmap:{}},comments:[{id:'persian',x:180,y:220,pinned:true,thread:[{id:'fa1',text:'اینجا ریتم تصویر آرام‌تر شود؟',at:'2026-11-11T08:00:00.000Z'}]}]}};
   await page.evaluate(f=>{localStorage.setItem('debug-day:v2',JSON.stringify(f.data));localStorage.setItem('debug-day:ui',JSON.stringify({view:'board'}));localStorage.setItem('debug-day:board-view:'+f.date,JSON.stringify({mode:'mindmap',camera:{x:30,y:80,z:0.8}}));},f);
   await page.reload();const card=page.locator('[data-comment-thread="persian"]');await card.waitFor();
   assert.equal(await card.getAttribute('dir'),'rtl');
   await card.getByRole('textbox',{name:'پاسخ',exact:true}).fill('بله، کمی مکث بهتر است.');
   await card.getByRole('textbox',{name:'پاسخ',exact:true}).press('Enter');
   assert.equal(await card.locator('li').count(),2);
   assert.equal(await card.getByRole('button',{name:'برداشتن سنجاق کامنت',exact:true}).count(),1);
   if(process.env.DEBUG_DAY_SCREENSHOTS)await page.screenshot({path:join(process.env.DEBUG_DAY_SCREENSHOTS,'comments-persian.png')});
   assert.deepEqual(errors,[]);await context.close();console.log('Comments upgrade: Persian passed');
  }
 } finally {await h.stop();}
})().catch(e=>{console.error(e);process.exitCode=1;});
