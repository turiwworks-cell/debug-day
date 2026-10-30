const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
const {mkdirSync}=require('node:fs');
const {join}=require('node:path');
// Sections behave like FigJam: drawn around things they take them in, carry
// what is nested, keep their title clear of the toolbar, and Delete takes contents.
(async()=>{
 const h=await start();
 try {
  for(const language of ['en','fa']){
   const {page,errors}=await h.context(false),f=await fixture(page,h.origin),t=(en,fa)=>language==='fa'?fa:en;
   f.data.setup.preferences.language=language;
   f.data.setup.life={v:2,items:[
    {id:'a',type:'section',parent:'',x:120,y:120,w:420,h:300,text:'Creative life',color:'#9DD6FF'},
    {id:'n',type:'sticky',parent:'a',x:40,y:60,w:200,h:160,text:'Shared idea',color:'#FFE08A'}
   ],links:[],frame:{x:24,y:1200,w:1400,h:900}};
   await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
   await page.reload();await page.waitForSelector('#qa',{state:'attached'});
   await page.locator('.views button').nth(1).click();
   await page.getByRole('button',{name:t('Full screen','تمام‌صفحه'),exact:true}).click();
   await page.locator('[data-life-jump]').click();
   const read=async()=>(await page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2')))).setup.life;
   const item=async(id)=>(await read()).items.find(i=>i.id===id);
   const a=page.locator('[data-life-id="a"]'),n=page.locator('[data-life-id="n"]');
   await a.waitFor();
   assert.equal(await a.locator('.b4-node-actions button').count(),0,'no toolbar inside a section');
   // Draw a new section around the existing one with Shift+S.
   const box=await a.boundingBox();
   await page.locator('.b2-viewport').focus();await page.keyboard.press('Escape');await page.keyboard.press('Shift+S');
   await page.mouse.move(box.x-12,box.y-60);await page.mouse.down();
   await page.mouse.move(box.x+box.width+40,box.y+box.height+40,{steps:12});await page.mouse.up();
   let life=await read();
   const outer=life.items.find(i=>i.type==='section'&&i.id!=='a');
   assert.ok(outer,'a section was drawn');
   assert.equal(outer.text,t('Section 2','سکشن ۲'),'new sections are numbered');
   assert.equal(life.items.find(i=>i.id==='a').parent,outer.id,'a section drawn around another takes it in');
   assert.equal(life.items.find(i=>i.id==='n').parent,'a','its notes stay in their own section');
   // The title tab is readable and the selection toolbar does not cover it.
   const o=page.locator(`[data-life-id="${outer.id}"]`);
   await page.waitForTimeout(100);
   const tab=await o.locator(':scope>.b4-node-body').boundingBox(),bar=await page.locator('.b4-selectionbar').boundingBox();
   assert.ok(tab.height>=20,'title has a readable on-screen size');
   assert.ok(bar.y+bar.height<=tab.y+1||bar.y>=tab.y+tab.height-1,'toolbar stays clear of the title: '+JSON.stringify({tab,bar}));
   // Moving the outer section by its title carries everything nested in it.
   const before=await n.boundingBox(),frameBefore=await o.boundingBox();
   await page.mouse.move(tab.x+tab.width/2,tab.y+tab.height/2);await page.mouse.down();
   await page.mouse.move(tab.x+tab.width/2+90,tab.y+tab.height/2+40,{steps:10});await page.mouse.up();
   const after=await n.boundingBox(),frameAfter=await o.boundingBox();
   // Snapping may round the move; the nested note must move exactly as its outer section does.
   assert.ok(frameAfter.x-frameBefore.x>60,'the outer section moved');
   assert.ok(Math.abs((after.x-before.x)-(frameAfter.x-frameBefore.x))<1.5&&Math.abs((after.y-before.y)-(frameAfter.y-frameBefore.y))<1.5,'nested notes move with the outer section');
   // Duplicate puts the copy beside the original, one gap to the right.
   await n.focus();await page.keyboard.press('Control+d');
   life=await read();
   const copy=life.items.find(i=>i.type==='sticky'&&i.id!=='n'),orig=life.items.find(i=>i.id==='n');
   assert.ok(copy,'duplicate made a copy');
   assert.equal(copy.parent,orig.parent,'the copy stays in the same section');
   assert.equal(copy.y,orig.y,'the copy sits on the same row');
   assert.equal(copy.x,orig.x+orig.w+40,'the copy is one gap to the right');
   await page.keyboard.press('Control+z');
   // Delete removes the section and its contents; one undo brings it all back.
   await o.focus();await page.keyboard.press('Delete');
   assert.deepEqual((await read()).items,[],'Delete takes the section and its contents');
   await page.keyboard.press('Control+z');
   assert.equal((await read()).items.length,3,'undo restores everything');
   // Ctrl+Shift+G removes only the frame, like ungrouping a FigJam section.
   await page.locator(`[data-life-id="${outer.id}"]`).focus();await page.keyboard.press('Control+Shift+G');
   life=await read();
   assert.deepEqual(life.items.map(i=>[i.id,i.parent]).sort(),[['a',''],['n','a']]);
   const out=process.env.DEBUG_DAY_SCREENSHOTS;
   if(out){mkdirSync(out,{recursive:true});await page.keyboard.press('Control+z');await page.screenshot({path:join(out,'figjam-sections-'+language+'.png')});}
   assert.deepEqual(errors,[]);await page.context().close();
  }
  console.log('FigJam sections: draw-around nesting, numbered titles, toolbar clearance, carried moves, duplicate row, delete and ungroup passed (en/fa)');
 }finally{await h.stop()}
})().catch(e=>{console.error(e);process.exit(1)});
