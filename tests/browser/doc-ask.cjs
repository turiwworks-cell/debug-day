const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// A long note asks once whether it should become a document (5.76).
(async()=>{
 const h=await start();
 try{
  const {page,errors}=await h.context(false),f=await fixture(page,h.origin);
  page.setDefaultTimeout(10000);
  f.data.days[f.date].notes=[
   {id:'a',kind:'sticky',text:'Script ideas',color:'#FFE299',x:1500,y:300},
   {id:'b',kind:'sticky',text:'Shot list',color:'#FFE299',x:1800,y:300},
  ];
  await page.evaluate((d)=>{localStorage.setItem('debug-day:v2',JSON.stringify(d.data));localStorage.setItem('debug-day:board-view:'+d.date,JSON.stringify({camera:{x:40,y:40,z:0.5},mode:'mindmap'}));},{data:f.data,date:f.date});
  await page.reload();await page.waitForSelector('.views',{state:'attached'});
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2'))),
   node=(ref)=>page.locator(`[data-board-id="${ref}"]`),
   open=async(ref)=>{await node(ref).locator('.dd-note-preview').dblclick();const ed=node(ref).locator('.dd-live');await ed.waitFor();await page.keyboard.press('Control+End');return ed;},
   lines=(n,w)=>Array.from({length:n},(_,i)=>w+' '+(i+1)).join('\n');
  await page.locator('.views button[data-panel="board"]').click();
  await node('sticky:a').waitFor();

  // A short note never asks.
  await open('sticky:a');
  await page.keyboard.type(' for the short film');
  assert.equal(await page.locator('.dd-doc-ask').count(),0);
  // Past many lines it asks, once. "Keep as note" keeps writing going.
  await page.keyboard.insertText('\n'+lines(15,'Scene'));
  const ask=page.locator('.dd-doc-ask');await ask.waitFor();
  assert.match(await ask.innerText(),/getting long/);
  await ask.getByRole('button',{name:'Keep as note',exact:true}).click();
  assert.equal(await ask.count(),0);
  await page.keyboard.type('\nmore');
  assert.ok((await node('sticky:a').locator('.dd-live').evaluate((e)=>e.value)).endsWith('more'),'still writing');
  await page.keyboard.press('Escape');
  // Writing in it again does not ask again.
  await open('sticky:a');await page.keyboard.type(' again');
  await page.waitForTimeout(200);
  assert.equal(await page.locator('.dd-doc-ask').count(),0,'asked only once');
  await page.keyboard.press('Escape');
  // "Make a document" turns it into one and opens it, words kept.
  await open('sticky:b');
  await page.keyboard.insertText('\n'+lines(16,'Shot'));
  await page.locator('.dd-doc-ask').waitFor();
  await page.locator('.dd-doc-ask').getByRole('button',{name:'Make a document',exact:true}).click();
  const doc=page.getByRole('dialog',{name:'Document: Shot list'});await doc.waitFor();
  const saved=await read(),note=saved.days[f.date].notes.find((n)=>n.id==='b');
  assert.equal(saved.days[f.date].canvas.board4.styles['sticky:b'].doc,true);
  assert.ok(note.text.startsWith('# Shot list'),note.text.slice(0,40));
  assert.ok(note.text.includes('Shot 16'),'every word kept');
  await page.keyboard.press('Escape');
  assert.deepEqual(errors,[]);
  console.log('doc ask ok');
 }finally{await h.stop();}
})().catch((e)=>{console.error(e);process.exit(1);});
