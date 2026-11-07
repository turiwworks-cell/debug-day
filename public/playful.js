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
  const h=R.createElement;
  let latest=null,observer;
  if(typeof document!=='undefined'&&!document.getElementById('dd-playful-styles')){
    const style=document.createElement('style');style.id='dd-playful-styles';style.textContent=styles;document.head.append(style);
  }
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
  return {Emoji,useInteractions,data:DDplayfulData,puff,label:value=>DDplayfulData.label(value,language()),isSticker:value=>DDplayfulData.isSticker(value)};
}
