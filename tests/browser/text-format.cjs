const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
const {mkdirSync}=require('node:fs');
const {join}=require('node:path');
// Text (5.61): a text object hugs its words, and notes get Milanote's formatting.
(async()=>{
 const h=await start();
 try{
  const {page,context,errors}=await h.context(false),f=await fixture(page,h.origin);
  const day=f.data.days[f.date];
  day.notes=[{id:'n',kind:'sticky',x:200,y:700,text:'',color:'#FFE08A'}];
  await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
  await page.reload();await page.waitForSelector('.views',{state:'attached'});
  await page.locator('.views button[data-panel="board"]').click();
  await page.getByRole('button',{name:'Full screen',exact:true}).click();
  const read=async()=>(await page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2')))).days[f.date];
  const editor=page.getByRole('textbox',{name:'Sticky note text'});
  // T, a click, a word: the box is as wide as the word, not a wide empty box.
  const view=await page.locator('.b2-viewport').boundingBox();
  await page.mouse.click(view.x+view.width*0.6,view.y+view.height*0.75);
  await page.keyboard.press('t');
  await page.mouse.click(view.x+view.width*0.6,view.y+view.height*0.75);
  await page.keyboard.type('Hello');
  await page.waitForFunction((date)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].notes.some(n=>n.text==='Hello'),f.date);
  let text=(await read()).notes.find(n=>n.text==='Hello');
  assert.ok(text,'the text is saved');
  const ref='sticky:'+text.id,node=page.locator(`[data-board-id="${ref}"]`);
  let box=await node.boundingBox();
  assert.ok(box.width<120,'the box hugs the word while typing: '+box.width);
  await editor.press('Control+Enter');
  await page.waitForTimeout(200);
  box=await node.boundingBox();
  assert.ok(box.width<120&&box.height<50,'and after: '+box.width+'×'+box.height);
  // More words make it wider; a narrower width from the side makes it wrap.
  await page.keyboard.press('Enter');
  await editor.press('End');
  await page.keyboard.type(' there, a longer line of words');
  await editor.press('Control+Enter');await page.waitForTimeout(200);
  const wide=await node.boundingBox();
  assert.ok(wide.width>box.width*2,'grows with its words: '+wide.width);
  const e=await node.locator('[data-edge="e"]').boundingBox();
  await page.mouse.move(e.x+e.width/2,e.y+e.height/2);await page.mouse.down();
  await page.mouse.move(e.x+e.width/2-wide.width/2,e.y+e.height/2,{steps:6});await page.mouse.up();
  await page.waitForTimeout(200);
  const narrow=await node.boundingBox();
  assert.ok(narrow.width<wide.width*0.7&&narrow.height>wide.height*1.5,'a narrower box wraps: '+narrow.width+'×'+narrow.height);
  // Text style from the bar, without typing: a large heading for the whole text.
  await page.locator('[data-text-style]').click();
  await page.locator('.dd-text-style-pop [data-style="h1"]').click();
  text=(await read()).notes.find(n=>n.id===text.id);
  assert.match(text.text,/^# Hello/);
  assert.equal(await node.locator('.dd-rich-h1').count(),1);
  // A note: heading, a list that keeps going, a nested item, bold and a link (Ctrl+K).
  const note=page.locator('[data-board-id="sticky:n"]');
  await note.dblclick({position:{x:60,y:60}});
  await page.keyboard.type('Show plan');
  await page.keyboard.press('Control+Shift+Digit2');
  await editor.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('- sketch');await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');await page.keyboard.type('colour');await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');await page.keyboard.press('Enter');
  await page.keyboard.type('my site');
  await page.keyboard.down('Shift');for(let i=0;i<7;i++)await page.keyboard.press('ArrowLeft');await page.keyboard.up('Shift');
  await page.keyboard.press('Control+k');
  await page.locator('[data-link-pop] input').fill('example.com');
  await page.locator('[data-link-pop] input').press('Enter');
  await page.waitForTimeout(150);
  let n=(await read()).notes.find(x=>x.id==='n');
  assert.equal(n.text,'## Show plan\n- sketch\n  - colour\n[my site](https://example.com)');
  // The bar while typing has Milanote's buttons; bold wraps the chosen words.
  if(!(await editor.count()))await note.dblclick({position:{x:60,y:60}});
  for(const kind of ['bold','italic','strike','highlight','link','bullet','number','todo'])assert.equal(await page.locator(`[data-note-format="${kind}"]`).count(),1,kind);
  await editor.press('Control+Home');
  await page.keyboard.down('Shift');for(let i=0;i<12;i++)await page.keyboard.press('ArrowRight');await page.keyboard.up('Shift');
  await page.locator('[data-note-format="bold"]').click();
  // A web address pasted over chosen words links them.
  await editor.press('Control+End');
  await page.keyboard.type('\nread this');
  await page.keyboard.down('Shift');for(let i=0;i<4;i++)await page.keyboard.press('ArrowLeft');await page.keyboard.up('Shift');
  await editor.evaluate((el)=>{const dt=new DataTransfer();dt.setData('text/plain','https://a.io/x');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));});
  await editor.press('Control+Enter');await page.waitForTimeout(200);
  n=(await read()).notes.find(x=>x.id==='n');
  assert.match(n.text,/^## \*\*Show plan\*\*/,'bold on the heading: '+n.text.split('\n')[0]);
  assert.match(n.text,/read \[this\]\(https:\/\/a\.io\/x\)$/);
  // What the note shows: a heading, list items with their marks, real links.
  assert.equal(await note.locator('.dd-rich-h2').count(),1);
  assert.equal(await note.locator('.dd-rich-li').count(),2);
  assert.equal(await note.locator('a.dd-rich-link[href="https://example.com"]').count(),1);
  assert.equal(await note.locator('a.dd-rich-link[href="https://a.io/x"][target="_blank"]').count(),1);
  const out=process.env.DEBUG_DAY_SCREENSHOTS;
  if(out){mkdirSync(out,{recursive:true});await page.screenshot({path:join(out,'text-format-desktop.png')});}
  assert.deepEqual(errors,[]);
  await context.close();
  console.log('Text: tight box, growing, wrapping, text styles, lists, links, bold and paste links passed');
 }finally{await h.stop()}
})().catch(e=>{console.error(e);process.exit(1)});
