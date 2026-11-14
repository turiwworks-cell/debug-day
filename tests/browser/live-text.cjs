const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// Writing without the marks (5.73): while a note is open the words already look
// formatted and **, ##, - [ ] never show, but the saved text keeps its marks.
(async()=>{
 const h=await start();
 try{
  const {page,errors}=await h.context(false),f=await fixture(page,h.origin);
  page.setDefaultTimeout(10000);
  f.data.days[f.date].notes=[
   {id:'a',kind:'sticky',text:'',color:'#FFE299',x:1500,y:300},
   {id:'b',kind:'sticky',text:'## Plan\n- **sketch** first\n- [x] colour',color:'#FFE299',x:1800,y:300},
  ];
  await page.evaluate((d)=>{localStorage.setItem('debug-day:v2',JSON.stringify(d.data));localStorage.setItem('debug-day:board-view:'+d.date,JSON.stringify({camera:{x:40,y:40,z:0.5},mode:'mindmap'}));},{data:f.data,date:f.date});
  await page.reload();await page.waitForSelector('.views',{state:'attached'});
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2'))),
   saved=(id,want)=>page.waitForFunction(([date,id,want])=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].notes.find((n)=>n.id===id).text===want,[f.date,id,want]),
   node=(ref)=>page.locator(`[data-board-id="${ref}"]`),
   seen=(ed)=>ed.evaluate((e)=>e.innerText.replace(/​/g,'')),
   value=(ed)=>ed.evaluate((e)=>e.value);
  await page.locator('.views button[data-panel="board"]').click();
  await node('sticky:b').waitFor();

  // A note that already has marks opens looking formatted, with no marks in sight.
  await node('sticky:b').locator('.dd-note-preview').dblclick();
  let ed=node('sticky:b').locator('.dd-live');await ed.waitFor();
  assert.equal(await value(ed),'## Plan\n- **sketch** first\n- [x] colour');
  const shown=await seen(ed);
  assert.ok(!/[#*\[\]]/.test(shown),'no marks while writing: '+shown);
  assert.match(shown,/Plan/);
  assert.equal(await ed.locator('.dd-rich-h2').count(),1,'the heading is drawn as a heading');
  assert.equal(await ed.locator('strong').innerText(),'sketch');
  assert.equal(await ed.locator('.dd-lv-todo[data-done=true]').count(),1);
  // Ticking the to-do's box while writing.
  // (wait for the board to stop moving after opening the note)
  const todo=ed.locator('.dd-lv-todo');let tb=await todo.boundingBox();
  for(let i=0;i<20;i++){await page.waitForTimeout(100);const nb=await todo.boundingBox();if(nb.x===tb.x&&nb.y===tb.y)break;tb=nb;}
  await page.mouse.click(tb.x+8,tb.y+tb.height/2);
  await page.waitForFunction(()=>document.querySelector('[data-board-id="sticky:b"] .dd-live')?.value.endsWith('- [ ] colour'));
  // Backspace at the start of the heading takes the heading off; Undo puts it back.
  await ed.evaluate((e)=>e.setSelectionRange(3,3));
  await page.keyboard.press('Backspace');
  assert.equal(await value(ed),'Plan\n- **sketch** first\n- [ ] colour');
  await page.keyboard.press('Control+z');
  assert.equal(await value(ed),'## Plan\n- **sketch** first\n- [ ] colour');
  await page.keyboard.press('Escape');
  await saved('b','## Plan\n- **sketch** first\n- [ ] colour');

  // Typing marks in an empty note: they turn into formatting and disappear.
  await node('sticky:a').locator('.dd-note-preview').dblclick();
  ed=node('sticky:a').locator('.dd-live');await ed.waitFor();
  await page.keyboard.type('# Moodboard');
  assert.equal(await ed.locator('.dd-rich-h1').count(),1);
  assert.equal(await seen(ed),'Moodboard');
  // Titles have their own face (5.77); the words under them keep the body face.
  assert.match(await ed.locator('.dd-rich-h1').evaluate((e)=>getComputedStyle(e).fontFamily),/Fraunces/);
  assert.doesNotMatch(await ed.evaluate((e)=>getComputedStyle(e).fontFamily),/Fraunces/);
  await page.keyboard.press('Enter');
  await page.keyboard.type('Find **three** films');
  assert.equal(await value(ed),'# Moodboard\nFind **three** films');
  assert.equal(await ed.locator('strong').innerText(),'three');
  assert.ok(!(await seen(ed)).includes('*'));
  // After a closing mark at the end of a line the next words are plain again.
  await page.keyboard.press('Enter');
  await page.keyboard.type('**bold**');
  await page.keyboard.type(' then plain');
  assert.equal(await value(ed),'# Moodboard\nFind **three** films\n**bold** then plain');
  // A list keeps going on Enter and its marks stay hidden.
  await page.keyboard.press('Enter');
  await page.keyboard.type('- [ ] ink');
  await page.keyboard.press('Enter');
  await page.keyboard.type('colour');
  assert.equal(await value(ed),'# Moodboard\nFind **three** films\n**bold** then plain\n- [ ] ink\n- [ ] colour');
  assert.equal(await ed.locator('.dd-lv-todo').count(),2);
  // Backspace right after hidden marks takes the last letter, not a mark.
  await ed.evaluate((e)=>{const v=e.value,i=v.indexOf('**bold**')+8;e.setSelectionRange(i,i);});
  await page.keyboard.press('Backspace');
  assert.ok((await value(ed)).includes('**bol**'),await value(ed));
  // Persian words start from the right.
  await page.keyboard.press('Control+End');
  // Enter twice: the list goes on, then an empty item ends it.
  await page.keyboard.press('Enter');await page.keyboard.press('Enter');
  await page.keyboard.type('ایده‌ی **تازه**');
  const fa=ed.locator('.dd-lv').last();
  assert.equal(await fa.evaluate((e)=>getComputedStyle(e).direction),'rtl');
  assert.ok((await value(ed)).endsWith('ایده‌ی **تازه**'));
  // Ctrl+B on chosen words still works, and the saved text keeps every mark.
  await page.keyboard.press('Escape');
  await saved('a','# Moodboard\nFind **three** films\n**bol** then plain\n- [ ] ink\n- [ ] colour\nایده‌ی **تازه**');
  const note=(await read()).days[f.date].notes.find((n)=>n.id==='a');
  assert.ok(note.text.startsWith('# Moodboard'));
  // T typed in a note does not jump the app to today.
  await node('sticky:a').locator('.dd-note-preview').dblclick();
  ed=node('sticky:a').locator('.dd-live');await ed.waitFor();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' t/n');
  assert.ok((await value(ed)).endsWith(' t/n'));
  await page.keyboard.press('Escape');
  assert.deepEqual(errors,[]);
  console.log('live text ok');
 }finally{await h.stop();}
})().catch((e)=>{console.error(e);process.exit(1);});
