// Shared symbols use the existing day.notes and task.emo fields in every view.
const stickers = [
['spark','Little spark','جرقهٔ کوچولو','create','star',['#FFE8A0','#F2BF63'],'✨'],
['cloud','Cloud break','ابر آروم','calm','cloud',['#DCEFFD','#A8CEE6'],'☁️'],
['studio','Studio pal','رفیق استودیو','create','blob',['#D8CAF6','#B09DDD'],'🎨'],
['flame','Creative fire','شعلهٔ خلاقیت','create','flame',['#FFBD8A','#EE8469'],'🔥'],
['sprout','Slow growth','جوانهٔ صبور','calm','sprout',['#E8C7AC','#C8997C'],'🌱'],
['heart','A little care','کمی مهربونی','calm','heart',['#FBD0DB','#EAA1BA'],'💗'],
['orbit','In my orbit','تو مدار خودم','create','planet',['#E2D8FC','#C1B4EA'],'🪐'],
['coffee','Coffee pause','مکث قهوه','calm','coffee',['#F7DDC1','#DEB68D'],'☕']
].map(([id,en,fa,category,art,colors,fallback])=>({id,value:'sticker:'+id,en,fa,category,art,colors,fallback,kind:'sticker'}));
const emojis = [
['✨','A little magic','کمی جادو','create'],['🎨','Color time','وقت رنگ','create'],['🪄','Make something','یه چیزی بساز','create'],['💡','Fresh idea','ایدهٔ تازه','create'],['🖌️','Paint','نقاشی','create'],['✏️','Sketch','اسکیس','create'],['🎬','Make a scene','یه صحنه بساز','create'],['🎧','Deep listening','گوش دادن','calm'],['🎸','Play','بنواز','create'],['🎹','Piano','پیانو','create'],['🧵','Make by hand','کار دست','create'],['📷','Take a look','یه نگاه تازه','create'],
['🌱','Growing slowly','رشد آروم','calm'],['☁️','Cloudy and okay','ابری و خوب','calm'],['☕','Coffee break','استراحت قهوه','calm'],['🍵','Tea time','وقت چای','calm'],['🌙','Quiet night','شب آروم','calm'],['🫧','Let it float','رهاش کن','calm'],['🕯️','Small light','نور کوچیک','calm'],['🌊','Go with the flow','همراه جریان','calm'],['🌼','A small bloom','شکوفهٔ کوچیک','calm'],['🍄','Little forest','جنگل کوچیک','calm'],['🐈','Cat company','رفیق گربه','calm'],['🦋','A new turn','تغییر تازه','calm'],
['🙂','Here today','امروز اینجام','play'],['🥹','A tender day','روز لطیف','play'],['🤩','Inspired','الهام گرفتم','play'],['😌','Taking it easy','آسون می‌گیرم','calm'],['😴','Need rest','استراحت می‌خوام','calm'],['🫠','Melting a little','کمی آب شدم','play'],['😎','Feeling good','حالم خوبه','play'],['🤗','A little warmth','کمی گرما','play'],['💛','Warm heart','دل گرم','play'],['💜','Soft heart','دل نرم','calm'],['🪩','Tiny dance','رقص کوچولو','play'],['🎈','Room to play','جا برای بازی','play'],
['🌈','More color','رنگ بیشتر','play'],['⭐','Small win','قدم خوب','play'],['🍒','Something sweet','یه چیز شیرین','play'],['🍊','Fresh energy','انرژی تازه','play'],['🛸','Somewhere new','یه جای تازه','play'],['🚀','Off we go','بریم که رفتیم','play'],['🧩','One piece at a time','تکه‌تکه پیش می‌رم','create'],['🎯','One small focus','یک تمرکز کوچیک','create'],['📚','A little learning','کمی یادگیری','create'],['🧶','Unravel it slowly','آروم بازش کن','calm'],['🐢','My own pace','با ریتم خودم','calm'],['🐙','Many ideas','ایده‌های زیاد','create']
].map(([value,en,fa,category])=>({value,en,fa,category,kind:'emoji'}));
export const DDplayfulData = {
  stickers, emojis,
  item(value){return [...stickers,...emojis].find(item=>item.value===value);},
  isSticker(value){return stickers.some(item=>item.value===value);},
  label(value,language='en'){const item=this.item(value);return item?(language==='fa'?item.fa:item.en):String(value||'');},
  valid(value){return !!this.item(value);},
  put(day,value,options={}){
    if(!day||!this.valid(value))return day;
    const locked=new Set(day.canvas?.board4?.locked||[]);
    if(options.taskId){
      const task=day.blocks?.find(task=>task.id===options.taskId);
      if(!task||task.emo===value||locked.has('b:'+task.id))return day;
      return {...day,blocks:day.blocks.map(task=>task.id===options.taskId?{...task,emo:value}:task)};
    }
    const id=options.replace||options.id;
    if(!id||locked.has('sticky:'+id))return day;
    const existing=(day.notes||[]).find(note=>note.id===id);
    if(options.replace&&(!existing||existing.kind!=='emoji'))return day;
    if(!options.replace&&existing)return day;
    if(existing?.text===value)return day;
    const label=this.label(value,'en')+' · '+this.label(value,'fa');
    const board=day.canvas?.board4||{},ref='sticky:'+id,size=this.isSticker(value)?128:76;
    const number=n=>Number.isFinite(n)?Math.max(-100000,Math.min(100000,n)):80;
    let origin={x:80,y:80};
    if(!existing&&(!Number.isFinite(options.x)||!Number.isFinite(options.y))){
      const occupied=(day.notes||[]).map(note=>({x:number(note.x),y:number(note.y),w:board.styles?.['sticky:'+note.id]?.width||(note.kind==='emoji'?128:220),h:board.styles?.['sticky:'+note.id]?.height||(note.kind==='emoji'?128:160)}));
      for(let index=0;index<1024;index++){
        const x=80+(index%5)*(size+24),y=80+Math.floor(index/5)*(size+24);
        origin={x,y};
        if(!occupied.some(note=>x<note.x+note.w+16&&x+size+16>note.x&&y<note.y+note.h+16&&y+size+16>note.y))break;
      }
    }
    const note=existing?{...existing,text:value,label}:{id,kind:'emoji',text:value,label,x:number(options.x??origin.x),y:number(options.y??origin.y),color:'#FFFFFF'};
    const styles={...board.styles,[ref]:{width:size,height:size,...board.styles?.[ref]}};
    return {...day,notes:existing?day.notes.map(n=>n.id===id?note:n):[...(day.notes||[]),note],canvas:{...day.canvas,board4:{...board,styles}}};
  },
  remove(day,id){
    const ref='sticky:'+id;
    if(!(day.notes||[]).some(n=>n.id===id&&n.kind==='emoji')||day.canvas?.board4?.locked?.includes(ref))return day;
    const next=structuredClone(day);next.notes=next.notes.filter(n=>n.id!==id);
    const board=next.canvas?.board4;
    if(board){
      board.links=(board.links||[]).filter(link=>link.from!==ref&&link.to!==ref);
      for(const layout of Object.values(board.layouts||{}))delete layout[ref];
      if(board.styles)delete board.styles[ref];
      if(board.stack)board.stack=board.stack.filter(value=>value!==ref);
      for(const[key,override]of Object.entries(board.overrides||{}))if(override?.from===ref||override?.to===ref||key.includes(ref+'->')||key.endsWith('->'+ref))delete board.overrides[key];
      if(board.hidden)board.hidden=board.hidden.filter(key=>!key.includes(ref+'->')&&!key.endsWith('->'+ref));
      for(const[key,refs]of Object.entries(board.groups||{})){board.groups[key]=refs.filter(value=>value!==ref);if(board.groups[key].length<2)delete board.groups[key];}
    }
    return next;
  },
  completed(before,after,id){
    const old=before?.blocks?.find(task=>task.id===id),current=after?.blocks?.find(task=>task.id===id);
    if(!old||!current)return false;
    if(!old.done&&current.done)return true;
    const steps=list=>(list||[]).flatMap(step=>[step,...steps(step.children)]);
    const previous=new Map(steps(old.subtasks).map(step=>[step.id,step.done]));
    return steps(current.subtasks).some(step=>step.done&&previous.has(step.id)&&!previous.get(step.id));
  }
};
export function DDcreatePlayful({React:R,Legacy,Art,styles,language}){
  const h=R.createElement,t=(en,fa)=>language()==='fa'?fa:en;
  let latest=null,observer;
  if(typeof document!=='undefined'&&!document.getElementById('dd-playful-styles')){
    const style=document.createElement('style');style.id='dd-playful-styles';style.textContent=styles;document.head.append(style);
  }
  function local(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
  function remember(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}
  function still(){return !!latest?.data?.setup?.preferences?.reducedMotion||matchMedia('(prefers-reduced-motion:reduce)').matches;}
  function puff(x,y){
    if(still()||document.hidden)return;
    const burst=document.createElement('div');burst.className='dd-playful-burst';burst.setAttribute('aria-hidden','true');
    const colors=['#C2AFF4','#F4C77A','#F0AAC6','#98CFB1'];
    for(let i=0;i<8;i++){const spark=document.createElement('i'),angle=i*Math.PI/4;spark.style.cssText='--x:'+x+'px;--y:'+y+'px;--dx:'+Math.cos(angle)*39+'px;--dy:'+(Math.sin(angle)*32-12)+'px;--spark:'+colors[i%4]+';--delay:'+i*7+'ms';burst.append(spark);}
    document.body.append(burst);setTimeout(()=>burst.remove(),850);
  }
  function watch(element){
    if(!element)return()=>{};
    if(!('IntersectionObserver'in window)){element.dataset.visible='true';return()=>{};}
    observer||=new IntersectionObserver(entries=>{for(const entry of entries)entry.target.dataset.visible=String(entry.isIntersecting);});
    observer.observe(element);return()=>observer.unobserve(element);
  }
  function Emoji({emoji,symbol,size=18,className='',label,animated=true,...rest}){
    const value=symbol||emoji||'',item=DDplayfulData.item(value),ref=R.useRef(null),timer=R.useRef(null),[replay,setReplay]=R.useState(false);
    R.useEffect(()=>watch(ref.current),[value]);
    R.useEffect(()=>()=>clearTimeout(timer.current),[]);
    function play(){if(still()||!animated)return;clearTimeout(timer.current);setReplay(true);timer.current=setTimeout(()=>setReplay(false),650);}
    if(!value)return null;
    return h('span',{...rest,ref,role:'img','aria-label':label||DDplayfulData.label(value,language()),className:'dd-playful-emoji '+className+(replay?' dd-replay':''),'data-symbol':value,'data-idle':animated&&size>=28,'data-native':!DDplayfulData.isSticker(value),style:{width:size,height:size,fontSize:size},onPointerEnter:play,onClick:play},
      DDplayfulData.isSticker(value)?h(Art,{item}):h('span',{'aria-hidden':true},h(Legacy,{emoji:value.startsWith('sticker:')?'✨':value,size}))
    );
  }
  function useInteractions(data,setData,date){
    latest={data,setData,date};
    const previous=R.useRef({data,date}),intent=R.useRef(null);
    R.useEffect(()=>{
      document.documentElement.dataset.playfulReady='true';
      function click(event){
        const button=event.target.closest('button,[role=checkbox],[role=button]');
        if(!button||button.disabled)return;
        const label=button.getAttribute('aria-label')||'',node=button.closest('[data-board-id]'),row=button.closest('[data-block-id],[data-review-task],[data-playful-task]');
        if(!button.matches('.b4-node-icon')&&!/^Mark |^Toggle /.test(label)&&!button.matches('[role=checkbox],.sq[aria-pressed],.subnode-check,.dd-review-check,[data-playful-complete],.dd-card-steps button[aria-pressed]'))return;
        let blockId=row?.dataset.blockId||row?.dataset.reviewTask||row?.dataset.playfulTask;
        if(node){const parts=node.dataset.boardId.split(':');if(parts[0]==='b'||parts[0]==='sub')blockId=parts[1];}
        if(!blockId)return;
        const rect=button.getBoundingClientRect();
        intent.current={date:latest.date,id:blockId,time:Date.now(),x:event.clientX||rect.left+rect.width/2,y:event.clientY||rect.top+rect.height/2};
      }
      document.addEventListener('click',click,true);
      return()=>{document.removeEventListener('click',click,true);delete document.documentElement.dataset.playfulReady;document.querySelectorAll('.dd-playful-burst').forEach(node=>node.remove());};
    },[]);
    R.useEffect(()=>{
      const old=previous.current,action=intent.current;previous.current={data,date};
      if(data===old.data)return;
      intent.current=null;
      if(action&&Date.now()-action.time<1200&&date===old.date&&action.date===date&&DDplayfulData.completed(old.data.days[date],data.days[date],action.id))puff(action.x,action.y);
    },[data,date]);
  }
  function Picker({onPick,onClose,current='',onClear,targets=[],target:initialTarget='',title}){
    const dialog=R.useRef(null),searchInput=R.useRef(null),ending=R.useRef(false),backdropDown=R.useRef(false);
    const[tab,setTab]=R.useState(current&&!DDplayfulData.isSticker(current)?'emoji':'sticker'),[query,setQuery]=R.useState(''),[filter,setFilter]=R.useState('all'),[favorites,setFavorites]=R.useState(()=>local('debug-day:sticker-favorites',[])),[recent,setRecent]=R.useState(()=>local('debug-day:sticker-recent',[])),[target,setTarget]=R.useState(initialTarget),[motionTick,setMotionTick]=R.useState(0);
    const fa=language()==='fa',base=tab==='sticker'?stickers:emojis,q=query.normalize('NFKC').toLowerCase().replace(/ي/g,'ی').replace(/ك/g,'ک').trim();
    const saved=Array.isArray(favorites)?favorites.filter(value=>DDplayfulData.valid(value)):[],used=Array.isArray(recent)?recent.filter(value=>DDplayfulData.valid(value)):[];
    const items=base.filter(item=>(filter==='all'||filter==='favorites'&&saved.includes(item.value)||filter==='recent'&&used.includes(item.value)||item.category===filter)&&(!q||(item.en+' '+item.fa+' '+item.value).toLowerCase().includes(q)));
    R.useLayoutEffect(()=>{
      const element=dialog.current,old=document.activeElement;element.showModal();searchInput.current?.focus({preventScroll:true});
      return()=>{ending.current=true;if(element.open)element.close();if(old?.isConnected)old.focus({preventScroll:true});};
    },[]);
    R.useEffect(()=>{const media=matchMedia('(prefers-reduced-motion:reduce)'),update=()=>setMotionTick(n=>n+1);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
    function choose(value){
      if(onPick(value,target)===false)return;
      remember('debug-day:sticker-recent',[value,...used.filter(old=>old!==value)].slice(0,16));onClose();
    }
    function favorite(value){const next=saved.includes(value)?saved.filter(old=>old!==value):[...saved,value];setFavorites(next);remember('debug-day:sticker-favorites',next);}
    const systemStill=matchMedia('(prefers-reduced-motion:reduce)').matches,enabled=!still();
    function keyboard(event){
      event.stopPropagation();
      if(event.key==='Escape'){event.preventDefault();onClose();return;}
      const tabs=[...dialog.current.querySelectorAll('[role=tab]')],tabIndex=tabs.indexOf(event.target);
      if(tabIndex>=0&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
        event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?1:(tabIndex+(event.key==='ArrowRight'?(fa?-1:1):(fa?1:-1))+2)%2;
        setTab(next?'emoji':'sticker');setFilter('all');tabs[next]?.focus();return;
      }
      const buttons=[...dialog.current.querySelectorAll('[data-choice]')],index=buttons.indexOf(event.target);
      if(index>=0&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)){
        event.preventDefault();const grid=dialog.current.querySelector('.dd-sticker-grid'),columns=getComputedStyle(grid).gridTemplateColumns.split(' ').length;
        const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?columns:event.key==='ArrowUp'?-columns:event.key==='ArrowRight'?(fa?-1:1):(fa?1:-1))+buttons.length)%buttons.length;
        buttons[next]?.focus();
      }
    }
    return h('dialog',{ref:dialog,role:'dialog',className:'dd-sticker-dialog',dir:fa?'rtl':'ltr','aria-label':t('Sticker library','کتابخانهٔ استیکر و ایموجی'),onKeyDown:keyboard,onCancel:event=>{event.preventDefault();onClose();},onClose:()=>{if(!ending.current)onClose();},onContextMenu:event=>event.stopPropagation(),onPointerDown:event=>{
      event.stopPropagation();const rect=event.currentTarget.getBoundingClientRect();
      backdropDown.current=event.target===event.currentTarget&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom);
    },onClick:event=>{
      if(event.target!==event.currentTarget||!backdropDown.current)return;
      backdropDown.current=false;const rect=event.currentTarget.getBoundingClientRect();
      if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)onClose();
    }},
      h('header',{className:'dd-sticker-heading'},h('div',null,h('h2',null,title||t('A little personality','کمی حال‌وهوای خودت')),h('p',null,t('Make room for a little play. Pick one that feels like you.','کمی جا برای بازی. یکی را انتخاب کن که شبیه حال توست.'))),h('button',{type:'button',className:'dd-playful-close','aria-label':t('Close sticker library','بستن کتابخانهٔ استیکر'),onClick:onClose},'×')),
      h('div',{className:'dd-sticker-toolbar'},
        h('div',{className:'dd-sticker-tabs',role:'tablist','aria-label':t('Symbol type','نوع نماد')},[['sticker','Stickers','استیکرها'],['emoji','Emoji','ایموجی‌ها']].map(([value,en,fa])=>h('button',{type:'button',key:value,role:'tab','aria-selected':tab===value,onClick:()=>{setTab(value);setFilter('all');}},t(en,fa)))),
        h('label',{className:'dd-sticker-search'},h('span',{'aria-hidden':true},'⌕'),h('input',{ref:searchInput,type:'search',dir:'auto',value:query,'aria-label':t('Find stickers or emoji','جستجوی استیکر یا ایموجی'),placeholder:t('Search a feeling or idea…','یک حس یا ایده را پیدا کن…'),onChange:event=>setQuery(event.target.value)})),
        h('div',{className:'dd-sticker-filters',role:'group','aria-label':t('Sticker filters','فیلتر استیکر')},[['all','All','همه'],['favorites','Favorites','علاقه‌مندی‌ها'],['recent','Recent','اخیر'],['create','Create','ساختن'],['calm','Slow down','آروم‌تر'],...(tab==='emoji'?[['play','Play','بازی']]:[])].map(([value,en,fa])=>h('button',{type:'button',key:value,'aria-pressed':filter===value,onClick:()=>setFilter(value)},t(en,fa)))),
        targets.length>0&&h('label',{className:'dd-sticker-target'},t('Use it for','برای'),h('select',{'aria-label':t('Sticker destination','جای استیکر'),value:target,onChange:event=>setTarget(event.target.value)},h('option',{value:''},t('A sticker on this day','استیکرِ این روز')),targets.map(task=>h('option',{key:task.id,value:task.id},task.name||t('Untitled task','کار بی‌نام')))))
      ),
      h('div',{className:'dd-sticker-scroll'},items.length?
        h('ul',{className:'dd-sticker-grid','aria-label':t('Choose a symbol','انتخاب نماد')},items.map(item=>h('li',{key:item.value,className:'dd-sticker-cell'},
          h('button',{type:'button',className:'dd-sticker-choice','data-choice':item.value,'aria-label':t('Use ','انتخاب ')+DDplayfulData.label(item.value,language()),'aria-pressed':current===item.value,onClick:()=>choose(item.value)},h(Emoji,{emoji:item.value,size:tab==='sticker'?76:50}),h('span',null,DDplayfulData.label(item.value,language()))),
          h('button',{type:'button',className:'dd-sticker-favorite','aria-pressed':saved.includes(item.value),'aria-label':t('Favorite ','علاقه‌مندی ')+DDplayfulData.label(item.value,language()),title:t('Save to favorites','ذخیره در علاقه‌مندی‌ها'),onClick:()=>favorite(item.value)},saved.includes(item.value)?'♥':'♡')
        ))):
        h('div',{className:'dd-sticker-empty',role:'status'},h(Emoji,{emoji:'sticker:cloud',size:66}),h('strong',null,t('Nothing here yet','اینجا هنوز چیزی نیست')),h('p',null,filter==='favorites'?t('Tap a little heart to save a favorite.','با زدن قلب کوچک، علاقه‌مندی اضافه کن.'):t('Try another word or show all symbols.','یک واژهٔ دیگر را امتحان کن یا همه را ببین.')),h('button',{type:'button',className:'dd-sticker-add',onClick:()=>{setQuery('');setFilter('all');}},t('Show all','نمایش همه')))
      ),
      h('footer',{className:'dd-sticker-footer'},h('div',null,
        h('button',{type:'button',className:'dd-sticker-motion','aria-pressed':enabled,disabled:systemStill,onClick:()=>{
          latest?.setData(old=>({...old,setup:{...old.setup,preferences:{...old.setup.preferences,reducedMotion:!old.setup.preferences?.reducedMotion}}}));setMotionTick(motionTick+1);
        }},systemStill?t('System: reduced motion','سیستم: حرکت کمتر'):enabled?t('Motion on','حرکت روشن'):t('Motion off','حرکت خاموش')),
        onClear&&h('button',{type:'button',onClick:()=>{onClear();onClose();}},t('Remove icon','حذف نماد'))
      ),h('button',{type:'button',className:'dd-sticker-surprise',disabled:!items.length,onClick:()=>choose(items[Math.floor(Math.random()*items.length)].value)},t('Surprise me ✦','غافلگیرم کن ✦')))
    );
  }
  function DayStickers({day,date=day?.date,onChange}){
    const[picker,setPicker]=R.useState(null),[expanded,setExpanded]=R.useState(false),rows=(day?.notes||[]).filter(note=>note.kind==='emoji'),locked=new Set(day?.canvas?.board4?.locked||[]);
    R.useEffect(()=>{setPicker(null);setExpanded(false);},[date]);
    function pick(value,taskId){const id=crypto.randomUUID();onChange(current=>DDplayfulData.put(current,value,{id,replace:picker?.replace,taskId:picker?.replace?null:taskId}));}
    return h('section',{className:'dd-day-stickers','data-day-stickers':date,'aria-label':t('Day stickers','استیکرهای روز'),dir:language()==='fa'?'rtl':'ltr'},
      h('div',{className:'dd-day-sticker-heading'},h('div',null,h('h3',null,t('A little you, in your day','ردِ خودت روی روز')),rows.length>0&&h('p',null,t('The same stickers are on your board.','همین استیکرها در برد هم هستند.'))),h('button',{type:'button',className:'dd-sticker-add','aria-label':t('Add sticker or emoji','افزودن استیکر یا ایموجی'),onClick:()=>setPicker({})},h('span',{'aria-hidden':true},'✦'),h('span',null,t('Stickers & emoji','استیکر و ایموجی')))),
      rows.length>0&&h('div',{className:'dd-day-sticker-items'},(expanded?rows:rows.slice(0,8)).map(note=>h('div',{className:'dd-day-sticker-item',key:note.id,'data-day-sticker':note.id},
        h('button',{type:'button',disabled:locked.has('sticky:'+note.id),'aria-label':t('Change ','تغییر ')+DDplayfulData.label(note.text,language()),onClick:()=>setPicker({replace:note.id,current:note.text})},h(Emoji,{emoji:note.text,size:62}),h('span',null,DDplayfulData.label(note.text,language()))),
        h('button',{type:'button',className:'dd-day-sticker-remove',disabled:locked.has('sticky:'+note.id),'aria-label':t('Remove ','حذف ')+DDplayfulData.label(note.text,language()),onClick:()=>onChange(current=>DDplayfulData.remove(current,note.id))},'×')
      ))),
      rows.length>8&&h('button',{type:'button',className:'dd-sticker-show','aria-expanded':expanded,onClick:()=>setExpanded(!expanded)},expanded?t('Show less','نمایش کمتر'):t('Show all ','نمایش همهٔ ')+rows.length),
      picker&&h(Picker,{current:picker.current,onClose:()=>setPicker(null),onPick:pick,targets:picker.replace?[]:day?.blocks||[]})
    );
  }
  function TaskSticker({task,onSelect,locked=false}){
    const[open,setOpen]=R.useState(false);R.useEffect(()=>setOpen(false),[task.id]);
    return h('div',{className:'dd-task-sticker'},
      h('button',{type:'button',disabled:locked,'aria-label':t('Choose task sticker or emoji','انتخاب استیکر یا ایموجی کار'),onClick:()=>setOpen(true)},h(Emoji,{emoji:task.emo||'sticker:spark',size:32}),h('span',null,t('Sticker / emoji','استیکر / ایموجی')),h('span',{'aria-hidden':true},'↗')),
      open&&h(Picker,{current:task.emo,onClose:()=>setOpen(false),onPick:value=>onSelect(value),onClear:task.emo?()=>onSelect(''):null,title:t('A face for this task','حال‌وهوای این کار')})
    );
  }
  return {Emoji,Picker,DayStickers,TaskSticker,useInteractions,data:DDplayfulData,puff,label:value=>DDplayfulData.label(value,language()),isSticker:value=>DDplayfulData.isSticker(value)};
}
