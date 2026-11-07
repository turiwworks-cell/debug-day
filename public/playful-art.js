// Original vector sticker characters, kept code-native for offline exports.
export function DDcreatePlayfulArt(R){
  const h=R.createElement;
  const shapes={
    star:'M50 12 61 34 86 38 68 56 72 82 50 70 27 82 32 56 14 38 39 34Z',
    cloud:'M24 73C9 73 8 52 22 48 19 29 43 20 54 34 66 21 85 33 80 48 99 54 89 75 75 75Z',
    blob:'M79 24C95 40 85 56 80 71 73 94 45 91 30 81 7 76 9 53 18 42 12 20 37 9 51 19 62 11 73 13 79 24Z',
    flame:'M51 10C57 31 79 28 77 49 91 40 87 68 74 81 57 98 25 85 19 69 7 44 34 35 34 21 45 28 42 42 51 10Z',
    sprout:'M30 56H73L68 81Q50 94 35 81Z',
    heart:'M50 83C39 75 11 57 15 35 18 15 39 15 50 31 61 15 82 15 86 35 91 57 61 76 50 83Z',
    planet:'M82 50A32 32 0 1 1 18 50 32 32 0 0 1 82 50Z',
    coffee:'M23 35H70V65Q70 84 47 84 23 84 23 65Z'
  };
  return function StickerArt({item,className=''}){
    const uid=R.useId().replace(/[^\w-]/g,''),kind=item.art,eyeY=kind==='sprout'?70:kind==='coffee'?60:kind==='star'?48:54,faceX=kind==='coffee'?46:50,gradient='dd-sticker-'+uid;
    const path=(d,props={})=>h('path',{d,...props}),extra=[];
    if(kind==='planet')extra.push(h('ellipse',{key:'back-ring',cx:50,cy:54,rx:45,ry:12,transform:'rotate(-25 50 54)',fill:'none',stroke:'#7666BD',strokeWidth:8}));
    if(kind==='coffee')extra.push(path('M70 41H77C96 41 93 64 71 64',{key:'handle',fill:'none',stroke:'#3C302C',strokeWidth:9}));
    if(kind==='sprout')extra.push(h('g',{key:'leaves',className:'dd-sticker-leaf',stroke:'#283A35',strokeWidth:2.5,strokeLinejoin:'round'},
      path('M50 59V32',{fill:'none'}),
      path('M50 45C29 47 23 33 25 24 42 20 54 28 50 45Z',{fill:'#90D5A7'}),
      path('M50 34C49 15 67 13 78 18 76 33 65 39 50 34Z',{fill:'#C1F0B4'}),
      path('M50 44 34 32M51 33 66 23',{fill:'none',stroke:'#56896B',strokeWidth:1.5})
    ));
    extra.push(path(shapes[kind]||shapes.star,{key:'paper',fill:'#FFFDF5',stroke:'#FFFDF5',strokeWidth:10,strokeLinejoin:'round'}));
    extra.push(path(shapes[kind]||shapes.star,{key:'body',fill:'url(#'+gradient+')',stroke:'#34313F',strokeWidth:2.5,strokeLinejoin:'round'}));
    if(kind==='flame')extra.push(path('M50 45C60 57 69 62 65 76 57 90 37 83 35 72 33 62 45 59 50 45Z',{key:'inner-flame',fill:'#FFDA83',opacity:.8}));
    if(kind==='planet'){
      extra.push(h('circle',{key:'crater1',cx:39,cy:32,r:7,fill:'#AA9AE4',opacity:.55}));
      extra.push(h('circle',{key:'crater2',cx:68,cy:43,r:4,fill:'#AA9AE4',opacity:.5}));
      extra.push(path('M12 63C21 80 79 51 89 39',{key:'front-ring',fill:'none',stroke:'#F8CBA9',strokeWidth:7,strokeLinecap:'round'}));
    }
    if(kind==='coffee'){
      extra.push(h('ellipse',{key:'top',cx:46.5,cy:35,rx:23.5,ry:6,fill:'#FFF7E7',stroke:'#34313F',strokeWidth:2.5}));
      extra.push(h('ellipse',{key:'drink',cx:46.5,cy:36,rx:17,ry:3,fill:'#A06F53'}));
      extra.push(h('g',{key:'steam',className:'dd-sticker-steam',fill:'none',stroke:'#A89585',strokeWidth:3,strokeLinecap:'round'},path('M35 24C28 17 40 15 35 8'),path('M50 24C43 17 56 15 51 7'),path('M64 24C58 17 69 16 65 10')));
    }
    extra.push(path(kind==='heart'?'M25 36Q29 26 38 29':kind==='cloud'?'M25 47Q28 37 38 36':kind==='sprout'?'M36 62H43':'M27 39Q29 32 35 29',{key:'shine',fill:'none',stroke:'#FFFFFF',strokeWidth:4,opacity:.65,strokeLinecap:'round'}));
    extra.push(h('g',{key:'face',className:'dd-sticker-face'},
      h('g',{className:'dd-sticker-eyes',style:{transformOrigin:faceX+'px '+eyeY+'px'}},
        kind==='cloud'?path('M37 54Q41 58 45 54M56 54Q60 58 64 54',{fill:'none',stroke:'#34313F',strokeWidth:2.7,strokeLinecap:'round'}):[h('ellipse',{key:'eye1',cx:faceX-9,cy:eyeY,rx:2.8,ry:3.7,fill:'#34313F'}),h('ellipse',{key:'eye2',cx:faceX+9,cy:eyeY,rx:2.8,ry:3.7,fill:'#34313F'})]
      ),
      h('ellipse',{cx:faceX-16,cy:eyeY+7,rx:5,ry:2.7,fill:'#E894A8',opacity:.65}),h('ellipse',{cx:faceX+16,cy:eyeY+7,rx:5,ry:2.7,fill:'#E894A8',opacity:.65}),
      path('M'+(faceX-4)+' '+(eyeY+8)+'Q'+faceX+' '+(eyeY+13)+' '+(faceX+4)+' '+(eyeY+8),{fill:'none',stroke:'#34313F',strokeWidth:2.2,strokeLinecap:'round'})
    ));
    if(kind==='star'||kind==='blob')extra.push(h('g',{key:'wave',className:'dd-sticker-wave',style:{transformOrigin:'75px 54px'}},path('M76 57Q88 57 89 47',{fill:'none',stroke:'#34313F',strokeWidth:3,strokeLinecap:'round'}),path('M86 48 84 44M90 46 92 43',{stroke:'#34313F',strokeWidth:2.5,strokeLinecap:'round'})));
    return h('svg',{viewBox:'0 0 100 100',className:'dd-sticker-art '+className,xmlns:'http://www.w3.org/2000/svg','aria-hidden':true,focusable:false},
      h('defs',null,h('linearGradient',{id:gradient,x1:'.1',y1:'0',x2:'.8',y2:'1'},h('stop',{offset:'0%',stopColor:item.colors[0]}),h('stop',{offset:'100%',stopColor:item.colors[1]}))),
      h('ellipse',{cx:50,cy:91,rx:25,ry:4,fill:'#38334A',opacity:.09}),
      h('g',{className:'dd-sticker-character dd-sticker-'+kind},extra),
      h('g',{className:'dd-sticker-spark',fill:item.colors[1],stroke:'#FFFDF5',strokeWidth:1.2},path('M86 14 88 20 94 22 88 24 86 30 84 24 78 22 84 20Z'),h('circle',{cx:15,cy:79,r:3}))
    );
  };
}

export const DDplayfulStyles = `
.dd-playful-emoji{display:inline-flex;position:relative;flex:none;align-items:center;justify-content:center;vertical-align:-.15em;line-height:1;user-select:none;isolation:isolate}
.dd-playful-emoji>span,.dd-playful-emoji>svg{width:100%;height:100%;display:inline-flex;align-items:center;justify-content:center;pointer-events:none}
.dd-sticker-art{overflow:visible;filter:drop-shadow(0 2px 1px #30274410)}
.dd-sticker-character{transform-origin:50px 65px}.dd-sticker-spark{transform-origin:86px 22px}
.dd-playful-emoji[data-visible=true][data-idle=true] .dd-sticker-character{animation:dd-sticker-float 4.8s ease-in-out infinite}
.dd-playful-emoji[data-visible=true][data-idle=true] .dd-sticker-eyes{animation:dd-sticker-blink 6s ease-in-out infinite}
.dd-playful-emoji[data-visible=true][data-idle=true] .dd-sticker-wave{animation:dd-sticker-wave 3.8s ease-in-out infinite}
.dd-playful-emoji[data-visible=true][data-idle=true] .dd-sticker-leaf{animation:dd-sticker-leaf 5s ease-in-out infinite;transform-origin:50px 56px}
.dd-playful-emoji[data-visible=true][data-idle=true] .dd-sticker-steam{animation:dd-sticker-steam 3.6s ease-in-out infinite}
.dd-playful-emoji[data-visible=true][data-idle=true] .dd-sticker-spark{animation:dd-sticker-spark 4s ease-in-out infinite}
.dd-playful-emoji[data-visible=true][data-idle=true][data-native=true]>span{animation:dd-emoji-breathe 5.2s ease-in-out infinite}
.dd-playful-emoji.dd-replay{animation:dd-emoji-replay .62s cubic-bezier(.18,.65,.3,1) both}
.dd-playful-burst{position:fixed;inset:0;pointer-events:none!important;z-index:1500;overflow:hidden}.dd-playful-burst i{position:absolute;left:var(--x);top:var(--y);width:8px;height:8px;background:var(--spark);clip-path:polygon(50% 0,62% 35%,100% 50%,62% 65%,50% 100%,38% 65%,0 50%,38% 35%);animation:dd-playful-puff .68s cubic-bezier(.1,.5,.3,1) both;animation-delay:var(--delay)}
html[data-playful-ready=true] :is(.btn,.dd-review-mood button){transition:background .15s,border-color .15s,box-shadow .15s}
html[data-playful-ready=true] .btn:active{scale:.98}
.dd-review-mood button[aria-pressed=true] .dd-playful-emoji{animation:dd-emoji-replay .5s ease-out}
@keyframes dd-sticker-float{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-3px) rotate(1.5deg)}}
@keyframes dd-sticker-blink{0%,90%,96%,100%{transform:scaleY(1)}93%{transform:scaleY(.12)}}
@keyframes dd-sticker-wave{0%,65%,100%{transform:rotate(0)}73%,85%{transform:rotate(-12deg)}79%,91%{transform:rotate(8deg)}}
@keyframes dd-sticker-leaf{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(3deg)}}
@keyframes dd-sticker-steam{0%,100%{opacity:.4;transform:translateY(1px)}50%{opacity:.8;transform:translateY(-2px)}}
@keyframes dd-sticker-spark{0%,100%{transform:scale(.9);opacity:.55}50%{transform:scale(1.08);opacity:.9}}
@keyframes dd-emoji-breathe{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-2px) rotate(2deg)}}
@keyframes dd-emoji-replay{0%,100%{transform:rotate(0) scale(1)}25%{transform:rotate(-10deg) scale(1.08)}55%{transform:rotate(7deg) scale(1.04)}80%{transform:rotate(-3deg)}}
@keyframes dd-playful-puff{0%{opacity:0;transform:translate(-50%,-50%) scale(.2)}15%{opacity:1}100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) rotate(80deg) scale(.4)}}
html[data-reduce-motion=true] :is(.dd-playful-emoji,.dd-playful-emoji *,.dd-playful-burst *,.dd-review-mood button .dd-playful-emoji){animation:none!important;transition:none!important}
html[data-reduce-motion=true] .dd-playful-burst{display:none}html[data-reduce-motion=true] .btn:active{scale:1}
@media(prefers-reduced-motion:reduce){.dd-playful-emoji,.dd-playful-emoji *,.dd-playful-burst *,.dd-review-mood button .dd-playful-emoji{animation:none!important;transition:none!important}.dd-playful-burst{display:none}html[data-playful-ready=true] .btn:active{scale:1}}
@media(max-width:700px){.b6 .b2-dock>.b2-icon>span{font-size:9px}}

.dd-current-task h2 .dd-playful-emoji{margin-inline-end:8px;vertical-align:middle}
.dd-review-task-name .dd-playful-emoji{margin-inline-end:6px;vertical-align:middle}

@media(max-width:700px){
  .b6 .b2-dock{gap:4px;overscroll-behavior-x:contain;scroll-padding-inline:6px}
  .b6 .b2-dock>.b2-icon{flex:0 0 46px;min-width:46px;padding:3px 4px;min-height:44px}
  .b6 .b2-dock .dd-btn-label{font-size:10px!important;line-height:12px!important;letter-spacing:0;max-width:100%;overflow:hidden;text-overflow:ellipsis}
}
`;
