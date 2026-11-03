const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// Lines inside a section (5.38.1). Dragging a note's + into the section's empty
// inside makes a new note there with a line to it; it never ties the line to
// the section's frame. An elbow line between two notes in nested sections
// stays inside them instead of going around the outer frame.
(async()=>{
 const h=await start();
 try{
  const {page,errors}=await h.context(false),f=await fixture(page,h.origin);
  page.setDefaultTimeout(10000);
  f.data.setup.life={v:2,items:[
   {id:'o',type:'section',parent:'',x:40,y:60,w:1400,h:1100,text:'Outer',color:'#9DD6FF'},
   {id:'a',type:'section',parent:'o',x:100,y:200,w:700,h:500,text:'Studio',color:'#C9B6FF'},
   {id:'n',type:'sticky',parent:'a',x:300,y:60,w:120,h:110,text:'One',color:'#FFE08A'},
   {id:'m',type:'sticky',parent:'a',x:100,y:200,w:120,h:110,text:'Two',color:'#FFE08A'},
  ],links:[{id:'link:1',from:'life:n',to:'life:m',style:'elbow',arrow:true,color:'#7A5FF5'}],frame:{x:24,y:1200,w:1600,h:1400}};
  await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
  await page.reload();await page.waitForSelector('#qa',{state:'attached'});
  const read=async()=>JSON.parse(await page.evaluate(()=>localStorage.getItem('debug-day:v2'))).setup.life;
  const view=page.locator('.b2-viewport');
  await page.locator('.views button').nth(1).click();
  await view.focus();await page.keyboard.press('Control+Shift+F');await page.locator('.b2.focus-mode').waitFor();
  await page.locator('[data-life-jump]').click();await page.waitForTimeout(400);
  const studio=await page.locator('[data-board-id="life:a"]').boundingBox();
  const wire=page.locator('[data-wire-id="link:1"] path[data-wire-path], path[data-wire-path]').first();
  const inside=async()=>{const b=await page.locator('path[data-wire-path]').first().boundingBox();return b.x>=studio.x-2&&b.x+b.width<=studio.x+studio.width+2&&b.y+b.height<=studio.y+studio.height+2;};
  assert.ok(await inside(),'the elbow line stays inside the section');
  // Nudge a note: the line still stays inside.
  const one=page.locator('[data-board-id="life:n"]'),ob=await one.boundingBox();
  await page.mouse.move(ob.x+ob.width/2,ob.y+40);await page.mouse.down();await page.mouse.move(ob.x+ob.width/2+3,ob.y+42);await page.mouse.move(ob.x+ob.width/2+6,ob.y+43);await page.mouse.up();
  await page.waitForTimeout(350);
  assert.ok(await inside(),'and still after a small move');
  // Drag the + into the section's empty inside: a new note, linked, in the section.
  await one.click();await page.waitForTimeout(250);
  const plus=one.locator('.b4-port.right:visible, [data-add-near="right"]:visible').first(),pb=await plus.boundingBox();
  await page.mouse.move(pb.x+pb.width/2,pb.y+pb.height/2);await page.mouse.down();
  for(let i=1;i<=8;i++)await page.mouse.move(pb.x+pb.width/2+i*22,pb.y+pb.height/2+i*2);
  await page.mouse.up();await page.waitForTimeout(400);
  await page.keyboard.press('Escape');await page.waitForTimeout(300);
  const life=await read(),made=life.items.find((i)=>!['o','a','n','m'].includes(i.id));
  assert.ok(made,'a new note was made');
  assert.equal(made.parent,'a','in the section');
  assert.ok(!life.links.some((l)=>l.to==='life:a'||l.to==='life:o'),'no line to a frame: '+JSON.stringify(life.links));
  assert.ok(life.links.some((l)=>l.from==='life:n'&&l.to==='life:'+made.id),'the line goes to the new note');
  assert.deepEqual(errors,[]);
  console.log('section lines: ok');
 }finally{await h.stop();}
})().catch(e=>{console.error(e);process.exit(1);});
