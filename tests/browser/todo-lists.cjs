const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
const {mkdirSync}=require('node:fs');
const {join}=require('node:path');
// To-do lists (5.65), after Milanote: a note becomes a list of tasks, typed in
// where it is (Enter, Tab / Shift+Tab, Backspace), with a title, due dates, a
// bin next to done tasks, moving a task by its grip, and the Calendar shows
// tasks with a due date.
(async()=>{
 const h=await start();
 try{
  for(const mobile of [false,true]){
  const {page,context,errors}=await h.context(mobile),f=await fixture(page,h.origin);
  page.setDefaultTimeout(10000);
  const day=f.data.days[f.date];
  day.notes=[{id:'n',kind:'sticky',x:200,y:700,text:mobile?'- [ ] Studio errands\n- [ ] Buy paint\n- [x] Clean brushes':'Studio errands\nBuy paint\n- [x] Clean brushes',color:'#FFE08A'}];
  // On a phone the list starts as a list (converting is the same menu as on a computer).
  if(mobile)day.canvas={board4:{layouts:{mindmap:{}},styles:{'sticky:n':{todo:true}}}};
  await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
  await page.reload();await page.waitForSelector('.views',{state:'attached'});
  await page.locator('.views button[data-panel="board"]').click();
  await page.getByRole('button',{name:'Full screen',exact:true}).click();
  await page.waitForSelector('[data-board-id="sticky:n"]');
  const read=async()=>(await page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2')))).days[f.date],
   text=async()=>(await read()).notes.find((n)=>n.id==='n').text,
   node=(ref)=>page.locator(`[data-board-id="${ref}"]`),
   settle=(ms=350)=>page.waitForTimeout(ms),
   menuItem=(name)=>page.getByRole('menu',{name:'Board context menu'}).getByRole('menuitem',{name,exact:true}),
   style=async(id)=>(await read()).canvas?.board4?.styles?.['sticky:'+id]||{},
   out=process.env.DEBUG_DAY_SCREENSHOTS,
   shot=async(name)=>{if(out){mkdirSync(out,{recursive:true});await page.screenshot({path:join(out,name+(mobile?'-phone':'')+'.png')});}};
  const card=node('sticky:n');
  await card.scrollIntoViewIfNeeded().catch(()=>{});
  // Convert to to-do list (right-click › More).
  if(!mobile){await card.click({button:'right'});await menuItem('More').click();await menuItem('Convert to to-do list').click();await settle();}
  assert.equal((await style('n')).todo,true);
  assert.equal(await text(),'- [ ] Studio errands\n- [ ] Buy paint\n- [x] Clean brushes','every line is a task; a done one stays done');
  assert.ok((await card.getAttribute('class')).includes('b4-todo-card'));
  assert.equal(await card.locator('.dd-todo-list li').count(),3);
  // A tick box ticks even when the card is not picked.
  await card.getByRole('checkbox',{name:/Buy paint/}).click();await settle();
  assert.match(await text(),/- \[x\] Buy paint/);
  // A done task has a small bin next to it (Milanote).
  assert.equal(await card.getByRole('button',{name:/^Delete task/}).count(),2);
  await card.getByRole('button',{name:'Delete task: Clean brushes'}).click();await settle();
  assert.doesNotMatch(await text(),/Clean brushes/,'the bin deletes the done task');
  // Double-click: type in the last task. Enter makes the next task, Tab moves it in.
  await card.locator('.dd-todo-list li').last().locator('.dd-todo-words').dblclick();await settle();
  const box=(i)=>card.locator(`[data-todo-index="${i}"]`);
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');await page.keyboard.type('Blue');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');await page.keyboard.type('Red');
  await page.keyboard.press('Enter');await page.keyboard.press('Shift+Tab');await page.keyboard.type('Call the gallery');
  await page.keyboard.press('Escape');await settle();
  assert.equal(await text(),'- [ ] Studio errands\n- [x] Buy paint\n  - [ ] Blue\n  - [ ] Red\n- [ ] Call the gallery');
  // Backspace at the start of an empty task takes it away; on a task with words it joins the one above.
  await box(3).click();await page.keyboard.press('Enter');await settle(100);
  assert.equal(await card.locator('[data-todo-index]').count(),6);
  await page.keyboard.press('Backspace');await page.keyboard.press('Backspace');await settle(100);
  await page.keyboard.press('Escape');await settle();
  assert.equal(await text(),'- [ ] Studio errands\n- [x] Buy paint\n  - [ ] Blue\n  - [ ] Red\n- [ ] Call the gallery','Backspace on an empty task: first a level out, then gone');
  // Title: from the list's tools.
  await card.getByRole('button',{name:'Title',exact:true}).click();
  await page.keyboard.type('Saturday');await page.keyboard.press('Enter');await settle(100);
  await page.keyboard.press('Escape');await settle();
  assert.match(await text(),/^# Saturday\n/);
  // Due date with a reminder time on a task.
  await box(4).click();
  await card.getByRole('button',{name:'Due date',exact:true}).click();
  const due=page.getByRole('dialog',{name:'Due date'});
  await due.getByRole('button',{name:'Tomorrow'}).click();
  await due.getByRole('textbox',{name:'Reminder time'}).fill('14:30').catch(async()=>{await due.locator('input[type=time]').fill('14:30');});
  await due.getByRole('button',{name:'Done'}).click();await settle();
  const tomorrow=new Date(Date.now()+864e5).toLocaleDateString('en-CA',{timeZone:'Asia/Tehran'});
  assert.match(await text(),new RegExp('- \\[ \\] Call the gallery 📅'+tomorrow+'T14:30'));
  assert.match(await card.locator('.dd-todo-due').innerText(),/14:30 · tomorrow/);
  await shot('todo-list');
  // Drag a task by its grip: Call the gallery goes to the top.
  if(!mobile){
   const grip=card.locator('[data-todo-row="4"] .dd-todo-grip'),gb=await grip.boundingBox(),first=await card.locator('[data-todo-row="0"]').boundingBox();
   await page.mouse.move(gb.x+gb.width/2,gb.y+gb.height/2);await page.mouse.down();
   await page.mouse.move(gb.x+gb.width/2,first.y+2,{steps:6});await page.mouse.up();await settle();
   assert.match(await text(),/^# Saturday\n- \[ \] Call the gallery 📅/,'moved to the top');
   await page.keyboard.press('Escape');await settle(150);await page.keyboard.press('Control+z');await settle();
   assert.match(await text(),/^# Saturday\n- \[ \] Studio errands/,'undo puts it back');
  }
  // The Calendar shows the task on its day (one connected planner).
  await page.keyboard.press('Escape').catch(()=>{});
  const cal=await page.evaluate(async([date])=>{const m=await import('./todos.js');return m.DDtodoDueItems(m.DDtodoLists(JSON.parse(localStorage.getItem('debug-day:v2')))).map((r)=>r.text+'|'+r.due);},[f.date]);
  assert.deepEqual(cal,['Call the gallery|'+tomorrow]);
  // A new to-do list from the tools menu starts typing right away.
  if(!mobile){
   await page.locator('[data-dock-more="tools"]').click();
   await menuItem('To-do list').click();await settle();
   await page.keyboard.type('Stretch canvas');await page.keyboard.press('Enter');await page.keyboard.type('Prime it');
   await page.keyboard.press('Escape');await settle();
   const made=(await read()).notes.find((n)=>n.id!=='n');
   assert.equal(made.text,'- [ ] Stretch canvas\n- [ ] Prime it');
   assert.equal((await style(made.id)).todo,true);
  }
  // Back to a note: its tasks stay tick boxes.
  if(!mobile){
   await page.keyboard.press('Escape');await settle(150);
   const cb=await card.boundingBox();await card.click({button:'right',position:{x:cb.width-8,y:cb.height-6}});
   await menuItem('More').click();await menuItem('Convert to note').click();await settle();
   assert.equal((await style('n')).todo,undefined);
   assert.match(await text(),/Call the gallery/);
  }
  assert.deepEqual(errors,[]);await context.close();
  }
  console.log('To-do lists: convert, tick, bin, type with Enter / Tab / Backspace, title, due date, move, Calendar, new and back passed');
 }finally{await h.stop()}
})().catch(e=>{console.error(e);process.exit(1)});
