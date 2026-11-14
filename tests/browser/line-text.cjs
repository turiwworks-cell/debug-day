const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// Lines (5.66): a line meets each side of a card in its middle, and a
// double-click on a line writes on it, in its middle.
(async()=>{
 const h=await start();
 try{
  const {page,context,errors}=await h.context(false),f=await fixture(page,h.origin);
  page.setDefaultTimeout(10000);
  const day=f.data.days[f.date];
  day.notes=[
   {id:'a',kind:'sticky',x:200,y:800,text:'Sketch',color:'#FFE08A'},
   {id:'b',kind:'sticky',x:700,y:900,text:'Paint',color:'#9DD6FF'},
  ];
  day.canvas={board4:{layouts:{mindmap:{}},styles:{},links:[{id:'ab',from:'sticky:a',to:'sticky:b',arrow:true}]}};
  await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
  await page.reload();await page.waitForSelector('.views',{state:'attached'});
  await page.locator('.views button[data-panel="board"]').click();
  await page.getByRole('button',{name:'Full screen',exact:true}).click();
  await page.waitForSelector('[data-wire-id="ab"]');
  const read=async()=>(await page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2')))).days[f.date],
   settle=(ms=350)=>page.waitForTimeout(ms),
   box=(ref)=>page.locator(`[data-board-id="${ref}"]`).boundingBox();
  // The line leaves a's right side and meets b's left side, each in its middle.
  const ends=await page.locator('[data-wire-id="ab"] .b4-wire-line').evaluate((el)=>{const n=el.getTotalLength();const m=el.getScreenCTM();const p=(t)=>{const q=el.getPointAtLength(t);return {x:q.x*m.a+m.e,y:q.y*m.d+m.f};};return [p(0),p(n)];});
  const A=await box('sticky:a'),B=await box('sticky:b');
  assert.ok(Math.abs(ends[0].x-(A.x+A.width))<3&&Math.abs(ends[0].y-(A.y+A.height/2))<3,'starts in the middle of a side: '+JSON.stringify(ends[0])+' '+JSON.stringify(A));
  assert.ok(Math.abs(ends[1].x-B.x)<3&&Math.abs(ends[1].y-(B.y+B.height/2))<3,'ends in the middle of a side: '+JSON.stringify(ends[1])+' '+JSON.stringify(B));
  // A double-click on the line opens a text box in its middle.
  const mid=await page.locator('[data-wire-id="ab"] .b4-wire-line').evaluate((el)=>{const q=el.getPointAtLength(el.getTotalLength()/2);const m=el.getScreenCTM();return {x:q.x*m.a+m.e,y:q.y*m.d+m.f};});
  await page.mouse.dblclick(mid.x,mid.y);await settle();
  const input=page.getByRole('textbox',{name:'Connection label'});
  await input.waitFor();
  const ib=await input.boundingBox();
  assert.ok(Math.abs(ib.x+ib.width/2-mid.x)<6&&Math.abs(ib.y+ib.height/2-mid.y)<6,'the text box sits in the middle of the line');
  await input.fill('then');await input.press('Enter');await settle();
  assert.equal((await read()).canvas.board4.links[0].label,'then');
  assert.equal(await page.locator('[data-wire-id="ab"] [data-wire-label] text').textContent(),'then');
  // A double-click on the words opens them again; Escape keeps them as they were.
  const lb=await page.locator('[data-wire-id="ab"] [data-wire-label]').boundingBox();
  await page.mouse.dblclick(lb.x+lb.width/2,lb.y+lb.height/2);await settle();
  assert.equal(await input.inputValue(),'then');
  await input.fill('later');await input.press('Escape');await settle();
  assert.equal((await read()).canvas.board4.links[0].label,'then','Escape changes nothing');
  // Undo takes the words off.
  await page.locator('.b2-viewport').focus();await page.keyboard.press('Control+z');await settle();
  assert.ok(!(await read()).canvas.board4.links[0].label,'undo');
  assert.deepEqual(errors,[]);await context.close();
  console.log('Lines: middle of each side, double-click writes on a line, Escape and undo passed');
 }finally{await h.stop()}
})().catch(e=>{console.error(e);process.exit(1)});
