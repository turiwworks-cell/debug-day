const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
const {mkdirSync}=require('node:fs');
const {join}=require('node:path');
// Shapes (5.59): a shape is a note with a shape, its own fill and stroke, and words in the middle.
(async()=>{
 const h=await start();
 try{
  for(const mobile of [false,true]){
   const {page,context,errors}=await h.context(mobile),f=await fixture(page,h.origin);
   // A Feed note that is a shape survives the Feed's cleaning and draws as a shape.
   f.data.setup.life={v:2,items:[{id:'fs',type:'sticky',parent:'',x:40,y:60,w:220,h:140,text:'Feed shape',color:'#C7F4F1',style:{shape:'hexagon',strokeStyle:'dashed',stroke:'#0D99FF',junk:1}}],links:[],frame:{x:24,y:1400}};
   await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
   await page.reload();await page.waitForSelector('#qa',{state:'attached'});
   await page.locator('.views button').nth(1).click();
   await page.getByRole('button',{name:'Full screen',exact:true}).click();
   const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2')));
   const life=(await read()).setup.life.items.find(i=>i.id==='fs');
   assert.deepEqual({shape:life.style.shape,strokeStyle:life.style.strokeStyle,stroke:life.style.stroke,junk:life.style.junk},{shape:'hexagon',strokeStyle:'dashed',stroke:'#0D99FF',junk:undefined});
   assert.equal(await page.locator('[data-board-id="life:fs"].b4-shape svg.dd-shape-layer path').count(),1,'a Feed shape draws its outline');

   const view=await page.locator('.b2-viewport').boundingBox(),cx=view.x+view.width*0.55,cy=view.y+view.height*0.72;
   const shapes=async()=>{const d=await read(),styles=d.days[f.date].canvas?.board4?.styles||{};return d.days[f.date].notes.filter(n=>styles['sticky:'+n.id]?.shape).map(n=>({...n,style:styles['sticky:'+n.id]}));};
   // The dock's shape tool shows the common shapes; a tap drops one, picked and ready.
   await page.locator('[data-dock="tools"] [aria-label="Shape tool"]').click();
   assert.equal(await page.locator('[data-shape-row] [data-shape-tool]').count(),10);
   await page.locator('[data-shape-tool="diamond"]').click();
   if(mobile)await page.mouse.click(cx,cy);else await page.mouse.click(cx,cy);
   let list=await shapes();
   assert.equal(list.length,1,'one shape made');
   assert.equal(list[0].style.shape,'diamond');
   assert.equal(list[0].style.width,200);assert.equal(list[0].style.height,200);
   const ref='sticky:'+list[0].id,node=page.locator(`[data-board-id="${ref}"]`);
   assert.equal(await node.getAttribute('class').then(c=>c.includes('b4-shape')),true);
   assert.equal(await node.locator('textarea').count(),0,'a new shape is picked, not open for typing');
   // Words go in the middle; long words make the shape taller, never smaller than its size.
   await page.keyboard.press('Enter');
   await node.locator('textarea').fill('A long thought that needs more room than a small diamond has, so the shape grows taller to hold every word of it');
   await node.locator('textarea').press('Control+Enter');
   await page.waitForTimeout(300);
   const grown=await node.boundingBox();
   assert.ok(grown.height/grown.width>1.2,'the shape grew to fit its words: '+grown.width+'×'+grown.height);
   assert.equal((await shapes())[0].style.height,200,'its own size stays as it was');
   // Fill and stroke from the selection bar, as in FigJam.
   await node.click({position:{x:grown.width/2,y:6}});
   await page.locator('[data-shape-open="fill"]').click();
   await page.locator('[data-shape-mode="light"]').click();
   await page.locator('[data-shape-color="#FFC7C2"]').click();
   await page.locator('[data-shape-open="stroke"]').click();
   await page.locator('[data-shape-mode="dashed"]').click();
   await page.locator('[data-shape-color="#F24822"]').click();
   list=await shapes();
   assert.equal(list[0].color,'#FFC7C2','the fill color is the note color');
   assert.deepEqual([list[0].style.fillMode,list[0].style.strokeStyle,list[0].style.stroke],['light','dashed','#F24822']);
   assert.equal(await node.locator('.dd-shape-layer path').getAttribute('stroke-dasharray'),'8 6');
   // Change the shape from the library, found by search.
   await page.locator('[data-shape-open="kind"]').click();
   await page.locator('[data-shape-search]').fill('database');
   assert.equal(await page.locator('[data-shape-pick]').count(),1);
   await page.locator('[data-shape-search]').press('Enter');
   assert.equal((await shapes())[0].style.shape,'cylinder');
   assert.equal(await page.locator('[data-shape-menu]').count(),0,'the library closes after a pick');
   if(!mobile){
    // R draws the last shape (now a cylinder) and a drag gives its size; O draws a circle.
    await page.keyboard.press('Escape');
    await page.keyboard.press('o');
    await page.mouse.move(view.x+160,view.y+view.height-260);await page.mouse.down();
    await page.mouse.move(view.x+320,view.y+view.height-160,{steps:8});await page.mouse.up();
    list=await shapes();
    const circle=list.find(s=>s.style.shape==='ellipse');
    assert.ok(circle,'O + drag draws a circle');
    assert.ok(circle.style.width>120&&circle.style.width<240&&circle.style.height<circle.style.width,'the drag sets its size: '+circle.style.width+'×'+circle.style.height);
    assert.equal(circle.style.fillMode,'light','a new shape takes the last fill you used');
    // A shape resizes freely from a corner (width and height apart).
    const c=page.locator(`[data-board-id="sticky:${circle.id}"]`),before=await c.boundingBox();
    const se=await c.locator('[data-edge="se"]').boundingBox();
    await page.mouse.move(se.x+se.width/2,se.y+se.height/2);await page.mouse.down();
    await page.mouse.move(se.x+se.width/2+60,se.y+se.height/2+90,{steps:8});await page.mouse.up();
    const after=(await shapes()).find(s=>s.id===circle.id).style;
    assert.ok(after.width>circle.style.width+30&&after.height>circle.style.height+60,'free resize: '+JSON.stringify(after));
    assert.equal(after.textSize,16,'resizing a shape does not scale its words');
    assert.ok(before.width>0);
   }
   const out=process.env.DEBUG_DAY_SCREENSHOTS;
   if(out){mkdirSync(out,{recursive:true});await page.screenshot({path:join(out,'shapes-'+(mobile?'phone':'desktop')+'.png')});}
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('Shapes: tool, row, library search, fill, stroke, words inside, growing, free resize and Feed shapes passed');
 }finally{await h.stop()}
})().catch(e=>{console.error(e);process.exit(1)});
