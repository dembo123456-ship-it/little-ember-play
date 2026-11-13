// Language packs. Korean is the source text; packs map Korean text -> translation.
// Packs live in lang/*.js and call LittleEmberI18n.rows([[ko,en,ja,zhHans,zhHant],...]).
// Keys may hold {0},{1}… for values built at run time ('{0}일 차' -> 'Day {0}');
// each value is translated again on its own. Text without a row stays Korean.
(function(){
  const KEY='little-ember-language-v1';
  const LANGS=[
    {code:'ko',name:'한국어',html:'ko',locale:'ko-KR'},
    {code:'en',name:'English',html:'en',locale:'en-US'},
    {code:'ja',name:'日本語',html:'ja',locale:'ja-JP'},
    {code:'zh-Hans',name:'简体中文',html:'zh-Hans',locale:'zh-CN'},
    {code:'zh-Hant',name:'繁體中文',html:'zh-Hant',locale:'zh-TW'}
  ];
  const COLUMN={en:1,ja:2,'zh-Hans':3,'zh-Hant':4};
  function detect(){
    const list=(typeof navigator!=='undefined'&&(navigator.languages||[navigator.language]))||[];
    for(const raw of list){const l=String(raw||'').toLowerCase();
      if(l.startsWith('ko'))return 'ko';if(l.startsWith('ja'))return 'ja';if(l.startsWith('en'))return 'en';
      if(l.startsWith('zh'))return /hant|tw|hk|mo/.test(l)?'zh-Hant':'zh-Hans';}
    return 'ko';
  }
  let current='ko';
  try{const saved=localStorage.getItem(KEY);current=LANGS.some(x=>x.code===saved)?saved:detect();}catch(_){current=detect();}
  const info=()=>LANGS.find(x=>x.code===current)||LANGS[0];
  const HANGUL=/[가-힣]/;
  const exact=new Map();          // plain keys
  const byStart=new Map(),byEnd=new Map(),wild=[]; // template keys, bucketed for speed
  const cache=new Map();
  const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  // A particle right after a value may come out either way (을/를 …), so accept both.
  const J={'을':'을\\(를\\)|을|를','이':'이\\(가\\)|이|가','은':'은\\(는\\)|은|는','과':'과\\(와\\)|과|와','으로':'\\(으\\)로|으로|로'};
  const PAIRS=[['을(를)',J['을']],['이(가)',J['이']],['은(는)',J['은']],['과(와)',J['과']],['(으)로',J['으로']],['을',J['을']],['를',J['을']],['이',J['이']],['가',J['이']],['은',J['은']],['는',J['은']],['과',J['과']],['와',J['과']],['으로',J['으로']],['로',J['으로']]];
  // A value followed by a counter word (3개, 120 G, Lv.5) is a number: match digits only, so
  // '{0} {1}개' can't swallow part of a name.
  const UNIT=/^\s?(개|명|G|%|일|점|칸|곳|마리|단계|번|회|년|시간|분|초|배|레벨|차|종|건|층|\/|\)|$)/;
  const PRE=/(Lv\.|\+|−|-|×|\/|\()$/;
  function compile(key,value){
    let src='^';const order=[];
    const rx=/\{(\d+)\}/g;let m,last=0;
    while((m=rx.exec(key))){
      const before=key.slice(last,m.index);
      src+=esc(before);order.push(Number(m[1]));
      last=m.index+m[0].length;
      const after=key.slice(last);
      const numeric=(UNIT.test(after)&&after!=='')||PRE.test(before);
      // A value may be empty (an optional suffix such as a ternary that gave '').
      src+=numeric?'([-+−]?[\\d][\\d,.]*)':'([\\s\\S]*?)';
      for(const [k,alt] of PAIRS)if(after.startsWith(k)){src+='(?:'+alt+')';last+=k.length;rx.lastIndex=last;break;}
    }
    src+=esc(key.slice(last))+'$';
    const entry={re:new RegExp(src),order,value,literal:key.replace(/\{\d+\}/g,'').length};
    const startsLit=!/^\{\d+\}/.test(key),endsLit=!/\{\d+\}$/.test(key);
    if(startsLit)push(byStart,key.slice(0,1),entry);else if(endsLit)push(byEnd,key.slice(-1),entry);else wild.push(entry);
  }
  function push(map,k,e){let l=map.get(k);if(!l)map.set(k,l=[]);l.push(e);}
  function addRow(ko,value,weak){
    if(!value||typeof ko!=='string')return;
    if(weak&&exact.has(ko))return;
    if(/\{\d+\}/.test(ko))compile(ko,value);else exact.set(ko,value);
  }
  const STEM=/(을\(를\)|이\(가\)|은\(는\)|으로|에게서|에게|에서|까지|부터|님이|님의|님은|님을|님께|님|을|를|이|가|은|는|과|와|의|로|에|도|만)$/;
  function fill(entry,groups){
    return entry.value.replace(/\{(\d+)\}/g,(_,d)=>{const pos=entry.order.indexOf(Number(d));return pos<0?'':translate(groups[pos],true);});
  }
  function lookup(text){
    if(exact.has(text))return exact.get(text);
    const lists=[byStart.get(text.slice(0,1)),byEnd.get(text.slice(-1)),wild];
    // Several templates can fit ('튼튼한 {0}' and '{0} 자세히'): keep the one that leaves the
    // least Korean behind, then the one with the most fixed text.
    let best,bestScore=null;
    for(const list of lists)if(list)for(const e of list){
      const m=e.re.exec(text);if(!m)continue;
      const out=fill(e,m.slice(1));
      const left=(out.match(/[가-힣]/g)||[]).length;
      if(bestScore===null||left<bestScore[0]||(left===bestScore[0]&&e.literal>bestScore[1])){best=out;bestScore=[left,e.literal];}
    }
    return best;
  }
  function translate(text,inner){
    if(!HANGUL.test(text))return text;
    let r=lookup(text);if(r!==undefined)return r;
    const t=text.trim();
    if(t!==text){r=lookup(t);if(r!==undefined)return text.replace(t,r);}
    // Wrapped in brackets or quotes ([결과 보기], (…), 「…」): translate the inside.
    const wrap=t.match(/^([\[(「『"“'·\s]+)([\s\S]*?)([\])」』"”'.!?:…\s]*)$/);
    if(wrap&&wrap[2]&&(wrap[1]||wrap[3])&&HANGUL.test(wrap[2])){const r2=translate(wrap[2],inner);if(r2!==wrap[2])return text.replace(t,wrap[1]+r2+wrap[3]);}
    if(inner){ // a value with a particle stuck on: translate the word itself
      const m=t.match(STEM);if(m&&t.length>m[0].length){r=lookup(t.slice(0,-m[0].length));if(r!==undefined)return r;}
    }
    // Lists joined with ' · ', ', ' or ' / ': translate piece by piece.
    for(const sep of [' · ',' — ',' / ',', ',' | ','·']){
      if(t.includes(sep)){const parts=t.split(sep);const out=parts.map(p=>translate(p,true));if(out.some((o,i)=>o!==parts[i]))return text.replace(t,out.join(sep));}
    }
    return text;
  }
  function t(text){
    if(current==='ko'||typeof text!=='string'||!HANGUL.test(text))return text;
    const hit=cache.get(text);if(hit!==undefined)return hit;
    const r=translate(text,false);
    if(cache.size>8000)cache.clear();
    cache.set(text,r);return r;
  }
  // Swaps Korean text nodes and labels on screen for the chosen language.
  const ATTRS=['title','aria-label','placeholder','data-tip','alt'];
  function translateNode(root){
    if(current==='ko'||!root)return;
    if(root.nodeType===3){const v=t(root.nodeValue);if(v!==root.nodeValue)root.nodeValue=v;return;}
    if(root.nodeType!==1)return;
    for(const a of ATTRS){const v=root.getAttribute&&root.getAttribute(a);if(v&&HANGUL.test(v)){const n=t(v);if(n!==v)root.setAttribute(a,n);}}
    const tag=root.tagName;if(tag==='SCRIPT'||tag==='STYLE')return;
    for(let c=root.firstChild;c;c=c.nextSibling)translateNode(c);
  }
  // Canvas text (world map, shop scene labels) goes through the same table.
  function patchCanvas(){
    if(typeof CanvasRenderingContext2D==='undefined')return;
    const P=CanvasRenderingContext2D.prototype;
    for(const k of ['fillText','strokeText','measureText']){const orig=P[k];if(!orig||orig.__i18n)continue;
      const w=function(text,...rest){return orig.call(this,typeof text==='string'?t(text):text,...rest);};w.__i18n=true;P[k]=w;}
  }
  let observer=null;
  function start(){
    if(typeof document==='undefined')return;
    document.documentElement.lang=info().html;
    document.documentElement.dataset.lang=current;
    if(current==='ko')return;
    cache.clear();
    document.title=t(document.title);
    translateNode(document.body);
    if(typeof MutationObserver!=='undefined'&&!observer){
      observer=new MutationObserver(list=>{for(const m of list){
        if(m.type==='characterData'||m.type==='attributes')translateNode(m.target);
        else for(const n of m.addedNodes)translateNode(n);}});
      observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS});
    }
  }
  function set(code){
    if(!LANGS.some(x=>x.code===code))return;
    try{localStorage.setItem(KEY,code);}catch(_){}
    if(typeof location!=='undefined')location.reload();
  }
  const api={
    languages:LANGS.slice(),
    get current(){return current;},
    get locale(){return info().locale;},
    // weak rows (generated names) never replace a row that is already there.
    rows(list,weak){const col=COLUMN[current];if(!col)return;for(const r of list)addRow(r[0],r[col],weak);cache.clear();},
    register(code,table){if(code!==current)return;for(const k in table)addRow(k,table[k]);cache.clear();},
    t,set,start,translateNode,
    num(n){return Number(n).toLocaleString(info().locale);}
  };
  if(typeof window!=='undefined'){
    window.LittleEmberI18n=api;
    if(current!=='ko')patchCanvas();
    if(typeof document!=='undefined'){
      // Deferred scripts run while readyState is 'interactive', before the packs register: wait for DOMContentLoaded.
      if(document.readyState==='complete')start();else document.addEventListener('DOMContentLoaded',start);
    }
  }
  if(typeof module!=='undefined')module.exports=api;
})();
