const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// Kept cards (5.46.4): picking a card redraws only the cards whose look changed;
// the others keep their elements. A kept card must still act on the board as it
// is now (the selection, the tool, the day), never on the one it was drawn with.
(async()=>{
 const h=await start();
 try{
  const {page,errors}=await h.context(false),f=await fixture(page,h.origin);
  page.setDefaultTimeout(10000);
  f.data.days[f.date].notes=['a','b','c','d'].map((id,i)=>({id,kind:'sticky',text:'Note '+id.toUpperCase(),color:'#FFE299',x:1500+i*300,y:300}));
  await page.evaluate((d)=>{localStorage.setItem('debug-day:v2',JSON.stringify(d.data));localStorage.setItem('debug-day:board-view:'+d.date,JSON.stringify({camera:{x:-700,y:40,z:0.6},mode:'mindmap'}));},{data:f.data,date:f.date});
  await page.reload();await page.waitForSelector('#qa',{state:'attached'});
  const node=(ref)=>page.locator(`[data-board-id="${ref}"]`),
   saved=async(id)=>(await page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2')))).days[f.date].notes.find((n)=>n.id===id),
   picked=()=>page.evaluate(()=>[...document.querySelectorAll('.b4-node[aria-selected=true]')].map((e)=>e.dataset.boardId).sort()),
   pick=async(ref,shift)=>{const b=await node(ref).boundingBox();if(shift)await page.keyboard.down('Shift');await page.mouse.click(b.x+b.width/2,b.y+b.height/2);if(shift)await page.keyboard.up('Shift');await page.waitForTimeout(120);};
  await page.locator('.views button').nth(1).click();
  await node('sticky:d').waitFor();await page.waitForTimeout(400);

  // 1. Picking moves from card to card.
  await pick('sticky:a');assert.deepEqual(await picked(),['sticky:a']);
  await pick('sticky:b');assert.deepEqual(await picked(),['sticky:b']);
  // 2. Shift adds to what is picked now: C was drawn before B was picked.
  await pick('sticky:c',true);assert.deepEqual(await picked(),['sticky:b','sticky:c']);
  // 3. Dragging one of them moves both, and only them.
  const before={a:(await saved('a')).x,b:(await saved('b')).x,c:(await saved('c')).x};
  const cb=await node('sticky:c').boundingBox();
  await page.mouse.move(cb.x+cb.width/2,cb.y+cb.height/2);await page.mouse.down();
  for(let i=1;i<=6;i++){await page.mouse.move(cb.x+cb.width/2+i*15,cb.y+cb.height/2+i*5);await page.waitForTimeout(16);}
  await page.mouse.up();
  await page.waitForFunction(([date,x])=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].notes.find((n)=>n.id==='c').x>x+50,[f.date,before.c]);
  assert.ok((await saved('b')).x>before.b+50,'the other picked card moves too');
  assert.equal((await saved('a')).x,before.a,'a card not picked stays');
  // The moved cards are drawn where they were saved.
  const left=await node('sticky:b').evaluate((e)=>parseFloat(e.style.left));
  assert.equal(Math.round(left),Math.round((await saved('b')).x));

  // 4. Undo puts them back, and the cards show it.
  await page.locator('.b2-viewport').focus();await page.keyboard.press('Control+z');
  await page.waitForFunction(([date,x])=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].notes.find((n)=>n.id==='c').x===x,[f.date,before.c]);
  await page.waitForFunction((x)=>Math.round(parseFloat(document.querySelector('[data-board-id="sticky:c"]').style.left))===Math.round(x),before.c);

  // 5. The line tool shows the dots on every card, and they go when it is put away.
  await page.keyboard.press('Escape');await page.waitForTimeout(100);
  await page.locator('.b2-viewport').focus();await page.keyboard.press('x');
  await page.waitForFunction(()=>document.querySelectorAll('[data-board-id^="sticky:"] .b4-port').length===16);
  await page.keyboard.press('v');
  await page.waitForFunction(()=>document.querySelectorAll('[data-board-id^="sticky:"] .b4-port').length===0);

  // 6. A note's quick colours open and close from its own button, and a colour sticks.
  await pick('sticky:d');
  // (The note's head row is hidden on the board; its buttons still work.)
  const dot=node('sticky:d').locator('button[aria-label="Change color"]'),press=(l)=>l.evaluate((e)=>e.click());
  await press(dot);await node('sticky:d').locator('.dd-native-colors').waitFor({state:'attached'});
  await press(dot);await node('sticky:d').locator('.dd-native-colors').waitFor({state:'detached'});
  await press(dot);
  const color=await node('sticky:d').locator('.dd-native-colors button').nth(2).getAttribute('aria-label');
  await press(node('sticky:d').locator('.dd-native-colors button').nth(2));
  await page.waitForFunction(([date,c])=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date].notes.find((n)=>n.id==='d').color.toLowerCase()===c.toLowerCase(),[f.date,color.replace(/^Use color /,'')]);

  // 7. Writing in a card that was kept shows the new words once it closes.
  await node('sticky:a').locator('.dd-note-preview').dblclick();
  const ed=node('sticky:a').locator('textarea');await ed.waitFor();await ed.press('End');
  await page.keyboard.type(' kept');await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.querySelector('[data-board-id="sticky:a"] .dd-note-preview')?.textContent.includes('Note A kept'));
  // And picking a card after that still picks only it.
  await pick('sticky:b');assert.deepEqual(await picked(),['sticky:b']);

  assert.deepEqual(errors,[]);
  console.log('kept cards: picking, shift, drag, undo, line tool, colours and writing passed');
 }finally{await h.stop();}
})().catch((e)=>{console.error(e);process.exit(1);});
