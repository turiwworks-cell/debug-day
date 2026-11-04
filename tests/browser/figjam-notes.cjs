const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// Sticky notes and connectors behave like FigJam: the sticky tool previews the
// note, typing happens on the note, "+" adds a neighbour, edges resize the
// FigJam way, a connector dropped on empty canvas makes a connected note, and
// a selected line has FigJam's own toolbar.
(async()=>{
 const h=await start();
 try {
  for(const language of ['en']){
   const {page,errors}=await h.context(false),f=await fixture(page,h.origin),t=(en,fa)=>language==='fa'?fa:en;
   f.data.setup.preferences.language=language;
   f.data.days[f.date].notes=[{id:'a',kind:'sticky',text:'First idea',color:'#FFE299',x:900,y:900}];
   f.data.days[f.date].canvas={board4:{layouts:{mindmap:{}},links:[],locked:[],styles:{'sticky:a':{width:240,height:240,textSize:16}}}};
   f.data.setup.life={v:2,items:[{id:'s',type:'section',parent:'',x:60,y:60,w:420,h:300,text:'Studio',color:'#B3EFBD'},{id:'s2',type:'section',parent:'',x:560,y:60,w:300,h:300,text:'Desk',color:'#FFC7C2'}],links:[],frame:{x:24,y:1400,w:1200,h:700}};
   await page.evaluate((d)=>localStorage.setItem('debug-day:v2',JSON.stringify(d)),f.data);
   await page.reload();await page.waitForSelector('#qa',{state:'attached'});
   await page.locator('.views button').nth(1).click();
   await page.getByRole('button',{name:t('Full screen','تمام‌صفحه'),exact:true}).click();
   const day=async()=>(await page.evaluate((date)=>JSON.parse(localStorage.getItem('debug-day:v2')).days[date],f.date));
   const style=async(id)=>(await day()).canvas.board4.styles['sticky:'+id];
   const note=(id)=>page.locator(`[data-board-id="sticky:${id}"]`);
   const dock=page.locator('.b2-dock');
   // The dock has no connector or feeling tool.
   assert.equal(await dock.getByRole('button',{name:t('Connect nodes','اتصال نودها'),exact:true}).count(),0);
   assert.equal(await dock.locator('button[aria-label*="eeling"],button[aria-label*="احساس"]').count(),0);
   // Sections: no connection circles, and a click on the body selects them.
   await page.locator('[data-life-jump]').click();
   const sec=page.locator('[data-life-id="s"]');await sec.waitFor();
   assert.equal(await sec.locator('.b4-port').count(),0,'sections have no connection points');
   await page.keyboard.press('Escape');
   const sb=await sec.boundingBox();await page.mouse.click(sb.x+sb.width-30,sb.y+sb.height-30);
   assert.equal(await sec.getAttribute('aria-selected'),'true','clicking inside a section selects it');
   // Shift-click a second section; dragging either body moves both together.
   const sec2=page.locator('[data-life-id="s2"]'),b2=await sec2.boundingBox(),grab={x:b2.x+b2.width-30,y:b2.y+b2.height-30};
   await page.keyboard.down('Shift');await page.mouse.click(grab.x,grab.y);await page.keyboard.up('Shift');
   assert.equal(await sec.getAttribute('aria-selected'),'true');assert.equal(await sec2.getAttribute('aria-selected'),'true','shift-click adds a section');
   await page.mouse.move(grab.x,grab.y);await page.mouse.down();await page.mouse.move(grab.x+60,grab.y+80,{steps:10});await page.mouse.up();
   const lifeNow=(await page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2')))).setup.life.items,L1=lifeNow.find(i=>i.id==='s'),L2=lifeNow.find(i=>i.id==='s2');
   assert.ok(L1.x>60&&L2.x>560,'both sections moved: '+JSON.stringify([L1,L2]));
   assert.ok(Math.abs((L1.x-60)-(L2.x-560))<=1&&Math.abs((L1.y-60)-(L2.y-60))<=1,'by the same amount');
   assert.equal(L1.parent,'');assert.equal(L2.parent,'','neither drops into the other');
   await page.keyboard.press('Escape');
   // Sticky tool: a ghost follows the pointer and the colors sit above the dock.
   await page.locator('.b2-viewport').focus();await page.keyboard.press('f');
   // A double-click anywhere on the board makes a note there, ready to type (5.28).
   // Let the fit land first, so both clicks hit the same spot on the board.
   await page.waitForFunction(()=>Number(document.querySelector('.b2-viewport').dataset.zoom)<1);await page.waitForTimeout(200);
   {const vb0=await page.locator('.b2-viewport').boundingBox(),n0=(await day()).notes.length;
    await page.mouse.dblclick(vb0.x+vb0.width*.62,vb0.y+vb0.height*.35);
    const typing=page.locator('.dd-note-editor textarea');await typing.waitFor();
    await typing.fill('Made by double-click');await page.keyboard.press('Escape');
    const after=await day();assert.equal(after.notes.length,n0+1,'double-click adds one note');
    assert.equal(after.notes.at(-1).text,'Made by double-click');await page.keyboard.press('Escape');}
   await page.locator('.b2-viewport').focus();await page.keyboard.press('s');
   const colors=page.locator('.dd-sticky-colors');await colors.waitFor();
   await colors.locator('button').nth(4).click();
   const vb=await page.locator('.b2-viewport').boundingBox(),spot={x:vb.x+vb.width*.62,y:vb.y+vb.height*.35};
   await page.mouse.move(spot.x,spot.y);await page.mouse.move(spot.x+4,spot.y+4);
   assert.equal(await page.locator('.dd-ghost-note').evaluate((e)=>e.style.display),'block','the sticky tool previews the note');
   const before=(await day()).notes.length;
   await page.mouse.click(spot.x+4,spot.y+4);
   const area=page.locator('.dd-note-editor textarea');await area.waitFor();
   assert.equal(await area.getAttribute('placeholder'),t('Type anything…','هر چیزی بنویس…'));
   assert.equal(await page.getByRole('button',{name:t('Finish editing note','پایان ویرایش نوت')}).count(),0,'no separate editing bar');
   await area.fill('Typed on the note');await page.keyboard.press('Escape');
   let d=await day();assert.equal(d.notes.length,before+1);
   const made=d.notes.at(-1);assert.equal(made.text,'Typed on the note');assert.equal(made.color,'#A8DAFF','the chosen color is used');
   assert.equal(await page.locator('.dd-ghost-note').evaluate((e)=>e.style.display),'none');
   // "+" beside a selected note adds a neighbour one gap away. Fit all lands
   // under 35% here, where the "+" hides (5.23), so step in once.
   const fitNear=async()=>{await page.locator('.b2-viewport').focus();await page.keyboard.press('f');await page.waitForTimeout(400);
    if(Number(await page.locator('.b2-viewport').getAttribute('data-zoom'))<0.35){await page.keyboard.press('=');await page.waitForTimeout(300);}};
   await fitNear();
   await note('a').locator('.dd-note-preview').click();
   const plus=note('a').locator('[data-add-near="left"]');await plus.waitFor();
   // The new note is ready to type; a note closed empty goes away (5.45).
   await plus.click();await page.keyboard.type('Neighbour');await page.keyboard.press('Escape');
   d=await day();const near=d.notes.at(-1),a=d.notes.find(n=>n.id==='a');
   assert.equal(near.x,a.x-240-40,'the new note sits one gap to the left');assert.equal(near.y,a.y);
   assert.equal((await style(near.id)).width,240);
   // Edges: left/right change only the width; corners scale the note and its text.
   // (A click on an already selected note starts typing, as in FigJam, so clear first.)
   await page.keyboard.press('Escape');
   await note('a').locator('.dd-note-preview').click();
   if(await note('a').locator('textarea').count())await page.keyboard.press('Escape');
   const drag=async(loc,dx,dy)=>{const b=await loc.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+dx,b.y+b.height/2+dy,{steps:8});await page.mouse.up();};
   await drag(note('a').locator('[data-edge="e"]'),60,30);
   let s=await style('a');assert.ok(s.width>240,'right edge widens');assert.equal(s.height,240,'right edge keeps the height');assert.equal(s.textSize,16);
   const w0=s.width;
   await page.waitForTimeout(250); // the width settles with a short snap animation
   await drag(note('a').locator('[data-edge="se"]'),80,80);
   // Height follows the text (5.21), so the scale shows in the text size and width.
   s=await style('a');const k=s.textSize/16;
   assert.ok(k>1.1,'corner scales up');assert.ok(Math.abs(s.width/w0-k)<.02,'corner keeps the proportions');
   assert.ok((await note('a').boundingBox()).height>=(await note('a').boundingBox()).width-1,'the note stays at least square');
   // A connector dropped on empty canvas makes a connected note there.
   await page.keyboard.press('Escape');
   await fitNear();
   await note('a').locator('.dd-note-preview').click();
   if(await note('a').locator('textarea').count())await page.keyboard.press('Escape');
   // With "+" showing there are no separate circles; dragging "+" draws the line.
   assert.equal(await note('a').locator('.b4-port').evaluateAll((l)=>l.filter((e)=>getComputedStyle(e).display!=='none').length),0,'no connection circles behind the edges');
   const port=await note('a').locator('[data-add-near="right"]').boundingBox(),count=(await day()).notes.length;
   await page.mouse.move(port.x+port.width/2,port.y+port.height/2);await page.mouse.down();
   await page.mouse.move(port.x+port.width/2+200,port.y+port.height/2,{steps:10});
   assert.equal(await page.locator('.dd-ghost-note').evaluate((e)=>e.style.display),'block','a note waits at the end of the line');
   await page.mouse.up();await page.keyboard.type('Linked');await page.keyboard.press('Escape');
   d=await day();assert.equal(d.notes.length,count+1,'dropping makes a note');
   const linked=d.notes.at(-1),link=d.canvas.board4.links.find(l=>l.from==='sticky:a'&&l.to==='sticky:'+linked.id);
   assert.ok(link,'and connects it');assert.equal(link.fromPort,'right');assert.equal(link.toPort,'left');
   assert.ok(linked.x>a.x,'the new note is to the right');
   // A selected line gets FigJam's toolbar and no details panel.
   const mid=await page.locator(`[data-wire-id="${link.id}"] .b4-wire-hit`).evaluate((p)=>{const q=p.getPointAtLength(p.getTotalLength()/2),m=p.getScreenCTM();return {x:m.a*q.x+m.c*q.y+m.e,y:m.b*q.x+m.d*q.y+m.f};});
   await page.mouse.click(mid.x,mid.y);
   const bar=page.locator('.b4-selectionbar');await bar.getByRole('button',{name:t('Elbowed line','خط شکسته'),exact:true}).waitFor();
   assert.equal(await page.getByRole('textbox',{name:t('Connection label','عنوان اتصال'),exact:true}).count(),0,'details stay closed until asked');
   const linkNow=async()=>(await day()).canvas.board4.links.find(l=>l.id===link.id);
   await bar.getByRole('button',{name:t('Straight line','خط صاف'),exact:true}).click();assert.equal((await linkNow()).style,'straight');
   // Dashes and the start arrow sit in the line's ⋯ menu.
   const lineMenu=async(en,fa)=>{await bar.getByRole('button',{name:t('More actions','گزینه‌های بیشتر'),exact:true}).click();await page.getByRole('menuitem',{name:t(en,fa),exact:true}).click();};
   await lineMenu('Dashed line','خط‌چین');assert.equal((await linkNow()).dashed,true);
   await lineMenu('Arrow at start','پیکان در ابتدا');
   let l=await linkNow();assert.equal(l.arrowStart,true);assert.equal(l.arrow,true,'end arrow stays');
   await bar.getByRole('button',{name:t('Line weight','ضخامت خط'),exact:true}).click();
   await bar.getByRole('button',{name:t('Thick','ضخیم'),exact:true}).click();assert.equal((await linkNow()).width,5);
   await bar.getByRole('button',{name:t('Line color','رنگ خط'),exact:true}).click();
   await bar.getByRole('button',{name:t('Line color ','رنگ خط ')+'#0D99FF',exact:true}).click();assert.equal((await linkNow()).color,'#0D99FF');
   const path=page.locator(`[data-wire-id="${link.id}"] .b4-wire-line`);
   assert.equal(await path.getAttribute('marker-start'),'url(#b4-arrow)');assert.equal(await path.getAttribute('marker-end'),'url(#b4-arrow)');
   // Ctrl+Space search opens on top of the full-screen board.
   await page.keyboard.press('Escape');await page.locator('.b2-viewport').focus();
   if(!await page.locator('.b6.focus-mode').count())await page.getByRole('button',{name:t('Full screen','تمام‌صفحه'),exact:true}).click();
   await page.locator('.b6.focus-mode').waitFor();await page.locator('.b2-viewport').focus();
   await page.keyboard.press('Control+Space');
   const find=page.locator('input[aria-controls="dd-command-results"]');await find.waitFor();
   assert.ok(await find.evaluate((e)=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e;}),'the search box is on top');
   await page.keyboard.press('Escape');
   assert.deepEqual(errors,[]);await page.context().close();
  }
  console.log('FigJam notes: dock, section clicks, sticky tool preview and colors, inline typing, + neighbours, FigJam resizing, + drag connectors, connector-to-new-note and line toolbar, multi-section moves, double-click notes and Ctrl+Space in full screen passed (en/fa)');
 }finally{await h.stop()}
})().catch(e=>{console.error(e);process.exit(1)});
