const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// The eyedropper (5.60): I, then a click on anything takes its color.
(async()=>{
 const h=await start();
 try{
  const {page,context,errors}=await h.context(false);
  // The board's own eyedropper is checked here, so the browser's screen one is hidden.
  await context.addInitScript(()=>{try{delete window.EyeDropper;}catch{}});
  const f=await fixture(page,h.origin);
  const day=f.data.days[f.date];
  day.notes=[{id:'pink',kind:'sticky',x:200,y:700,text:'Pink',color:'#FFC7EE'},{id:'txt',kind:'sticky',x:520,y:700,text:'Words',color:'#FFE08A'},{id:'sh',kind:'sticky',x:820,y:700,text:'Shape',color:'#FFFFFF'}];
  day.canvas={...(day.canvas||{}),board4:{...(day.canvas?.board4||{}),styles:{'sticky:txt':{width:240,height:48,textSize:24,plain:true},'sticky:sh':{width:200,height:160,textSize:16,shape:'rounded',stroke:'#0D99FF'}}}};
  await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
  await page.reload();await page.waitForSelector('.views',{state:'attached'});
  await page.locator('.views button[data-panel="board"]').click();
  await page.getByRole('button',{name:'Full screen',exact:true}).click();
  const read=async()=>{const d=await page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2')));return d.days[f.date];};
  const tool=()=>page.locator('.b2-viewport').getAttribute('data-tool');
  const center=async(ref)=>{const b=await page.locator(`[data-board-id="${ref}"]`).boundingBox();return [b.x+b.width/2,b.y+b.height*0.7];};
  await page.locator('[data-board-id="sticky:pink"]').scrollIntoViewIfNeeded();
  await page.keyboard.press('f');await page.waitForTimeout(400);
  // A shape picked: I, then a click on the pink note fills the shape pink.
  await page.locator('[data-board-id="sticky:sh"]').click();
  await page.keyboard.press('i');
  assert.equal(await tool(),'dropper');
  const [px,py]=await center('sticky:pink');
  await page.mouse.move(px,py);
  await page.locator('.dd-dropper-loupe').waitFor();
  assert.equal(await page.locator('.dd-dropper-loupe span').textContent(),'#FFC7EE','the loupe shows the color under the pointer');
  await page.mouse.click(px,py);
  let d=await read();
  assert.equal(d.notes.find(n=>n.id==='sh').color,'#FFC7EE','the shape took the color');
  assert.equal(await tool(),'select','one pick, then back to selecting');
  assert.equal(await page.locator('[data-board-id="sticky:sh"]').getAttribute('aria-selected'),'true','the click did not change what is picked');
  // A text object takes the color for its words.
  await page.locator('[data-board-id="sticky:txt"]').click();
  await page.keyboard.press('i');
  const [sx,sy]=await center('sticky:sh');await page.mouse.click(sx,sy);
  d=await read();
  assert.equal(d.canvas.board4.styles['sticky:txt'].textColor,'#FFC7EE');
  // The stroke palette's dropper sets a shape's stroke from the board.
  await page.locator('[data-board-id="sticky:sh"]').click();
  await page.locator('[data-shape-open="stroke"]').click();
  await page.locator('[data-shape-dropper="stroke"]').click();
  assert.equal(await tool(),'dropper');
  const [tx,ty]=await center('sticky:txt');await page.mouse.click(tx,ty);
  d=await read();
  assert.equal(d.canvas.board4.styles['sticky:sh'].stroke,'#FFC7EE','the stroke took the text color');
  // Nothing picked: the next notes take the color. Empty canvas keeps the dropper on; Esc puts it down.
  await page.keyboard.press('Escape');
  await page.mouse.click(60,700);
  await page.keyboard.press('i');
  await page.mouse.click(60,620);
  assert.equal(await tool(),'dropper','no color on empty canvas, still picking');
  await page.keyboard.press('Escape');
  assert.equal(await tool(),'select');
  assert.equal(await page.getByRole('button',{name:'Exit full screen',exact:true}).count(),1,'Esc puts the dropper down without leaving full screen');
  await page.keyboard.press('i');
  await page.mouse.click(px,py);
  const look=await page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:board-appearance')||'{}'));
  assert.equal(look.stickyColor,'#FFC7EE','new notes use the taken color');
  // It is in the Tools dock menu too, with its key.
  await page.locator('[data-dock="tools"]').click({button:'right'});
  assert.ok(await page.getByRole('menuitem',{name:/Eyedropper/}).count(),'Eyedropper is in the tools menu');
  await page.keyboard.press('Escape');
  assert.deepEqual(errors,[]);
  await context.close();
  console.log('Eyedropper: loupe, fill, text color, stroke palette, next notes, Esc and menu passed');
 }finally{await h.stop()}
})().catch(e=>{console.error(e);process.exit(1)});
