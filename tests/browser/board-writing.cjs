const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// Writing on the board (5.32): a readable section rename, the board comes close
// to write when zoomed out (and goes back), text align, text objects, a short
// right-click with quick colors and "Send to section…", the align panel, and
// line color / weight that new lines keep and many lines take at once.
(async()=>{
 const h=await start();
 try{
  const {page,errors,context}=await h.context(false),f=await fixture(page,h.origin);
  page.setDefaultTimeout(10000);
  f.data.setup.life={v:2,items:[
   {id:'p',type:'section',parent:'',x:40,y:60,w:520,h:320,text:'Project',color:'#9DD6FF'},
   {id:'q',type:'section',parent:'',x:640,y:60,w:520,h:320,text:'Ideas',color:'#FFA6D9'},
   {id:'q1',type:'section',parent:'q',x:30,y:60,w:260,h:200,text:'This App',color:'#FFA6D9'},
   {id:'lf-inbox',type:'section',parent:'',x:40,y:420,w:520,h:240,text:'Capture',color:'#B3EFBD'},
   {id:'n1',type:'sticky',parent:'p',x:30,y:60,w:200,h:200,text:'Inside',color:'#FFE08A'},
  ],links:[],frame:{x:24,y:700,w:1300,h:700}};
  f.data.days[f.date].notes=[
   {id:'a',kind:'sticky',text:'Alpha',color:'#FFE299',x:1700,y:200},
   {id:'b',kind:'sticky',text:'Beta',color:'#FFE299',x:2050,y:260},
   {id:'c',kind:'sticky',text:'Gamma',color:'#FFE299',x:2400,y:330},
  ];
  f.data.days[f.date].canvas={board4:{layouts:{mindmap:{}},locked:[],styles:{},
   links:[{id:'ab',from:'sticky:a',to:'sticky:b',style:'straight',arrow:true},{id:'bc',from:'sticky:b',to:'sticky:c',style:'straight',arrow:true}]}};
  await page.evaluate((d)=>{localStorage.setItem('debug-day:v2',JSON.stringify(d.data));localStorage.setItem('debug-day:board-view:'+d.date,JSON.stringify({camera:{x:40,y:150,z:0.4},mode:'mindmap'}));},{data:f.data,date:f.date});
  await page.reload();await page.waitForSelector('#qa',{state:'attached'});
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2'))),
   items=async()=>(await read()).setup.life.items,
   day=async()=>(await read()).days[f.date],
   node=(ref)=>page.locator(`[data-board-id="${ref}"]`),
   view=page.locator('.b2-viewport'),
   zoom=async()=>Number(await view.getAttribute('data-zoom')),
   key=async(k)=>{await view.focus();await page.keyboard.press(k);await page.waitForTimeout(150);},
   settle=()=>page.waitForTimeout(400),
   menu=()=>page.getByRole('menu',{name:'Board context menu'}),
   menuItem=(name)=>menu().getByRole('menuitem',{name,exact:true}),
   bar=page.locator('.b4-selectionbar'),
   pick=async(ref,shift)=>{const b=await node(ref).boundingBox();if(shift)await page.keyboard.down('Shift');await page.mouse.click(b.x+b.width/2,b.y+b.height/2);if(shift)await page.keyboard.up('Shift');await page.waitForTimeout(150);};
  const shots=process.env.DEBUG_DAY_SCREENSHOTS,shot=async(name)=>{if(shots){require('node:fs').mkdirSync(shots,{recursive:true});await page.screenshot({path:require('node:path').join(shots,name+'.png')});}};
  await page.locator('.views button').nth(1).click();
  await view.focus();await page.keyboard.press('Control+Shift+F');await page.locator('.b2.focus-mode').waitFor();
  await page.waitForFunction(()=>document.querySelector('.b2-viewport')?.dataset.zoom==='0.4');

  // 1. Renaming a section far out: the name is edited at 16px or more on screen.
  const title=node('life:p').locator(':scope>.b4-node-body');
  await title.dblclick();
  const rename=page.getByRole('textbox',{name:'Section name',exact:true});
  await rename.waitFor();
  const onScreen=await rename.evaluate((el)=>parseFloat(getComputedStyle(el).fontSize)*Number(document.querySelector('.b2-viewport').dataset.zoom));
  assert.ok(onScreen>=15.9,'the name reads at '+onScreen+'px on screen');
  assert.equal(await rename.evaluate((el)=>el.selectionStart===0&&el.selectionEnd===el.value.length),true,'the old name is selected, ready to retype');
  assert.equal(await zoom(),0.4,'a section rename needs no zoom');
  await shot('rename-section');
  await rename.fill('Client project');await rename.press('Enter');
  assert.equal((await items()).find((i)=>i.id==='p').text,'Client project');

  // 2. Writing in a note far out: the board glides close, then back.
  await node('sticky:a').locator('.dd-note-preview').dblclick();
  const editor=node('sticky:a').locator('textarea');await editor.waitFor();
  await page.waitForFunction(()=>Number(document.querySelector('.b2-viewport').dataset.zoom)>0.8);
  const box=await node('sticky:a').boundingBox(),vp=await view.boundingBox();
  assert.ok(box.x>=vp.x&&box.x+box.width<=vp.x+vp.width,'the note is in view while writing');
  await shot('write-zoomed');
  await editor.fill('Alpha, readable');await editor.press('Control+Enter');
  await page.waitForFunction(()=>document.querySelector('.b2-viewport').dataset.zoom==='0.4');
  assert.equal((await day()).notes.find((n)=>n.id==='a').text,'Alpha, readable');
  // Moved the board while writing: it stays where you put it.
  await node('sticky:b').locator('.dd-note-preview').dblclick();
  await page.waitForFunction(()=>Number(document.querySelector('.b2-viewport').dataset.zoom)>0.8);await settle();
  await page.mouse.move(vp.x+vp.width/2,vp.y+vp.height/2);await page.mouse.wheel(0,200);await settle();
  const moved=await zoom();
  await key('Escape');await settle();
  assert.equal(await zoom(),moved,'after moving the board yourself, it does not jump back');


  // 3. Text align sits on the note's bar: left → center → right.
  await key('Shift+1');await settle();
  await pick('sticky:a');
  const align=bar.locator('[data-text-align]');
  assert.equal(await align.getAttribute('data-text-align'),'start');
  await align.click();
  assert.equal((await day()).canvas.board4.styles['sticky:a'].textAlign,'center');
  assert.equal(await node('sticky:a').locator('.dd-note-preview').evaluate((el)=>getComputedStyle(el).textAlign),'center');
  await bar.locator('[data-text-align]').click();
  assert.equal((await day()).canvas.board4.styles['sticky:a'].textAlign,'end');
  await key('Escape');

  // 4. Text objects: T, click, type. Words on the board with no note paper.
  const vb=await view.boundingBox();
  await key('t');
  assert.equal(await page.getByRole('button',{name:'Text tool',exact:true}).getAttribute('aria-pressed'),'true');
  const z0=await zoom();
  await page.mouse.click(vb.x+vb.width*0.55,vb.y+vb.height*0.62);
  const typing=page.locator('.b4-plain textarea');await typing.waitFor();
  await typing.fill('Big title');await typing.press('Control+Enter');await settle();
  assert.equal(await zoom(),z0,'back to the view you had');
  let notes=(await day()).notes,text=notes.find((n)=>n.text==='Big title');
  assert.ok(text,'the text is a note of this day: '+JSON.stringify(notes.map((n)=>n.text)));
  const style=(await day()).canvas.board4.styles['sticky:'+text.id];
  assert.equal(style.plain,true);assert.equal(style.textSize,24);
  const textNode=node('sticky:'+text.id);
  assert.equal(await textNode.evaluate((el)=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)','no paper behind the words');
  const tb=await textNode.boundingBox(),z1=await zoom();
  assert.ok(tb.height<120*z1,'as tall as its words, not a square: '+tb.height);
  // It is still a note everywhere else: More › Show as a note brings its paper back.
  await textNode.click({button:'right'});await menu().waitFor();
  await menuItem('More').click();await menuItem('Show as a note').click();
  assert.equal((await day()).canvas.board4.styles['sticky:'+text.id].plain,undefined);
  await key('Control+z');await settle();
  assert.equal((await day()).canvas.board4.styles['sticky:'+text.id].plain,true);
  // An empty text leaves nothing behind.
  const count=(await day()).notes.length;
  await key('t');
  await page.mouse.click(vb.x+vb.width*0.3,vb.y+vb.height*0.75);
  await page.locator('.b4-plain textarea').waitFor();await page.keyboard.press('Escape');await settle();
  assert.equal((await day()).notes.length,count,'an empty text is removed');

  // 5. Right-click is short, with quick colors and Send to section.
  await page.locator('.b2.focus-mode').waitFor();
  await key('Shift+1');await settle();
  await node('sticky:b').locator('.dd-note-preview').click({button:'right'});await menu().waitFor();
  const labels=await menu().getByRole('menuitem').evaluateAll((l)=>l.map((e)=>e.getAttribute('aria-label')));
  assert.ok(labels.length<=10,'a short menu: '+labels.join(', '));
  for(const gone of ['Layer order','Opacity','Zoom to selection','Select branch','Cut','Text style'])assert.ok(!labels.includes(gone),gone+' waits in More');
  await shot('menu-note');
  await menu().getByRole('menuitemradio',{name:'Color #B3EFBD',exact:true}).click();
  assert.equal((await day()).notes.find((n)=>n.id==='b').color,'#B3EFBD');
  await node('sticky:b').locator('.dd-note-preview').click({button:'right'});await menu().waitFor();
  assert.equal(await menu().getByRole('menuitemradio',{name:'Color #B3EFBD',exact:true}).getAttribute('aria-checked'),'true');
  await menuItem('Send to').click();
  await shot('menu-send');
  // Send to has only This App and Capture, each with its key (5.66).
  const sendTo=await menu().getByRole('menuitem').evaluateAll((l)=>l.map((e)=>e.getAttribute('aria-label')));
  assert.ok(sendTo.some((l)=>/This App/.test(l))&&sendTo.some((l)=>/Capture/.test(l)),'This App and Capture: '+sendTo.join(', '));
  assert.ok(!sendTo.some((l)=>/^Project|^Ideas$/.test(l)),'and no other section: '+sendTo.join(', '));
  assert.match(await menu().locator('[role=menuitem]',{hasText:'This App'}).innerText(),/Alt\+T/);
  await menuItem('Ideas › This App').click();await settle();
  let all=await items(),sent=all.find((i)=>i.text==='Beta');
  assert.ok(sent&&sent.parent==='q1','the note is in Ideas › This App now: '+JSON.stringify(sent));
  assert.ok(!(await day()).notes.some((n)=>n.id==='b'),'and no longer a loose note of the day');
  const small=all.find((i)=>i.id==='q1');
  assert.ok(sent.x>=0&&sent.y>=0&&sent.x+sent.w<=small.w&&sent.y+sent.h<=small.h,'it sits inside, the section grew: '+JSON.stringify([sent,small]));
  assert.ok((await read()).setup.life.links.some((l)=>l.to==='life:'+sent.id)||(await day()).canvas.board4.links.some((l)=>l.to==='life:'+sent.id),'its line came along');
  // A section goes into another section too, and out again.
  await key('Escape');await page.locator('[data-life-jump]').click();await settle();
  await node('life:p').locator(':scope>.b4-node-body').click({button:'right'});await menu().waitFor();
  await menuItem('Send to').click();
  await menuItem('Capture').click();await settle();
  assert.equal((await items()).find((i)=>i.id==='p').parent,'lf-inbox');
  await node('life:p').locator(':scope>.b4-node-body').click({button:'right'});await menu().waitFor();
  await menuItem('Send to').click();await menuItem('Out of its section').click();await settle();
  assert.equal((await items()).find((i)=>i.id==='p').parent,'');
  // Alt+C sends what is picked to Capture.
  await key('Escape');await node('life:p').locator(':scope>.b4-node-body').click();await settle(150);
  await page.keyboard.press('Alt+c');await settle();
  assert.equal((await items()).find((i)=>i.id==='p').parent,'lf-inbox','Alt+C: to Capture');
  await key('Control+z');await settle();
  assert.equal((await items()).find((i)=>i.id==='p').parent,'');
  await node('life:p').locator(':scope>.b4-node-body').click();await settle(150);

  // 6. The align panel lines things up and spaces them evenly.
  await key('Escape');await key('Shift+1');await settle();
  await pick('sticky:a');await pick('sticky:c',true);await pick('sticky:'+text.id,true);
  // Picking several things opens Align by itself (5.38.2).
  const panel=page.getByRole('complementary',{name:'Align and space'});
  await panel.waitFor();
  await shot('align-panel');
  const before=(await day()).notes.find((n)=>n.id==='c').y;
  await panel.getByRole('button',{name:'Align top',exact:true}).click();
  // Ctrl+Z works with the focus still in the panel (undo clears the selection, as anywhere).
  await page.keyboard.press('Control+z');await settle();
  assert.equal((await day()).notes.find((n)=>n.id==='c').y,before,'Ctrl+Z undoes the align with the panel open');
  await page.keyboard.press('Control+Shift+z');await settle();
  await pick('sticky:a');await pick('sticky:c',true);await pick('sticky:'+text.id,true);await panel.waitFor();
  notes=(await day()).notes;
  assert.equal(notes.find((n)=>n.id==='a').y,notes.find((n)=>n.id==='c').y);
  assert.equal(notes.find((n)=>n.id==='a').y,notes.find((n)=>n.id===text.id).y);
  await panel.getByRole('button',{name:'Distribute horizontally',exact:true}).click();
  await panel.getByRole('button',{name:'Same width',exact:true}).click();await settle();
  const widths=['a','c',text.id].map((id)=>node('sticky:'+id).evaluate((el)=>el.offsetWidth));
  const [wa,wc,wt]=await Promise.all(widths);
  assert.ok(wa===wc&&wc===wt,'same width: '+[wa,wc,wt]+JSON.stringify((await day()).canvas.board4.styles));
  await panel.getByRole('button',{name:'Close align',exact:true}).click();
  // Closed by hand: it stays closed for this selection, the bar button brings it back.
  await pick('sticky:c',true);await settle();
  assert.equal(await page.locator('.b4-node.selected').count(),2);
  assert.equal(await panel.count(),0,'closed align stays closed while the selection lasts');
  await bar.getByRole('button',{name:'Align & space',exact:true}).click();await panel.waitFor();
  await panel.getByRole('button',{name:'Close align',exact:true}).click();
  await key('Escape');

  // 7. Lines: the color and weight you pick are what new lines get; many lines change together.
  await key('Shift+1');await settle();
  const links=async()=>[...(await day()).canvas.board4.links,...(await read()).setup.life.links];
  const clickWire=async(id)=>{const p=await page.locator(`[data-wire-id="${id}"] .b4-wire-hit`).evaluate((el)=>{const p=el.getPointAtLength(el.getTotalLength()/2),q=new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y};});await page.mouse.click(p.x,p.y);await page.waitForTimeout(150);};
  await clickWire('ab');
  await bar.getByRole('button',{name:'Line color',exact:true}).click();
  await shot('line-color');
  await bar.getByRole('button',{name:'Line color #F24822',exact:true}).click();
  await bar.getByRole('button',{name:'Line weight',exact:true}).click();
  await bar.getByRole('button',{name:'Thick',exact:true}).click();
  let ab=(await links()).find((l)=>l.id==='ab');
  assert.deepEqual([ab.color,ab.width],['#F24822',5]);
  const look=await page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:board-appearance')));
  assert.deepEqual([look.lineColor,look.lineWidth],['#F24822',5],'remembered for new lines');
  // A new line takes that look.
  await key('Escape');await pick('sticky:a');
  await node('sticky:a').locator('.dd-note-preview').click({button:'right'});await menu().waitFor();
  await menuItem('More').click();await menuItem('Connect from here').click();
  await pick('sticky:c');await settle();
  const fresh=(await links()).find((l)=>l.from==='sticky:a'&&l.to==='sticky:c');
  assert.ok(fresh,'a new line from Alpha to Gamma');
  assert.deepEqual([fresh.color,fresh.width],['#F24822',5]);
  // Many lines at once: drag a box around them, pick one color.
  await key('Escape');await page.locator('.b2.focus-mode').waitFor();
  const ba=await node('sticky:a').boundingBox(),bcb=await node('sticky:c').boundingBox();
  const x0=Math.min(ba.x,bcb.x)-30,y0=Math.min(ba.y,bcb.y)-30,x1=Math.max(ba.x+ba.width,bcb.x+bcb.width)+30,y1=Math.max(ba.y+ba.height,bcb.y+bcb.height)+30;
  await page.mouse.move(x0,y0);await page.mouse.down();await page.mouse.move(x1,y1,{steps:8});await page.mouse.up();await settle();
  await bar.getByRole('button',{name:'Line color',exact:true}).click();
  await bar.getByRole('button',{name:'Line color #0D99FF',exact:true}).click();
  const blue=(await links()).filter((l)=>l.color==='#0D99FF').map((l)=>l.from+'>'+l.to);
  assert.ok(blue.includes('sticky:a>sticky:c'),'the lines in the box changed together: '+blue);
  await bar.getByRole('button',{name:'Line weight',exact:true}).click();
  await bar.getByRole('button',{name:'Thin',exact:true}).click();
  assert.equal((await links()).find((l)=>l.from==='sticky:a'&&l.to==='sticky:c').width,2);

  // 8. The canvas menu is short too, with Add text here.
  await key('Escape');
  await page.mouse.click(vb.x+vb.width*0.85,vb.y+vb.height*0.55,{button:'right'});await menu().waitFor();
  const canvasItems=await menu().getByRole('menuitem').evaluateAll((l)=>l.map((e)=>e.getAttribute('aria-label')));
  assert.ok(canvasItems.includes('Add text here')&&canvasItems.length<=10,canvasItems.join(', '));
  await shot('menu-canvas');
  await page.keyboard.press('Escape');

  console.log('Board writing: section rename, edit zoom, text align, text objects, short menus, send to section, align panel and line looks passed');
  assert.deepEqual(errors,[]);await context.close();
 }finally{await h.stop()}
})().catch(e=>{console.error(e);process.exit(1)});
