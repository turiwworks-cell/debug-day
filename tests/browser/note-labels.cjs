const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
const {mkdirSync}=require('node:fs');
const {join}=require('node:path');
// Note tags like Milanote's labels (5.62): one menu searches, ticks and creates
// tags, shows how often each is used, and renames or deletes a tag everywhere.
(async()=>{
 const h=await start();
 try{
  for(const mobile of [false,true]){
   const {page,context,errors}=await h.context(mobile),f=await fixture(page,h.origin);
   page.setDefaultTimeout(10000);
   const day=f.data.days[f.date],other='2020-01-02';
   day.blocks[0].tags=['idea'];
   day.notes=[
    {id:'p',kind:'sticky',text:'First',color:'#FFE299',x:200,y:700,tags:['idea']},
    {id:'q',kind:'sticky',text:'Second',color:'#9DD6FF',x:520,y:700,tags:['idea','ink']},
   ];
   f.data.days[other]={...JSON.parse(JSON.stringify(day)),date:other,blocks:[],notes:[{id:'o',kind:'sticky',text:'Old',color:'#FFE299',x:0,y:0,tags:['ink']}]};
   f.data.setup.later=[...(f.data.setup.later||[]),{id:'lt',name:'Later ink',min:30,tags:['Ink']}];
   await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
   await page.reload();await page.waitForSelector('.views',{state:'attached'});
   await page.locator('.views button[data-panel="board"]').click();
   await page.getByRole('button',{name:'Full screen',exact:true}).click();
   const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2'))),
    note=async(id,date=f.date)=>(await read()).days[date].notes.find((n)=>n.id===id),
    node=(ref)=>page.locator(`[data-board-id="${ref}"]`),
    settle=(ms=350)=>page.waitForTimeout(ms),
    pick=async(ref)=>{const b=await node(ref).boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;mobile?await page.touchscreen.tap(x,y):await page.mouse.click(x,y);await settle(200);};
   await pick('sticky:p');
   await page.locator('.b4-selectionbar [data-note-tags]').click();
   const menu=page.locator('.dd-note-tag-editor'),field=menu.getByRole('textbox',{name:'Add a tag',exact:true});
   await field.waitFor();
   // Every tag shows, ticked when it is on the note, with how often it is used.
   const row=(tag)=>menu.locator(`[data-tag-row="${tag}"]`);
   assert.equal(await row('idea').getAttribute('aria-selected'),'true');
   assert.equal(await row('ink').getAttribute('aria-selected'),'false');
   assert.equal((await row('idea').locator('.dd-tag-count').innerText()).trim(),'3','idea: two notes and a task');
   assert.equal((await row('ink').locator('.dd-tag-count').innerText()).trim(),'3','ink: a note, an old note and Later');
   // Search, then the arrow keys and Enter tick a tag.
   await field.fill('in');
   assert.equal(await menu.locator('[data-tag-row]').count(),1,'search keeps the matches');
   assert.equal(await menu.locator('[data-tag-create]').count(),1,'and offers to make a new tag');
   assert.equal(await menu.locator('[data-active]').getAttribute('data-tag-row'),'ink','the first match is ready for Enter');
   await field.press('ArrowDown');assert.equal(await menu.locator('[data-active]').getAttribute('data-tag-create'),'in');
   await field.press('ArrowUp');await field.press('Enter');
   await settle();
   assert.deepEqual((await note('p')).tags,['idea','ink']);
   // A click on a ticked tag takes it off.
   await row('idea').click();await settle();
   assert.deepEqual((await note('p')).tags,['ink']);
   // A new tag: type it and press Enter.
   await field.fill('Night walk');await field.press('Enter');await settle();
   assert.deepEqual((await note('p')).tags,['ink','Night_walk']);
   const out=process.env.DEBUG_DAY_SCREENSHOTS;
   if(out){mkdirSync(out,{recursive:true});await page.screenshot({path:join(out,'labels-'+(mobile?'phone':'desktop')+'.png')});}
   // ⋯ renames a tag everywhere: this day, other days, Later; Undo brings this board back.
   await row('ink').hover().catch(()=>{});
   await menu.locator('[data-tag-more="ink"]').click();
   const rename=menu.getByRole('textbox',{name:'Rename tag'});
   await rename.fill('Colour');await rename.press('Enter');await settle();
   let d=await read();
   assert.deepEqual(d.days[f.date].notes.find((n)=>n.id==='p').tags,['Colour','Night_walk']);
   assert.deepEqual(d.days[f.date].notes.find((n)=>n.id==='q').tags,['idea','Colour']);
   assert.deepEqual(d.days[other].notes[0].tags,['Colour'],'another day too');
   assert.deepEqual(d.setup.later.find((b)=>b.id==='lt').tags,['Colour'],'and Later');
   // ⋯ deletes a tag everywhere, after asking.
   await menu.locator('[data-tag-more="Colour"]').click();
   await menu.getByRole('button',{name:'Delete tag'}).click();
   assert.match(await menu.locator('.dd-tag-confirm').innerText(),/all 4 things/);
   await menu.locator('.dd-tag-confirm').getByRole('button',{name:'Delete',exact:true}).click();await settle();
   d=await read();
   assert.deepEqual(d.days[f.date].notes.find((n)=>n.id==='p').tags,['Night_walk']);
   assert.deepEqual(d.days[f.date].notes.find((n)=>n.id==='q').tags,['idea']);
   assert.equal(d.days[other].notes[0].tags,undefined);
   assert.equal(d.setup.later.find((b)=>b.id==='lt').tags,undefined);
   // The count finds every note and task with the tag (Board search).
   await row('idea').locator('[data-tag-count]').click();await settle();
   assert.equal(await page.locator('.b4-search input').inputValue(),'#idea');
   assert.equal(await menu.count(),0,'the menu closes for the search');
   await page.keyboard.press('Escape');await settle();
   // A picked note's tag shows a × under the pointer.
   if(!mobile){
    await pick('sticky:q');
    await node('sticky:q').locator('.dd-note-above [data-tag="idea"]').hover();
    await node('sticky:q').locator('.dd-note-above').getByRole('button',{name:'Remove tag idea'}).click();await settle();
    assert.equal((await note('q')).tags,undefined);
   }
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('Note tags: menu, search, tick, create, counts, rename and delete everywhere, find passed');
 }finally{await h.stop()}
})().catch(e=>{console.error(e);process.exit(1)});
