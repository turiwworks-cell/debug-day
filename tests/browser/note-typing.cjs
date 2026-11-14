const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// Typing in a board note (5.46.1): the text is saved a moment after the last key
// instead of on every key, so it never gets lost: it is there after a pause, after
// Esc right away, after opening another note, and after leaving the Board.
(async()=>{
 const h=await start();
 try{
  const {page,errors}=await h.context(false),f=await fixture(page,h.origin);
  page.setDefaultTimeout(10000);
  f.data.days[f.date].notes=[
   {id:'a',kind:'sticky',text:'Alpha',color:'#FFE299',x:1500,y:300},
   {id:'b',kind:'sticky',text:'Beta',color:'#FFE299',x:1800,y:300},
  ];
  f.data.setup.life={v:2,items:[{id:'s',type:'section',parent:'',x:40,y:60,w:520,h:320,text:'Project',color:'#9DD6FF'},{id:'fn',type:'sticky',parent:'s',x:30,y:60,w:200,h:200,text:'Feed',color:'#FFE08A'}],links:[],frame:{x:24,y:330,w:1300,h:700}};
  await page.evaluate((d)=>{localStorage.setItem('debug-day:v2',JSON.stringify(d.data));localStorage.setItem('debug-day:board-view:'+d.date,JSON.stringify({camera:{x:40,y:40,z:0.5},mode:'mindmap'}));},{data:f.data,date:f.date});
  await page.reload();await page.waitForSelector('.views',{state:'attached'});
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2'))),
   text=async(id)=>(await read()).days[f.date].notes.find((n)=>n.id===id).text,
   node=(ref)=>page.locator(`[data-board-id="${ref}"]`),
   open=async(ref)=>{await node(ref).locator('.dd-note-preview').dblclick();const ed=node(ref).locator('textarea');await ed.waitFor();await ed.press('End');return ed;};
  await page.locator('.views button[data-panel="board"]').click();
  await node('sticky:a').waitFor();

  // 1. A pause saves it, and the editor keeps every key typed.
  let ed=await open('sticky:a');
  await page.keyboard.type(' one');
  assert.equal(await ed.inputValue(),'Alpha one');
  await page.waitForFunction((date)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].notes.find((n)=>n.id==='a').text==='Alpha one',f.date);

  // 1b. Bold while writing changes the text in the box, and keeps typing going (5.47).
  await page.keyboard.press('Control+a');await page.keyboard.press('Control+b');
  await page.waitForFunction(()=>document.querySelector('[data-board-id="sticky:a"] textarea')?.value==='**Alpha one**');
  await page.keyboard.press('End');await page.keyboard.type('\n- [ ] ');
  await node('sticky:a').locator('.dd-sticky-hint').waitFor();
  await ed.fill('Alpha one');
  await page.waitForFunction((date)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].notes.find((n)=>n.id==='a').text==='Alpha one',f.date);
  await page.keyboard.press('End');

  // 2. Esc right after typing saves it.
  await page.keyboard.type(' two');await page.keyboard.press('Escape');
  await page.waitForTimeout(50);
  assert.equal(await text('a'),'Alpha one two');

  // 3. Opening another note right away saves the first one.
  ed=await open('sticky:a');
  await page.keyboard.type('!');
  await node('sticky:b').locator('.dd-note-preview').dblclick();
  await node('sticky:b').locator('textarea').waitFor();
  assert.equal(await text('a'),'Alpha one two!');
  await page.keyboard.press('End');await page.keyboard.type(' x');
  // 4. Leaving the Board right away saves it too.
  await page.locator('.views button[data-panel="calendar"]').click();
  await page.waitForTimeout(50);
  assert.equal(await text('b'),'Beta x');

  // 5. A Feed note on the board saves the same way, and Undo takes the typing back.
  await page.locator('.views button[data-panel="board"]').click();
  await node('life:fn').waitFor();await page.locator('.b2-viewport').focus();await page.keyboard.press('f');await page.waitForTimeout(500);
  ed=await open('life:fn');
  await page.keyboard.type(' idea');await page.keyboard.press('Escape');
  assert.equal((await read()).setup.life.items.find((i)=>i.id==='fn').text,'Feed idea');
  await page.locator('.b2-viewport').focus();await page.keyboard.press('Control+z');await page.waitForTimeout(150);
  assert.equal((await read()).setup.life.items.find((i)=>i.id==='fn').text,'Feed');

  assert.deepEqual(errors,[]);
  console.log('note typing: Bold and the to-do hint while writing, saved after a pause, on Esc, on another note, on leaving the Board, Feed notes and undo ok');
 }finally{await h.stop();}
})().catch((e)=>{console.error(e);process.exit(1);});
