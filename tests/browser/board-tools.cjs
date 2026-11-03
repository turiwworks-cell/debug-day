const assert=require('node:assert/strict');
const {start,fixture}=require('./harness.cjs');
// Board tools (5.34): comments (pins, threads, the Comments list), the pen
// (draw, eraser, pick / move / delete, undo), tags on notes (the note's bar,
// right-click, Board search and app search) and parent notes with sub-notes
// (a calm look outside the paper, the family on selection, Select branch).
(async()=>{
 const h=await start();
 try{
  for(const mobile of [false,true]){
   const {page,errors,context}=await h.context(mobile),f=await fixture(page,h.origin);
   page.setDefaultTimeout(10000);
   f.data.setup.life={v:2,items:[
    {id:'a',type:'section',parent:'',x:40,y:60,w:900,h:620,text:'Studio',color:'#9DD6FF'},
    {id:'n',type:'sticky',parent:'a',x:40,y:90,w:220,h:220,text:'Shared idea',color:'#FFE08A',tags:['sketch']},
    {id:'k',type:'sticky',parent:'a',x:440,y:90,w:220,h:220,text:'Line study',color:'#A8E6B8'},
   ],links:[{id:'nk',from:'life:n',to:'life:k',arrow:true}],frame:{x:1250,y:620,w:1300,h:1000}};
   const day=f.data.days[f.date];
   day.blocks[0].tags=['idea'];
   day.notes=[
    {id:'p',kind:'sticky',text:'Parent idea',color:'#FFE299',x:1300,y:100},
    {id:'c1',kind:'sticky',text:'Child one',color:'#FFA6D9',x:1700,y:40},
    {id:'c2',kind:'sticky',text:'Child two',color:'#9DD6FF',x:1700,y:330},
   ];
   day.canvas={board4:{layouts:{mindmap:{}},locked:[],styles:{},links:[
    {id:'pc1',from:'sticky:p',to:'sticky:c1',arrow:true},
    {id:'pc2',from:'sticky:p',to:'sticky:c2',arrow:true},
    // Arrows at both ends say nothing about family.
    {id:'c12',from:'sticky:c1',to:'sticky:c2',arrow:true,arrowStart:true},
   ]}};
   await page.evaluate((d)=>{localStorage.setItem('debug-day:v2',JSON.stringify(d.data));localStorage.setItem('debug-day:ui',JSON.stringify({view:'board'}));localStorage.setItem('debug-day:board-view:'+d.date,JSON.stringify({camera:d.mobile?{x:-440,y:40,z:0.35}:{x:-720,y:0,z:0.6},mode:'mindmap'}));},{data:f.data,date:f.date,mobile});
   await page.reload();await page.waitForSelector('.b2-viewport');
   const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('debug-day:v2'))),
    today=async()=>(await read()).days[f.date],
    life=async()=>(await read()).setup.life,
    node=(ref)=>page.locator(`[data-board-id="${ref}"]`),
    view=page.locator('.b2-viewport'),
    bar=page.locator('.b4-selectionbar'),
    settle=(ms=300)=>page.waitForTimeout(ms),
    key=async(k)=>{await view.focus();await page.keyboard.press(k);await settle(150);},
    menu=()=>page.getByRole('menu',{name:'Board context menu'}),
    menuItem=(name)=>menu().getByRole('menuitem',{name,exact:true}),
    camera=async()=>{const [t,r]=await Promise.all([page.locator('.b2-world').evaluate((el)=>el.style.transform),view.boundingBox()]);const m=t.match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px.*scale\(([-\d.]+)\)/);return {x:+m[1],y:+m[2],z:+m[3],left:r.x,top:r.y};},
    toScreen=async(x,y)=>{const c=await camera();return {x:c.left+c.x+x*c.z,y:c.top+c.y+y*c.z};},
    center=async(ref)=>{const b=await node(ref).boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2};},
    tap=async(locator)=>mobile?locator.tap():locator.click(),
    pick=async(ref)=>{const c=await center(ref);mobile?await page.touchscreen.tap(c.x,c.y):await page.mouse.click(c.x,c.y);await settle(200);},
    cdp=await context.newCDPSession(page),
    // A finger (or two) on the glass: real touch pointer events.
    touch=async(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map((p,i)=>({x:p.x,y:p.y,id:i}))}),
    draw=async(points)=>{
     if(mobile){await touch('touchStart',[points[0]]);for(const p of points.slice(1))await touch('touchMove',[p]);await touch('touchEnd',[]);}
     else{await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();for(const p of points.slice(1))await page.mouse.move(p.x,p.y,{steps:4});await page.mouse.up();}
     await settle(250);
    },
    line=(a,b,n=6)=>Array.from({length:n+1},(_,i)=>({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n+Math.sin(i)*6})),
    undo=async()=>{await view.focus();await page.keyboard.press('Control+z');await settle(250);},
    redo=async()=>{await view.focus();await page.keyboard.press('Control+Shift+z');await settle(250);};
   const shots=process.env.DEBUG_DAY_SCREENSHOTS,shot=async(name)=>{if(shots){require('node:fs').mkdirSync(shots,{recursive:true});await page.screenshot({path:require('node:path').join(shots,name+(mobile?'-phone':'')+'.png')});}};
   await view.focus();await page.keyboard.press('Control+Shift+F');await page.locator('.b2.focus-mode').waitFor();
   await settle(500);

   // 1. Parent notes: arrows make the family; the parent stands out outside its paper.
   assert.equal(await node('sticky:p').getAttribute('data-parent-look'),'stack','a parent note gets the calm stack');
   assert.equal(await node('sticky:c1').getAttribute('data-parent-look'),null,'a two-way line makes no parent');
   assert.equal(await node('life:n').getAttribute('data-parent-look'),'stack','a Feed note with an arrow is a parent too');
   assert.equal((await node('sticky:p').locator('.dd-subnote-count').innerText()).trim(),'2');
   const paper=await node('sticky:p').evaluate((el)=>{const s=getComputedStyle(el);return [s.backgroundColor,s.borderRadius,el.offsetWidth,el.offsetHeight].join('|');});
   const plain=await node('sticky:c2').evaluate((el)=>{const s=getComputedStyle(el);return [s.borderRadius].join('|');});
   assert.equal(paper.split('|')[1],plain,'the paper itself keeps its shape');
   const under=await node('sticky:p').locator('.dd-note-under').boundingBox(),pbox=await node('sticky:p').boundingBox();
   assert.ok(under.y>=pbox.y+pbox.height,'the count sits under the paper, not on it');
   await shot('parent-note');
   // Picked, a note shows its family; a click goes there and Back returns.
   await pick('sticky:p');
   const family=node('sticky:p').locator('.dd-note-family');
   await family.waitFor();
   assert.deepEqual(await family.locator('[data-family-ref]').evaluateAll((els)=>els.map((e)=>e.dataset.familyRef)),['sticky:c1','sticky:c2']);
   await shot('family');
   await tap(family.locator('[data-family-ref="sticky:c1"]'));
   await settle(600);
   assert.equal(await node('sticky:c1').evaluate((el)=>el.classList.contains('selected')),true,'the sub-note is picked');
   const back=page.locator('.b2-brandbar [data-places-back]');
   assert.equal(await back.isDisabled(),false,'Back returns to where you were');
   assert.deepEqual(await node('sticky:c1').locator('.dd-note-family [data-family-ref]').evaluateAll((els)=>els.map((e)=>e.dataset.familyRef)),['sticky:p'],'a sub-note shows its parent');
   const zoomed=(await camera()).z;
   await tap(back);await settle(700);
   assert.ok(Math.abs((await camera()).z-(mobile?0.35:0.6))<0.02&&Math.abs(zoomed-(await camera()).z)>0.05,'Back returns the camera');
   // Select branch takes the sub-notes along.
   await pick('sticky:p');
   const pc=await center('sticky:p');
   if(mobile){await bar.locator('[data-dock-more="selection"]').click();}
   else await page.mouse.click(pc.x,pc.y,{button:'right'});
   await menuItem('More').click();await menuItem('Select branch').click();await settle();
   assert.equal(await page.locator('.b4-node.selected').count(),3,'the parent and its two sub-notes');
   await key('Escape');
   // Three calm looks to choose from, in the tools menu.
   await page.locator('[data-dock-more="tools"]').click();
   await menuItem('Parent note look').click();await menuItem('Page edges').click();await settle();
   assert.equal(await node('sticky:p').getAttribute('data-parent-look'),'pages');
   await page.locator('[data-dock-more="tools"]').click();
   await menuItem('Parent note look').click();await menuItem('Soft stack').click();await settle();

   // 2. Tags: from the note's bar and from right-click; one tag system with tasks.
   await pick('sticky:p');
   await bar.locator('[data-note-tags]').click();
   const tagInput=page.getByRole('textbox',{name:'Add a tag',exact:true});
   await tagInput.fill('idea');await tagInput.press('Enter');
   await tagInput.fill('Sketch book');await tagInput.press('Enter');
   assert.deepEqual((await today()).notes.find((n)=>n.id==='p').tags,['idea','Sketch_book']);
   if(mobile)assert.equal(await page.locator('.dd-note-tag-sheet').count(),1,'on a phone tags open in a sheet');
   else assert.equal(await node('sticky:p').locator('.dd-note-tag-editor').count(),1,'tags are edited under the note');
   await shot('tags-edit');
   await page.locator('.dd-note-tag-editor').getByRole('button',{name:'Remove tag Sketch_book'}).click();
   assert.deepEqual((await today()).notes.find((n)=>n.id==='p').tags,['idea']);
   await tagInput.press('Escape');await settle();
   const chip=node('sticky:p').locator('.dd-note-tags .dd-tag');
   assert.equal((await chip.innerText()).trim(),'#idea');
   assert.ok((await chip.boundingBox()).y>=pbox.y+pbox.height-1,'tags sit under the paper');
   // Right-click a Feed note: Tags…
   await page.evaluate(()=>{const v=document.querySelector('.b2-viewport');v.dispatchEvent(new CustomEvent('x'));});
   const kc=await center('life:k');
   if(mobile){await pick('life:k');await bar.locator('[data-dock-more="selection"]').click();}
   else await page.mouse.click(kc.x,kc.y,{button:'right'});
   await menuItem('Tags…').click();
   await tagInput.fill('#Idea');await tagInput.press('Enter');
   assert.deepEqual((await life()).items.find((i)=>i.id==='k').tags,['Idea']);
   await tagInput.press('Escape');await settle();
   // Board search: #idea finds the task and both notes (one tag, any case), not #sketch.
   await view.focus();await page.keyboard.press('Control+f');
   await page.locator('.b4-search input').fill('#idea');await settle();
   const found=await page.locator('#dd-board-results [role=option]').allInnerTexts();
   assert.ok(found.some((t)=>/Parent idea/.test(t))&&found.some((t)=>/Line study/.test(t))&&found.some((t)=>/Portfolio writing/.test(t)),found.join(' / '));
   assert.ok(!found.some((t)=>/Shared idea/.test(t)),'#sketch is another tag');
   await shot('board-search-tag');
   await page.keyboard.press('Escape');await settle();
   // App search (Ctrl+Space) reads note tags too.
   if(!mobile){
    await page.keyboard.press('Control+Space');
    const search=page.getByRole('dialog').getByRole('combobox');
    await search.fill('#sketch');await settle();
    const rows=await page.getByRole('listbox').getByRole('option').allInnerTexts();
    assert.ok(rows.some((t)=>/Shared idea/.test(t)),rows.join(' / '));
    assert.ok(rows.some((t)=>/#sketch/.test(t)),'the result shows its tags');
    await page.keyboard.press('Escape');await settle();
   }

   // 3. Pen: draw on the day and inside a section; colors, widths, undo.
   await key('Escape');
   await key('p');
   assert.equal(await page.locator('.dd-ink-capture').count(),1,'P turns the pen on');
   await page.locator('.dd-pen-bar').getByRole('button',{name:'Blue pen'}).click();
   await page.locator('.dd-pen-bar').getByRole('button',{name:'Thick line'}).click();
   const a1=await toScreen(1980,150),a2=await toScreen(2200,220);
   await draw(line(a1,a2));
   let strokes=(await today()).canvas.board4.strokes;
   assert.equal(strokes.length,1,'one stroke on the day');
   assert.equal(strokes[0].color,'#0D99FF');assert.equal(strokes[0].width,8);
   assert.ok(strokes[0].pts.split(' ').length<=12,'points are saved simplified: '+strokes[0].pts);
   await shot('pen-day');
   // Inside the Feed section: it belongs to the section.
   const lf=await page.locator('[data-board-id="life:a"]').boundingBox();
   await draw(line({x:lf.x+lf.width*0.3,y:lf.y+lf.height*0.75},{x:lf.x+lf.width*0.55,y:lf.y+lf.height*0.8}));
   const inked=(await life()).strokes;
   assert.equal(inked.length,1);assert.equal(inked[0].parent,'a','a stroke drawn in a section belongs to it');
   const [x0,y0]=inked[0].pts.split(' ')[0].split(',').map(Number);
   assert.ok(x0>0&&x0<900&&y0>0&&y0<620,'points relative to the section');
   await undo();
   assert.equal((await life()).strokes,undefined,'undo takes the stroke back');
   await redo();
   assert.equal((await life()).strokes.length,1,'redo brings it again');
   // Eraser: one touch removes a whole stroke.
   await page.locator('.dd-pen-bar').getByRole('button',{name:/Eraser/}).click();
   const mid=await toScreen(2090,185);
   await draw([{x:mid.x-30,y:mid.y-40},{x:mid.x,y:mid.y},{x:mid.x+30,y:mid.y+40}]);
   assert.equal((await today()).canvas.board4.strokes,undefined,'the eraser removed the whole stroke');
   await undo();
   assert.equal((await today()).canvas.board4.strokes.length,1);
   // A two-finger pan on a phone still pans while the pen is on.
   if(mobile){
    const before=await camera(),vb=await view.boundingBox(),cx=vb.x+vb.width/2,cy=vb.y+vb.height/2;
    await touch('touchStart',[{x:cx-40,y:cy}]);await touch('touchStart',[{x:cx-40,y:cy},{x:cx+40,y:cy}]);
    for(let i=1;i<=5;i++)await touch('touchMove',[{x:cx-40,y:cy+i*20},{x:cx+40,y:cy+i*20}]);
    await touch('touchEnd',[]);await settle(400);
    const after=await camera();
    assert.ok(Math.abs(after.y-before.y)>40,'two fingers moved the board');
    assert.equal((await today()).canvas.board4.strokes.length,1,'and drew nothing');
   }
   await page.locator('.dd-pen-bar').getByRole('button',{name:'Done'}).click();
   assert.equal(await page.locator('.dd-ink-capture').count(),0);
   // Pick a stroke, move it, delete it, undo.
   const drawn=page.locator('.dd-ink g[data-stroke-home="day"] .dd-ink-hit');
   const hit=await page.evaluate(()=>{const p=document.querySelector('.dd-ink g[data-stroke-home="day"] .dd-ink-hit'),l=p.getTotalLength(),pt=p.getPointAtLength(l/2),m=p.getScreenCTM();return {x:pt.x*m.a+m.e,y:pt.y*m.d+m.f};});
   const ptsBefore=(await today()).canvas.board4.strokes[0].pts;
   if(mobile){await touch('touchStart',[hit]);for(let i=1;i<=4;i++)await touch('touchMove',[{x:hit.x+i*12,y:hit.y+i*6}]);await touch('touchEnd',[]);}
   else{await page.mouse.move(hit.x,hit.y);await page.mouse.down();await page.mouse.move(hit.x+50,hit.y+25,{steps:5});await page.mouse.up();}
   await settle();
   assert.notEqual((await today()).canvas.board4.strokes[0].pts,ptsBefore,'the stroke moved');
   assert.equal(await page.locator('.dd-ink g.selected').count(),1,'and stays picked');
   await shot('stroke-picked');
   if(mobile)await page.locator('.dd-pen-bar').getByRole('button',{name:'Delete drawing'}).click();
   else{await page.keyboard.press('Delete');}
   await settle();
   assert.equal((await today()).canvas.board4.strokes,undefined,'deleted');
   await undo();
   assert.equal((await today()).canvas.board4.strokes.length,1,'undo brings it back');
   await drawn.count();

   // 4. Comments: on a card, free in a section, free on the day.
   await key('m');
   assert.equal(await page.locator('.dd-comment-capture').count(),1,'M turns comments on');
   const c2=await node('sticky:c2').boundingBox();
   if(mobile)await page.touchscreen.tap(c2.x+c2.width*0.8,c2.y+20);else await page.mouse.click(c2.x+c2.width*0.8,c2.y+20);
   const box=page.getByRole('textbox',{name:'Write a comment',exact:true});
   await box.fill('Love this colour');await box.press('Enter');await settle();
   let notes=(await today()).canvas.board4.comments;
   assert.equal(notes.length,1);assert.equal(notes[0].on,'sticky:c2','a comment on a card follows the card');
   assert.equal(await page.locator('.dd-comment-capture').count(),0,'back to Select after posting');
   const reply=page.getByRole('textbox',{name:'Reply',exact:true});
   await reply.fill('Thanks!');await reply.press('Enter');await settle();
   assert.equal((await today()).canvas.board4.comments[0].thread.length,2);
   if(mobile)assert.equal(await page.locator('.dd-thread-sheet').count(),1,'on a phone the thread is a sheet');
   await shot('comment-thread');
   // Edit a message.
   await page.locator('.dd-thread li').first().getByRole('button',{name:'Edit message'}).click();
   const edit=page.getByRole('textbox',{name:'Edit message',exact:true});
   await edit.fill('Love this colour so much');await edit.press('Enter');await settle();
   const first=(await today()).canvas.board4.comments[0].thread[0];
   assert.equal(first.text,'Love this colour so much');assert.ok(first.edited,'marked edited');
   await page.getByRole('button',{name:'Close comment',exact:true}).click();await settle();
   // The pin follows its card.
   const pin=page.locator('.dd-pin[data-comment-home="day"]').first();
   const pinBefore=await pin.boundingBox(),noteBefore=await node('sticky:c2').boundingBox();
   await pick('sticky:c2');
   for(let i=0;i<4;i++)await key('Shift+ArrowRight');
   await settle();
   const pinAfter=await pin.boundingBox(),noteAfter=await node('sticky:c2').boundingBox();
   assert.ok(Math.abs((pinAfter.x-pinBefore.x)-(noteAfter.x-noteBefore.x))<2,'the pin moved with the note');
   await key('Escape');
   // Free comment inside the section: it belongs to the section (the Feed).
   const sec=await page.locator('[data-board-id="life:a"]').boundingBox();
   await key('m');
   if(mobile)await page.touchscreen.tap(sec.x+sec.width*0.8,sec.y+sec.height*0.6);else await page.mouse.click(sec.x+sec.width*0.8,sec.y+sec.height*0.6);
   await box.fill('Feed thought');await box.press('Enter');await settle();
   const feed=(await life()).comments;
   assert.equal(feed.length,1);assert.equal(feed[0].parent,'a');
   await page.getByRole('button',{name:'Close comment',exact:true}).click();await settle();
   // Right-click the empty board: Add comment here (the day's board).
   if(!mobile){
    const spot=await toScreen(2100,500);
    await page.mouse.click(spot.x,spot.y,{button:'right'});
    await menuItem('Add comment here').click();
    await box.fill('Day thought');await box.press('Enter');await settle();
    const free=(await today()).canvas.board4.comments.find((c)=>!c.on);
    assert.ok(free&&Math.abs(free.x-2100)<2,'a free comment on the day');
    await page.getByRole('button',{name:'Close comment',exact:true}).click();await settle();
   }
   // Resolve hides it; the Comments list (Shift+M) finds it again.
   await tap(page.locator('.dd-pin[data-comment-home="day"] .dd-pin-dot').first());
   await page.locator('[data-resolve]').click();await settle();
   assert.equal((await today()).canvas.board4.comments.find((c)=>c.on==='sticky:c2').done,true);
   assert.equal(await page.locator('.dd-pin[data-done]').count(),0,'a resolved comment leaves the board');
   await key('Shift+M');
   const panel=page.locator('.dd-comments-panel');
   await panel.waitFor();
   assert.equal(await panel.locator('[data-comment-group="feed"] .dd-comment-row').count(),1);
   await panel.getByRole('button',{name:/^Resolved/}).click();
   assert.equal(await panel.locator('.dd-comment-row').count(),1);
   await shot('comments-list');
   await panel.getByRole('button',{name:/^Open/}).click();
   // Jump to the Feed comment from far away; Back returns.
   const before=await camera();
   await panel.locator('[data-comment-group="feed"] .dd-comment-row').click();
   await settle(700);
   assert.notEqual(JSON.stringify(await camera()),JSON.stringify(before),'the board went to the comment');
   assert.equal(await page.locator('.dd-thread').count(),1,'and opened it');
   await page.getByRole('button',{name:'Close comment',exact:true}).click();await settle();
   if(await panel.count())await panel.getByRole('button',{name:'Close comments'}).click();
   await tap(back);await settle(700);
   const returned=await camera();
   assert.ok(Math.abs(returned.x-before.x)<3&&Math.abs(returned.y-before.y)<3&&Math.abs(returned.z-before.z)<0.01,'Back returns from the comment');
   // Delete a thread, undo brings it back.
   await tap(page.locator('.dd-pin[data-comment-home="feed"] .dd-pin-dot'));
   await page.locator('[data-delete-thread]').click();await settle();
   assert.equal((await life()).comments,undefined);
   await undo();
   assert.equal((await life()).comments.length,1);
   // A deleted card takes its comments along.
   await pick('sticky:c2');await page.locator('[data-board-id="sticky:c2"].selected').waitFor();
   await key('Delete');await settle(500);
   assert.ok(!(await today()).notes.some((n)=>n.id==='c2'),'the note is gone');
   assert.ok(!((await today()).canvas.board4.comments||[]).some((c)=>c.on==='sticky:c2'),'the note took its comment');
   await undo();

   // The phone page never scrolls sideways, and nothing went wrong.
   if(mobile)assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no sideways scroll');
   if(mobile)assert.ok(await page.locator('[data-dock="tools"]').evaluate((e)=>e.scrollWidth<=e.clientWidth+1),'the tools dock fits in one row');
   assert.deepEqual(errors,[]);
   console.log('board tools '+(mobile?'phone':'desktop')+' ok');
   await context.close();
  }
  console.log('board tools ok');
 }finally{await h.stop();}
})().catch((e)=>{console.error(e);process.exit(1);});
