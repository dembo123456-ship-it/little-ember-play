(function () {
  'use strict';
  const Sim = window.ForgeSim;
  const DATA = Sim.DATA;
  const SAVE_KEY = 'little-ember-save-v1';
  const PREF_KEY = 'little-ember-preferences-v1';
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  // Game texts are written with both particles ("단검을(를)", "에다이(가)"); pick the right one from the last syllable
  // before showing it (2026-11-09 review). Words ending in a non-Korean letter keep the "(…)" form.
  const JOSA_PAIRS = {'을(를)':['을','를'],'이(가)':['이','가'],'은(는)':['은','는'],'와(과)':['과','와'],'과(와)':['과','와']};
  const fixJosa = text => text.replace(/([가-힣])(을\(를\)|이\(가\)|은\(는\)|와\(과\)|과\(와\)|\(으\)로)/g, (m, ch, p) => {
    const f = (ch.charCodeAt(0) - 0xAC00) % 28;
    if (p === '(으)로') return ch + (f && f !== 8 ? '으로' : '로');
    return ch + JOSA_PAIRS[p][f ? 0 : 1];
  });
  const escape = value => fixJosa(String(value == null ? '' : value)).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = value => Math.floor(Number(value) || 0).toLocaleString('ko-KR');
  const recipe = id => DATA.recipes.find(r => r.id === id);
  const region = id => DATA.regions.find(r => r.id === id);
  const iconPaths = {
    flame:'<path d="M13 2c2 6-5 7-1 11 2-1 3-3 3-5 7 7 5 14-3 14S2 15 6 10c0 4 3 5 3 4-2-5 4-7 4-12Z"/>',
    coin:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><path d="M10 8h3m-3 4h3m-3-4v8m0 0h3"/>',
    star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
    shop:'<path d="M4 10v11h16V10M3 4h18l1 6c-1 3-4 3-5 0-1 3-4 3-5 0-1 3-4 3-5 0-1 3-4 3-5 0Zm6 17v-6h6v6M7 4l-1 6m6-6v6m5-6 1 6"/>',
    people:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v3"/>',
    person:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
    scroll:'<path d="M6 3h12a3 3 0 0 1 3 3v3h-5V6a3 3 0 0 0-6 0v12a3 3 0 0 1-6 0v-2h12v2a3 3 0 0 1-3 3H7M6 3a3 3 0 0 0-3 3v3h7m3 3h4m-4 3h4"/>',
    building:'<path d="m2 10 10-8 10 8M4 9v12h16V9M9 21v-8h6v8M8 7h8"/>',
    help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1.5-1 2m0 3h.01"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    moon:'<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>',
    hammer:'<path d="m14 4 6 6-3 3-6-6Zm-4 4 3 3-9 10-3-3ZM13 3l2-2 8 8-2 2"/>',
    sword:'<path d="m5 19 14-14 2-2v6L9 21m-3-7 6 6M3 21l3-3"/>',
    book:'<path d="M12 5c-4-3-7-3-10-1v15c3-2 6-2 10 1 4-3 7-3 10-1V4c-3-2-6-2-10 1Zm0 0v15M5 7l4 1m6 0 4-1"/>',
    pause:'<path d="M8 5v14M16 5v14" stroke-width="3"/>',
    play:'<path d="m8 4 12 8-12 8Z"/>',
    mouse:'<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 3v6m-6 1h12"/>',
    arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    check:'<path d="m4 12 5 5L20 6"/>',
    lock:'<rect x="5" y="10" width="14" height="12" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v3"/>',
    settings:'<path d="m10 2-1 3-3-1-2 3 2 3-3 1v4l3 1-2 3 3 2 3-2 1 3h4l1-3 3 1 2-3-2-3 3-1v-4l-3-1 1-3-3-2-3 2-1-3Z" transform="translate(0 -1) scale(.96)"/><circle cx="12" cy="12" r="3"/>',
    sound:'<path d="M11 4 5 9H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    mute:'<path d="M11 4 5 9H2v6h3l6 5Zm5 5 6 6m-6 0 6-6"/>',
    box:'<path d="m3 6 9-4 9 4v13l-9 4-9-4Zm0 0 9 4 9-4M12 10v13M7 4l10 4v5"/>',
    leaf:'<path d="M21 3C5 1 0 8 5 16s18 2 16-13Zm0 0L3 21m5-13v8h8"/>',
    mountain:'<path d="m2 21 8-17 6 11 3-7 4 13Zm4-8 3 1 2-3 3 1"/>',
    download:'<path d="M12 2v14m-5-5 5 5 5-5M3 17v5h18v-5"/>',
    upload:'<path d="M12 16V2M7 7l5-5 5 5M3 17v5h18v-5"/>',
    reset:'<path d="M3 4v6h6M3 10a9 9 0 1 1 1 8"/>',
    shelf:'<path d="M3 3v19M21 3v19M3 10h18M3 20h18M7 4v6m5-4v4m5-6v6M7 14v6m5-4v4m5-6v6"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    calendar:'<rect x="3" y="5" width="18" height="17" rx="2"/><path d="M7 2v6m10-6v6M3 11h18M7 15h2m4 0h2m2 0h1M7 18h2m4 0h2"/>',
    trophy:'<path d="M7 3h10v7a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 15v5m-5 2h10m-7-2h4"/>',
    bed:'<path d="M3 18V8m18 10V9M3 15h18M3 11h18v4M6 11V7h5v4m3 0V7h5v4M3 18v3m18-3v3"/>',
    shield:'<path d="m12 2 9 4v7c0 5-9 9-9 9s-9-4-9-9V6Z"/>',
    heart:'<path d="M12 21S2 15 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 7-10 13-10 13Z"/>',
    focus:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/>',
    move:'<path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4m12-8 4 4-4 4"/>',
    search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 7 7"/>',
    gem:'<path d="m5 3-4 6 11 13L23 9l-4-6ZM1 9h22M5 3l3 6 4-6 4 6 3-6M8 9l4 13 4-13"/>',
    map:'<path d="m2 6 6-3 8 3 6-3v15l-6 3-8-3-6 3Zm6-3v15m8-12v15"/>'
  };
  // Painted icons (2026-11-10, art/ui-icons → scripts/build-ui-icons.ps1). Written out one by one so the one-file build embeds them.
  // They sit inside the same 24x24 svg box, so every place that sizes an icon keeps working; the line drawing is the fallback.
  const ICON_ART = {arrow:'assets/ui-icons/arrow.png',bed:'assets/ui-icons/bed.png',book:'assets/ui-icons/book.png',box:'assets/ui-icons/box.png',building:'assets/ui-icons/building.png',calendar:'assets/ui-icons/calendar.png',check:'assets/ui-icons/check.png',clock:'assets/ui-icons/clock.png',close:'assets/ui-icons/close.png',coin:'assets/ui-icons/coin.png',download:'assets/ui-icons/download.png',flame:'assets/ui-icons/flame.png',focus:'assets/ui-icons/focus.png',gem:'assets/ui-icons/gem.png',hammer:'assets/ui-icons/hammer.png',heart:'assets/ui-icons/heart.png',help:'assets/ui-icons/help.png',leaf:'assets/ui-icons/leaf.png',lock:'assets/ui-icons/lock.png',map:'assets/ui-icons/map.png',moon:'assets/ui-icons/moon.png',mountain:'assets/ui-icons/mountain.png',mouse:'assets/ui-icons/mouse.png',move:'assets/ui-icons/move.png',mute:'assets/ui-icons/mute.png',pause:'assets/ui-icons/pause.png',people:'assets/ui-icons/people.png',person:'assets/ui-icons/person.png',play:'assets/ui-icons/play.png',plus:'assets/ui-icons/plus.png',reset:'assets/ui-icons/reset.png',scroll:'assets/ui-icons/scroll.png',search:'assets/ui-icons/search.png',settings:'assets/ui-icons/settings.png',shelf:'assets/ui-icons/shelf.png',shield:'assets/ui-icons/shield.png',shop:'assets/ui-icons/shop.png',sound:'assets/ui-icons/sound.png',star:'assets/ui-icons/star.png',sun:'assets/ui-icons/sun.png',sword:'assets/ui-icons/sword.png',trophy:'assets/ui-icons/trophy.png',upload:'assets/ui-icons/upload.png'};
  Object.assign(ICON_ART,{combat:'assets/ui-icons/combat.png',boss:'assets/ui-icons/boss.png',angry:'assets/ui-icons/angry.png',incapacitated:'assets/ui-icons/incapacitated.png',material:'assets/ui-icons/material.png',spark:'assets/ui-icons/spark.png',speed1:'assets/ui-icons/speed1.png',speed2:'assets/ui-icons/speed2.png'});
  if(typeof window!=='undefined')window.LittleEmberIconArt=ICON_ART; // the game scene draws the same painted icons
  const icon = (name, className='') => ICON_ART[name]
    ? '<svg class="icon icon-art '+className+'" viewBox="0 0 24 24" aria-hidden="true"><image href="'+ICON_ART[name]+'" x="0" y="0" width="24" height="24"/></svg>'
    : '<svg class="icon '+className+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(iconPaths[name]||iconPaths.star)+'</svg>';
  // Painted icon from the item atlas (item-icons.js); '' when the id has none, so the drawn fallback is used.
  function itemPic(id,className) {
    const position=window.ForgeItemIcons?.cssPosition(id);
    return position?'<span class="'+className+' item-pic" aria-hidden="true"><i style="background-position:'+position+'"></i></span>':'';
  }
  function itemArt(r) {
    const pic=r&&r.id?itemPic(r.id,'item-art'):'';if(pic)return pic;
    r = r || {tier:1,type:'sword'};
    const color = r.tier === 3 ? '#a9ced1' : r.tier === 2 ? '#c6d5d2' : '#b8c1b8';
    const gold = r.tier === 3 ? '#b49960' : '#ae8956';
    const parts = {
      sword:'<path d="m27 4 5-2 1 6-16 25-6-4Z" fill="'+color+'"/><path d="m28 7-13 23" stroke="#edf2e4" stroke-width="2"/><path d="m7 28 14 8-3 4-14-8Z" fill="'+gold+'"/><path d="m10 35 5 3-6 10-5-3Z" fill="#8c684a"/><circle cx="6" cy="46" r="3" fill="'+gold+'"/>',
      bow:'<path d="M8 4c29 6 29 36 0 42l10-21Z" fill="#bb9962"/><path d="m8 4 4 21-4 21" fill="none" stroke="#ddd4b9" stroke-width="1.6"/><path d="M3 26h34m-5-4 5 4-5 4" fill="none" stroke="#8c6a46" stroke-width="2"/><path d="m17 20 5 1v9l-5 1Z" fill="#826548"/>',
      shield:'<path d="M20 3 36 9v17c-1 10-9 17-16 21-7-4-15-11-16-21V9Z" fill="'+gold+'"/><path d="M20 8 31 12v14c-1 7-6 13-11 16-5-3-10-9-11-16V12Z" fill="'+color+'"/><path d="m20 13 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z" fill="#e5cb84"/>',
      staff:'<path d="m24 18 4 2-13 28-4-2Z" fill="#a58254"/><path d="m27 3 9 11-13 10-8-12Z" fill="#b6a9dc"/><path d="m27 3-3 12 12-1m-12 1-1 9-8-12Z" fill="#d5c9f1"/><path d="m18 22 10 4" stroke="#c7a66d" stroke-width="4"/>',
      axe:'<path d="m24 6 5 2-14 40-5-2Z" fill="#a58254"/><path d="M21 7 8 4 3 21l14 6 9-7 9 2 3-12-10-5Z" fill="'+color+'"/><path d="M8 4 3 21l6 2 5-17" fill="#e1e5d7"/><path d="m21 10 8 3-3 10-8-3Z" fill="'+gold+'"/>',
      spear:'<path d="m27 14 4 2-18 34-4-2Z" fill="#aa8453"/><path d="m33 2 3 15-10 8-4-6Z" fill="'+color+'"/><path d="m33 2-7 17" stroke="#edf0df" stroke-width="2"/><path d="m21 21 8 4" stroke="'+gold+'" stroke-width="4"/>',
      dagger:'<path d="m26 5 6 6-13 20-8-5Z" fill="'+color+'"/><path d="m26 9-11 18" stroke="#edf0df" stroke-width="2"/><path d="m8 26 15 8-3 4-15-8Z" fill="'+gold+'"/><path d="m10 33 6 3-7 11-5-3Z" fill="#96724b"/>',
      gauntlet:'<path d="m9 8 5-2 4 5 4-8 5 2 1 10 6-2 4 5-6 16-6 4-2 11H9L7 34 3 22l4-5Z" fill="'+color+'"/><path d="M9 37h18v11H9Z" fill="'+gold+'"/><path d="m12 16 2 10m8-12-2 12m8-6-3 9" stroke="#edf0df" stroke-width="2"/>',
      crossbow:'<path d="m27 12 5 4-17 33-6-4Z" fill="#9b744c"/><path d="M5 6c4 16 17 23 31 17l-2 7C19 31 5 22 2 9Z" fill="'+gold+'"/><path d="m5 6 14 15 17 2" fill="none" stroke="#d6d8bd" stroke-width="2"/><path d="m13 31 16-25m-4 1 4-1v5" stroke="'+color+'" stroke-width="3"/><path d="m12 30 11 7" stroke="#6e6a54" stroke-width="4"/>',
      focus:'<path d="m13 29 14-2 4 17H9Z" fill="'+gold+'"/><circle cx="20" cy="18" r="13" fill="#a9bfd5"/><path d="m20 5 7 12-7 14-7-14Z" fill="#d8d9e9"/><path d="M8 14h24m-20 9h16" stroke="#eef1e1"/><path d="M8 45h24" stroke="#a08351" stroke-width="4"/>',
      tome:'<path d="m7 7 24-4 3 37-24 6-4-4Z" fill="#8f82a1"/><path d="m10 11 19-3 2 27-19 5Z" fill="#b5a9c5"/><path d="m9 42 22-5 3 3-24 6Z" fill="#eae3c9"/><path d="m20 15 4 6 6 1-5 5 1 7-6-3-6 4 1-7-5-4 7-2Z" fill="'+gold+'"/>',
      quiver:'<path d="m15 4 5 28m7-28-5 29m11-24-8 25" stroke="#b4a17a" stroke-width="3"/><path d="m12 3 3 7 4-7m5 0 3 7 3-7m1 3 2 6 4-3" fill="'+color+'"/><path d="m10 21 21 3-7 25-15-4Z" fill="#9f7851"/><path d="m9 21 23 3-2 6-21-3Z" fill="'+gold+'"/><path d="m13 30 12 2-3 11-10-2Z" fill="#b9905b"/>',
      accessory:'<ellipse cx="20" cy="31" rx="13" ry="15" fill="'+gold+'"/><ellipse cx="20" cy="31" rx="8" ry="10" fill="#f6edce"/><path d="m20 3 9 8-9 10-9-10Z" fill="#9ebfbc"/><path d="m20 3-2 10 11-2m-11 2 2 8-9-10Z" fill="#c8ded4"/>',
      armor:'<path d="m13 5 7 5 7-5 11 9-6 10-4-3 3 24H9l3-24-5 3-5-10Z" fill="'+color+'"/><path d="m13 5 7 5 7-5-2 12H15Z" fill="#8e9690"/><path d="M12 31h16v6H12Z" fill="#a78356"/><path d="M18 31h5v6h-5Z" fill="#dfc187"/><path d="m7 10 6 6-6 8-5-10m31-4-6 6 5 8 6-10" fill="#d9ded1"/>'
    };
    return '<svg class="item-art" viewBox="0 0 40 52" fill="none" stroke="#716b57" stroke-width="1.2" stroke-linejoin="round" aria-hidden="true">'+(parts[r.type]||parts.sword)+'</svg>';
  }
  // The facility's own painted picture (cut from the shop objects atlas, the same art as in the forge), not a line icon.
  const SHOP_OBJECTS_SRC='assets/shop/shop-objects.png',SHOP_ATLAS_W=2584,SHOP_ATLAS_H=282;
  const FACILITY_CROPS={furnace:{x:4,y:4,w:171,h:222},display:{x:703,y:4,w:128,h:274},enhance:{x:259,y:4,w:114,h:120}};
  function facilityPicture(type,fallbackIcon){
    const c=FACILITY_CROPS[type];if(!c)return icon(fallbackIcon||'shop');
    const s=Math.min(150/c.h,170/c.w),w=Math.round(c.w*s),h=Math.round(c.h*s);
    return '<span class="facility-pic" style="width:'+w+'px;height:'+h+'px;background-image:url('+SHOP_OBJECTS_SRC+');background-size:'+Math.round(SHOP_ATLAS_W*s)+'px '+Math.round(SHOP_ATLAS_H*s)+'px;background-position:-'+Math.round(c.x*s)+'px -'+Math.round(c.y*s)+'px" aria-hidden="true"></span>';
  }
  // Boss rare recipes (DATA.bossRecipes): a boss's pool, shown as its first piece's picture and the pieces' names.
  function bossRecipeList(bossId){return ((DATA.bossRecipes||{})[bossId]||[]).map(id=>recipe(id)).filter(Boolean);}
  function bossRecipeArt(bossId){return itemArt(bossRecipeList(bossId)[0]);}
  function bossRecipeNames(bossId){const list=bossRecipeList(bossId);return list.length>3?list.slice(0,2).map(r=>r.name).join(' · ')+' 외 '+(list.length-2)+'종':list.map(r=>r.name).join(' · ');}
  function materialArt(id) {
    const pic=itemPic(id,'material-shape');if(pic)return pic;
    const m = DATA.materials[id] || {color:'#a9b2a0'};
    const paths = id === 'wood' ? '<path d="m4 5 12-3 4 14-12 5Z"/><path d="m7 8 8-2m-6 6 7-2m-5 6 6-2" fill="none" stroke="#7c6042"/>' : id === 'leather' ? '<path d="m5 3 5 2 5-2 5 5-3 5 2 7-9-2-7 3 1-9-3-5Z"/>' : id === 'crystal' ? '<path d="m12 1 8 7-3 12-10 2-5-13Z"/><path d="m12 1-3 10 8 9m-8-9 11-3M9 11 2 9" fill="none" stroke="#d9d3eb"/>' : '<path d="m5 7 9-5 7 8-3 11-15-2-2-7Z"/><path d="m5 7 7 5 9-2m-9 2 6 9m-6-9L3 19" fill="none" stroke="#e1e4d9"/>';
    return '<svg class="material-shape" viewBox="0 0 24 24" fill="'+m.color+'" stroke="#756e5660" stroke-width="1.2" stroke-linejoin="round" aria-hidden="true">'+paths+'</svg>';
  }
  function specialMaterialsMarkup() {
    return Object.entries(DATA.materials).filter(([id,m])=>m.source==='invasion').map(([id,m])=>'<button class="special-material-stock" data-action="invasion">'+materialArt(id)+'<span><b>'+escape(m.name)+'</b><small>마을 방어 보상 · 특별 장비 제작</small></span><strong>'+num(state.materials[id]||0)+'개</strong></button>').join('');
  }

  const facilityInfo = {
    furnace:{name:'화덕',icon:'flame',detail:'제작 대기열 +3칸',description:'제조 직원이 작업 위치에 도착하면 제작을 시작해요. 작업할 때에만 불이 켜집니다.'},
    display:{name:'진열대',icon:'shelf',detail:'장비 진열 +6칸',description:'완성한 장비를 진열하는 곳이에요. 모험가의 구매와 제작 의뢰 납품에 사용합니다.'},
    enhance:{name:'강화 작업대',icon:'hammer',detail:'모험가 자동 강화',description:'모험가가 자신의 강화석과 골드로 이용해요. 강화 실패로 장비가 파괴될 수 있습니다.'}
  };
  const statusName = {visiting:'대장간 방문',departing:'사냥터로 출발',hunting:'사냥 중',returning:'마을로 돌아오는 중',resting:'여관에서 회복',enhancing:'장비 강화 중',leaving:'마을을 떠나는 중',traveling:'마을로 이동',arriving:'새로운 방문',shopping:'장비 고르는 중',raiding:'보스 토벌 중',recalling:'마을로 긴급 귀환',defending:'마을 방어전'};
  const staffStatus = {working:'업무 처리 중',walking:'작업대로 이동',moving:'작업대로 이동',resting:'체력 회복 중',tired:'체력 회복 중',idle:'작업 대기',selling:'판매 응대 중',sales:'판매 응대 중',training:'직원 훈련 중'};
  const staffRoles = {smith:{name:'제조',icon:'hammer',facility:'furnace',description:'화덕에서 장비 제작 · 교대 근무'},sales:{name:'판매',icon:'coin',facility:'display',description:'매장 우측 계산대 응대 · 언변에 따른 판매가 상승'},buyer:{name:'재료 매입',icon:'gem',facility:null,description:'귀환 모험가의 재료를 목표 재고까지 매입'},logistics:{name:'물류·진열',icon:'box',facility:'display',description:'창고의 판매용 장비를 빈 매대로 운반'},enhancer:{name:'강화 보조',icon:'sword',facility:'enhance',description:'강화대에서 모험가의 강화 작업 속도 향상'},innkeeper:{name:'여관 관리',icon:'bed',facility:null,description:'여관의 환자를 나눠 맡아 회복 지원'}};
  const townLevelLabel = town => (town.levelRange || [town.recommendedLevel || 1]).join('–');
  const slotNames = {weapon:'무기',offhand:'보조 장비',armor:'갑옷',accessory:'장신구'};
  const slotIcons = {weapon:'sword',offhand:'shield',armor:'shield',accessory:'gem'};
  const getTown = () => Sim.getTown(state);
  const ownedTowns = () => Sim.getOwnedTowns(state);
  const townHeroes = id => state.adventurers.filter(a => a.townId === (id || state.activeTownId));
  const residents = () => Sim.getResidents(state);
  const quality = item => DATA.qualities[item?.quality] || DATA.qualities.normal;
  const itemName = item => recipe(item?.recipeId)?.name || item?.name || '기본 장비';
  const itemLevel = item => item?.enhance || item?.enhancement || 0;
  const itemSlot = item => item?.slot || recipe(item?.recipeId)?.slot || 'weapon';
  const costValue = cost => typeof cost === 'object' && cost !== null ? (cost.gold ?? cost.cost ?? 0) : cost;
  const townCatalog = () => Array.isArray(DATA.towns) ? DATA.towns : Object.entries(DATA.towns || {}).map(([id,t])=>({id,...t}));
  const orders = () => Sim.getOrders(state);
  const displayedItems = () => Sim.getDisplayedItems ? Sim.getDisplayedItems(state) : getTown().inventory.filter(i=>i.listed!==false);
  const isListed = item => item.listed!==false;
  const clamp = (n,min,max) => Math.min(max,Math.max(min,Number(n)||0));
  const pct = (n,total) => clamp((Number(n)||0)/(Number(total)||1)*100,0,100);
  const isDisabled = value => value ? ' disabled' : '';
  const slotList = () => ['weapon','offhand','armor','accessory'];
  const spriteIndex = (a,i=0) => window.ForgeScene?.getSpriteIndex ? ForgeScene.getSpriteIndex(a,i) : i;
  const portrait = (a,i=0,size=88) => '<canvas class="portrait" width="'+size+'" height="'+Math.round(size*1.23)+'" data-portrait="'+spriteIndex(a,i)+'" aria-label="'+escape(a?.name||'캐릭터')+'"></canvas>';
  function candidateCount() {
    const roster = window.ForgeRoster || DATA.npcRoster;
    return roster?.getCount ? roster.getCount() : (Array.isArray(roster) ? roster.length : roster?.characters?.length || DATA.maxAdventurers || 200);
  }

  // Access storage lazily: even obtaining localStorage can fail in a restricted context.
  // An unreadable save is never the same thing as an empty save slot.
  const saveStore = ForgeSaveStore.create({
    storage:{getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value),key:index=>localStorage.key(index),get length(){return localStorage.length;}},
    key:SAVE_KEY,normalize:data=>Sim.normalizeState(data),now:()=>Date.now()
  });
  const loadedSave = saveStore.load();
  let state = loadedSave.ok && loadedSave.state ? loadedSave.state : Sim.createState();
  let saveBlocked = !loadedSave.ok;
  // Craft quality is kept in the journal; legacy popup preferences cannot re-enable it.
  let preferences = {sound:true,music:true,musicVolume:.55,sfxVolume:.75,audioVersion:1,speed:1,speedVersion:2,centralNotifications:false,festivalSeenYear:0};
  try {const p=JSON.parse(localStorage.getItem(PREF_KEY)||'{}');
    // Sound v1 (music + effects): on by default; the old beep switch (default off) is not carried over.
    if(p.audioVersion===1){preferences.sound=p.sound!==false;preferences.music=p.music!==false;const vol=(v,d)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):d;preferences.musicVolume=vol(p.musicVolume,.55);preferences.sfxVolume=vol(p.sfxVolume,.75);}preferences.speed=p.speedVersion===2?([1,2].includes(p.speed)?p.speed:1):(p.speed===4?2:1);preferences.speedVersion=2;
    // Tutorial flags were saved but never read back, so a reload forgot them (2026-11-09 fix).
    if(p.tutorialDone===true)preferences.tutorialDone=true;if(p.missionsDone===true)preferences.missionsDone=true;Object.assign(preferences,ForgeNotifications.normalizePreferences(p),{centralNotifications:false});} catch (_) {}
  // Material request board draft: one row per gatherable material (checked + amount), reset each time the window opens.
  const questMaterials = () => Object.entries(DATA.materials).filter(([k,m])=>m.buyable!==false&&!m.rare).map(([k])=>k);
  const newQuestDraft = () => ({rows:Object.fromEntries(questMaterials().map(k=>[k,{checked:false,amount:10}]))});
  const ui = {operationsTab:'materials',materialDraft:null,autoRecipeId:'iron_sword',operationsFilter:'all',focusedTown:null,selectedRecruit:null,invasionTown:null,recipeFilter:'all',craftOrderId:null,calendarTab:'month',festivalItem:null,inventoryView:'warehouse',side:'craft',view:'village',recipeId:'iron_sword',paused:saveBlocked,modal:null,modalData:null,dirty:true,lastEvent:state.seq,modalSignature:'',sideSignature:'',queueSignature:'',questTab:'materials',questDraft:newQuestDraft(),heroSearch:'',heroFilter:'current',selectedOrder:null,selectedOrderItem:null,placement:null,itemReturn:null};
  const staffPortraits = new Map([['shop-owner',{id:'shop-owner',candidateId:'smith',role:'smith',name:'대장장이'}]]);
  let notifications = null;
  let scene = null, previousFocus = null, audioContext = null, soundTime = 0, lastFrame = performance.now(), lastUI = 0, visualTime = 1;

  function hydrateIcons(scope=document) {scope.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);el.removeAttribute('data-icon');});}
  function portraits(scope=document) {
    if (!window.ForgeScene?.drawPortrait) return;
    scope.querySelectorAll('canvas[data-portrait]').forEach(c=>ForgeScene.drawPortrait(c,Number(c.dataset.portrait)));
    scope.querySelectorAll('canvas[data-staff-portrait]').forEach(c=>{const staff=staffPortraits.get(c.dataset.staffPortrait);if(staff&&ForgeScene.drawStaffPortrait)ForgeScene.drawStaffPortrait(c,staff);});
  }
  function staffPortrait(staff,size=74) {
    const key=String(staff.id||staff.candidateId||staff.name||'smith');staffPortraits.set(key,staff);
    return '<canvas class="portrait staff-portrait" width="'+size+'" height="'+Math.round(size*1.22)+'" data-staff-portrait="'+escape(key)+'" aria-label="'+escape(staff.name||'직원')+'"></canvas>';
  }
  // 2026-11: nothing pops up at the top centre any more; short messages become a line in the bottom-left feed.
  function toast(message,error=false,action=null) {
    if(!message)return;
    // A warning while a window is open shows inside that window (a red strip at its top), where you are looking.
    if(error&&ui.modal&&$('#modal-alert')){const a=$('#modal-alert');a.textContent=fixJosa(String(message));a.hidden=false;a.classList.remove('shake');void a.offsetWidth;a.classList.add('shake');clearTimeout(toast.alertTimer);toast.alertTimer=setTimeout(()=>{a.hidden=true;},4500);return;}
    try{pushFeed(error?'notice-error':'notice',String(message),action||null,null);}catch(_){}
  }
  // 2026-11: game events no longer pop up; they scroll as small text lines in the bottom-left of the game screen,
  // each with a category tag and (when useful) a text action like [제작 하기]. Hovering the feed darkens it for reading.
  const FEED_KINDS={
    order:['제작 의뢰','order'],'order-complete':['제작 의뢰','order'],
    'season-notice':['계절 행사','season'],'season-start':['계절 행사','season'],'season-end':['계절 행사','season'],'season-complete':['계절 행사','season'],festival:['장비 축제','season'],
    'fame-craft':['명품 제작','craft'],'fame-boss':['보스 토벌','boss'],
    'recipe-unlock':['설계도','recipe'],goal:['목표 달성','goal'],'quest-complete':['재료 의뢰','quest'],
    arrival:['새 모험가','hero'],'recruit-arrival':['방문 인재','hero'],migration:['이주','hero'],
    'invasion-start':['마을 습격','danger'],'invasion-battle':['마을 습격','danger'],'invasion-end':['마을 습격','danger'],'training-complete':['훈련','staff'],
    achievement:['업적','goal'],
    incident:['돌발 사건','danger'],'incident-result':['돌발 사건','season'],'rare-recipe':['희귀 설계도','recipe'],'raid-result':['보스 토벌','danger'],'boss-ready':['보스 출현','boss'],'quest-ready':['성장 퀘스트','goal'],crisis:['위기','danger'],
    notice:['알림','misc'],'notice-error':['안내','danger']
  };
  const feedLog=[];let feedSeq=0;
  function feedText(e){
    if(e.type==='order'){const a=state.adventurers.find(x=>x.id===e.adventurerId),r=DATA.recipes.find(x=>x.id===e.recipeId);if(a&&r)return a.name+'님이 '+r.name+' 제작을 요청했어요.';}
    // 방문 인재: just "OOO이(가) 소문을 듣고 찾아왔습니다." (level and salary stay in the journal / fame window).
    if(e.type==='recruit-arrival'&&e.text)return e.text.split(' · ')[0].replace(/[.\s]*$/,'')+'.';
    return e.text||'';
  }
  // A copy of each item a feed line points at, so its info still opens after it was sold or handed over.
  const feedItems=new Map();
  function findItemAnywhere(id){for(const t of Object.values(state.towns||{})){const item=(t.inventory||[]).find(i=>i.id===id);if(item)return item;}return null;}
  function rememberFeedItem(id){const item=findItemAnywhere(id);if(item){feedItems.set(id,JSON.parse(JSON.stringify(item)));while(feedItems.size>100)feedItems.delete(feedItems.keys().next().value);}}
  // Where clicking a feed line takes you (the place to check that situation).
  function feedLink(e){
    switch(e.type){
      case 'order':return {kind:'order-craft',id:e.orderId};
      case 'order-complete':case 'arrival':case 'quest-complete':case 'migration':return e.adventurerId?{kind:'hero',id:e.adventurerId}:{kind:'nav',tab:'quests'};
      case 'season-notice':case 'season-start':case 'season-end':case 'season-complete':return {kind:'season-open',id:'season'};
      case 'festival':return {kind:'festival-open',id:''};
      case 'fame-craft':if(e.itemId)rememberFeedItem(e.itemId);return e.itemId?{kind:'stock-item',id:e.itemId}:{kind:'warehouse',id:''};
      case 'fame-boss':return {kind:'boss',id:e.bossId};
      case 'recipe-unlock':return {kind:'recipe-open',id:e.recipeId};
      case 'goal':return {kind:'fame',id:''};
      case 'recruit-arrival':return {kind:'fame',id:''};
      case 'invasion-start':case 'invasion-battle':case 'invasion-end':return {kind:'invasion',id:e.invasionId||e.townId};
      case 'training-complete':return {kind:'staff-card',id:e.staffId};
    }
    return null;
  }
  function pushFeed(type,text,action,link){
    if(!text)return;const kind=FEED_KINDS[type]||['알림','misc'];
    feedLog.push({id:++feedSeq,type,tag:kind[0],cls:kind[1],text,action:action||null,link:link||null,day:state.day,time:Date.now()});
    if(feedLog.length>100)feedLog.splice(0,feedLog.length-100);renderFeed();
  }
  // A request line's button follows the request: [제작 하기] → [제작 중] → [전달 완료] (or [기한 지남]), never a dead click.
  function feedActionState(a){
    // A crisis button stays live only while that crisis is open.
    if(a&&a.crisis){const open=a.kind==='boss'?(state.raidState?.parties||[]).some(p=>p.bossId===a.id&&p.status==='fighting'&&p.crisis&&p.crisis.active):(Sim.getIncidents(state).find(v=>v.id===a.id)?.task?.crisis?.active);return open?a:{...a,label:'지나감',done:true};}
    if(a&&a.kind==='quest-open'&&a.id){const claimed=state.questBook&&state.questBook.claimed.includes(Number(a.id));return claimed?{...a,label:'받음',done:true}:a;}
    if(a&&a.kind==='migration-open'&&!(Sim.getMigrationCandidates?Sim.getMigrationCandidates(state):[]).length)return {...a,label:'보냄',done:true};
    if(a&&a.kind==='incident-open'){const v=Sim.getIncidents?Sim.getIncidents(state).find(x=>x.id===a.id):null;return !v||v.status==='done'?{...a,label:'지나감',done:true}:v.status==='active'?{...a,label:'진행 중'}:a;}
    if(!a||a.kind!=='order-craft')return a;
    const o=state.orders.find(x=>x.id===a.id);
    if(!o||o.status==='completed')return {...a,label:'전달 완료',done:true};
    if(o.status!=='open')return {...a,label:'기한 지남',done:true};
    if(o.reservedItemId)return {...a,label:'전달 대기',done:true};
    if(state.towns&&Object.values(state.towns).some(t=>(t.queue||[]).some(q=>q.orderId===o.id)))return {...a,label:'제작 중',done:true};
    return a;
  }
  let feedSignature='';
  function renderFeed(){
    const root=$('#game-feed');if(!root)return;
    const lines=feedLog.slice(-6).map(f=>({f,a:feedActionState(f.action)}));
    const sig=lines.map(({f,a})=>f.id+':'+(a?a.label:'')).join('|');if(sig===feedSignature&&root.childElementCount)return;feedSignature=sig;
    const linkAttrs=l=>l?' data-action="'+escape(l.kind)+'" data-id="'+escape(l.id||'')+'"'+(l.tab?' data-tab="'+escape(l.tab)+'"':''):' disabled';
    root.innerHTML=lines.map(({f,a})=>'<p class="feed-line"><button type="button" class="feed-link"'+linkAttrs(f.link)+'><span class="feed-tag feed-'+f.cls+'">['+escape(f.tag)+']</span> '+escape(f.text)+'</button>'+(a?a.done?' <span class="feed-action feed-done">['+escape(a.label)+']</span>':' <button class="feed-action" data-action="'+escape(a.kind)+'" data-id="'+escape(a.id||'')+'">['+escape(a.label)+']</button>':'')+'</p>').join('');
  }
  function clearMoments() {notifications?.clear();}
  function queueMoment(event) {if(event.type==='fame-boss')notifications?.enqueue(event);}
  function updateMoments(elapsed) {notifications?.update(elapsed,{hidden:document.hidden,busy:!!ui.modal||!!ui.placement,festival:Sim.getFestival(state)});}
  // Sound effects (dist/audio.js). Game events map to one effect each; other branches stay quiet.
  const EVENT_SFX={crafted:'crafted',sale:'sale',enhance:'enhance','enhance-destroy':'enhanceFail','enhance-start':'enhanceStart',order:'order','order-complete':'coins','quest-complete':'coins','quest-post':'paper','quest-accept':'paper',
    'season-notice':'season','season-start':'season','season-end':'season','season-complete':'fanfare','fame-craft':'fanfare','fame-boss':'fanfare',goal:'fanfare',level:'fanfare','recipe-unlock':'unlock','training-complete':'unlock',
    arrival:'doorbell','recruit-arrival':'doorbell',hire:'hire','recruit-hired':'hire','recruitment-hire':'hire',build:'build',upgrade:'build','furnace-upgrade':'build','warehouse-upgrade':'build',branch:'build',inn:'build',
    payroll:'payout',festival:'coins','rare-purchase':'coins','season-purchase':'coins','season-delivery':'coins','invasion-start':'alarm','invasion-battle':'battle','invasion-end':'victory','invasion-relief':'victory','raid-start':'battle'};
  const LOCAL_SFX=new Set(['crafted','sale','enhance','enhance-destroy','enhance-start','arrival','order']);
  function sfx(name){if(preferences.sound&&window.ForgeAudio)window.ForgeAudio.sfx(name);}
  function eventSound(e){const name=EVENT_SFX[e.type];if(!name)return;if(LOCAL_SFX.has(e.type)&&e.townId&&e.townId!==state.activeTownId)return;sfx(name);}
  function chime(kind){sfx(kind==='error'?'error':'click');}
  // ?mute (test pages) keeps the game silent whatever the settings say.
  const AUDIO_MUTED=typeof location!=='undefined'&&/[?&]mute\b/.test(location.search||'');
  function applyAudio(){window.ForgeAudio?.configure({music:!AUDIO_MUTED&&!!preferences.music,sfx:!AUDIO_MUTED&&!!preferences.sound,musicVolume:preferences.musicVolume,sfxVolume:preferences.sfxVolume});}
  // Music follows the place on screen: title, village, forge shop, workshop, world map.
  function audioPlace(){if(!window.ForgeAudio)return;const room=ui.view==='shop'&&scene?.getRoomFocus?scene.getRoomFocus():null;window.ForgeAudio.setPlace(document.getElementById('title-screen')&&!document.getElementById('title-screen').classList.contains('leaving')?'title':ui.view==='village'?'village':ui.view==='world'?'world':room==='workshop'?'workshop':'forge');}
  function savePreferences() {try {localStorage.setItem(PREF_KEY,JSON.stringify(preferences));}catch(_) {}}
  function saveTime(value,full=false) {
    if(!value)return '시각 정보 없음';
    const date=new Date(value);
    return full?date.toLocaleString('ko-KR'):date.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  }
  function saveProblem(reason) {
    return ({
      read:'저장 공간을 읽지 못했어요. 기존 진행을 덮어쓰지 않도록 게임을 멈췄습니다. 다시 불러오기를 눌러 주세요.',
      invalid:'기존 저장을 불러오지 못했어요. 원본은 보호 중이며, 화면은 임시 대장간입니다. 설정에서 원본 내보내기와 백업 복구를 할 수 있어요.',
      missing:'현재 저장은 없지만 이전 백업이 남아 있어요. 새 진행을 저장하기 전에 설정에서 백업을 확인해 주세요.',
      conflict:'다른 탭에서 저장 내용이 바뀌었어요. 서로의 진행을 덮어쓰지 않도록 멈췄습니다. 이 화면을 내보내거나 최신 저장을 다시 불러오세요.',
      snapshot:'현재 진행을 안전하게 저장할 수 없어 마지막 정상 저장을 유지하고 있어요. 현재 진행을 파일로 내보내 보관해 주세요.',
      archive:'이전 진행의 백업을 만들지 못했어요. 마지막 정상 저장은 유지됩니다. 현재 진행을 파일로 내보내 보관해 주세요.',
      write:'브라우저에 저장하지 못했어요. 마지막 정상 저장은 유지됩니다. 다시 시도하거나 현재 진행을 파일로 내보내 주세요.'
    })[reason]||'저장을 완료하지 못했어요. 설정에서 저장 상태를 확인해 주세요.';
  }
  function renderSaveStatus() {
    const info=saveStore.info();saveBlocked=info.blocked;
    const problem=!!info.reason, savedAt=info.savedAt;
    const label=saveBlocked?'기존 저장 보호 중':problem?'자동 저장 실패':savedAt?'자동 저장 · '+saveTime(savedAt):loadedSave.state?'진행 불러옴 · 5초 자동 저장':'5초마다 자동 저장';
    $('#save-status').textContent=label;
    const indicator=$('#save-indicator');indicator.textContent=label;indicator.dataset.state=saveBlocked?'protected':problem?'error':'saved';
    indicator.title=problem?saveProblem(info.reason):(savedAt?'마지막 저장: '+saveTime(savedAt,true)+' · ':'')+'이 브라우저에 5초마다 저장 · 저장 설정 열기';
    const banner=$('#save-recovery-banner');banner.hidden=!problem;
    $('#save-recovery-title').textContent=saveBlocked?'저장된 진행을 보호하고 있어요':'자동 저장을 완료하지 못했어요';
    $('#save-recovery-message').textContent=problem?saveProblem(info.reason)+(info.detail?' (오류 코드 '+info.detail+')':''):'';
    const retry=$('#save-retry');retry.dataset.action=saveBlocked?'retry-save-load':'retry-save';retry.textContent=saveBlocked?'다시 불러오기':'저장 다시 시도';
    if($('#settings-save-time'))$('#settings-save-time').textContent=savedAt?'마지막 저장: '+saveTime(savedAt,true):'이번 접속에서 아직 새로 저장하지 않았어요.';
    if(saveBlocked&&!ui.paused){ui.paused=true;renderHeader();}
  }
  function save(showToast=false,options={}) {
    savePreferences();
    // Keep the backup shown in the confirmation stable until the user decides.
    if(ui.modal==='save-restore'&&!options.replace)return false;
    const result=saveStore.save(state,options);renderSaveStatus();
    if(showToast)toast(result.ok?'현재 진행을 저장했어요.':saveProblem(result.reason),!result.ok);
    return result.ok;
  }
  function adoptSavedState(loaded,{newGame=false}={}) {
    state=loaded;Sim.advanceRecruitment(state,Date.now());ui.lastEvent=state.seq;ui.recipeId='iron_sword';ui.recipeFilter='all';ui.craftOrderId=null;ui.focusedTown=null;ui.side='craft';ui.paused=false;ui.heroPage=0;ui.selectedOrder=null;ui.selectedOrderItem=null;ui.festivalItem=null;ui.questDraft=newQuestDraft();
    lastFrame=performance.now();clearMoments();cancelPlacement();closeModal();ui.paused=false;invalidate();setView('shop');refitSceneCamera();
    if(newGame){
      // A new game is a full restart: tutorial, hands-on missions (and with them incidents/quests/crises) and the news feed start over.
      notifications?.resetFestivalReminder();delete preferences.tutorialDone;delete preferences.missionsDone;savePreferences();
      feedLog.length=0;feedItems.clear();renderFeed();
      if(!saveBlocked)setTimeout(startTutorial,520);
    }
    syncIncidents();renderSaveStatus();render(true);
  }
  function retrySavedState() {
    const result=saveStore.load();renderSaveStatus();
    if(!result.ok){toast(saveProblem(result.reason),true);if(ui.modal==='settings')renderSettings();return;}
    adoptSavedState(result.state||Sim.createState());
    toast(result.state?state.day+'일 차 저장을 다시 불러왔어요.':'이 브라우저에 저장된 진행이 없어요. 새 대장간을 시작합니다.');
  }
  function act(result,{refresh=true}={}) {
    if(!result)return false;
    toast(result.message,!result.ok);
    if(result.ok){ui.dirty=true;ui.modalSignature='';save();}else sfx('error');
    if(refresh)render(true);
    return !!result.ok;
  }
  function invalidate(){ui.dirty=true;ui.modalSignature='';ui.sideSignature='';ui.queueSignature='';}
  // While a button is held down, the area holding it is not rebuilt: swapping the button out between press and
  // release made the browser drop the click, so popup buttons sometimes seemed not to respond.
  let pressedTarget=null;
  document.addEventListener('pointerdown',e=>{pressedTarget=e.target instanceof Element?e.target:null;},true);
  const releasePress=()=>{setTimeout(()=>{pressedTarget=null;},0);};
  document.addEventListener('pointerup',releasePress,true);document.addEventListener('pointercancel',releasePress,true);
  function pressedInside(el){return !!(pressedTarget&&el&&el.contains(pressedTarget));}
  function updateRegion(el,html,signature) {
    if(!el||el.dataset.signature===signature)return;
    if(pressedInside(el))return;
    const active=document.activeElement;
    const focused=el.contains(active)?{action:active.dataset.action,id:active.dataset.id,slot:active.dataset.slot}:null;
    const scroll=el.scrollTop;
    // Keep scrolled inner lists (e.g. the festival item picker) and scrolled windows around the region where they were:
    // a rebuild used to send them back to the top every time stock changed.
    const inner=[],outer=[];
    el.querySelectorAll('*').forEach(node=>{if(node.scrollTop>0&&node.className&&typeof node.className==='string')inner.push([node.tagName+'.'+node.className.trim().split(/\s+/)[0],node.scrollTop]);});
    for(let up=el.parentElement;up&&up!==document.body;up=up.parentElement)if(up.scrollTop>0)outer.push([up,up.scrollTop]);
    el.innerHTML=html;el.dataset.signature=signature;el.scrollTop=scroll;
    for(const [key,top] of inner){const [tag,cls]=key.split('.');const node=el.querySelector(tag.toLowerCase()+'.'+CSS.escape(cls));if(node)node.scrollTop=top;}
    for(const [up,top] of outer)up.scrollTop=top;
    if(focused?.action){const target=Array.from(el.querySelectorAll('[data-action]')).find(b=>b.dataset.action===focused.action&&b.dataset.id===focused.id&&b.dataset.slot===focused.slot);target?.focus({preventScroll:true});}
    portraits(el);
  }
  function metric(label,value,unit='',iconName='') {return '<div class="metric-cell"><small>'+(iconName?icon(iconName):'')+escape(label)+'</small><strong>'+escape(value)+'<em>'+escape(unit)+'</em></strong></div>';}
  function resourceRequirement(label,current,target) {return '<div class="requirement '+(current>=target?'met':'')+'">'+icon(current>=target?'check':'lock')+'<span>'+escape(label)+'</span><b>'+num(current)+' / '+num(target)+'</b></div>';}
  function empty(title,text,ic='box'){return '<div class="empty-state">'+icon(ic)+'<h3>'+escape(title)+'</h3>'+(text?'<p>'+escape(text)+'</p>':'')+'</div>';}
  const invasionPhase = invasion => invasion?.phase||invasion?.status||'';
  const invasionLabels = {recalling:'모험가 긴급 귀환',battle:'마을 방어전',recovery:'부상자 회복 중',resolved:'마을이 평온해졌어요'};
  // 2026-11-09 (user decision): every short time on screen is REAL seconds at the current speed. Game time runs 2x real at
  // 1x speed and 4x at 2x, so game seconds are divided by that before showing. realSecondsLabel is for times that already are real.
  const realSecondsLabel = value => {const n=Math.max(0,Math.ceil(Number(value)||0));return n>=60?Math.floor(n/60)+'분 '+n%60+'초':n+'초';};
  const gameRate = () => 2*Math.max(1,Number(preferences.speed)||1);
  if(typeof window!=='undefined')window.LittleEmberGameRate=gameRate;
  const secondsLabel = value => realSecondsLabel((Number(value)||0)/gameRate());
  function renderCampaignSummary() {
    if(!Sim.getFame)return;
    const fame=Sim.getFame(state),invasion=Sim.getInvasion(state),phase=invasionPhase(invasion),offers=Sim.getRecruitOffers(state),pay=Sim.getPayroll(state);
    const message=phase==='recalling'?invasion.arrivedCount+' / '+invasion.totalMembers+'명 도착':phase==='battle'?'전원 집결 · 함께 방어 중':phase==='recovery'?'회복 중 '+(invasion.recoveringCount??invasion.injuredCount)+'명':phase==='resolved'?'마을 방어 기록 보기':'마을 방어와 회복';
    const sig=[fame.rank,fame.value,offers.length,phase,invasion?.arrivedCount,invasion?.recoveringCount,pay.daysUntil,pay.totalDebt].join(':');
    updateRegion($('#campaign-summary'),'<button class="campaign-card fame-card" data-action="fame">'+icon('star')+'<span><small>'+escape(fame.rankName)+'</small><b>명성 '+num(fame.value)+(offers.length?' · 방문 인재 '+offers.length+'명':'')+'</b></span>'+icon('arrow')+'</button><button class="campaign-card '+(['recalling','battle','recovery'].includes(phase)?'incident-active':'')+'" data-action="invasion">'+icon(phase==='recovery'?'heart':'shield')+'<span><small>'+escape(invasionLabels[phase]||'오늘의 마을 소식')+'</small><b>'+escape(message)+'</b></span>'+icon('arrow')+'</button><button class="campaign-card finance-card" data-action="finance">'+icon('coin')+'<span><small>다음 성장을 위한 골드</small><b>'+(pay.totalDebt?'미지급 '+num(pay.totalDebt)+' G':'월급까지 '+pay.daysUntil+'일')+'</b></span>'+icon('arrow')+'</button>',sig);
  }
  function renderEarlyGuide() {
    const guide=DATA.onboarding;if(!guide?.phases)return;
    const minutes=Math.floor(state.time/60),totalStaff=ownedTowns().reduce((n,t)=>n+t.staff.length,0),pay=Sim.getPayroll(state);
    const actions=[['side','craft','제작하기'],['nav','quests','의뢰소'],['nav','staff','직원 관리'],['nav','world','월드맵'],['invasion','','마을 방어'],['finance','','성장 준비'],['nav','world','새 지점'],['nav','calendar','축제 준비']];
    const signature=[Math.floor(minutes/5),state.stats.crafted,state.stats.sold,ownedTowns().length,totalStaff,pay.totalDebt].join(':');
    updateRegion($('#early-guide-content'),'<p class="guide-basis">'+escape(guide.basis||'1배속으로 실제 플레이한 시간을 기준으로 한 목표 경로입니다.')+'</p><p class="guide-balance">'+escape(guide.balanceStatus==='deferred'?'도달 시점은 운영에 따라 달라져요. 전체 밸런스 검토는 아직 진행하지 않았습니다.':guide.balanceStatus||'전체 밸런스 검토는 별도로 진행할 예정입니다.')+'</p><div class="guide-checks"><span>장비 제작 <b>'+num(state.stats.crafted)+'개</b></span><span>판매 <b>'+num(state.stats.sold)+'개</b></span><span>직원 <b>'+totalStaff+'명</b></span><span>운영 지점 <b>'+ownedTowns().length+'곳</b></span></div><ol class="guide-phases">'+guide.phases.map((phase,i)=>{const action=actions[i]||actions[7];return '<li><span class="guide-time">'+phase.from+'–'+phase.to+'분</span><div><h3>'+escape(phase.title)+'</h3><p>'+escape(phase.description)+'</p><small>'+escape(phase.goal)+'</small></div><button class="text-button" data-action="guide-step" data-kind="'+action[0]+'" data-target="'+action[1]+'">'+action[2]+' '+icon('arrow')+'</button></li>';}).join('')+'</ol>',signature);
  }
  function worldExploreMarkup() {
    const focused=townCatalog().find(t=>t.id===ui.focusedTown)||townCatalog().find(t=>t.id===state.activeTownId),nearby=DATA.regions.filter(r=>r.townId===focused.id).sort((a,b)=>a.recommendedLevel-b.recommendedLevel),owned=!!state.towns[focused.id],invasion=owned&&Sim.getInvasion?Sim.getInvasion(state,focused.id):null;
    return '<div class="side-subhead"><span>'+townCatalog().length+'개 마을 · '+DATA.regions.length+'개 사냥터</span>'+icon('map')+'</div><p class="world-explore-hint">마을을 고르면 주변 지도를 살펴볼 수 있어요.</p><div class="town-list">'+townCatalog().map(t=>'<button class="town-card '+(t.id===focused.id?'focused':'')+'" data-action="focus-town" data-id="'+escape(t.id)+'" aria-pressed="'+(t.id===focused.id)+'"><span class="town-icon">'+icon(state.towns[t.id]?'shop':'map')+'</span><span><b>'+escape(t.name)+'</b><small>권장 Lv. '+townLevelLabel(t)+'</small></span>'+(state.towns[t.id]?'<em>'+(t.id===state.activeTownId?'운영 화면':'보유 지점')+'</em>':icon('arrow'))+'</button>').join('')+'</div><section class="focused-town"><div><small>지금 살펴보는 마을</small><h3>'+escape(focused.name)+'</h3></div><button class="secondary-button" data-action="town" data-id="'+escape(focused.id)+'">'+(owned?'지점 정보':'개점 조건')+'</button></section>'+(invasion&&invasionPhase(invasion)!=='resolved'?'<button class="world-incident" data-action="invasion" data-id="'+escape(focused.id)+'">'+icon('shield')+escape(invasionLabels[invasionPhase(invasion)])+' '+icon('arrow')+'</button>':'')+'<div class="world-region-links">'+nearby.map(r=>'<button data-action="region" data-id="'+escape(r.id)+'"><b>'+escape(r.name)+'</b><span>권장 Lv. '+(r.recommendedLevel||1)+'</span>'+icon('arrow')+'</button>').join('')+'</div><p class="world-explore-hint">지도 드래그·방향키로 이동 · 휠과 +/−로 확대<br>지점을 선택해도 현재 운영 화면은 바뀌지 않아요.</p><details class="world-raid-details"><summary>'+icon('shield')+' 이 지역의 보스 토벌</summary>'+worldRaidMarkup(focused.id)+'</details>';
  }
  function focusWorldTown(id) {
    if(!townCatalog().some(t=>t.id===id))return;
    ui.focusedTown=id;if(ui.modal)closeModal();if(ui.view!=='world')setView('world');scene?.focusTown?.(id);invalidate();render(true);
  }

  function renderHeader() {
    const town=getTown(), local=townHeroes(), staying=local.filter(a=>a.resident!==false&&a.status!=='leaving');
    $('#gold-value').textContent=num(state.gold); // the coin icon already says "gold"; the old "G" hid behind the settings button
    $('#reputation-value').textContent=num(state.reputation);
    $('#shop-level').textContent='Lv. '+town.level;
    const calendar=Sim.getCalendar(state),hour=calendar.hour;
    $('#day-value').textContent=calendar.label;
    $('#clock-value').textContent=(hour<12?'오전':'오후')+' '+(hour%12||12)+':'+String(calendar.minute).padStart(2,'0')+' · 달력 보기';
    $('#location-eyebrow').textContent=(townCatalog().find(t=>t.id===town.id)?.englishName || town.id.toUpperCase())+' · LITTLE EMBER';
    $('#location-heading').textContent=town.id==='greenwood'?'오늘도, 따뜻한 불을 피워요.':town.name+'에 피어난 작은 불꽃.';
    $('#location-sub').textContent=town.name+' · '+ownedTowns().length+'개 대장간이 함께 성장하고 있어요.';
    $('#scene-title').textContent=ui.view==='world'?'작은 불꽃의 세계':town.name+' 대장간';
    $('.scene-label').hidden=ui.view==='world';$('.scene-weather').hidden=ui.view==='world';
    $('#scene-help').innerHTML=icon('mouse')+(ui.view==='world'?' 마을·사냥터·보스 선택 · 드래그·휠로 탐색':' 시설·모험가 선택 · 드래그로 이동');
    const hunting=local.filter(a=>a.status==='hunting').length,visiting=local.filter(a=>['visiting','shopping','enhancing','returning'].includes(a.status)).length;
    $('#scene-summary').textContent=ui.view==='world'?townCatalog().length+'개 마을 · '+DATA.regions.length+'개 사냥터 · Lv.1–300 · 지점 '+ownedTowns().length+'곳 운영 중':'방문 '+visiting+'명 · 사냥 '+hunting+'명 · 마을 정원 '+staying.length+'/'+Sim.getInnCapacity(state);
    $('#stock-count').textContent=town.inventory.length;
    $('#hero-count').textContent=state.adventurers.length;
    const active=state.quests.filter(q=>q.status!=='completed').length+orders().filter(q=>!['completed','expired'].includes(q.status)).length;
    $('#quest-count').textContent=active;$('#quest-count').hidden=!active;
    $('#pause-overlay').hidden=!ui.paused;
    $('#pause-overlay strong').textContent=saveBlocked?'기존 저장을 보호하는 중':'잠시 쉬어가는 중';
    $('#pause-overlay button').textContent=saveBlocked?'저장 및 복구 설정':'계속하기';
    $('#open-tag').innerHTML='<i></i> '+(saveBlocked?'저장 확인 중':ui.paused?'휴식 중':'영업 중');
    const pause=$('.pause-button');pause.innerHTML=icon(ui.paused?'play':'pause');pause.setAttribute('aria-label',ui.paused?'계속하기':'일시정지');
    const sound=$('#sound-toggle'),audible=preferences.sound||preferences.music;sound.innerHTML=icon(audible?'sound':'mute');sound.title=audible?'소리 끄기':'소리 켜기';sound.setAttribute('aria-label',sound.title);sound.setAttribute('aria-pressed',String(audible));
    const speedButton=$('.speed-toggle');if(speedButton){
      if(ui.paused){speedButton.innerHTML=icon('pause');speedButton.title='일시정지 중 · 누르면 1배속';}
      else{speedButton.innerHTML=icon(preferences.speed===1?'speed1':'speed2');speedButton.title='게임 하루: '+(preferences.speed===1?'실제 60초':'실제 30초')+' · 누르면 '+(preferences.speed===1?'2배속':'일시정지');}
      speedButton.classList.toggle('paused',ui.paused);speedButton.setAttribute('aria-label',speedButton.title);}
    const branchSig=ownedTowns().map(t=>t.id+':'+t.level).join(',')+':'+state.activeTownId;
    updateRegion($('#branch-shortcuts'),ownedTowns().map((t,i)=>'<button class="'+(t.id===state.activeTownId?'active':'')+'" data-action="enter-town" data-id="'+escape(t.id)+'" title="'+escape(t.name)+' 지점으로 이동">'+icon('shop')+'<span>'+escape(t.name)+'</span></button>').join('')+'<button class="branch-add" data-action="nav" data-tab="world">'+icon('plus')+' 새 지점</button>',branchSig);
    const overviewSig=[town.id,town.level,town.width,town.height,town.facilities.length,town.staff.length,staying.length,Sim.getInnCapacity(state)].join(':');
    updateRegion($('#town-overview'),'<button data-action="nav" data-tab="upgrades">'+icon('building')+'<span>대장간 <b>Lv.'+town.level+'</b></span></button><button data-action="nav" data-tab="staff">'+icon('hammer')+'<span>직원 <b>'+town.staff.length+'명</b></span></button><button data-action="nav" data-tab="inn">'+icon('bed')+'<span>정착 모험가 <b>'+staying.length+' / '+Sim.getInnCapacity(state)+'</b></span></button>',overviewSig);
  }
  function renderGoal() {
    const g=Sim.getNextGoal(state);if(!g)return;
    const signature=[g.id,g.progress,g.target].join(':');
    updateRegion($('#goal-card'),'<div class="goal-icon">'+icon(g.complete?'star':'scroll')+'</div><div class="goal-content"><span class="goal-kicker">'+(g.complete?'명장 대장간':'작은 대장간 성장 일지')+'</span><h3>'+escape(g.title)+' <span>'+num(g.progress)+' / '+num(g.target)+'</span></h3><p>'+escape(g.description)+'</p><div class="goal-progress"><i style="width:'+pct(g.progress,g.target)+'%"></i></div></div><div class="goal-reward">'+icon(g.complete?'star':'coin')+(g.complete?'명장 달성':'+'+num(g.reward)+' G')+'</div>',signature);
  }
  function renderLogs() {
    updateRegion($('#activity-log'),state.logs.slice(0,3).map(l=>'<div class="log-line"><i class="log-dot '+(l.type.includes('sale')?'sale':l.type.includes('quest')?'quest':l.type.includes('craft')?'craft':'')+'"></i><p>'+escape(l.text)+'</p><time>'+Math.floor(l.time/DATA.dayLength+1)+'일 차</time></div>').join(''),state.logs[0]?.id||'empty');
  }
  function recipeMetrics(r) {
    const s=r.stats||{attack:r.attack,defense:r.defense,maxHp:r.hp};
    return '<span>'+icon(slotIcons[r.slot]||'sword')+' '+escape(slotNames[r.slot]||'무기')+'</span>'+[['attack','공격력'],['defense','방어력'],['maxHp','체력']].filter(([k])=>s[k]).map(([k,label])=>'<span>'+label+' <b>+'+num(s[k])+'</b></span>').join('');
  }
  const recipeTierNames=['입문','기초','숙련','전문','명장','궁극'];
  const recipeTier=r=>Math.min(6,Math.max(1,Math.ceil(Sim.getRecipeLevel(r)/5)));
  // 2026-11 crafting tab: filters (slot · craftable only · level band, same as auto-crafting) over one clean list.
  // A row opens the recipe in a centred popup; its [만들기] crafts right away.
  function craftFilterState(){return ui.craftFilter||(ui.craftFilter={ready:true,band:'all'});}
  function craftFilteredRecipes(){
    const f=craftFilterState(),slot=ui.recipeFilter||'all',unlocked=new Set(Sim.getUnlockedRecipes(state).map(r=>r.id));
    return {unlocked,list:[...DATA.recipes].filter(r=>!r.bossRecipe&&(!r.unlockDrop||(state.unlockedDrops||[]).includes(r.id))&&(slot==='all'||r.slot===slot)&&(f.band==='all'||Math.floor(Math.min(Sim.getRecipeLevel(r),30)/10)===Number(f.band))&&(!f.ready||unlocked.has(r.id))).sort((a,b)=>Sim.getRecipeLevel(a)-Sim.getRecipeLevel(b)||a.name.localeCompare(b.name))};
  }
  function craftFiltersMarkup(){
    const f=craftFilterState(),slot=ui.recipeFilter||'all';
    return [['all','전체'],['weapon','무기'],['offhand','보조 장비'],['armor','갑옷'],['accessory','장신구']].map(([id,label])=>'<button type="button" class="ops-chip'+(slot===id?' selected':'')+'" data-action="craft-filter" data-slot="'+id+'">'+label+'</button>').join('')
      +'<button type="button" class="ops-chip'+(f.ready?' selected':'')+'" data-action="craft-filter" data-ready="1">'+icon('check')+' 만들 수 있는 것만</button><span class="ops-break"></span>'
      +[['all','모든 레벨'],['0','Lv.1–9'],['1','Lv.10–19'],['2','Lv.20–29'],['3','Lv.30']].map(([id,label])=>'<button type="button" class="ops-chip'+(f.band===id?' selected':'')+'" data-action="craft-filter" data-band="'+id+'">'+label+'</button>').join('');
  }
  function recipeMainStat(r){const s=r.stats||{attack:r.attack,defense:r.defense,maxHp:r.hp};return r.slot==='weapon'?'공 +'+num(s.attack||0):r.slot==='armor'||r.slot==='offhand'?'방 +'+num(s.defense||0):'체 +'+num(s.maxHp||0);}
  function recipeGridMarkup(recipes,unlocked) {
    const town=getTown(),queueFull=town.queue.length>=Sim.getQueueCapacity(state),warehouseFull=Sim.getEquipmentUsage(state)>=Sim.getEquipmentCapacity(state);
    return recipes.map(r=>{
      const open=unlocked.has(r.id),short=Object.entries(r.cost).some(([k,v])=>(state.materials[k]||0)<v),why=!open?'제작기술 Lv.'+Sim.getRecipeLevel(r)+'부터 만들 수 있어요':short?'재료가 부족해요':queueFull?'화덕 대기열이 가득 찼어요':warehouseFull?'창고가 가득 찼어요':'';
      const cost=Object.entries(r.cost).map(([k,v])=>'<span class="cr-mat'+((state.materials[k]||0)<v?' short':'')+'" data-tip="'+escape(DATA.materials[k].name+' · 보유 '+num(state.materials[k]||0)+'개')+'">'+materialArt(k)+'<b>'+num(v)+'</b></span>').join('');
      return '<div class="craft-row'+(open?'':' locked')+(short?' is-short':'')+'"><button type="button" class="cr-open" data-action="recipe" data-id="'+escape(r.id)+'" title="'+escape(r.name)+' 자세히">'+itemArt(r)+'<span class="cr-name"><b>'+escape(r.name)+'</b><small>Lv.'+Sim.getRecipeLevel(r)+' · '+recipeMainStat(r)+' · '+num(r.price)+' G</small></span><span class="cr-mats">'+cost+'</span></button>'
        +'</div>';
    }).join('');
  }
  // The recipe popup body: picture, name, effects, materials, [만들기] and the help that applies.
  function recipeDetailMarkup(r){
    const town=getTown(),allUnlocked=Sim.getUnlockedRecipes(state),order=orders().find(q=>q.id===ui.craftOrderId&&q.recipeId===r.id);
    const unlockedRecipe=allUnlocked.some(x=>x.id===r.id),enough=Object.entries(r.cost).every(([k,v])=>state.materials[k]>=v),queueFull=town.queue.length>=Sim.getQueueCapacity(state),warehouseFull=Sim.getEquipmentUsage(state)>=Sim.getEquipmentCapacity(state),can=unlockedRecipe&&enough&&!queueFull&&!warehouseFull;
    const duration=r.duration*9/7,smiths=town.staff.filter(s=>s.role==='smith').length;
    const orderNote=order?'<div class="craft-order-context"><span>'+icon('scroll')+' 제작 의뢰 · '+escape(r.name)+'</span><small>만들면 완성되는 즉시 의뢰한 모험가에게 전달돼요.</small></div>':'';
    const hint=!unlockedRecipe?'제작기술 Lv. '+Sim.getRecipeLevel(r)+'부터 만들 수 있어요. 제조 직원을 훈련하거나 숙련된 직원을 고용해 주세요.':!can?(warehouseFull?'창고가 가득 찼어요. 장비를 진열하거나 창고를 확장하세요.':queueFull?'화덕 대기열이 가득 찼어요. 하나가 끝나면 이어서 예약할 수 있어요.':'재료가 부족해요. 재료 창고나 의뢰소를 이용하세요.'):!smiths?'제조 직원이 없어요. 예약한 제작은 직원 배정 후 시작됩니다.':'';
    const q=town.queue,cap=Sim.getQueueCapacity(state);
    return orderNote+'<div class="rp-head"><span class="rp-art">'+itemArt(r)+'</span><div><h3>'+escape(r.name)+'</h3><p>'+escape(r.description||'')+'</p><div class="recipe-metrics">'+recipeMetrics(r)+'<span>'+icon('coin')+' <b>'+num(r.price)+' G</b></span><span>'+icon('clock')+' <b>'+secondsLabel(duration)+'</b></span><span>제작 Lv.'+Sim.getRecipeLevel(r)+'</span></div></div></div>'
      +'<div class="material-costs">'+Object.entries(r.cost).map(([k,v])=>'<span class="cost-chip '+(state.materials[k]<v?'insufficient':'')+'" title="보유 '+num(state.materials[k])+'개">'+materialArt(k)+escape(DATA.materials[k].name)+' <b>'+num(v)+'</b><span> / '+num(state.materials[k])+'</span></span>').join('')+'</div>'
      +'<div class="rp-actions"><span class="rp-queue">'+icon('flame')+' 화덕 '+q.length+' / '+cap+'</span><button class="primary-button rd-make" data-action="craft" data-id="'+escape(r.id)+'"'+isDisabled(!can)+'>'+icon('hammer')+' 만들기</button></div>'
      +(!unlockedRecipe?'<button class="secondary-button full-button" data-action="nav" data-tab="staff">'+icon('people')+' 제조 직원 훈련·고용</button>':'')
      +(unlockedRecipe&&Object.entries(r.cost).some(([k,v])=>(state.materials[k]||0)<v&&DATA.materials[k]?.buyable!==false)?'<button class="secondary-button full-button" data-action="quest-for-recipe" data-id="'+escape(r.id)+'">'+icon('scroll')+' 부족한 재료 의뢰하기</button>':'')
      +(hint?'<p class="craft-hint">'+escape(hint)+'</p>':'');
  }  function renderRecipeModal(){
    const r=recipe(ui.modalData);if(!r){closeModal();return;}
    const town=getTown(),html=recipeDetailMarkup(r);
    updateRegion($('#modal-body'),html,[r.id,preferences.speed,state.gold,JSON.stringify(state.materials),town.queue.length,Sim.getQueueCapacity(state),ui.craftOrderId,Sim.getEquipmentUsage(state)].join('|'));
  }
  function renderCraftPanel(el,town) {
    const order=orders().find(q=>q.id===ui.craftOrderId);if(!order)ui.craftOrderId=null;
    if(!el.querySelector('#craft-recipe-list')){
      // No furnace strip above the list: it appeared and vanished with each craft and pushed the list up and down.
      el.innerHTML='<div class="ops-chips craft-filters" id="craft-panel-filters"></div><div class="recipe-list craft-list" id="craft-recipe-list" aria-label="제작할 장비"></div>';
    }
    const f=craftFilterState();
    updateRegion($('#craft-panel-filters'),craftFiltersMarkup(),[ui.recipeFilter,f.ready,f.band].join(':'));
    const {unlocked,list}=craftFilteredRecipes(),grid=$('#craft-recipe-list');
    updateRegion(grid,list.length?recipeGridMarkup(list,unlocked):'<p class="quest-empty">조건에 맞는 장비가 없어요.</p>',[town.id,ui.recipeFilter,f.ready,f.band,list.map(r=>r.id).join(','),[...unlocked].length].join(':'));
    // Stock and furnace changes only update each row in place (the list, its scroll and focus stay put).
    {const queueFull=town.queue.length>=Sim.getQueueCapacity(state),warehouseFull=Sim.getEquipmentUsage(state)>=Sim.getEquipmentCapacity(state);
      grid.querySelectorAll('.craft-row').forEach(row=>{const r=recipe(row.querySelector('[data-action="recipe"]')?.dataset.id);if(!r)return;const open=unlocked.has(r.id),short=Object.entries(r.cost).some(([k,v])=>(state.materials[k]||0)<v),why=!open?'제작기술 Lv.'+Sim.getRecipeLevel(r)+'부터 만들 수 있어요':short?'재료가 부족해요':queueFull?'화덕 대기열이 가득 찼어요':warehouseFull?'창고가 가득 찼어요':'';
        row.classList.toggle('is-short',short);row.querySelectorAll('.cr-mat').forEach((m,i)=>{const [k,v]=Object.entries(r.cost)[i]||[];if(k)m.classList.toggle('short',(state.materials[k]||0)<v);});
        row.title=why;});}
  }
  function qualityGuideMarkup() {
    return '<details class="equipment-quality-guide"><summary>'+icon('gem')+' 완성품 품질 · '+DATA.qualityOrder.length+'단계</summary><p>품질은 완성품의 완성도예요. 같은 설계도에서도 직원의 손놀림·성격·명성에 따라 다른 품질이 나옵니다.</p><div class="quality-guide-list">'+DATA.qualityOrder.map(id=>{const q=DATA.qualities[id];return '<div><span class="quality-pill quality-'+id+'">'+escape(q.name)+'</span><small>기본 성능 ×'+q.multiplier.toFixed(2)+(q.minCraftLevel>1?' · 제작자 Lv. '+q.minCraftLevel+'부터':'')+'</small></div>';}).join('')+'</div><p>품질은 제작할 때 결정돼요. 자세한 성능은 옵션·내구도·강화까지 함께 확인하세요.</p></details>';
  }
  function enhancementGuideMarkup(item,hero) {
    if(item.recipeId==='starter')return '';
    const level=itemLevel(item),max=DATA.enhancement.maxLevel;
    return '<div class="enhancement-level"><span>강화 단계 <b>+'+level+' / +'+max+'</b></span><div class="enhancement-segments" aria-label="최대 '+max+'단계 중 '+level+'단계">'+Array.from({length:max},(_,i)=>'<i class="'+(i<level?'filled':'')+'"></i>').join('')+'</div></div><details class="enhancement-guide"><summary>+'+max+'까지 강화 비용·확률 보기</summary><div class="enhancement-table-scroll"><table><caption>'+(hero?'새 신청 기준 · 착용자 성격을 반영한 강화 확률':'새 신청 기준 · 착용자의 성격에 따라 확률이 달라져요')+'</caption><thead><tr><th scope="col">목표</th><th scope="col">수수료</th><th scope="col">강화석</th><th scope="col">성공</th></tr></thead><tbody>'+Array.from({length:max},(_,i)=>{const info=Sim.getEnhancementInfo({...item,enhance:i},hero,state);return '<tr'+(i===level?' class="next-enhancement"':'')+'><th scope="row">+'+(i+1)+'</th><td>'+num(info.fee)+' G</td><td>'+num(info.stones)+'개</td><td>'+Math.round(info.successRate*100)+'%</td></tr>';}).join('')+'</tbody></table></div><p>수수료와 강화석은 시도할 때 소모돼요. 실패하면 장비가 파괴됩니다. +6부터는 단계당 성능 증가 폭이 줄어들어요.</p></details>';
  }
  function recipeFiltersMarkup(unlocked) {
    return '<div class="recipe-filters" aria-label="제작 장비 슬롯">'+[['all','전체'],...slotList().map(id=>[id,slotNames[id]])].map(([id,name])=>'<button class="'+(ui.recipeFilter===id?'active':'')+'" data-action="recipe-filter" data-id="'+id+'" aria-pressed="'+(ui.recipeFilter===id)+'">'+escape(name)+'<small>'+unlocked.filter(r=>id==='all'||r.slot===id).length+'</small></button>').join('')+'</div>';
  }
  // 2026-11 one-click request flow: [제작 하기] hands over a matching item right away if one exists (storage or display),
  // otherwise starts crafting it for this request (the finished piece goes straight to the requester).
  // Only when that is impossible (materials, smith level, full queue) does it open the crafting panel on that recipe.
  function openOrderRecipe(id) {
    const order=state.orders.find(q=>q.id===id&&q.status==='open'&&q.expiresAt>state.time),r=order&&recipe(order.recipeId);
    if(!r){toast('이 제작 의뢰는 이미 완료되었거나 마감되었어요.',true);return;}
    if(order.townId!==state.activeTownId)enterTown(order.townId);
    const hero=state.adventurers.find(a=>a.id===order.adventurerId),who=hero?hero.name+'님':'의뢰한 모험가';
    if(order.reservedItemId){toast(r.name+' 완성! '+who+'이 돌아오면 바로 전달돼요.');return;}
    if(getTown().queue.some(q=>q.orderId===id)){toast(r.name+' 제작 중이에요. 완성되면 '+who+'에게 바로 전달돼요.');return;}
    const ready=Sim.getOrderCandidates(state,id).sort((a,b)=>(Sim.getOrderPayout(state,id,b.id)||0)-(Sim.getOrderPayout(state,id,a.id)||0))[0];
    if(ready){const res=Sim.fulfillOrder(state,id,ready.id);if(res.ok){invalidate();ui.dirty=true;save();render(true);toast(who+'에게 '+ready.name+' 전달 · +'+num(res.payout)+' G');return;}}
    const made=Sim.craftForOrder(state,id);
    if(made.ok){invalidate();ui.dirty=true;save();render(true);toast(r.name+' 제작 시작! 완성되면 '+who+'에게 바로 전달돼요.');return;}
    toast(made.message,true);
    cancelPlacement();ui.craftOrderId=id;ui.recipeId=r.id;ui.side='craft';if(ui.view!=='shop')setView('shop');showModal('recipe',r.id);
  }
  function renderSide(force=false) {
    const town=getTown();
    const signature=[ui.side,ui.inventoryView,ui.stockSlot,ui.view,ui.focusedTown,ui.recipeFilter,ui.recipeId,ui.craftOrderId,ui.craftOrderId?state.orders.find(q=>q.id===ui.craftOrderId)?.status:'',town.staff.map(w=>w.role+':'+w.craftLevel).join(','),town.id,state.gold,JSON.stringify(state.materials),town.level,town.warehouseLevel,Sim.getMaterialCapacity(state),town.facilities.length,town.inventory.map(i=>[i.id,i.price,i.listed,i.locked,Sim.isCustomerItemReserved(state,i.id)].join(':')).join(','),town.queue.length,ui.view==='world'?Math.floor(state.time)+':'+state.adventurers.map(a=>a.status+':'+a.regionId+':'+Sim.getPower(a)).join(','):''].join('|');
    if(!force&&signature===ui.sideSignature)return;
    if(!force&&pressedInside($('#side-content')))return;
    ui.sideSignature=signature;
    const el=$('#side-content');el.classList.toggle('world-content',ui.view==='world');
    $$('.work-tabs button').forEach(b=>{const selected=b.dataset.side===ui.side&&ui.view==='shop';b.classList.toggle('active',selected);b.setAttribute('aria-selected',String(selected));});
    $('#panel-title').textContent=ui.view==='world'?'마을에서, 더 먼 곳으로':'작은 장인의 작업대';
    if(ui.view==='world'){
      const raidsOpen=!!el.querySelector('.world-raid-details')?.open;
      updateRegion(el,worldExploreMarkup(),signature);
      const details=el.querySelector('.world-raid-details');if(details)details.open=raidsOpen;
      return;
    }
    delete el.dataset.signature;
    if(ui.side==='craft'){
      renderCraftPanel(el,town);
    } else if(ui.side==='inventory'){
      // 2026-11 storage tab: same look as the crafting tab — type chips, one line per item (tap for details).
      const all=ui.inventoryView==='display'?displayedItems():town.inventory.filter(i=>!isListed(i)),slot=ui.stockSlot||'all',items=all.filter(i=>slot==='all'||itemSlot(i)===slot),full=displayedItems().length>=Sim.getStockCapacity(state);
      const chips=[['all','전체'],['weapon','무기'],['offhand','보조 장비'],['armor','갑옷'],['accessory','장신구']].map(([id,label])=>'<button type="button" class="ops-chip'+(slot===id?' selected':'')+'" data-action="stock-filter" data-slot="'+id+'">'+label+'<small>'+all.filter(i=>id==='all'||itemSlot(i)===id).length+'</small></button>').join('');
      const row=item=>{const reserved=Sim.isCustomerItemReserved(state,item.id),listed=isListed(item),q=quality(item),enh=itemLevel(item);
        return '<div class="craft-row stock-line'+(item.locked?' is-locked':'')+'"><button type="button" class="cr-open" data-action="stock-item" data-id="'+escape(item.id)+'">'+itemArt(recipe(item.recipeId))+'<span class="cr-name"><b class="quality-'+escape(item.quality)+'">'+escape(itemName(item))+'</b><small>'+escape(q.label||q.name)+' · '+escape(slotNames[itemSlot(item)]||'')+(reserved?' · 손님 예약':'')+'</small></span><b class="sl-price">'+num(item.price)+' G</b></button>'
          +'<button type="button" class="sl-lock'+(item.locked?' on':'')+'" data-action="lock-item" data-id="'+escape(item.id)+'" aria-pressed="'+!!item.locked+'" title="'+(reserved?'손님이 예약한 장비예요':item.locked?'보관 잠금 풀기':'보관 잠금 (판매·납품 안 함)')+'"'+isDisabled(reserved)+'>'+icon('lock')+'</button>'
          +'<button type="button" class="cr-make sl-move" data-action="'+(listed?'unlist-item':'list-item')+'" data-id="'+escape(item.id)+'"'+isDisabled(reserved||(listed?Sim.getEquipmentUsage(state)>=Sim.getEquipmentCapacity(state):(item.locked||full)))+'>'+(listed?'창고로':'진열')+'</button></div>';};
      el.innerHTML='<div class="inventory-switch"><button class="'+(ui.inventoryView==='warehouse'?'active':'')+'" data-action="inventory-view" data-view="warehouse">창고 <b>'+town.inventory.filter(i=>!isListed(i)).length+'</b></button><button class="'+(ui.inventoryView==='display'?'active':'')+'" data-action="inventory-view" data-view="display">진열대 <b>'+displayedItems().length+' / '+Sim.getStockCapacity(state)+'</b></button></div>'
        +'<div class="ops-chips craft-filters stock-filters">'+chips+'</div>'
        +(items.length?'<div class="craft-list stock-list">'+items.map(row).join('')+'</div>':all.length?'<p class="quest-empty">이 종류의 장비가 없어요.</p>':'<p class="stock-empty"><b>'+(ui.inventoryView==='warehouse'?'창고가 비어 있어요':'진열대가 비어 있어요')+'</b><small>'+(ui.inventoryView==='warehouse'?'완성한 장비는 먼저 창고에 들어와요.':'창고에서 판매할 장비를 진열하세요.')+'</small></p>')
        ;
    } else {
      // 2026-11 material tab: same rows as the other tabs (art · name · stock bar · +5 buy), special materials, then
      // the four ways to get more as small buttons.
      const cap=Sim.getMaterialCapacity(state),bar=n=>'<span class="mat-bar"><i style="width:'+pct(Math.min(n,cap),cap)+'%"></i></span>';
      // The +5 price includes incident price changes; while the roads are closed the button is off and says why.
      const stopped=Sim.incidentFactor&&Sim.incidentFactor(state,'buyStop')===0;
      const basic=Object.entries(DATA.materials).filter(([id,m])=>!m.rare&&m.buyable!==false).map(([id,m])=>{const n=state.materials[id]||0,cost=Math.round(Sim.getMaterialPrices(id).direct*(Sim.incidentFactor?Sim.incidentFactor(state,'price:'+id):1))*5;
        return '<div class="craft-row mat-line'+(n>=cap?' is-full':'')+'"><div class="cr-open mat-info">'+materialArt(id)+'<span class="cr-name"><b>'+escape(m.name)+'</b><span class="mat-stock"><small><b>'+num(n)+'</b> / '+num(cap)+'</small>'+bar(n)+'</span></span></div><button type="button" class="cr-make mat-buy" data-action="buy" data-id="'+id+'" title="'+(stopped?'길이 막혀서 지금은 재료를 살 수 없어요':'긴급 조달 5개 (모험가 매입가의 4배)')+'"'+isDisabled(stopped||state.gold<cost||Sim.getMaterialRoom(state,id)<5)+'>'+(stopped?'구입 불가':'+5 · '+num(cost)+' G')+'</button></div>';}).join('');
      const special=Object.entries(DATA.materials).filter(([id,m])=>m.source==='invasion').map(([id,m])=>'<div class="craft-row mat-line special"><button type="button" class="cr-open mat-info" data-action="invasion">'+materialArt(id)+'<span class="cr-name"><b>'+escape(m.name)+'</b><small>마을 방어 보상 · 특별 장비 재료</small></span><b class="sl-price">'+num(state.materials[id]||0)+'개</b></button></div>').join('');
      el.innerHTML=warehouseLink('재료 창고 · 재료별 '+num(cap)+'개까지')+'<div class="craft-list mat-list">'+basic+special+'</div>'
        +'<div class="mat-links"><button data-action="operations" data-tab="materials">'+icon('settings')+'자동 매입</button><button data-action="nav" data-tab="quests">'+icon('scroll')+'재료 의뢰</button><button data-action="gather" id="gather-button" title="주변에서 기초 재료 모으기">'+icon('leaf')+'모으기</button></div>';
    }
  }
  function stationState(f,town=getTown()) {
    const tasks=town.queue.filter(q=>q.facilityId===f.id||q.furnaceId===f.id||q.stationId===f.id), task=tasks.find(q=>q.id===f.taskId)||tasks[0];
    const worker=town.staff.find(s=>s.id===f.staffId||s.facilityId===f.id);
    let label=f.active?'제작 중':task?worker?(worker.salaryDebt>0?'직원 급여 지급 대기':worker.status==='training'?'직원 훈련 완료 대기':worker.status==='resting'||worker.stamina<=0?'직원 체력 회복 중':'직원 이동 · 도착 대기'):'제조 직원 대기':'예약 대기';
    return {tasks,task,worker,label};
  }
  function renderQueue(force=false) {
    const town=getTown(), furnaces=town.facilities.filter(f=>f.type==='furnace');
    const signature=[town.id,Sim.getQueueCapacity(state),town.queue.map(q=>[q.id,q.facilityId,q.furnaceId,q.stationId].join(':')).join(','),furnaces.map(f=>[f.id,f.active,f.taskId,f.staffId].join(':')).join(','),town.staff.map(s=>s.id+':'+s.role+':'+s.status).join(',')].join('|');
    if(force||signature!==ui.queueSignature){
      ui.queueSignature=signature;
      $('#queue-section').innerHTML='<div class="queue-heading">'+icon('hammer')+' 제작 대기열 <span>'+town.queue.length+' / '+Sim.getQueueCapacity(state)+'칸</span></div><div class="station-status-list">'+furnaces.map((f,i)=>{const s=stationState(f,town);return '<button class="station-status" data-action="facility" data-id="'+escape(f.id)+'"><span class="station-light '+(f.active?'lit':'')+'"></span><b>화덕 '+(i+1)+'</b><small>'+escape(s.label)+'</small>'+icon('arrow')+'</button>';}).join('')+'</div>'+town.queue.map(q=>'<div class="queue-item">'+itemArt(recipe(q.recipeId))+'<div class="queue-info"><strong>'+escape(recipe(q.recipeId)?.name||'장비')+'</strong><small data-queue-time="'+escape(q.id)+'"></small><div class="queue-bar"><i data-queue-progress="'+escape(q.id)+'"></i></div></div></div>').join('')+(!town.queue.length?'<div class="empty-slot">'+icon('plus')+'장비를 선택해 제작을 예약하세요</div>':'');
    }
    town.queue.forEach(q=>{
      const f=furnaces.find(f=>f.taskId===q.id||f.id===q.facilityId||f.id===q.furnaceId||f.id===q.stationId),active=f?.active&&(!f.taskId||f.taskId===q.id);
      const t=$('[data-queue-time="'+q.id+'"]'),p=$('[data-queue-progress="'+q.id+'"]');
      if(t)t.textContent=active?'제작 중 · 약 '+secondsLabel(q.remaining * (Sim.getCraftDuration(state,q.recipeId,q.staffId)||q.total) / ((recipe(q.recipeId)?.duration||7)*9/7) / Math.max(1,Sim.getFurnaceWorkers(state,town.id,f.id).length))+' 남음':f?.taskId&&f.taskId!==q.id?'이전 제작 완료 대기':f?stationState(f,town).label:'화덕 배정 대기';
      if(p)p.style.width=pct(q.total-q.remaining,q.total)+'%';
    });
    const gather=$('#gather-button');if(gather){gather.disabled=state.gatherCooldown>0;{const label=icon('leaf')+(state.gatherCooldown>0?secondsLabel(state.gatherCooldown):'모으기');if(gather.innerHTML!==label)gather.innerHTML=label;}}
  }
  const modalMeta={
    adventurers:['YOUR ADVENTURERS','함께 자라는 모험가들'],hero:['A FAMILIAR FACE','모험가 이야기'],candidate:['SOMEONE TO MEET','아직 만나지 못한 모험가'],item:['MADE WITH CARE','장비 자세히 보기'],recipe:['FORGE A PIECE','장비 만들기'],
    quests:['THE REQUEST BOARD','작은 불꽃 의뢰소'],upgrades:['GROW YOUR FORGE','대장간 레벨을 올려 시설을 늘려요'],facility:['A PLACE TO WORK','시설 살펴보기'],
    warehouse:['ROOM FOR TOMORROW','재료와 작품을 담는 창고'],operations:['THE WORKSHOP IN MOTION','직원들과 만드는 자동 운영'],boss:['WORLD BOSS','월드보스 토벌 현황'],staff:['OUR LITTLE TEAM','함께 불을 피우는 직원들'],inn:['REST FOR TOMORROW','모험가의 쉼터, 작은 여관'],town:['ANOTHER LITTLE EMBER','새로운 마을의 이야기'],
    calendar:['THE VILLAGE CALENDAR','달력과 계절 행사'],market:['FROM THEIR ADVENTURES','모험가의 희귀 재료 시장'],fame:['A NAME PEOPLE REMEMBER','명성과 새로운 인연'],invasion:['STAND TOGETHER','마을 방어와 회복'],training:['PRACTICE MAKES A MASTER','직원 훈련'],finance:['GOLD FOR TOMORROW','다음 성장을 위한 골드'],research:['SECRETS OF THE FORGE','대장간 연구'],achievements:['A STORY WORTH TELLING','업적과 칭호'],region:['BEYOND THE VILLAGE','사냥터 살펴보기'],help:['WELCOME, BLACKSMITH','작은 불꽃에 오신 걸 환영해요'],settings:['YOUR LITTLE WORLD','환경설정'],incident:['SOMETHING HAPPENED','돌발 사건'],migration:['READY FOR THE ROAD','다음 마을로 보낼 모험가'],'save-restore':['YOUR SAVED STORY','이전 진행 복구']
  };
  function setNav(tab) {
    $$('.main-nav [data-tab]').forEach(b=>{const active=b.dataset.tab===tab;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  }
  function showModal(type,data=null) {
    if(!modalMeta[type])return;
    if(ui.modal==='operations'&&type!=='operations')ui.materialDraft=null;
    if(ui.modal==='save-restore'&&type!=='save-restore'){ui.paused=saveBlocked||!!ui.restoreWasPaused;lastFrame=performance.now();renderHeader();}
    if(!ui.modal)previousFocus=document.activeElement;
    if(type==='quests'&&ui.modal!=='quests'){ui.questDraft=newQuestDraft();ui.selectedOrder=null;ui.selectedOrderItem=null;}
    if(ui.modal!==type)sfx('open');
    ui.modal=type;ui.modalData=data;ui.modalSignature='';
    $('#modal').classList.toggle('compact',['help','settings','save-restore','item','recipe','candidate','facility','town','training','region','incident'].includes(type));
    $('#modal').classList.toggle('incident-window',type==='incident');
    $('#modal').classList.toggle('wide',['adventurers','hero','upgrades','staff','inn','quests','calendar','market','fame','invasion','finance','operations','warehouse','research','achievements','boss'].includes(type));
    // Illustrated 9-slice popup frame (assets/ui/popup) — currently only the adventurer windows.
    // 2026-11 window layout (frame, 672px, fixed header/footer): adventurer list, adventurer detail, request board.
    // 2026-11: every game window uses the illustrated frame and the adventurer window's layout (672px, title bar).
    $('#modal').classList.toggle('framed',true);
    $('#modal').classList.toggle('game-window',!['adventurers','hero','quests'].includes(type));
    $('#modal').classList.toggle('roster-window',['adventurers','hero','quests'].includes(type));
    $('#modal').classList.toggle('quest-window',type==='quests');
    $('#modal').classList.toggle('calendar-window',type==='calendar');
    $('#modal').classList.toggle('hero-window',type==='hero');
    // Recipe / stored-item popups sit just left of the open workbench (no dimming), so the list stays usable.
    {const docked=['recipe','item'].includes(type)&&!data?.heroId&&ui.view==='shop'&&!$('.work-panel')?.hidden;$('#modal-backdrop').classList.toggle('docked',docked);$('#modal').classList.toggle('docked-window',docked);}
    if($('#modal-header-extra'))$('#modal-header-extra').innerHTML='';
    $('#modal-eyebrow').textContent=modalMeta[type][0];$('#modal-title').textContent=modalMeta[type][1];
    $('#modal-body').innerHTML='';$('#modal-backdrop').hidden=false;document.body.style.overflow='hidden';
    renderModalSwitch(type);
    renderModal(true);setNav(['adventurers','staff','hero','candidate','training'].includes(type)?'characters':['upgrades','inn','facility'].includes(type)?'facilities':type==='town'?'world':type);
    setTimeout(()=>$('#modal [data-action="close"]')?.focus({preventScroll:true}),0);
  }
  function closeModal() {
    if(ui.modal)sfx('close');
    if(ui.modal==='quests')ui.questDraft=newQuestDraft();
    if(ui.modal==='operations')ui.materialDraft=null;
    if(ui.modal==='save-restore')ui.paused=saveBlocked||!!ui.restoreWasPaused;
    if($('#modal-alert'))$('#modal-alert').hidden=true;
    ui.modal=null;ui.modalData=null;ui.modalSignature='';$('#modal-backdrop').hidden=true;document.body.style.overflow='';setNav(ui.view==='world'?'world':'shop');
    if(previousFocus?.isConnected&&!previousFocus.closest('[hidden]'))previousFocus.focus({preventScroll:true});else $('#game-canvas').focus({preventScroll:true});previousFocus=null;
  }
  function beginPlacement(type,moveId=null) {
    const facility=moveId?getTown().facilities.find(f=>f.id===moveId):null;
    if(moveId&&!facility){toast('이 시설을 찾지 못했어요.',true);return;}
    type=facility?.type||type;
    closeModal();setView('shop');ui.placement={type,...(moveId?{moveId}:{})};scene?.setPlacement(ui.placement);
    $('#placement-banner').hidden=false;$('#placement-title').textContent=facilityInfo[type].name+(moveId?' 위치 옮기기':' 놓을 곳을 골라주세요');
    $('#placement-description').textContent=moveId?'빈 바닥을 누르면 옮겨요. 앞쪽 작업 통로를 남겨주세요.':'배치할 빈 바닥을 누르세요 · '+num(costValue(Sim.getBuildCost(state,type)))+' G · 앞쪽 작업 통로가 필요해요';
    $('#canvas-wrap').classList.add('placing');$('#game-canvas').focus({preventScroll:true});
    if(window.innerWidth<760)$('#canvas-wrap').scrollIntoView({behavior:'smooth',block:'center'});
  }
  function cancelPlacement() {ui.placement=null;scene?.setPlacement(null);$('#placement-banner').hidden=true;$('#canvas-wrap').classList.remove('placing');}
  function placeFacility(type,x,y,moveId) {
    const result=moveId?Sim.moveFacility(state,moveId,x,y):Sim.placeFacility(state,type,x,y);
    if(act(result))cancelPlacement();
  }
  // Village picture geometry: x of the dirt path in front of each building spot (centre of the path from the patch
  // down to the road, measured row by row on the background, as a fraction of the 16:9 picture), and each level's door centre as a fraction of its art cell.
  const VILLAGE_DOORS={forgePathX:.296,innPathX:.715,forge:[.53,.51,.50,.46,.46],inn:[.50,.51,.52,.50,.51]};
  function villageDoors(town){return {forge:VILLAGE_DOORS.forge[clamp(town.level,1,5)-1],inn:VILLAGE_DOORS.inn[clamp(town.innLevel,1,5)-1]};}
  function renderVillage() {
    const town=getTown(),forge=$('#village-forge-art'),inn=$('#village-inn-art');if(!town||!forge||!inn)return;
    const shopLevel=clamp(town.level,1,5),innLevel=clamp(town.innLevel,1,5);
    forge.style.backgroundPosition=((shopLevel-1)*25)+'% 50%';inn.style.backgroundPosition=((innLevel-1)*25)+'% 50%';
    // Stand each building so its door sits right on the dirt path in front of it (see VILLAGE_DOORS).
    const view=$('#village-view'),fb=$('.village-forge'),ib=$('.village-inn');
    if(view&&fb&&ib&&view.clientWidth){const share=el=>el.offsetWidth/view.clientWidth,d=villageDoors(town);
      fb.style.left=((VILLAGE_DOORS.forgePathX-share(fb)*d.forge)*100).toFixed(3)+'%';ib.style.left=((VILLAGE_DOORS.innPathX-share(ib)*d.inn)*100).toFixed(3)+'%';ib.style.right='auto';}
    $('#village-forge-label').textContent='대장간 Lv.'+shopLevel+' · 입장';
    // First visit: the forge sign bobs and glows until the first piece is made, so a new player knows where to go.
$('#village-inn-label').textContent='여관 Lv.'+innLevel;
  }
  function setView(view) {
    if(view!=='shop'&&ui.placement)cancelPlacement();
    if(view==='world'&&ui.view!=='world')ui.viewBeforeWorld=ui.view;
    ui.view=view==='village'?'village':view==='world'?'world':'shop';
    scene?.setView(ui.view==='world'?'world':'shop');
    const keyboardRegions=$('#world-keyboard-regions');if(keyboardRegions){keyboardRegions.hidden=ui.view!=='world';if(ui.view==='world'&&!keyboardRegions.innerHTML)keyboardRegions.innerHTML=DATA.regions.map(r=>'<button data-action="region" data-id="'+escape(r.id)+'">'+escape(r.name)+' · 권장 Lv.'+r.recommendedLevel+'</button>').join('');}
    $('#village-view').hidden=ui.view!=='village';$('#canvas-wrap').classList.toggle('view-village',ui.view==='village');$('#canvas-wrap').classList.toggle('view-world',ui.view==='world');
    $('.work-panel').hidden=ui.view!=='shop';
    $$('[data-action="view"]').forEach(b=>b.classList.toggle('active',b.dataset.view===ui.view));
    if(!ui.modal)setNav(ui.view==='world'?'world':'shop');invalidate();render(true);
  }
  function refitSceneCamera() {
    if(!scene)return;
    // Read the updated rooms before fitting the camera to their new bounds.
    scene.render(state,visualTime);scene.resetCamera();scene.render(state,visualTime);
  }
  // Forge level allowance (2026-11 design: the map is fixed, the level decides the facilities).
  function forgeLevelText(level){const i=Sim.getForgeLevelInfo(level);return '화덕 '+i.furnace+' · 진열대 '+i.display+' · 강화 작업대 '+i.enhance+(i.furnaceGrade===3?' · 최고급 화덕':i.furnaceGrade===2?' · 고급 화덕':'');}
  function heroCustomerState(a) {return state.towns[a.townId]?.customerService?.requests.find(q=>q.heroId===a.id)?.status||'';}
  function traitNote(actor,kind) { const trait=Sim.getPersonality(actor);return trait?'<p class="personality-note" title="'+escape(kind==='staff'?trait.staffDescription:trait.adventurerDescription)+'"><span class="trait-tag trait-'+escape(trait.id)+'">'+escape(trait.prefix)+'</span><span>'+escape(kind==='staff'?trait.staffDescription:trait.adventurerDescription)+'</span></p>':''; }
  function heroStatus(a) {const request=heroCustomerState(a);return a.injuryUntil>state.time?'침공 부상 · 여관에서 요양':a.raidId?'보스 토벌 중':a.missionId?'돌발 사건 파견 중':request?(request==='ready'?'카운터 주문 · 완성품 수령 대기':'카운터 주문 · 제작 대기'):statusName[a.status]||'마을에서 생활 중';}
  // The adventurer window lists every met adventurer (search and filter were removed in the 2026-11 layout).
  function filteredHeroes() {
    return state.adventurers.map(a=>({active:a}));
  }
  function renderHeroList(force) {
    const body=$('#modal-body');
    if(force||!$('#hero-results')){
      body.innerHTML='<div class="roster-list" id="hero-results"></div><div class="roster-pagination" id="hero-pagination"></div>';
    }
    const extra=$('#modal-header-extra');if(extra)extra.innerHTML=icon('people')+' 만난 모험가 <b>'+state.adventurers.length+' / '+candidateCount()+'명</b>';
    const list=filteredHeroes(),pageSize=24,maxPage=Math.max(0,Math.ceil(list.length/pageSize)-1);ui.heroPage=clamp(ui.heroPage||0,0,maxPage);
    const shown=list.slice(ui.heroPage*pageSize,(ui.heroPage+1)*pageSize);
    const signature=[state.activeTownId,ui.heroPage,...shown.map(row=>{const a=row.active;return [a.id,a.townId,a.level,a.status,heroCustomerState(a),a.gold,a.hp,a.questId,a.fatigue&&Math.floor(a.fatigue/10),row.active?Sim.getPower(a):0].join(':');})].join('|');
    // One row per adventurer, left to right: portrait, rank, level, name, job, power, current place.
    updateRegion($('#hero-results'),shown.length?shown.map(({active:a},i)=>{
      // Short place label for the list column; the full status stays in the tooltip.
      const request=heroCustomerState(a),shortStatus=a.injuryUntil>state.time?'부상 요양 중':a.raidId?'보스 토벌 중':a.missionId?'파견 중':request?(request==='ready'?'주문품 수령 대기':'주문 제작 대기'):statusName[a.status]||'마을에서 생활 중';
      const town=a.townId!==state.activeTownId?(state.towns[a.townId]?.name||'여행 중')+' · ':'',grade=a.potentialGrade||'C',place=town+shortStatus+(a.questId?' · 재료 의뢰':''),fullPlace=town+heroStatus(a)+(a.questId?' · 재료 의뢰 수행 중':'');
      return '<button class="roster-row" data-action="hero" data-id="'+escape(a.id)+'"><span class="hero-portrait-wrap">'+portrait(a,i)+'</span><span class="roster-rank grade-'+escape(grade)+'" title="잠재 등급'+(a.gradeLegacy?' (기존)':'')+'">'+escape(grade)+'</span><span class="roster-level">Lv. '+a.level+'</span><span class="roster-name">'+escape(a.name)+'</span><span class="roster-job">'+escape(a.job)+'</span><span class="roster-power"><span>전투력</span><b>'+num(Sim.getPower(a))+'</b></span><span class="roster-place hero-status '+escape(a.status||'')+'" title="'+escape(fullPlace)+'">'+icon(a.status==='hunting'?'sword':a.status==='resting'?'bed':'shop')+escape(place)+'</span></button>';
    }).join(''):empty('아직 만난 모험가가 없어요','여관을 늘리고 새 인연을 기다려요.','people'),signature);
    updateRegion($('#hero-pagination'),'<button class="secondary-button" data-action="hero-page" data-page="'+(ui.heroPage-1)+'"'+isDisabled(ui.heroPage<=0)+'>이전</button><span>'+(ui.heroPage+1)+' / '+(maxPage+1)+' · '+list.length+'명</span><button class="secondary-button" data-action="hero-page" data-page="'+(ui.heroPage+1)+'"'+isDisabled(ui.heroPage>=maxPage)+'>다음</button>',[ui.heroPage,maxPage,list.length].join(':'));
  }
  function renderHeroDetail(force) {
    const a=state.adventurers.find(a=>a.id===ui.modalData);if(!a){$('#modal-body').innerHTML=empty('모험가를 찾지 못했어요','모험가 목록을 다시 열어주세요.','people');return;}
    $('#modal-title').textContent=a.name+'의 모험';
    const stats=Sim.getCombatStats(a),equipment=a.equipment||{};
    const sig=[a.id,a.level,a.status,heroCustomerState(a),a.gold,a.enhancementStones,a.questId,a.discount,a.injuryUntil>state.time,a.medicalCost,JSON.stringify(equipment),JSON.stringify(a.bossRecipe||null)].join('|');
    if(force||ui.modalSignature!==sig){ui.modalSignature=sig;
      // A boss rare recipe this hero carries, and how far they are in gathering its materials.
      const held=a.bossRecipe&&recipe(a.bossRecipe.recipeId),ready=held&&a.bossRecipe.gathered>=a.bossRecipe.needed;
      const recipeNote=held?'<div class="hd-recipe'+(ready?' ready':'')+'">'+itemArt(held)+'<div><small>희귀 설계도</small><b>'+escape(held.name)+'</b></div><span>'+(ready?'재료 준비 완료 · 제작 의뢰하러 와요':'재료 모으는 중 '+a.bossRecipe.gathered+' / '+a.bossRecipe.needed)+'</span></div>':'';
      // 2026-11 layout: back link fixed on top; profile row (portrait | grade, level, name, job / personality | 2x2 equipment slots);
      // then one box with combat stats on the left and HP / fatigue / XP gauges on the right. Slots show only art; hover = item info.
      const grade=a.potentialGrade||'C',statCell=(label,value,iconName)=>'<div class="hd-stat"><span>'+(iconName?icon(iconName):'')+escape(label)+'</span><b>'+escape(value)+'</b></div>',gauge=(label,cls,id)=>'<div class="hd-gauge"><span>'+label+'</span><div class="status-track '+cls+'"><i id="hero-'+id+'-bar"></i></div><b id="hero-'+id+'-value"></b></div>';
      const slotTitle=(slot,item)=>item?itemName(item)+(itemLevel(item)?' +'+itemLevel(item):'')+' · '+(quality(item).label||quality(item).name)+'\n'+itemStatsText(item)+(optionSummary(item)?'\n'+optionSummary(item):''):slotNames[slot]+' · 비어 있음';
      $('#modal-body').innerHTML='<button type="button" class="hd-back" data-action="back-heroes"><span aria-hidden="true">‹</span> 모험가 목록</button><div class="hd-scroll">'+
        '<section class="hd-profile"><span class="hd-portrait">'+portrait(a,0,128)+'</span><div class="hd-ident"><div class="hd-nameline"><span class="roster-rank grade-'+escape(grade)+'" title="잠재 등급'+(a.gradeLegacy?' (기존)':'')+'">'+escape(grade)+'</span><span class="hd-level">Lv. '+a.level+'</span><h3>'+escape(a.name)+'</h3><span class="hd-job">'+escape(a.job)+'</span></div><p id="hero-status-line" class="hd-status"></p>'+traitNote(a,'adventurer')+recipeNote+'</div>'+
        '<div class="hd-equip">'+slotList().map(slot=>{const item=equipment[slot];return '<button class="hd-slot equipment-slot '+(!item?'empty':'grade-'+escape(item.quality||'normal'))+'" data-action="equipment-item" data-id="'+escape(a.id)+'" data-slot="'+slot+'" data-tip="equip" aria-label="'+escape(slotTitle(slot,item))+'"'+isDisabled(!item)+'>'+(item?itemArt(recipe(item.recipeId))+(itemLevel(item)?'<em>+'+itemLevel(item)+'</em>':'')+(item.heirloom?'<i class="hd-heirloom">전용</i>':''):icon(slotIcons[slot]))+'</button>';}).join('')+'</div></section>'+
        '<div class="hd-vitals"><div class="hd-stats">'+statCell('전투력',num(stats.power))+statCell('공격력',num(stats.attack))+statCell('방어력',num(stats.defense))+'</div><div class="hd-gauges">'+gauge('체력','hp','hp')+gauge('피로','fatigue','fatigue')+gauge('경험','xp','xp')+'</div></div><div id="hero-injury-note"></div></div>';portraits($('#modal-body'));
    }
    const extra=$('#modal-header-extra');if(extra)extra.innerHTML='<span>'+icon('coin')+' 모험가 지갑 <b>'+num(a.gold)+' G</b></span><span>'+icon('gem')+' 강화석 <b>'+num(a.enhancementStones||0)+'개</b></span>';
    const xpNeed=Sim.xpNeeded(a),maxLevel=a.level>=DATA.adventurerMaxLevel;$('#hero-xp-value').textContent=maxLevel?'최고 레벨':num(a.xp)+' / '+num(xpNeed);$('#hero-xp-bar').style.width=(maxLevel?100:pct(a.xp,xpNeed))+'%';
    // 지금 하는 일 · 있는 마을 · 다음 마을로 갈 준비 (2026-11-10 사용자 확인): why they can or cannot be sent somewhere.
    {const line=$('#hero-status-line');if(line){const town=state.towns[a.townId]?.name||DATA.towns.find(t=>t.id===a.townId)?.name||'',mig=(Sim.getMigrationCandidates?Sim.getMigrationCandidates(state):[]).find(c=>c.id===a.id);
      updateRegion(line,icon('clock')+' 지금 <b>'+escape(heroStatus(a))+'</b> · '+escape(town)+(mig?' · <span class="hd-mig">'+escape(mig.toName)+'(으)로 갈 준비됨'+(mig.block?' ('+escape(mig.block)+')':'')+'</span>'+(mig.block?'':' <button type="button" class="text-button" data-action="migration-open">보내기</button>'):''),[a.id,heroStatus(a),a.townId,mig?mig.block:'-'].join(':'));}}
    const injury=$('#hero-injury-note');if(injury){const injured=a.injuryUntil>state.time;updateRegion(injury,injured?'<div class="injury-note">'+icon('bed')+'<div><b>침공 부상으로 요양 중 · '+secondsLabel(a.injuryUntil-state.time)+'</b><p>회복 전까지 사냥·장비 구매·강화를 쉬어요.'+(a.medicalCost?' 미납 치료비 '+num(a.medicalCost)+' G가 있습니다.':'')+'</p></div><button class="text-button" data-action="invasion" data-id="'+escape(a.townId)+'">구호 살펴보기</button></div>':a.medicalCost?'<p class="supply-note">남은 치료비 '+num(a.medicalCost)+' G · 소지 골드에서 정산합니다.</p>':'',[a.id,Math.ceil(a.injuryUntil-state.time),a.medicalCost].join(':'));}
    $('#hero-hp-value').textContent=num(stats.hp)+' / '+num(stats.maxHp);$('#hero-hp-bar').style.width=pct(stats.hp,stats.maxHp)+'%';$('#hero-fatigue-value').textContent=Math.round(a.fatigue||0)+' / 100';$('#hero-fatigue-bar').style.width=pct(a.fatigue,100)+'%';
  }
  // Storage / display item popup: lock and move buttons (the same ones as the list row).
  function itemStockActions(item){const reserved=Sim.isCustomerItemReserved(state,item.id),listed=isListed(item),full=displayedItems().length>=Sim.getStockCapacity(state);
    return '<div class="item-stock-actions"><button class="secondary-button'+(item.locked?' on':'')+'" data-action="lock-item" data-id="'+escape(item.id)+'"'+isDisabled(reserved)+'>'+icon('lock')+(reserved?'손님 예약 중':item.locked?'보관 잠금 풀기':'보관 잠금')+'</button><button class="primary-button" data-action="'+(listed?'unlist-item':'list-item')+'" data-id="'+escape(item.id)+'"'+isDisabled(reserved||(listed?Sim.getEquipmentUsage(state)>=Sim.getEquipmentCapacity(state):(item.locked||full)))+'>'+icon(listed?'box':'shelf')+(listed?'창고로 옮기기':'진열하기')+'</button></div>';}
  function renderItem(force) {
    const d=ui.modalData,hero=d?.heroId?state.adventurers.find(a=>a.id===d.heroId):null;
    const here=hero?null:getTown().inventory.find(i=>i.id===d?.itemId);
    // Not in this shop any more (sold, handed over, or in another branch): show it from another branch or the feed's copy.
    const elsewhere=!hero&&!here&&d?.itemId?findItemAnywhere(d.itemId):null,remembered=!hero&&!here&&!elsewhere&&d?.itemId?feedItems.get(d.itemId):null;
    const item=hero?hero.equipment?.[d.slot]:here||elsewhere||remembered;
    if(!item){$('#modal-body').innerHTML=empty('이 장비는 자리를 떠났어요','장비가 판매되거나 교체되었어요. 진열대와 모험가 정보를 다시 확인해 주세요.','shelf')+'<button class="secondary-button full-button" data-action="item-back">돌아가기</button>';return;}
    const activeTask=hero?.enhancement?.itemId===item.id?hero.enhancement:hero?.pendingEnhancement?.itemId===item.id?hero.pendingEnhancement:null;
    const sig=JSON.stringify(item)+':'+(here?'h':elsewhere?'e':remembered?'r':'')+':'+Sim.isCustomerItemReserved(state,item.id)+':'+(hero?.traitId||'')+':'+JSON.stringify(activeTask&&[activeTask.fee,activeTask.stones,activeTask.successRate,activeTask.paid,!!hero.pendingEnhancement]);
    if(!force&&ui.modalSignature===sig)return;ui.modalSignature=sig;
    const stats=Sim.getItemStats(item),quote=Sim.getEnhancementInfo(item,hero,state),r=recipe(item.recipeId);
    const info=activeTask?{...quote,fee:activeTask.fee,stones:activeTask.stones,successRate:activeTask.successRate,destructionRate:1-activeTask.successRate}:quote;
    const guideOpen=!!$('#modal-body .enhancement-guide')?.open;
    $('#modal-title').textContent=itemName(item)+(itemLevel(item)?' +'+itemLevel(item):'');
    const location=d?.heroId?'착용 중':remembered?'판매·전달되어 지금은 대장간에 없어요':elsewhere?(Object.values(state.towns).find(t=>t.inventory.includes(elsewhere))?.name||'다른 지점')+' 보관':Sim.isCustomerItemReserved(state,item.id)?'카운터 손님에게 전달 대기':isListed(item)?'진열 중':'창고 보관';
    const provenance=(r?'<span class="small-badge recipe-tier-badge recipe-tier-'+recipeTier(r)+'">제작 Lv. '+Sim.getRecipeLevel(r)+'</span>':'')+(item.heirloom?'<span class="small-badge heirloom-badge">보스 설계도 전용 장비</span>':'');
    const next=info.maxed?'<p>'+(item.recipeId==='starter'?'대장간에서 새 장비를 구매하면 강화할 수 있어요.':'장비의 힘을 끝까지 끌어냈어요.')+'</p>':'<div class="enhancement-stats"><span>강화석 <b>'+num(info.stones)+'개</b></span><span>이용료 <b>'+num(info.fee)+' G</b></span><span>성공 확률 <b>'+Math.round(info.successRate*100)+'%</b></span><span class="risk">파괴 확률 <b>'+Math.round(info.destructionRate*100)+'%</b></span></div><p>'+(activeTask?(activeTask.paid?'결제 완료 · 추가 골드와 강화석을 내지 않아요. ':'결제 대기 · 작업대에 도착하면 위 비용을 지불해요. ')+'접수한 조건으로 진행하며 실패하면 장비가 파괴됩니다.':'모험가의 강화석과 골드를 사용해요. 실패하면 이 장비가 파괴됩니다.')+'</p>';
    $('#modal-body').innerHTML='<div class="item-detail-hero"><div class="large-item-art">'+itemArt(r)+'</div><div><div class="item-grade-badges"><span class="quality-pill quality-'+escape(item.quality||'normal')+'">품질 · '+escape(quality(item).label||quality(item).name)+'</span>'+provenance+'</div><p>'+escape(slotNames[itemSlot(item)])+' · '+escape(location)+'</p><strong>'+num(item.price||r?.price||0)+' <small>G</small></strong></div></div><p class="modal-description">'+escape(r?.description||'모험의 시작을 함께한 장비입니다.')+'</p><div class="metrics-grid three-columns">'+metric('공격력','+'+num(stats.attack))+metric('방어력','+'+num(stats.defense))+metric('체력','+'+num(stats.hp||stats.maxHp))+'</div>'+itemOptions(item)+'<div class="item-durability"><span>내구도</span><b>'+Math.round(item.durability??100)+' / 100</b>'+'</div>'+enhancementGuideMarkup(item,hero)+(hero?'<div class="enhancement-note"><h3>'+icon('hammer')+' '+(item.recipeId==='starter'?'기본 장비는 강화할 수 없어요':info.maxed?'최대 강화 달성':activeTask?(hero.pendingEnhancement?'재개할 강화 +':'접수한 강화 +')+info.nextLevel:'다음 강화 +'+info.nextLevel)+'</h3>'+next+'</div><button class="secondary-button full-button" data-action="item-back">'+icon('arrow')+' 돌아가기</button>':here?itemStockActions(item):'');
    if(guideOpen&&$('#modal-body .enhancement-guide'))$('#modal-body .enhancement-guide').open=true;
  }
  function materialQuestCards() {
    // One row per request, left to right: material, name x amount, paid, adventurer, state/progress, action.
    // Newest first, at most 10 rows: every request still running, then the latest finished ones.
    const local=[...state.quests].filter(q=>!q.townId||q.townId===state.activeTownId).reverse(),running=local.filter(q=>q.status!=='completed');
    const shown=new Set(running.concat(local.filter(q=>q.status==='completed').slice(0,Math.max(0,10-running.length))));
    return local.filter(q=>shown.has(q)).map(q=>{
      const a=state.adventurers.find(x=>x.id===q.adventurerId),stateName={open:'수락 대기',active:'수집 중',completed:'납품 완료'}[q.status]||'진행 중';
      const progress=q.status==='active'?'<div class="mini-progress"><i style="width:'+pct(q.progress,q.amount)+'%"></i></div><small>'+num(Math.min(q.amount,q.progress||0))+' / '+num(q.amount)+'</small>':'';
      return '<article class="quest-row '+escape(q.status)+'"><span class="material-badge" data-tip="material" data-id="'+escape(q.material)+'">'+materialArt(q.material)+'</span><span class="qr-name">'+escape(DATA.materials[q.material].name)+' <b>×'+num(q.amount)+'</b></span><span class="qr-reward"><b>'+num(q.reward)+'</b> G</span><span class="qr-hero">'+(a?escape(a.name):'–')+'</span><span class="qr-state"><b>'+stateName+'</b>'+progress+'</span><span class="qr-action">'+(q.status==='open'?'<button class="text-button" data-action="cancel-quest" data-id="'+escape(q.id)+'">취소</button>':'')+'</span></article>';
    }).join('')||'<p class="quest-empty">아직 게시한 재료 의뢰가 없어요.</p>';
  }
  function questShell() {
    $('#modal-body').innerHTML='<div class="modal-tabs"><button class="'+(ui.questTab==='materials'?'active':'')+'" data-action="quest-tab" data-tab="materials">'+icon('leaf')+' 재료 의뢰</button><button class="'+(ui.questTab==='orders'?'active':'')+'" data-action="quest-tab" data-tab="orders">'+icon('sword')+' 제작 의뢰 <span>'+orders().length+'</span></button>'+(Sim.getQuestBook?'<button class="'+(ui.questTab==='growth'?'active':'')+'" data-action="quest-tab" data-tab="growth">'+icon('trophy')+' 성장 퀘스트'+((Sim.getQuestBook(state)||{}).ready?' <span>'+Sim.getQuestBook(state).ready+'</span>':'')+'</button>':'')+'</div><div id="quest-tab-content"></div>';
  }
  function renderMaterialQuests(force) {
    if(force||!$('#quest-form')){
      // One row per material: check it, set the amount, then one "의뢰 게시" posts every checked row at the fixed price.
      // Amounts are capped by warehouse room (stock + open requests may not pass the per-material capacity).
      const cap=Sim.getMaterialCapacity(state),d=ui.questDraft,rows=questMaterials().map(k=>{const row=d.rows[k],unit=Sim.getMaterialPrices(k).quest,room=Sim.getQuestRoom(state,k),full=room<1;
        if(full)row.checked=false;row.amount=clamp(row.amount,1,Math.max(1,room));
        return '<div class="qb-row'+(row.checked?' checked':'')+(full?' full':'')+'" data-material="'+k+'"><label class="qb-check"><input type="checkbox" data-quest-check="'+k+'"'+(row.checked?' checked':'')+(full?' disabled':'')+' aria-label="'+escape(DATA.materials[k].name)+' 의뢰"></label><span class="material-badge" data-tip="material" data-id="'+k+'">'+materialArt(k)+'</span><span class="qb-name">'+escape(DATA.materials[k].name)+'<small>보유 '+num(state.materials[k]||0)+' / '+num(cap)+'</small></span><span class="qb-amount"><button type="button" data-action="quest-step" data-material="'+k+'" data-amount="-10" aria-label="10개 줄이기"'+(full?' disabled':'')+'>−</button><input type="number" min="1" max="'+Math.max(1,room)+'" step="1" value="'+row.amount+'" data-quest-amount="'+k+'" aria-label="'+escape(DATA.materials[k].name)+' 수량"'+(full?' disabled':'')+'><button type="button" data-action="quest-step" data-material="'+k+'" data-amount="10" aria-label="10개 늘리기"'+(full?' disabled':'')+'>+</button></span><span class="qb-unit">개당 '+num(unit)+' G</span><b class="qb-total" data-quest-total="'+k+'"></b></div>';}).join('');
      $('#quest-tab-content').innerHTML='<form class="quest-form quest-board" id="quest-form"><div class="qb-list">'+rows+'</div><div class="quest-terms"><p id="quest-quote"></p><button class="primary-button" type="submit" id="quest-submit">'+icon('scroll')+' 의뢰 게시</button></div></form><h3 class="modal-section-title">'+icon('scroll')+' 재료 의뢰 내역 <small class="subtle">최근 10건</small> <span id="active-quest-number" class="subtle"></span></h3><div id="quest-list" class="quest-list"></div>';
      updateQuestDraft();
    }
    const local=state.quests.filter(q=>!q.townId||q.townId===state.activeTownId);
    updateRegion($('#quest-list'),materialQuestCards(),JSON.stringify(local));
    $('#active-quest-number').textContent=local.filter(q=>q.status!=='completed').length+'건 진행 중';
  }
  // Refresh the per-row totals, the checked summary and the post button without rebuilding the inputs.
  function updateQuestDraft() {
    if(!$('#quest-form'))return;
    const d=ui.questDraft;let count=0,total=0;
    for(const k of questMaterials()){
      const row=d.rows[k];row.amount=clamp(Math.floor(Number(row.amount)||1),1,Math.max(1,Math.min(10000,Sim.getQuestRoom(state,k))));
      const cost=Sim.getQuestQuote(k,row.amount),el=$('[data-quest-total="'+k+'"]');if(el)el.textContent=num(cost)+' G';
      const line=$('.qb-row[data-material="'+k+'"]');line?.classList.toggle('checked',row.checked);
      if(row.checked){count++;total+=cost;}
    }
    const open=state.quests.filter(q=>q.townId===state.activeTownId&&q.status!=='completed').length,room=Math.max(0,5-open);
    $('#quest-quote').innerHTML=count?'선택 <b>'+count+'건</b> · 의뢰비 <b>'+num(total)+' G</b>'+(count>room?' · <span class="warn">지금은 '+room+'건까지 게시할 수 있어요</span>':''):'의뢰할 재료를 체크하세요 · 진행 중 '+open+' / 5건';
    // Only "nothing checked" disables the button; any other problem is explained by the post result.
    $('#quest-submit').disabled=!count;
  }
  // Hover card for a material picture: name, fixed prices and where adventurers find it.
  function materialTipHtml(id){
    const m=DATA.materials[id];if(!m)return '';
    const sources=DATA.regions.filter(r=>r.loot[id]),townData=DATA.towns.find(t=>t.id===state.activeTownId);
    const local=sources.filter(r=>townData?.regionIds.includes(r.id)),shown=(local.length?local:sources).slice(0,3);
    const where=shown.length?(local.length?'':'<p class="tip-empty">이 마을 사냥터에는 없어요 · 다른 지점에서</p>')+shown.map(r=>'<div class="tip-row"><span>'+escape(r.name)+'</span><b>전투력 '+num(r.minPower)+'</b></div>').join(''):'<p class="tip-empty">'+(m.source==='invasion'?'마을 방어 보상':'보스 토벌 보상')+'</p>';
    const p=Sim.getMaterialPrices(id),prices=m.buyable===false?'':'<div class="tip-sep"></div><div class="tip-row"><span>재료 의뢰</span><b>'+num(p.quest)+' G</b></div><div class="tip-row"><span>자동 매입</span><b>'+num(p.auto)+' G</b></div><div class="tip-row"><span>직접 구매</span><b>'+num(p.direct)+' G</b></div>';
    return '<div class="tip-head"><b>'+escape(m.name)+'</b></div><small class="tip-sub">획득처</small>'+where+prices;
  }
  function renderOrders(force) {
    const list=orders(),town=getTown();
    if(ui.selectedOrder&&!list.some(q=>q.id===ui.selectedOrder)){ui.selectedOrder=null;ui.selectedOrderItem=null;}
    const selected=list.find(q=>q.id===ui.selectedOrder);
    const candidates=selected?Sim.getOrderCandidates(state,selected.id):[];
    if(ui.selectedOrderItem&&!candidates.some(i=>i.id===ui.selectedOrderItem))ui.selectedOrderItem=null;
    const sig=[JSON.stringify(list),town.inventory.map(i=>[i.id,i.quality,i.price,i.listed,i.locked].join(':')).join(','),town.queue.map(q=>q.orderId||'').join(','),ui.selectedOrder,ui.selectedOrderItem].join('|');
    if(force||ui.modalSignature!==sig){ui.modalSignature=sig;
      // Right side, three states: nothing picked → a hint; matching gear → one line per item (name, grade, options,
      // payout) to pick and hand over; no gear → make a new one now (handed over when done).
      const cards=list.length?list.map(q=>{const a=state.adventurers.find(a=>a.id===q.adventurerId);return '<button class="order-card '+(selected?.id===q.id?'selected':'')+'" data-action="select-order" data-id="'+escape(q.id)+'"><div class="order-item-art">'+itemArt(recipe(q.recipeId))+'</div><div><small>'+escape(a?.name||'모험가')+(q.heirloom?'의 희귀 설계도':'의 부탁')+'</small><h3>'+escape(recipe(q.recipeId)?.name||'장비')+'</h3><p>'+(q.heirloom?'보수 약 '+num(recipe(q.recipeId)?.price||q.escrow)+' G · 제작 '+(recipe(q.recipeId)?.craftDays||'')+'일</p><p hidden>':'')+'시세 +'+Math.round(q.basePremium*100)+'% · '+escape(DATA.qualities[q.bonusQuality]?.name||'우수')+' 이상 +'+Math.round(q.qualityBonus*100)+'%</p><span class="order-timer" data-order-time="'+escape(q.id)+'"></span></div>'+icon('arrow')+'</button>';}).join(''):'<p class="quest-empty">아직 들어온 제작 의뢰가 없어요. 보스를 잡아 희귀 설계도를 얻은 모험가가 전용 장비를 부탁하러 와요. 월드맵에서 보스 토벌을 보내 보세요.</p>';
      let side;
      if(!selected)side='<p class="quest-empty order-hint">왼쪽에서 제작 의뢰를 골라주세요.</p>';
      else if(candidates.length){
        const rows=candidates.map(item=>{const payout=Sim.getOrderPayout(state,selected.id,item.id),q=quality(item),opts=(item.options||[]).map(o=>({attack:'공격',defense:'방어',hp:'체력'}[o.stat]||o.stat)+' '+(o.value>0?'+':'')+num(o.value)).join(' · ');
          return '<button class="order-candidate order-line '+(item.id===ui.selectedOrderItem?'selected':'')+'" data-action="select-order-item" data-id="'+escape(item.id)+'" aria-pressed="'+(item.id===ui.selectedOrderItem)+'"><span class="choice-radio"></span>'+itemArt(recipe(item.recipeId))+'<b class="ol-name">'+escape(itemName(item))+(itemLevel(item)?' +'+itemLevel(item):'')+'<em class="order-where'+(item.listed?' listed':'')+'">'+(item.listed?'진열 중':'창고')+'</em></b><span class="ol-grade quality-'+escape(item.quality)+'">'+escape(q.label||q.name)+'</span><span class="ol-opts" title="'+escape(opts||itemStatsText(item))+'">'+escape(opts||itemStatsText(item))+'</span><strong class="ol-pay">'+num(payout)+' G</strong></button>';}).join('');
        side='<h3>납품할 장비를 골라주세요</h3><div class="order-candidates">'+rows+'</div><button class="primary-button" data-action="fulfill-order" data-id="'+escape(selected.id)+'"'+isDisabled(!ui.selectedOrderItem)+'>'+icon('check')+(ui.selectedOrderItem?' '+num(Sim.getOrderPayout(state,selected.id,ui.selectedOrderItem))+' G 받고 납품하기':' 장비를 골라주세요')+'</button>';
      }else if(selected.heirloom){
        // Boss rare recipe (v2): the shop supplies a huge amount of ordinary materials; the furnace works for days.
        const r=recipe(selected.recipeId),queued=town.queue.some(q=>q.orderId===selected.id),level=Sim.getRecipeLevel(r),skilled=town.staff.some(w=>w.role==='smith'&&w.craftLevel>=level);
        const lacking=Object.entries(r.cost).some(([k,n])=>(state.materials[k]||0)<n);
        side='<div class="order-heirloom">'+itemArt(r)+'<div><b>'+escape(r.name)+'</b><p>'+escape(state.adventurers.find(a=>a.id===selected.adventurerId)?.name||'모험가')+' 전용 장비 · 전투력 '+num(r.power)+' · 제작 '+(r.craftDays||'?')+'일 · 완성되면 바로 착용해요</p></div></div><div class="order-need">'+Object.entries(r.cost).map(([k,n])=>{const have=state.materials[k]||0,cap=Sim.getMaterialCapacity(state);
          // Rare pieces can need more of a material than the warehouse holds: say so instead of leaving the player waiting.
          return '<div class="on-row'+(have<n&&!queued?' short':'')+'"><span class="material-badge">'+materialArt(k)+'</span><b>'+escape(DATA.materials[k]?.name||k)+' '+num(n)+'개</b><small>'+(queued?'넣었어요':n>cap?'창고 한도 '+num(cap)+'개 · 창고 증축 필요':'창고 '+num(have)+'개'+(have<n?' · '+num(n-have)+'개 부족':''))+'</small></div>';}).join('')+'</div><div class="order-gain"><span>보수</span><b>약 '+num(r.price)+' G</b></div>'
          +(selected.reservedItemId?'<button class="secondary-button full-button order-craft-button" disabled>'+icon('check')+' 완성됐어요 · 모험가가 오면 바로 전달돼요</button>':queued?'<div class="order-progress" data-order-progress="'+escape(selected.id)+'"><div class="op-head">'+icon('hammer')+'<b class="op-label">제작 준비 중</b><span class="op-time"></span></div><div class="op-bar"><i></i></div><small>완성되면 바로 전달돼요</small></div>':'<button class="primary-button order-craft-button" data-action="order-make" data-id="'+escape(selected.id)+'"'+isDisabled(!skilled||lacking)+'>'+icon('hammer')+(!skilled?' 제작기술 Lv.'+level+' 직원이 필요해요':lacking?' 재료가 모자라요':' 전용 장비 제작하기 ('+(r.craftDays||'?')+'일)')+'</button>');
      }else{
        const queued=town.queue.some(q=>q.orderId===selected.id);
        const need=recipe(selected.recipeId)?.cost||{},rp=recipe(selected.recipeId)?.price||0,gain=Math.min(Math.round(rp*(1+selected.basePremium)),selected.escrow);side='<p class="quest-empty">창고와 진열대에 맞는 장비가 없어요.</p><div class="order-need">'+Object.entries(need).map(([k,n])=>{const have=state.materials[k]||0;return '<div class="on-row'+(have<n?' short':'')+'"><span class="material-badge" data-tip="material" data-id="'+k+'">'+materialArt(k)+'</span><b>'+escape(DATA.materials[k]?.name||k)+' '+num(n)+'개</b><small>(보유 중 '+num(have)+'개)</small></div>';}).join('')+'</div><div class="order-gain"><span>의뢰 완료 시 획득 골드 <small>일반 품질 기준</small></span><b>'+num(gain)+' G</b></div>'+(selected.reservedItemId?'<button class="secondary-button full-button order-craft-button" disabled>'+icon('check')+' 완성됐어요 · 모험가가 오면 바로 전달돼요</button>':queued?'<div class="order-progress" data-order-progress="'+escape(selected.id)+'"><div class="op-head">'+icon('hammer')+'<b class="op-label">제작 준비 중</b><span class="op-time"></span></div><div class="op-bar"><i></i></div><small>완성되면 바로 전달돼요</small></div>':'<button class="primary-button order-craft-button" data-action="order-make" data-id="'+escape(selected.id)+'">'+icon('hammer')+' 새로 제작해서 즉시 납품하기</button>');
      }
      // Matching gear under a storage lock (manual or the auto-keep rule) is held back: say so, and how to release it.
      const held=selected?town.inventory.filter(i=>i.recipeId===selected.recipeId&&i.locked&&i.id!==selected.reservedItemId).length:0;
      if(held)side+='<p class="order-held">'+icon('lock')+' 보관 잠금된 같은 장비 '+num(held)+'개는 납품하지 않아요. 창고에서 잠금을 풀면 납품할 수 있어요.</p>';
      $('#quest-tab-content').innerHTML='<div class="order-layout"><div class="order-list">'+cards+'</div><div class="order-selection'+(selected?'':' empty')+'">'+side+'</div></div>';
    }
    list.forEach(q=>{const el=$('[data-order-time="'+q.id+'"]');if(el){const left=Math.max(0,q.expiresAt-state.time),making=!!q.heirloom&&Object.values(state.towns).some(t=>t.queue.some(x=>x.orderId===q.id));
      // A piece already on the furnace is delivered when done even past the deadline, so do not show a countdown to 0.
      el.textContent=making?'화덕에서 만드는 중':'남은 시간 '+(left>=DATA.dayLength?Math.ceil(left/DATA.dayLength)+'일':secondsLabel(left));}});
    // Live craft gauge for a request being made: which furnace, how far along, time left (or why it is waiting).
    const prog=$('.order-progress');if(prog){const task=town.queue.find(q=>q.orderId===prog.dataset.orderProgress);
      if(task){const furnaces=town.facilities.filter(f=>f.type==='furnace'),f=furnaces.find(f=>f.id===task.facilityId),working=!!(f&&f.active&&f.taskId===task.id),pctDone=clamp(task.total?1-Number(task.remaining||0)/task.total:0,0,1);
        prog.querySelector('.op-label').textContent=working?'화덕 '+(furnaces.indexOf(f)+1)+'에서 제작 중':'제작 대기 중 · 대장장이가 화덕에 오면 시작해요';
        prog.querySelector('.op-time').textContent=working?'남은 시간 '+secondsLabel(task.remaining||0):'';
        prog.querySelector('.op-bar i').style.width=Math.round(pctDone*100)+'%';prog.classList.toggle('working',working);}}
  }
  function optionSummary(item) {return (item?.options||[]).map(o=>o.label+' '+({attack:'공격력',defense:'방어력',hp:'체력'}[o.stat]||o.stat)+' '+(o.value>0?'+':'')+o.value).join(' · ');}
  function itemOptions(item,compact=false) {
    const options=Array.isArray(item?.options)?item.options:[];
    if(!options.length)return compact?'':'<p class="supply-note">추가 옵션이 없는 장비예요.</p>';
    return '<div class="item-options '+(compact?'compact':'')+'">'+options.map(o=>'<span class="'+(o.value<0?'negative':'positive')+'">'+(compact?'':escape(o.label)+' · ')+escape(({attack:'공격력',defense:'방어력',hp:'체력'})[o.stat]||o.stat)+' <b>'+(o.value>0?'+':'')+num(o.value)+'</b></span>').join('')+'</div>';
  }
  function itemStatsText(item) {const s=Sim.getItemStats(item);return [['attack','공'],['defense','방'],['hp','체']].filter(([k])=>s[k]).map(([k,n])=>n+' '+num(s[k])).join(' · ')||'기본 장비';}
  function renderFacilities(force) {
    const town=getTown(),expansion=Sim.getExpansionCost(state);
    const sig=[town.id,town.level,town.width,town.height,state.gold,JSON.stringify(town.facilities),town.staff.map(s=>s.id+':'+s.status+':'+s.facilityId).join(',')].join('|');
    if(!force&&ui.modalSignature===sig)return;ui.modalSignature=sig;
    $('#modal-body').innerHTML='<div class="workshop-expansion"><div class="expansion-icon">'+icon('building')+'</div><div><span class="eyebrow">'+escape(town.name)+' · 대장간 Lv.'+town.level+'</span><h3>'+forgeLevelText(town.level)+'</h3><p>'+(expansion===null?'최고 단계 대장간이에요. 최고급 화덕까지 쓸 수 있어요.':'Lv.'+(town.level+1)+'로 확장하면 '+forgeLevelText(town.level+1)+'까지 쓸 수 있어요.')+'</p></div><button class="primary-button" data-action="expand"'+isDisabled(expansion===null||state.gold<costValue(expansion))+'>'+icon(expansion===null?'check':'coin')+(expansion===null?'최고 단계':num(costValue(expansion))+' G · 확장')+'</button></div><div class="build-grid">'+Object.entries(facilityInfo).map(([type,f])=>{const slot=Sim.getFreeFacilitySlot(state,type),cost=slot?costValue(Sim.getBuildCost(state,type)):null,def=DATA.facilityTypes[type],count=town.facilities.filter(x=>x.type===type).length;return '<article class="build-card"><div class="build-symbol '+type+'">'+icon(f.icon)+'</div><span class="small-badge">'+count+'개 운영 중</span><h3>'+f.name+'</h3><b class="facility-effect">'+f.detail+'</b><button class="primary-button" data-action="build" data-id="'+type+'"'+isDisabled(cost===null||state.gold<cost)+'>'+icon(cost===null?'check':'plus')+(cost===null?'설치 한도 도달':num(cost)+' G · 구매하기')+'</button></article>';}).join('')+warehouseBuildCard()+'</div>'+furnaceGradeSection(town);
  }
  // 2026-11: furnace grades are improved here (facility placement), not in the single-facility window.
  function furnaceGradeName(g){return ['','화덕','고급 화덕','최고급 화덕'][g]||'화덕';}
  function furnaceGradeSection(town){
    const furnaces=town.facilities.filter(f=>f.type==='furnace');
    // One short line per furnace: what its grade does (smiths working together = craft speed).
    return '<h3 class="modal-section-title">'+icon('flame')+' 화덕 등급</h3><div class="furnace-grade-list">'+furnaces.map((f,i)=>{const q=Sim.getFurnaceGradeQuote(state,f.id);
      const label=!q.next?'':town.level<q.requiredLevel?'대장간 Lv.'+q.requiredLevel+' 필요':f.taskId?'작업이 끝난 뒤 개선':num(q.cost)+' G · '+furnaceGradeName(q.next)+'으로';
      return '<div class="furnace-grade-row"><span class="facility-row-icon">'+icon('flame')+'</span><span><b>'+furnaceGradeName(q.grade)+' '+(i+1)+'</b><small>대장장이 최대 '+q.grade+'명이 함께 일해요 · 제작 속도 최대 ×'+q.grade+'</small></span>'+(q.next?'<button class="secondary-button" data-action="upgrade-furnace" data-id="'+escape(f.id)+'"'+isDisabled(!q.allowed)+'>'+label+'</button>':'<span class="small-badge">최고 등급</span>')+'</div>';}).join('')+'</div>';
  }
  function renderFacility(force) {
    const town=getTown(),f=town.facilities.find(f=>f.id===ui.modalData);if(!f){$('#modal-body').innerHTML=empty('시설을 찾지 못했어요','시설 목록에서 다시 골라주세요.');return;}
    const meta=facilityInfo[f.type],st=stationState(f,town),quote=f.type==='furnace'?Sim.getFurnaceGradeQuote(state,f.id):null,workers=f.type==='furnace'?Sim.getFurnaceWorkers(state,town.id,f.id).length:0;
    const sig=[f.id,f.active,f.taskId,f.staffId,f.grade,state.gold,town.level,workers,st.worker?.status].join(':');
    if(!force&&ui.modalSignature===sig)return;ui.modalSignature=sig;$('#modal-title').textContent=meta.name+' 살펴보기';
    const gradeNames=['','일반','고급','최고급'];
    const detail=f.type==='furnace'?'<div class="facility-detail-note"><h3>'+furnaceGradeName(quote.grade)+' · 작업 '+workers+' / '+quote.grade+'명</h3><p>'+escape(st.label)+' · 대기열 '+st.tasks.length+' / 3칸</p></div>'+(quote.next?'<p class="supply-note">등급 개선(고급·최고급 화덕)은 시설 배치 창에서 해요.</p><button class="secondary-button full-button" data-action="nav" data-tab="upgrades">시설 배치로 가기</button>':'<p class="supply-note">최고 등급</p>')+'<button class="secondary-button full-button" data-action="nav" data-tab="staff">직원 배정</button>':f.type==='enhance'?'<div class="facility-detail-note"><h3>모험가 자동 강화</h3><p>강화 실패 시 해당 장비가 파괴됩니다.</p></div>':'<div class="facility-detail-note"><h3>진열 공간 +6칸</h3></div>';
    $('#modal-body').innerHTML='<div class="facility-detail-symbol '+f.type+'">'+facilityPicture(f.type,meta.icon)+'</div><div class="metrics-grid three-columns">'+metric('공간',f.w+' × '+f.h)+metric('위치',f.x+', '+f.y)+metric('상태',f.active?'가동 중':'대기 중')+'</div>'+detail;
  }
  function renderStaff(force) {
    const town=getTown();
    if(force||!$('#staff-list'))$('#modal-body').innerHTML='<div class="staff-toolbar"><strong>직원 <span id="staff-total"></span></strong></div><div class="staff-grid" id="staff-list"></div><h3 class="modal-section-title">직원 채용</h3><div id="recruitment-board-status"></div><div class="candidate-grid" id="staff-candidates"></div><h3 class="modal-section-title">'+icon('star')+' 방문 인재 <small class="subtle" id="staff-visitors-fame"></small></h3><div class="candidate-grid" id="staff-visitors"></div>';
    // Visiting talent (drawn by fame) listed right here, in the same rows as the applicants.
    {const fame=Sim.getFame(state),offers=Sim.getRecruitOffers(state);$('#staff-visitors-fame').textContent='명성 '+fame.rankName+' · '+num(fame.value);
      updateRegion($('#staff-visitors'),offers.length?offers.map(o=>{const trait=Sim.getPersonality(o),role=staffRoles[o.role]?.name||'직원';return '<article class="staff-hire-card hire-row">'+staffPortrait(o,88)+'<span class="roster-rank grade-'+escape(o.potentialGrade||'C')+'" title="잠재 등급">'+escape(o.potentialGrade||'C')+'</span><span class="qb-name staff-name">'+escape(o.name)+'<small>'+(o.kind==='apprentice'?'방문 견습생':'방문 장인')+' · '+escape(role)+' 담당 · '+secondsLabel(o.expiresAt-state.time)+' 후 떠남</small></span>'+(trait?'<span class="trait-tag trait-'+escape(trait.id)+'" data-tip="'+escape(trait.staffDescription)+'">'+escape(trait.prefix)+'</span>':'<span></span>')+'<span class="hire-stats"><span>손놀림 <b>'+num(o.dexterity)+'</b></span><span>언변 <b>'+num(o.eloquence)+'</b></span><span>체력 <b>'+num(o.maxStamina)+'</b></span></span><span class="hire-wage">월급 <b>'+num(o.salary)+' G</b></span><button class="secondary-button" data-action="hire-recruit" data-id="'+escape(o.id)+'"'+isDisabled(state.gold<o.cost||town.staff.length>=30)+'>'+(town.staff.length>=30?'정원 도달':num(o.cost)+' G · 고용')+'</button></article>';}).join(''):'<p class="quest-empty">우수·명품 장비와 보스 토벌로 명성을 쌓으면 특별한 인재가 찾아와요.</p>',[town.id,state.gold,town.staff.length,fame.value,...offers.map(o=>o.id+':'+Math.ceil((o.expiresAt-state.time)/10))].join('|'));}
    $('#staff-total').textContent=town.staff.length+' / 30명';
    const sig=town.staff.map(s=>[s.id,s.name,s.role,s.craftLevel,s.salesLevel,s.dexterity,Math.floor(s.eloquence),s.status,s.assignedFacilityId,s.salaryDebt,s.trainingId].join(':')).join('|')+town.facilities.map(f=>f.id).join(',');
    if(force||!$('#staff-list').contains(document.activeElement)||document.activeElement?.tagName!=='SELECT')updateRegion($('#staff-list'),town.staff.map(w=>{const trait=Sim.getPersonality(w);return '<article class="staff-card" id="staff-card-'+escape(w.id)+'"><div class="staff-card-top">'+staffPortrait(w)+'<span class="roster-rank grade-'+escape(w.potentialGrade||'C')+'" title="잠재 등급">'+escape(w.potentialGrade||'C')+'</span><div><h3 class="staff-name" title="'+escape(trait?.staffDescription||'')+'">'+escape(w.name)+'</h3><small class="staff-state '+(w.salaryDebt?'debt':'')+'">'+escape(staffWorkLabel(w))+'</small></div></div><div class="staff-level" title="'+(w.role==='sales'?'판매':'제작')+' 경험치"><b>'+(w.role==='sales'?'판매':'제작')+' Lv. '+(w.role==='sales'?(w.salesLevel||1):w.craftLevel)+'</b><small data-craft-xp-value="'+escape(w.id)+'"></small></div><div class="staff-skills"><span title="손놀림">손놀림 <b>'+num(w.dexterity)+'</b></span><span title="언변">언변 <b>'+num(w.eloquence)+'</b></span><span title="월급">'+num(w.salary||0)+' G</span></div><div class="staff-stamina">체력 <b data-stamina-value="'+escape(w.id)+'"></b></div><div class="staff-assignment"><label><span>역할</span><select data-staff-role="'+escape(w.id)+'" aria-label="'+escape(w.name)+' 역할"'+isDisabled(!!w.trainingId)+'>'+staffRoleOptions(w)+'</select></label><label><span>작업 장소</span><select data-staff-facility="'+escape(w.id)+'" aria-label="'+escape(w.name)+' 작업 장소"'+isDisabled(!!w.trainingId)+'><option value="">자동 배정</option>'+town.facilities.filter(f=>f.type===staffRoles[w.role]?.facility).map((f,i)=>'<option value="'+escape(f.id)+'"'+(w.assignedFacilityId===f.id?' selected':'')+'>'+facilityInfo[f.type].name+' '+(i+1)+'</option>').join('')+'</select></label></div><div class="staff-training-link"><button class="secondary-button" data-action="training" data-id="'+escape(w.id)+'">'+(w.trainingId?'훈련 중':'훈련')+'</button><small data-training-time="'+escape(w.id)+'"></small></div>'+(w.salaryDebt?'<div class="salary-due">미지급 '+num(w.salaryDebt)+' G <button data-action="pay-wages" data-id="'+escape(w.id)+'"'+isDisabled(state.gold<w.salaryDebt)+'>지급</button></div>':'')+'</article>';}).join('')||empty('직원이 없습니다','아래에서 직원을 고용하세요.','people'),sig);
    town.staff.forEach(w=>{const value=$('[data-stamina-value="'+w.id+'"]'),bar=$('[data-stamina-bar="'+w.id+'"]'),xp=$('[data-craft-xp-value="'+w.id+'"]'),xpBar=$('[data-craft-xp-bar="'+w.id+'"]'),level=w.role==='sales'?(w.salesLevel||1):w.craftLevel,points=w.role==='sales'?(w.salesXp||0):w.craftXp,need=Sim.getCraftXpNeeded(level);if(value)value.textContent=Math.round(w.stamina)+' / '+w.maxStamina;if(bar)bar.style.width=pct(w.stamina,w.maxStamina)+'%';if(xp)xp.textContent=level>=30?'최고 숙련도':num(points)+' / '+num(need)+' 경험치';if(xpBar)xpBar.style.width=(level>=30?100:pct(points,need))+'%';});
    town.staff.forEach(w=>{const el=$('[data-training-time="'+w.id+'"]'),task=Sim.getTraining?.(state,w.id);if(el)el.textContent=task?secondsLabel(task.remaining)+' 남음':'';});
    const board=Sim.getRecruitmentBoard(state,town.id,Date.now());
    const candidates=board?.candidates||[];
    const nowMs=Date.now(),remaining=board?.refreshInMs??600000,adCost=board?.premium?.cost??600,adWait=board?.premium?.cooldownRemainingMs||0;
    updateRegion($('#recruitment-board-status'),'<div class="recruitment-toolbar"><div><b>다음 후보 갱신 <span id="recruitment-countdown"></span></b></div><button class="primary-button" data-action="recruitment-ad"'+isDisabled(!board||!board.premium?.canPost)+'>'+icon('scroll')+'고급 모집공고 · '+num(adCost)+' G</button></div><p class="operation-note">지원자 3명 추가 · 경력자 확률 20% · 실제 10분 유지.<span id="recruitment-ad-note"></span></p>',[town.id,adCost,state.gold>=adCost,adWait>0,candidates.length>9,board?.premium?.canPost].join(':'));
    $('#recruitment-countdown').textContent=realSecondsLabel(remaining/1000);
    $('#recruitment-ad-note').textContent=adWait>0?' 다음 공고까지 '+realSecondsLabel(adWait/1000)+'.':'';
    // One line per applicant: portrait · name/grade/role · trait (hover for what it does) · skills · wage · hire.
    updateRegion($('#staff-candidates'),candidates.length?candidates.map(c=>{const cost=c.cost,trait=Sim.getPersonality(c),role=staffRoles[c.role]?.name||'직원';return '<article class="staff-hire-card hire-row">'+staffPortrait({...c,candidateId:c.candidateId||c.templateId},88)+'<span class="roster-rank grade-'+escape(c.potentialGrade||'C')+'" title="잠재 등급">'+escape(c.potentialGrade||'C')+'</span><span class="qb-name staff-name">'+escape(c.name)+'<small>'+escape(role)+' 담당'+(c.role==='smith'?' · 제작 Lv.1':'')+'</small></span>'+(trait?'<span class="trait-tag trait-'+escape(trait.id)+'" data-tip="'+escape(trait.staffDescription)+'">'+escape(trait.prefix)+'</span>':'<span></span>')+'<span class="hire-stats"><span>손놀림 <b>'+num(c.dexterity)+'</b></span><span>언변 <b>'+num(c.eloquence)+'</b></span><span>체력 <b>'+num(c.stamina??c.maxStamina)+'</b></span></span><span class="hire-wage">월급 <b>'+num(c.salary)+' G</b></span><button class="secondary-button" data-action="hire-candidate" data-id="'+escape(c.id)+'"'+isDisabled(town.staff.length>=30||state.gold<cost)+'>'+(town.staff.length>=30?'정원 도달':num(cost)+' G · 고용')+'</button></article>';}).join(''):empty('다음 지원자를 기다리고 있어요','갱신 때 새 지원자를 만나거나 고급 모집공고를 낼 수 있어요.','people'),[town.id,state.gold,town.staff.length,...candidates.map(c=>c.id)].join(':'));
    for(const c of candidates){const expiry=$('[data-candidate-expiry="'+c.id+'"]');if(expiry)expiry.textContent=(c.source==='premium'?'고급 공고 지원 · ':'일반 지원 · ')+realSecondsLabel(c.remainingMs/1000)+' 후 마감';}
  }
  function renderInn(force) {
    const town=getTown(),cap=Sim.getInnCapacity(state),people=residents(),cost=Sim.getInnUpgradeCost(state),resting=people.filter(a=>a.status==='resting'),injured=people.filter(a=>a.injuryUntil>state.time);
    const averageFatigue=resting.length?Math.round(resting.reduce((n,a)=>n+a.fatigue,0)/resting.length):0;
    const sig=[town.id,cap,cost,state.gold,people.length,resting.length,injured.length,averageFatigue].join(':');
    if(force||ui.modalSignature!==sig){ui.modalSignature=sig;
      $('#modal-body').innerHTML='<div class="inn-banner"><span class="inn-sign">'+icon('bed')+'</span><div><span class="eyebrow">'+escape(town.name)+' · 여관 Lv.'+town.innLevel+'</span><h3>모험가들의 편안한 쉼터</h3><p>새 모험가를 맞이할 자리 '+Math.max(0,cap-people.length)+'명</p></div></div><div class="metrics-grid three-columns">'+metric('수용 인원',people.length+' / '+cap,'명','people')+metric('휴식 중',resting.length,'명','bed')+metric('부상 회복 중',injured.length,'명','heart')+'</div>'+(people.length>cap?'<p class="inn-overflow">기존 주민 '+people.length+'명은 유지됩니다. 정원에 여유가 생기면 새 주민이 정착합니다.</p>':'')+'<p class="inn-recovery-summary">'+(resting.length?'휴식 중인 모험가의 평균 피로 '+averageFatigue+'%':'지금은 모두 모험과 마을 생활을 하고 있어요.')+'</p><div class="inn-upgrade"><div><b>'+(cost===null?'여관이 최대 규모에 도달했어요':'더 많은 모험가를 맞이할까요?')+'</b><p>'+(cost===null?'최대 40명의 정착을 지원합니다.':'수용 인원 '+cap+' → '+(cap+8)+'명')+'</p></div><button class="primary-button" data-action="upgrade-inn"'+isDisabled(cost===null||state.gold<costValue(cost))+'>'+icon(cost===null?'check':'coin')+(cost===null?'최대 규모':num(costValue(cost))+' G · 여관 확장')+'</button></div>'+'<div id="inn-invasion-summary">'+(injured.length?'<div class="injury-note">'+icon('heart')+'<div><b>부상자 '+injured.length+'명이 회복을 기다리고 있어요.</b><p>구호 지원을 하면 남은 요양 시간을 줄일 수 있어요.</p></div><button class="secondary-button" data-action="invasion">구호 살펴보기</button></div>':'')+'</div><button class="secondary-button full-button" data-action="nav" data-tab="adventurers">'+icon('people')+'모험가 정보 보기</button>';
    }
  }
  function renderTown(force) {
    const id=ui.modalData,t=townCatalog().find(t=>t.id===id);if(!t){$('#modal-body').innerHTML=empty('이 마을을 찾지 못했어요','월드맵을 다시 열어주세요.','map');return;}
    const req=Sim.getBranchRequirements(state,id),owned=state.towns[id];
    const sig=[id,req.opened,req.ok,state.gold,state.reputation,req.currentLevel,owned?.level,owned?.staff.length,owned?.queue.length,owned?.inventory.length].join(':');if(!force&&ui.modalSignature===sig)return;ui.modalSignature=sig;
    $('#modal-title').textContent=t.name;
    $('#modal-body').innerHTML='<div class="town-illustration">'+icon(owned?'shop':'map')+'<span>'+(owned?'작은 불꽃의 또 다른 집':'새로운 이야기가 기다려요')+'</span></div><p class="modal-description">'+escape(t.subtitle||'다른 마을에 새 대장간을 열고 모험가들을 만나보세요.')+'</p>'+(owned?'<div class="metrics-grid three-columns">'+metric('대장간',owned.level,'단계')+metric('직원',owned.staff.length,'명')+metric('진열 장비',Sim.getDisplayedItems(state,owned.id).length,'개')+'</div><button class="primary-button" data-action="enter-town" data-id="'+escape(id)+'">'+icon('shop')+(id===state.activeTownId?'우리 대장간으로 돌아가기':'이 지점으로 이동하기')+'</button>':'<div class="branch-requirements">'+resourceRequirement('개점 자금',state.gold,req.cost)+resourceRequirement('대장간 단계',req.currentLevel,req.requiredLevel)+resourceRequirement('대장간 명성',state.reputation,req.requiredReputation)+(req.migrationRequired?resourceRequirement('이주 준비 모험가 · 전투력 '+num(req.migrationPower)+' 이상',Math.min(req.migrationReady,req.migrationRequired),req.migrationRequired):'')+'</div><p class="supply-note">개점 비용에는 기본 화덕·진열대·강화 작업대와 직원, 작은 여관이 포함돼요. 새 마을의 주민은 앞 마을에서 실력을 쌓은 모험가들이 이주해 와요. 열고 나면 강해진 모험가를 보낼지 물어보니, 보낼 사람을 골라 주세요(보낸 모험가는 앞 마을 보스·파견 후보에서 빠져요).'+(t.upkeep?' 개점 후 매달 지점 유지비 '+num(t.upkeep)+' G가 월급과 함께 나가요.':'')+'</p><button class="primary-button" data-action="open-branch" data-id="'+escape(id)+'"'+isDisabled(!req.ok)+'>'+icon('flame')+num(req.cost)+' G · 새 지점 열기</button>')+'<button class="secondary-button full-button" data-action="focus-town" data-id="'+escape(id)+'">'+icon('map')+' 주변 지도 살펴보기 · 권장 Lv. '+townLevelLabel(t)+'</button>';
  }
  // 이주 (2026-11-10 사용자): heroes strong enough for the next town are listed together; the player ticks whom to
  // send (all who can go are ticked at first) and sends them at once. Busy heroes show why they must wait.
  function renderMigration(force){
    const list=Sim.getMigrationCandidates?Sim.getMigrationCandidates(state):[];
    if(!ui.migPick){ui.migPick=new Set();ui.migSeen=new Set();}
    // Heroes who can go are ticked the first time they show up (also when one becomes free while the window is open).
    for(const c of list)if(!c.block&&!ui.migSeen.has(c.id)){ui.migSeen.add(c.id);ui.migPick.add(c.id);}
    for(const id of [...ui.migPick])if(!list.some(c=>c.id===id&&!c.block))ui.migPick.delete(id);
    const sig=['mig',list.map(c=>c.id+':'+c.block+':'+c.power).join(','),[...ui.migPick].join(',')].join('|');if(!force&&ui.modalSignature===sig)return;ui.modalSignature=sig;
    if(!list.length){$('#modal-body').innerHTML=empty('지금 옮겨 갈 모험가가 없어요','모험가가 다음 마을로 갈 만큼 강해지면 여기서 물어볼게요.','people');return;}
    const free=list.filter(c=>!c.block),all=free.length&&free.every(c=>ui.migPick.has(c.id));
    const rows=list.map(c=>{const a=state.adventurers.find(x=>x.id===c.id),on=ui.migPick.has(c.id);
      return '<button type="button" class="mig-row'+(c.block?' busy':'')+(on?' on':'')+'" data-action="mig-pick" data-id="'+escape(c.id)+'"'+isDisabled(!!c.block)+' aria-pressed="'+on+'"><span class="choice-check">'+(on?icon('check'):'')+'</span>'+(a?portrait(a,0,36):'')+'<span class="mig-name"><b>'+escape(c.name)+'</b><small>Lv.'+c.level+' · 전투력 '+num(c.power)+'</small></span><span class="mig-route">'+escape(c.fromName)+' '+icon('arrow')+' '+escape(c.toName)+(c.block?'<small>'+escape(c.block)+'</small>':'')+'</span></button>';}).join('');
    $('#modal-body').innerHTML='<p class="modal-description">이 모험가들이 다음 마을로 갈 만큼 강해졌어요. 보낼 모험가를 고르세요. 안 보낸 모험가는 지금 마을에 남아 계속 일해요.</p>'
      +'<div class="mig-head"><button type="button" class="text-button" data-action="mig-all"'+isDisabled(!free.length)+'>'+(all?'모두 빼기':'모두 고르기')+'</button><small>'+ui.migPick.size+' / '+list.length+'명 고름</small></div>'
      +'<div class="mig-list">'+rows+'</div>'
      +'<div class="ip-actions mig-actions"><button type="button" class="secondary-button" data-action="close">나중에</button><button type="button" class="primary-button" data-action="mig-send"'+isDisabled(!ui.migPick.size)+'>'+icon('arrow')+' '+ui.migPick.size+'명 보내기</button></div>';
    portraits($('#modal-body'));
  }
  function renderHelp() {
    $('#modal-body').innerHTML='<div class="help-intro">'+staffPortrait({id:'guide-smith',candidateId:'smith',name:'대장장이'},90)+'<div><h3>우리의 장비로, 더 먼 모험을.</h3><p>작은 불꽃을 하나씩 늘려보세요.<br>함께 일하고, 함께 쉬며 마을이 자랍니다.</p></div></div><div class="help-steps">'+[
      ['화덕과 직원이 함께 장비를 만들어요','설계도를 골라 제작을 예약하세요. 제조 직원이 화덕 앞에 도착해야 시간이 흐릅니다. 화덕마다 대기열이 3칸 생기고, 직원은 체력이 떨어지면 쉬어요.'],
      ['대장간 레벨을 올려 시설을 늘려요','시설 배치에서 화덕은 뒤편 작업실에, 진열대와 강화 작업대는 매장에 놓으세요. 직원은 계산대 뒤 문으로 작업실과 창고를 드나듭니다. 시설은 정해진 자리에 놓이고, 대장간을 확장하면 레벨에 따라 놓을 수 있는 시설 수가 늘어나요. 제조 직원이 10·20레벨에 도달하면 중급·고급 설계도가 열려요.'],
      ['진열과 강화로 수익을 얻어요','완성품은 창고에서 직접 골라 진열하세요. 잠금한 장비는 자동 판매와 전체 진열에서 제외됩니다. 진열대 하나에 장비 6개를 놓을 수 있어요. 모험가는 필요한 슬롯의 장비를 구매하고, 사냥에서 얻은 강화석으로 직접 강화합니다. 강화 수수료는 수입이 되고 실패하면 해당 장비가 파괴돼요.'],
      ['자동 운영으로 반복 업무를 맡겨요','자동 운영에서 재료별 목표 재고와 반복 제작할 설계도를 설정하세요. 제작 목표 0은 연속 생산입니다. 매입·운반 직원을 배정하면 재료 거래와 진열을 처리하며, 지정 품질 이상은 잠가 보관합니다. 강화 보조·여관 관리 직원은 현장에서 작업과 회복을 도와요.'],
      ['창고가 커지면 운영 규모도 커져요','창고 관리에서 지점의 보관 공간을 확장하세요. 장비는 창고·제작 예약·축제 반환 예약 공간을 사용하며 진열하면 자리가 비워집니다. 재료는 품목마다 정해진 수량까지 매입해요. 여러 지점의 재료 창고 용량은 합산됩니다.'],
      ['두 가지 의뢰를 활용하세요','재료 의뢰는 재료를 체크하고 수량을 정한 뒤 한 번에 게시합니다. 값은 재료마다 정해져 있어요. 제작 의뢰는 희귀 설계도를 가진 모험가가 맡기는 전용 장비예요.'],
      ['여관에서 다음 모험을 준비해요','패배하거나 지친 모험가는 침대 말풍선을 띄우고 여관에 돌아옵니다. 방이 부족하면 마을에 머물지 못해요. 여관 확장으로 새 모험가가 정착할 공간을 마련하세요.'],
      ['다른 마을에 작은 불꽃을 전해요','월드맵에서 다섯 마을을 살펴보고 개점 조건과 주변 사냥터를 확인하세요. 위쪽 지점 버튼이나 [·], Alt+1–5로 빠르게 이동합니다. 골드와 재료는 모든 지점이 함께 사용해요. 새 지점을 열면 앞 마을에서 충분히 강해진 모험가를 보낼지 물어봐요. 목록에서 보낼 모험가를 골라 [보내기]를 누르세요(소식 줄 [이주]). 보스 토벌·돌발 파견 중이거나 전용 장비를 기다리는 모험가는 일을 마친 뒤 보낼 수 있어요.'],
      ['달력을 보고 월급과 축제를 준비해요','매달 첫날 직원의 월급을 지급합니다. 미지급 급여가 생기면 직원은 쉬며 기다려요. 매년 봄 10–14일에는 장비를 직접 골라 최대 3점 출품하고, 15일에 최고 점수 작품의 상금을 받습니다.'],
      ['모험가를 골라 보스를 토벌해요','보스에는 모험가가 저절로 가지 않아요. 월드맵에서 보스를 눌러 파티를 골라 보내세요. 이기면 가끔 한 명이 희귀 설계도를 얻어 전용 장비를 맡기러 와요. 제작 장비에는 좋은 옵션과 나쁜 옵션이 무작위로 붙습니다.'],
      ['명성을 쌓고 새로운 인재를 만나요','우수 이상 품질의 장비와 보스 토벌은 대장간의 명성을 높여요. 명성 메뉴에서 방문 장인과 견습생의 고용비·월급을 확인하세요. 직원 관리에서 제작기술 훈련도 진행할 수 있습니다.'],
      ['침공을 막고 마을의 회복을 도와요','침공이 시작되면 그 마을의 모험가 전원이 귀환하고, 모두 도착해야 방어전이 시작됩니다. 부상자는 여관에서 요양하며 장비 구매와 강화를 쉬어요. 플레이어는 특별 재료를 받고 구호금을 지원할 수 있습니다.'],
      ['세계와 첫 두 시간의 길을 살펴봐요','다섯 마을마다 사냥터 열 곳, 총 50곳이 Lv.1–300으로 이어집니다. 보스 표식을 누르면 토벌 상황과 재출현 타이머를 볼 수 있어요. 아직 지점이 없는 마을도 확대하고 살펴볼 수 있어요. 대장간 화면의 접기형 길잡이는 1배속 기준 목표 경로이며 정해진 시간에 달성해야 하는 과제는 아닙니다.']
    ].map(([title,text],i)=>'<div class="help-step"><span>'+(i+1)+'</span><div><h3>'+title+'</h3><p>'+text+'</p></div></div>').join('')+'</div><div class="keyboard-hints"><kbd>Space</kbd> 일시정지 <kbd>1</kbd><kbd>2</kbd><kbd>4</kbd> 속도 <kbd>Esc</kbd> 닫기·배치 취소<br><br><kbd>[</kbd><kbd>]</kbd> 운영 지점 순환 · <kbd>Alt</kbd>+<kbd>1–5</kbd> 지점 바로가기<br><br>빈 바닥 드래그·방향키로 화면 이동, 휠과 +/− 버튼으로 확대·축소합니다.<br>5초마다 이 브라우저에 자동 저장됩니다. 다른 탭으로 이동하거나 게임을 닫으면 시간은 멈춥니다.</div>';portraits($('#modal-body'));
  }
  // Help (환경설정 › 도움말): one short card per system, opened one at a time.
  const HELP_TOPICS=[
    ['hammer','장비 만들기','작업대 [장비 제작]에서 장비를 누르면 왼쪽에 제작 창이 떠요. 재료가 있으면 [만들기]로 화덕에 예약하고, 제조 직원이 화덕 앞에 서면 만들기 시작해요. 직원의 제작기술이 높을수록 더 좋은 품질이 나와요.'],
    ['shelf','진열과 판매','완성된 장비는 창고에 보관돼요. [장비 보관]에서 진열하면 판매 직원이 카운터에서 모험가에게 팔아요. 잠금을 걸면 팔지 않고 보관해요. 모험가는 지금 낀 장비보다 좋고 가진 돈으로 살 수 있는 장비만 사요. 모험가 창에서 장비와 지갑을 보고 그보다 한 단계 좋은 장비를 만들어 두면 잘 팔리고, 모험가도 빨리 강해져요.'],
    ['scroll','제작 의뢰','보스를 잡고 희귀 설계도를 얻은 모험가만 제작 의뢰를 해요(실습 미션의 첫 의뢰는 예외). 대장간이 재료를 대서 며칠에 걸쳐 전용 장비를 만들어 주면 큰 보수와 명성을 받아요. 30일이 지나면 사라져요.'],
    ['box','재료','재료 창고에서 사거나, 의뢰소에서 모험가에게 재료 의뢰를 맡기거나, [모으기]로 직접 모아요. 매입 직원이 있으면 자동 매입도 할 수 있어요.'],
    ['people','직원','직원 관리에서 제조·판매·매입·운반·강화 보조 직원을 뽑아요. 매달 1일에 월급이 나가요. 지친 직원은 쉬었다가 다시 일해요.'],
    ['sword','모험가와 사냥','모험가는 사냥을 다녀와 돈과 강화석을 모으고, 대장간에서 장비를 사서 강해져요. 강해진 모험가는 다음 마을로 이주해요.'],
    ['gem','강화','모험가가 자기 강화석과 골드로 강화 작업대에서 장비를 강화해요. 실패하면 장비가 부서질 수 있어요.'],
    ['shield','보스와 희귀 설계도','보스에는 모험가가 저절로 가지 않아요. 월드맵에서 보스를 눌러 필요 전투력과 드랍품을 보고, 모험가를 골라 파티를 꾸려 파견하세요. 이기면 12% 확률로(8번째 승리에는 반드시) 한 명이 희귀 설계도를 얻어요. 그 모험가가 의뢰소에 전용 장비를 맡기면, 대장간이 재료를 대서 며칠에 걸쳐 만들어 줘요. 재료가 아주 많이 드니 창고를 넓혀 두세요.'],
    ['flame','돌발 사건','가끔 손님, 사고, 시세 같은 사건이 생기면 왼쪽 위 달력 아래에 [돌발] 이름 [남은 시간] 줄로 나와요. 누르면 가운데 창에 선택지와 "그냥 두면" 생기는 일이 보여요. 급한 것은 30초 안에 골라야 하고, 그냥 두면 대개 손해를 봐요. 납품 사건은 창에서 바로 [만들기]를 누르면 완성되는 대로 납품돼요. 파견 사건은 바쁜 모험가도 골라 둘 수 있고, 모두 일을 마치면 함께 출발해요.'],
    ['star','효과 아이콘','사건으로 생긴 효과는 달력 오른쪽에 동그란 아이콘으로 보여요. 윗줄은 좋은 효과(초록), 아랫줄은 나쁜 효과(빨강)예요. 아이콘을 누르거나 마우스를 올리면 무슨 효과인지와 남은 기간이 나와요.'],
    ['trophy','성장 퀘스트','게임 끝까지 이어지는 목표예요. 왼쪽 [퀘스트] 줄이나 의뢰소 › 성장 퀘스트 탭에서 보고, 끝내면 [완료]가 붙어요. 탭에서 보상(골드·재료)을 받아요. 한 장을 다 끝내면 장 보상도 있어요.'],
    ['heart','마을 방어','가끔 몬스터가 마을을 습격해요. 마을 모험가들이 모여 싸우고, 끝나면 다친 모험가는 여관에서 쉬어요.'],
    ['calendar','계절 행사와 축제','한 해는 봄·여름·가을·겨울이에요. 계절마다 행사가 열리고, 봄에는 장비 축제에 장비를 출품해 상금을 받을 수 있어요. 달력에서 날짜를 확인하세요.'],
    ['map','새 지점 열기','월드맵에서 다음 마을을 누르면 개점 조건이 보여요. 대장간 단계·명성·자금·이주할 모험가 조건을 채우면 새 지점을 열 수 있어요. 열고 나면 앞 마을에서 충분히 강해진 모험가를 보낼지 물어봐요. 목록에서 보낼 모험가를 골라 [보내기]를 누르세요. 보스 토벌·돌발 파견 중이거나 전용 장비를 기다리는 모험가는 일을 마친 뒤 보낼 수 있어요.'],
    ['book','연구소','2호점을 열면 골드 버튼 › 연구소가 열려요. 골드를 써서 모든 지점에 적용되는 연구를 올려요.'],
    ['trophy','업적','특별한 일을 해내면 업적이 쌓이고 일부는 칭호를 줘요. 새 게임을 시작해도 남아요.']
  ];
  // All topics fit on one screen: a grid of topic buttons, the picked one's explanation below (no scrolling).
  function helpMarkup(){
    const pick=Math.min(HELP_TOPICS.length-1,Math.max(0,ui.helpTopic||0)),[ic,title,body]=HELP_TOPICS[pick];
    return '<div class="help-grid">'+HELP_TOPICS.map(([ic,title],i)=>'<button type="button" class="help-chip'+(i===pick?' active':'')+'" data-action="help-topic" data-id="'+i+'">'+icon(ic)+'<span>'+escape(title)+'</span></button>').join('')+'</div>'
      +'<div class="help-card">'+icon(ic)+'<div><h3>'+escape(title)+'</h3><p>'+escape(body)+'</p></div></div>'
      +(typeof startTutorial==='function'?'<button class="secondary-button full-button" data-action="tutorial-restart">'+icon('book')+' 튜토리얼 다시 보기</button>':'');
  }
  function renderSettings() {
    const info=saveStore.info(),backups=saveStore.listBackups(),hasOriginal=saveStore.exportOriginal()!==null;
    // A save problem opens straight onto the save tab (recovery and backups live there).
    const tab=ui.settingsTab||(saveBlocked||info.reason?'save':'sound');
    const tabs='<div class="modal-tabs settings-tabs">'+[['sound','sound','소리'],['save','download','저장'],['help','help','도움말'],['etc','settings','기타']].map(([t,ic,label])=>'<button class="'+(tab===t?'active':'')+'" data-action="settings-tab" data-tab="'+t+'">'+icon(ic)+' '+label+'</button>').join('')+'</div>';
    // A blocked save is always shown first, whatever the tab.
    const blocked=saveBlocked?'<div class="save-recovery"><h3>기존 저장 원본을 보호하고 있어요</h3><p>'+escape(saveProblem(info.reason))+'</p><div class="setting-actions"><button class="secondary-button" data-action="retry-save-load">다시 불러오기</button><button class="secondary-button" data-action="export-recovery"'+isDisabled(!hasOriginal)+'>기존 원본 내보내기</button></div><p>기존 진행 대신 지금 화면의 진행으로 시작하려면 선택하세요. 먼저 기존 원본을 별도로 보관합니다.</p><button class="secondary-button danger-button" data-action="accept-new-save">새 진행을 저장하기</button></div>':'';
    let body='';
    if(tab==='sound')body=
      '<div class="setting-row sound-row"><div><h3>배경음악</h3><p>마을·대장간·작업실·월드맵마다 다른 곡</p></div><input type="range" min="0" max="100" step="5" data-volume="music" value="'+Math.round(preferences.musicVolume*100)+'" aria-label="배경음악 크기"'+(preferences.music?'':' disabled')+'><button class="secondary-button" data-action="sound-music">'+icon(preferences.music?'sound':'mute')+(preferences.music?'켜짐':'꺼짐')+'</button></div>'+
      '<div class="setting-row sound-row"><div><h3>효과음</h3><p>제작·판매·강화·행사 소리</p></div><input type="range" min="0" max="100" step="5" data-volume="sfx" value="'+Math.round(preferences.sfxVolume*100)+'" aria-label="효과음 크기"'+(preferences.sound?'':' disabled')+'><button class="secondary-button" data-action="sound-sfx">'+icon(preferences.sound?'sound':'mute')+(preferences.sound?'켜짐':'꺼짐')+'</button></div>';
    else if(tab==='help')body=helpMarkup();
    else if(tab==='etc')body=
      (Ach?(()=>{const s=Ach.summary(achievementProfile(),null);return '<div class="setting-row"><div><h3>업적 기록</h3><p>'+s.unlockedCount+' / '+s.total+' 달성 · 새 게임을 시작해도 남아요.</p></div><div class="setting-actions"><button class="secondary-button" data-action="achievements-export">'+icon('download')+' 내보내기</button><button class="secondary-button danger-button" data-action="achievements-reset-prompt">기록 지우기</button></div></div><div id="achievements-reset-confirm" class="reset-confirm" hidden>업적 기록을 모두 지울까요? 되돌릴 수 없어요.<div><button class="secondary-button danger-button" data-action="achievements-reset-confirm">모두 지우기</button><button class="secondary-button" data-action="achievements-reset-cancel">취소</button></div></div>';})():'')+
      '<div class="setting-row"><div><h3>새 대장간 시작하기</h3><p>기존 진행을 별도로 보관하고 첫날로 돌아갑니다.</p></div><button class="secondary-button danger-button" data-action="reset-prompt">'+icon('reset')+' 새로 시작</button></div>'+
      '<div id="reset-confirm" class="reset-confirm" hidden>첫날부터 새로 시작할까요? 현재 저장은 복구용으로 별도 보관합니다.<div><button class="secondary-button danger-button" data-action="reset-confirm">새 대장간으로 시작</button><button class="secondary-button" data-action="reset-cancel">취소</button></div></div>';
    else body=
      '<div class="save-state-card"><strong>'+escape(saveBlocked?'기존 저장 보호 중':info.reason?'자동 저장 확인 필요':'자동 저장 켜짐 · 5초 간격')+'</strong><p id="settings-save-time">'+escape(info.savedAt?'마지막 저장: '+saveTime(info.savedAt,true):'이번 접속에서 아직 새로 저장하지 않았어요.')+'</p></div>'+
      '<div class="setting-row"><div><h3>현재 진행 저장</h3><p>'+state.day+'일 차 · '+num(state.gold)+' G · 지점 '+ownedTowns().length+'곳</p></div><button class="secondary-button" data-action="save">지금 저장</button></div>'+
      '<div class="setting-actions"><button class="secondary-button" data-action="export">'+icon('download')+' 현재 진행 내보내기</button><button class="secondary-button" data-action="import">'+icon('upload')+' 저장 파일 불러오기</button></div>'+
      '<section class="save-backups"><h3>이전 저장 복구</h3>'+
      (backups.length?backups.map(b=>'<div class="save-backup-row"><div><strong>'+num(b.day)+'일 차 · '+num(b.gold)+' G</strong><small>'+escape(b.savedAt?saveTime(b.savedAt,true):'이전 버전 백업 · 저장 시각 없음')+'</small></div><button class="secondary-button" data-action="restore-save-backup" data-key="'+escape(b.key)+'">복구 확인</button></div>').join(''):'<p class="supply-note">복구 가능한 이전 저장이 아직 없습니다. 첫 저장 이후 다음 저장부터 백업이 남아요.</p>')+'</section>';
    $('#modal-body').innerHTML=blocked+tabs+'<div class="settings-body">'+body+'</div>';
  }
  function renderSaveRestore() {
    const backup=saveStore.listBackups().find(b=>b.key===ui.modalData);
    $('#modal-body').innerHTML=backup?
      '<p class="modal-description">이 시점의 대장간으로 돌아갑니다. 지금 저장된 원본은 별도로 보관하며, 확인하는 동안 게임과 자동 저장은 잠시 멈춥니다.</p><div class="save-state-card"><strong>'+num(backup.day)+'일 차 · '+num(backup.gold)+' G</strong><p>'+escape(backup.savedAt?saveTime(backup.savedAt,true):'이전 버전 백업 · 저장 시각 없음')+'</p></div><div class="setting-actions"><button class="primary-button" data-action="restore-save-confirm" data-key="'+escape(backup.key)+'">이 진행으로 복구</button><button class="secondary-button" data-action="settings">취소</button></div>':
      '<p class="modal-description">이 백업을 읽을 수 없어요. 현재 저장은 그대로 유지됩니다.</p><button class="secondary-button" data-action="settings">저장 설정으로 돌아가기</button>';
  }
  function calendarDayLabel(absoluteDay) {
    const d=Math.max(1,Math.floor(absoluteDay||1)),within=(d-1)%120;
    return Math.floor((d-1)/120+1)+'년 '+['봄','여름','가을','겨울'][Math.floor(within/30)]+' '+(within%30+1)+'일';
  }
  // --- Seasonal events (dist/seasons.js) ---
  const SEASON_NAMES=['봄','여름','가을','겨울'];
  function seasonDayLabel(month,day){
    const ev=Sim.getSeasonEvents?Sim.getSeasonEvents(state):null;if(!ev)return '';
    const short={market:'상단 장터',harvest:'수확제 주문',coldsnap:'한파'};
    const e=ev.events.find(e=>e.id!=='festival'&&e.season===month&&day>=e.start&&day<=e.end);
    if(!e||e.id==='coldsnap'&&day!==e.start)return '';
    return '<small class="festival season-day">'+escape(e.id==='coldsnap'?'한파 시작':short[e.id])+'</small>';
  }
  function seasonStatusText(e){return e.status==='active'?'진행 중 · '+e.daysLeft+'일 남음':e.status==='soon'?e.daysUntil+'일 뒤 시작':e.status==='upcoming'?e.daysUntil+'일 뒤':'올해는 끝났어요';}
  function renderSeasonTab(content,cal){
    const ev=Sim.getSeasonEvents?Sim.getSeasonEvents(state):null;
    if(!ev){updateRegion(content,empty('계절 행사를 준비 중이에요','잠시 후 다시 열어 주세요.','calendar'),'season-none');return;}
    const cards='<div class="season-grid">'+ev.events.map(e=>'<article class="season-card '+escape(e.status)+'"><small>'+SEASON_NAMES[e.season-1]+' '+e.start+(e.end!==e.start?'~'+e.end:'')+'일</small><h4>'+escape(e.name)+'</h4><p>'+escape(e.description)+'</p><b>'+escape(seasonStatusText(e))+'</b>'+(e.id==='festival'?'<button class="text-button" data-action="calendar-tab" data-tab="festival">축제 보기 '+icon('arrow')+'</button>':'')+'</article>').join('')+'</div>';
    let detail='';
    const m=ev.market;
    if(m&&(m.status==='open'||m.spent>0)){
      detail+='<h3 class="modal-section-title">'+icon('gem')+' 떠돌이 상단 장터 <small>'+(m.status==='open'?'여름 12일까지':'올해 장터는 끝났어요 · '+num(m.spent)+' G 거래')+'</small></h3>';
      if(m.status==='open')detail+='<div class="payroll-list season-market">'+m.offers.map(o=>{const five=Math.min(5,o.left);return '<div class="payroll-row"><div><b>'+escape(o.name)+'</b><small>남은 '+num(o.left)+'개 · 평소 시세 '+num(o.basePrice)+' G</small></div><span>개당 <b>'+num(o.unitPrice)+' G</b></span><button class="secondary-button" data-action="season-buy" data-id="'+escape(o.id)+'" data-amount="'+five+'"'+isDisabled(!o.left||state.gold<o.unitPrice*Math.max(1,five))+'>'+(five||0)+'개</button><button class="secondary-button" data-action="season-buy" data-id="'+escape(o.id)+'" data-amount="all"'+isDisabled(!o.left||state.gold<o.unitPrice*o.left)+'>남은 만큼 · '+num(o.unitPrice*o.left)+' G</button></div>';}).join('')+'</div>';
    }
    const h=ev.harvest;
    if(h){
      const head={open:'가을 20일까지 · 모두 납품하면 '+num(h.reward)+' G · 명성 +'+h.reputation,completed:'주문 완료 · +'+num(h.paid)+' G',expired:'기한 종료 · 납품한 만큼 '+num(h.paid)+' G'}[h.status];
      detail+='<h3 class="modal-section-title">'+icon('scroll')+' 수확제 대량 주문 <small>'+escape(head)+'</small></h3><div class="payroll-list season-harvest">'+h.lines.map(l=>{const done=l.delivered>=l.required;return '<div class="payroll-row"><div><b>'+escape(l.name)+'</b><small>제작기술 Lv.'+l.requiredLevel+' · 모든 지점 창고·진열대 보유 '+num(l.available)+'개</small></div><span>납품 <b>'+l.delivered+' / '+l.required+'</b></span>'+(h.status==='open'&&!done?'<button class="secondary-button" data-action="season-deliver" data-id="'+escape(l.recipeId)+'"'+isDisabled(!l.available)+'>납품</button><button class="text-button" data-action="season-craft" data-id="'+escape(l.recipeId)+'">제작하기 '+icon('arrow')+'</button>':'<span class="payroll-check">'+icon(done?'check':'clock')+'</span>')+'</div>';}).join('')+'</div>'+(h.status==='open'?'<p class="supply-note">잠근 장비와 손님이 예약한 장비는 납품하지 않아요. 기한이 지나면 납품한 만큼의 40%만 받아요.</p>':'');
    }
    if(ev.coldsnap&&ev.coldsnap.active)detail+='<h3 class="modal-section-title">'+icon('shield')+' 한파 사냥철 <small>겨울 내내</small></h3><p class="supply-note">사냥 경험치와 전리품이 30% 늘어나요. 대신 사냥에서 지면 장비 내구도가 두 배로 깎이니 갑옷과 교체 장비를 넉넉히 준비하세요.</p>';
    // (no separate 'next event' line: each card already shows how far away it is)
    const sig=['season',cal.dayOfYear,state.gold,JSON.stringify(ev.events.map(e=>e.status+e.daysUntil+e.daysLeft)),JSON.stringify(m),JSON.stringify(h),ev.coldsnap&&ev.coldsnap.active].join('|');
    updateRegion(content,''+cards+detail,sig);
  }
  function renderCalendar(force) {
    const cal=Sim.getCalendar(state),festival=Sim.getFestival(state),payroll=Sim.getPayroll(state),body=$('#modal-body');
    if(force||!$('#calendar-content')){
      body.innerHTML='<div class="calendar-summary" id="calendar-summary"></div><div class="modal-tabs calendar-tabs">'+[['month','calendar','달력'],['season','leaf','계절 행사'],['festival','trophy','장비 축제'],['payroll','coin','직원 급여']].map(([t,ic,label])=>'<button class="'+(ui.calendarTab===t?'active':'')+'" data-action="calendar-tab" data-tab="'+t+'">'+icon(ic)+' '+label+'</button>').join('')+'</div><div id="calendar-content"></div>';
    }
    updateRegion($('#calendar-summary'),'<h3>'+icon('calendar')+escape(cal.label)+'</h3><span class="calendar-payday">'+icon('coin')+(payroll.daysUntil?'급여일까지 <b>'+payroll.daysUntil+'일</b>':'<b>오늘 급여일</b>')+'</span>',[cal.label,payroll.nextPayDay,payroll.daysUntil].join(':'));
    const content=$('#calendar-content');
    if(ui.calendarTab==='season'){renderSeasonTab(content,cal);return;}
    if(ui.calendarTab==='month'){
      const start=cal.absoluteDay-cal.day+1,offset=(start-1)%7,days=Array.from({length:offset},()=>'<span class="calendar-empty"></span>').concat(Array.from({length:30},(_,i)=>{const day=i+1,absolute=start+i,festivalDay=cal.month===1&&day>=10&&day<=14,results=cal.month===1&&day===15,payday=day===1&&start>1;return '<div class="calendar-day '+(day===cal.day?'today':'')+'"><b>'+day+'</b>'+(festivalDay?'<small class="festival">축제 접수</small>':'')+(results?'<small class="festival">축제 시상</small>':'')+(payday?'<small class="payday">급여일</small>':'')+seasonDayLabel(cal.month,day)+'</div>';})).join('');
      updateRegion(content,'<div class="calendar-month"><div class="calendar-weekdays">'+['월','화','수','목','금','토','일'].map(d=>'<span>'+d+'</span>').join('')+'</div><div class="calendar-days">'+days+'</div></div>',[cal.absoluteDay,payroll.nextPayDay].join(':'));return;
    }
    if(ui.calendarTab==='payroll'){
      const sig=[state.gold,payroll.nextPayDay,payroll.totalSalary,payroll.totalDebt,...payroll.staff.map(w=>w.id+':'+w.salary+':'+w.debt+':'+w.craftLevel)].join('|');
      updateRegion(content,'<div class="metrics-grid three-columns">'+metric('한 달 급여',num(payroll.totalSalary),'G','coin')+metric('미지급 급여',num(payroll.totalDebt),'G')+metric('다음 지급까지',num(payroll.daysUntil),'일','calendar')+'</div>'+(payroll.upkeep?'<p class="supply-note">급여일 지점 유지비 '+num(payroll.upkeep)+' G</p>':'')+(payroll.totalDebt?'<button class="secondary-button full-button" data-action="pay-wages"'+isDisabled(state.gold<payroll.totalDebt)+'>'+icon('coin')+' 미지급 급여 전체 지급 · '+num(payroll.totalDebt)+' G</button>':'')+'<div class="payroll-list">'+payroll.staff.map(w=>'<div class="payroll-row"><div><b>'+escape(w.name)+'</b><small>'+escape(w.townName)+' · '+escape(payrollRoleLabel(w))+'</small></div><span>월급 <b>'+num(w.salary)+' G</b></span><span class="'+(w.debt?'debt':'settled')+'">'+(w.debt?'미지급 '+num(w.debt)+' G':'미지급 없음')+'</span>'+(w.debt?'<button class="secondary-button" data-action="pay-wages" data-id="'+escape(w.id)+'"'+isDisabled(state.gold<w.debt)+'>지급</button>':'<span class="payroll-check">'+icon('check')+'</span>')+'</div>').join('')+'</div>',sig);return;
    }
    const candidates=Sim.getFestivalCandidates(state),entries=festival.entries||[],results=festival.results||[];
    if(ui.festivalItem&&!candidates.some(i=>i.id===ui.festivalItem))ui.festivalItem=null;
    const selected=candidates.find(i=>i.id===ui.festivalItem);
    const sig=[festival.year,festival.status,festival.daysUntil,JSON.stringify(entries),JSON.stringify(results),candidates.map(i=>i.id+':'+i.locked).join(','),ui.festivalItem,state.activeTownId].join('|');
    // Festival: one short banner, results only when there are any, the entries as fixed slots, and the item picker
    // only while entries are open (outside that window it is just a line saying when it opens).
    const max=festival.maxEntries||3,open=festival.status==='open';
    const stateText={upcoming:'접수 '+festival.daysUntil+'일 전',open:'접수 중 · '+(festival.closesIn||0)+'일 남음',judging:'심사 중',finished:'시상 완료'}[festival.status]||'다음 축제를 기다려요';
    const banner='<div class="festival-banner"><span>'+icon('trophy')+'</span><div><h3>'+festival.year+'년 장비 축제</h3><p>봄 10~14일 접수 · 15일 시상 · 최대 '+max+'점, 가장 높은 한 점에 상금</p></div><b class="festival-state'+(open?' open':'')+'">'+stateText+'</b></div>';
    const resultsHtml=results.length?'<h3 class="modal-section-title">'+icon('trophy')+' 시상 결과</h3><div class="festival-results">'+results.map(r=>'<article class="festival-result"><b>'+r.rank+'위</b><div><h3>'+escape(r.itemName)+'</h3><p>'+escape(r.label)+' · '+num(r.score)+'점</p></div><strong>+'+num(r.reward)+' G</strong></article>').join('')+'</div>':'';
    const slots=Array.from({length:max},(_,i)=>{const e=entries[i];
      // Outside the entry days an empty slot shows a lock, not a "+" that looks like it can be filled (2026-11-10).
      if(!e)return '<div class="festival-slot'+(open?'':' closed')+'">'+icon(open?'plus':'lock')+'<small>'+(open?'출품할 장비를 골라 주세요':'접수 기간이 아니에요')+'</small></div>';
      return '<article class="festival-entry"><div class="festival-item-art">'+itemArt(recipe(e.item.recipeId))+'</div><div><h3>'+escape(itemName(e.item))+'</h3><p class="quality-'+escape(e.item.quality)+'">'+escape(quality(e.item).label||quality(e.item).name)+' · '+num(e.score)+'점</p><small>'+escape(e.townName)+'</small></div>'+(open?'<button class="text-button" data-action="withdraw-festival" data-id="'+escape(e.id)+'">출품 취소</button>':'')+'</article>';}).join('');
    let picker='';
    if(open){
      picker='<h3 class="modal-section-title">'+icon('box')+' 출품할 장비 고르기 <small>'+escape(getTown().name)+' 창고·진열대</small></h3><div class="festival-candidates">'+(candidates.length?candidates.map(i=>'<button class="festival-candidate '+(i.id===ui.festivalItem?'selected':'')+'" data-action="festival-item" data-id="'+escape(i.id)+'" title="'+escape(itemStatsText(i)+' · '+optionSummary(i))+'" aria-pressed="'+(i.id===ui.festivalItem)+'"><span class="choice-radio"></span>'+itemArt(recipe(i.recipeId))+'<span><b>'+escape(itemName(i))+'</b><small class="quality-'+escape(i.quality)+'">'+escape(quality(i).label||quality(i).name)+'</small></span><strong>'+num(Sim.getFestivalScore(i))+'점</strong></button>').join(''):empty('출품할 장비가 없어요','장비를 만들거나 보관 잠금을 풀면 여기에 나와요.','box'))+'</div>'
        +(candidates.length?'<div class="festival-submit"><span>'+(selected?escape(itemName(selected))+' · <b>'+num(Sim.getFestivalScore(selected))+'점</b>':'장비를 하나 고르세요')+'</span><button class="primary-button" data-action="submit-festival"'+isDisabled(!selected||entries.length>=max)+'>'+icon('trophy')+' 출품하기</button></div>':'');
    }else if(festival.status==='upcoming')picker='<p class="festival-wait">'+icon('clock')+' 봄 10일에 접수가 열리면 여기서 장비를 골라 출품할 수 있어요.</p>';
    updateRegion(content,banner+resultsHtml+'<h3 class="modal-section-title">'+icon('sword')+' 출품작 <small>'+entries.length+' / '+max+'</small></h3><div class="festival-entries">'+slots+'</div>'+picker,sig);
  }
  function worldRaidMarkup(townId=null) {
    const bosses=Sim.getBosses(state).filter(b=>!townId||region(b.regionId)?.townId===townId);
    return '<div class="raid-panel"><h3 class="modal-section-title">'+icon('shield')+' 월드보스 · '+bosses.length+'곳</h3>'+(!bosses.length?'<p class="boss-empty">이 마을에는 월드보스가 없어요. 연결된 다른 마을의 보스 표식을 살펴보세요.</p>':bosses.map(b=>{const party=b.activeParty;return '<article class="boss-card '+(party?'active':'')+'"><h4>'+escape(b.name)+'<span>'+icon('people')+b.partySize+'명</span></h4><p>개인 전투력 '+num(b.minPower)+' · 희귀 설계도 '+Math.round((b.rareChance??.12)*100)+'%</p>'+(party?'<div class="mini-progress"><i style="width:'+pct(party.total-party.remaining,party.total)+'%"></i></div><div class="boss-party"><span>토벌 중 '+bossTimer(party.remaining)+'</span><b>성공 '+Math.round(party.successChance*100)+'%</b></div>':'<small>'+icon('clock')+' '+(b.cooldownRemaining>0?'재출현 '+bossTimer(b.cooldownRemaining):b.worldReady?'파티 출발 준비':'출현 중 · 파티 모집')+'</small>')+'<button class="text-button boss-map-link" data-action="boss" data-id="'+escape(b.id)+'">토벌 현황 '+icon('arrow')+'</button></article>';}).join(''))+'</div>'; // 2026-11-09: boss materials are retired, so the rare-material market button is gone
  }
  function renderMarket(force) {
    const offers=Sim.listRareOffers(state),rare=Object.entries(DATA.materials).filter(([id,m])=>m.rare&&!m.retired&&m.source!=='invasion'),sig=[state.gold,Sim.getMaterialCapacity(state),offers.map(o=>[o.id,o.status,o.amount,o.totalPrice].join(':')).join(','),rare.map(([id])=>state.materials[id]).join(',')].join('|');
    if(!force&&ui.modalSignature===sig)return;ui.modalSignature=sig;
    const offerRows=offers.map(o=>{
      const amount=Math.min(o.amount,Sim.getMaterialRoom(state,o.material)),cost=amount*o.unitPrice;
      return '<article class="rare-offer"><div class="material-badge">'+materialArt(o.material)+'</div><div><h3>'+escape(o.materialName||DATA.materials[o.material]?.name||o.material)+' <span>'+o.amount+'개</span></h3><p>'+escape(o.sellerName)+' · '+escape(state.towns[o.townId]?.name||'마을')+'</p><small>개당 '+num(o.unitPrice)+' G'+(amount<o.amount?' · 창고 여유 '+amount+'개':'')+'</small></div><button class="primary-button" data-action="buy-rare" data-id="'+escape(o.id)+'"'+isDisabled(amount===0||state.gold<cost)+'>'+(amount?amount+'개 · '+num(cost)+' G 매입':'창고 가득 참')+'</button></article>';
    }).join('');
    $('#modal-body').innerHTML=''+warehouseLink('희귀 재료를 위한 창고 공간')+'<div class="rare-stocks">'+rare.map(([id,m])=>'<div>'+materialArt(id)+'<span>'+escape(m.name)+'</span><b>'+num(state.materials[id]||0)+' / '+num(Sim.getMaterialCapacity(state))+'</b></div>').join('')+'</div><h3 class="modal-section-title">'+icon('gem')+' 모험가가 내놓은 재료 <small>'+offers.length+'건</small></h3><div class="rare-offers">'+(offers.length?offerRows:empty('모험가들의 귀환을 기다려요','강한 모험가들이 보스를 토벌하면 희귀 전리품을 들고 돌아와 판매합니다. 월드맵에서 토벌 상황을 살펴보세요.','gem'))+'</div><button class="secondary-button full-button" data-action="nav" data-tab="world">'+icon('map')+' 월드맵에서 보스 토벌 살펴보기</button>';
  }

  // Fourth card in the facility row (next to furnace / display / anvil): the storage corner and its next level.
  function warehouseBuildCard() {
    const w=Sim.getWarehouse(state),cost=w.nextLevel?w.upgradeCost:null;
    return '<article class="build-card"><div class="build-symbol warehouse">'+icon('box')+'</div><span class="small-badge">Lv.'+w.level+' / '+w.maxLevel+'</span><h3>창고</h3><b class="facility-effect">장비 '+num(w.equipmentCapacity)+'칸 · 재료 '+num(w.materialCapacity)+'개'+(w.nextLevel?' → '+num(w.nextEquipmentCapacity)+'칸 · '+num(w.nextMaterialCapacity)+'개':'')+'</b><button class="primary-button" data-action="upgrade-warehouse"'+isDisabled(cost===null||state.gold<cost)+'>'+icon(cost===null?'check':'plus')+(cost===null?'최고 단계':num(cost)+' G · 확장')+'</button></article>';
  }
  function warehouseLink(label) {
    const w=Sim.getWarehouse(state);
    return '<button class="warehouse-capacity-link" data-action="warehouse">'+icon('box')+'<span><b>'+(label||'창고 Lv. '+w.level+' · 보관 공간 관리')+'</b><small>장비 '+num(w.equipmentUsed)+' / '+num(w.equipmentCapacity)+'칸 · 재료별 '+num(w.materialCapacity)+'개</small></span>'+icon('arrow')+'</button>';
  }
  function renderWarehouse(force=false) {
    const town=getTown(),w=Sim.getWarehouse(state),levels=DATA.warehouseLevels||[];
    const signature=[town.id,w.level,w.equipmentUsed,w.storedEquipment,w.queuedEquipment,w.festivalReservations,w.materialCapacity,state.gold,JSON.stringify(state.materials)].join('|');
    if(!force&&ui.modalSignature===signature)return;ui.modalSignature=signature;
    const overflow=w.equipmentOverflow>0||(w.materialOverflow||[]).length>0;
    // 2026-11 compact game layout: one status bar (level · chips · upgrade), a slim equipment gauge,
    // an inventory-style grid of material slots, and a row of small links.
    const nextInfo=w.nextLevel?'다음 Lv.'+w.nextLevel+' · 재료 '+num(w.nextMaterialCapacity)+'개씩 · 장비 '+num(w.nextEquipmentCapacity)+'칸 · 선반 '+w.nextShelves+'개':'최고 단계';
    $('#modal-body').innerHTML='<div class="wh2">'+
      '<div class="wh2-bar"><span class="wh2-badge">Lv.'+w.level+'<small>/'+w.maxLevel+'</small></span><b class="wh2-name">'+escape(w.name)+'</b>'+
        '<span class="wh2-chip">'+icon('gem')+'재료 <b>'+num(w.materialCapacity)+'</b>개씩</span><span class="wh2-chip">'+icon('shelf')+'선반 <b>'+w.shelves+'</b></span>'+
        '<button class="wh2-up" data-action="upgrade-warehouse" title="'+escape(nextInfo)+'"'+isDisabled(!w.nextLevel||state.gold<w.upgradeCost)+'>'+(w.nextLevel?'▲ '+num(w.upgradeCost)+' G':'최고 단계')+'</button></div>'+
      (w.nextLevel?'<p class="wh2-next">'+escape(nextInfo)+'</p>':'')+
      '<div class="wh2-gauge"><span>'+icon('sword')+'장비</span><div class="storage-track"><i style="width:'+pct(w.equipmentUsed,w.equipmentCapacity)+'%"></i></div><b>'+num(w.equipmentUsed)+'<small>/'+num(w.equipmentCapacity)+'</small></b><em>보관 '+w.storedEquipment+' · 예약 '+(w.queuedEquipment+w.festivalReservations)+'</em></div>'+
      (overflow?'<p class="wh2-warn">한도를 넘은 재고가 있어요(보존됨)</p>':'')+
      '<div class="wh2-grid">'+Object.entries(DATA.materials).filter(([id,m])=>!m.retired).map(([id,m])=>{const stock=state.materials[id]||0,full=stock>=w.materialCapacity;return '<div class="wh2-slot'+(full?' full':'')+(stock?'':' empty')+'" title="'+escape(m.name)+' '+num(stock)+' / '+num(w.materialCapacity)+'">'+materialArt(id)+'<span class="wh2-slot-name">'+escape(m.name)+'</span><b>'+num(stock)+'<small>/'+num(w.materialCapacity)+'</small></b><i style="width:'+pct(stock,w.materialCapacity)+'%"></i></div>';}).join('')+'</div>'+
      '<div class="wh2-links"><button data-action="warehouse-items">'+icon('sword')+'보관 장비</button><button data-action="operations" data-tab="materials">'+icon('settings')+'자동 매입</button><button data-action="operations" data-tab="display">'+icon('shelf')+'자동 진열</button></div>'+
    '</div>';
  }
  function operationsLink(tab,label) {
    return '<button class="automation-link" data-action="operations" data-tab="'+tab+'">'+icon('settings')+'<span>'+label+'</span>'+icon('arrow')+'</button>';
  }
  function staffRoleOptions(worker) {
    return Object.entries(staffRoles).map(([id,meta])=>'<option value="'+id+'"'+(worker.role===id?' selected':'')+'>'+meta.name+' 담당</option>').join('');
  }
  function staffWorkLabel(worker) {
    if(worker.salaryDebt)return '급여 미지급 · 휴식 중';
    if(worker.status==='working')return ({smith:'장비 제작 중',buyer:'재료 매입 중',logistics:'장비 운반·진열 중',enhancer:'강화 작업 보조',innkeeper:'모험가 회복 지원'})[worker.role]||'업무 처리 중';
    // An idle smith while jobs wait: say why (every waiting job needs more craft skill than this smith has).
    if(worker.role==='smith'&&worker.status==='idle'){const t=Object.values(state.towns).find(x=>x.staff.includes(worker)),waiting=(t?.queue||[]).filter(q=>!q.staffId);
      if(waiting.length&&waiting.every(q=>Sim.getRecipeLevel(recipe(q.recipeId))>worker.craftLevel)){const need=Math.min(...waiting.map(q=>Sim.getRecipeLevel(recipe(q.recipeId))));return '제작기술 부족 · Lv.'+need+' 필요';}}
    return staffStatus[worker.status]||'작업 대기';
  }
  function operationForm(kind,id,rule,label) {
    // Auto-craft targets are 1+ (no "0 = make forever": that drained materials into piles of stock).
    const minimum=kind==='craft'?1:0,enabled=!!rule?.enabled,maximum=kind==='material'?Sim.getMaterialCapacity(state):1000000,savedTarget=rule?.targetStock??(kind==='material'?Math.min(100,maximum):3),target=Math.max(minimum,Math.min(savedTarget,maximum));
    return '<form class="operation-rule-form" data-operation-form="'+kind+'" data-id="'+escape(id)+'"><label class="operation-check"><input type="checkbox" name="enabled"'+(enabled?' checked':'')+' aria-label="'+escape(label)+' 자동 '+(kind==='material'?'매입':'제작')+' 사용"><span>사용</span></label><label class="ops-target">'+(kind==='craft'?'재고':'목표')+'<input type="number" name="targetStock" min="'+minimum+'" max="'+maximum+'" step="1" value="'+target+'" required aria-label="'+escape(label)+' 목표 재고">'+(kind==='craft'?'개 유지':'개')+'</label><button class="secondary-button ops-btn" type="submit">저장</button></form>';
  }
  function updateOperationStatus() {
    if(ui.modal!=='operations')return;
    const data=Sim.getOperations(state),town=getTown();
    for(const [key,value] of Object.entries(data.status||{})){
      const target=$('[data-operation-status="'+key+'"]');
      if(target){target.className='operation-status state-'+value.state;target.textContent=value.reason;}
    }
    for(const el of $$('[data-operation-stock]'))el.textContent=num(state.materials[el.dataset.operationStock]||0);
    for(const el of $$('[data-operation-limit]')){const rule=data.materialRules[el.dataset.operationLimit],cap=Sim.getMaterialCapacity(state),target=Math.min(rule?.targetStock??cap,cap);el.textContent='현재 적용 목표 '+num(target)+'개 · 품목 한도 '+num(cap)+'개'+(rule?.targetStock>cap?' · 기존 목표 '+num(rule.targetStock)+'개 보존':'');}
    for(const el of $$('[data-operation-form="material"] [name="targetStock"]'))el.setAttribute('max',Sim.getMaterialCapacity(state));
    for(const el of $$('[data-operation-made]')){const id=el.dataset.operationMade;el.textContent='재고 '+town.inventory.filter(i=>i.recipeId===id).length+'개 · 제작 대기 '+town.queue.filter(q=>q.recipeId===id).length+'개';}
    for(const el of $$('[data-operation-role-count]')){const role=el.dataset.operationRoleCount,workers=town.staff.filter(w=>w.role===role);el.textContent=workers.length+'명 · 근무 '+workers.filter(w=>['working','selling'].includes(w.status)&&!w.salaryDebt).length+'명';}
    const total=$('#operations-team-size');if(total)total.textContent=town.staff.length+' / 30명';
  }
  // 2026-11 compact layout (same look as the request board): a status line, then one short row per item.
  function renderOperations(force=false) {
    const town=getTown(),data=Sim.getOperations(state);
    if(!force&&$('#operations-content')){updateOperationStatus();return;}
    const tabs=[['materials','gem','재료 매입'],['production','hammer','자동 제작'],['display','shelf','진열·보관'],['team','people','업무 현황']];
    let content='';
    if(ui.operationsTab==='materials'){
      if(!ui.materialDraft)ui.materialDraft={};
      const cap=Sim.getMaterialCapacity(state),materials=Object.entries(DATA.materials).filter(([id,m])=>m.source!=='invasion'&&!m.retired);
      content='<div class="operation-status" data-operation-status="purchase"></div><form class="ops-form" data-operation-form="material-batch"><div class="ops-list">'+materials.map(([id,m])=>{const rule=ui.materialDraft[id]||data.materialRules[id],on=!!rule?.enabled,target=Math.min(rule?.targetStock??Math.min(100,cap),cap);
        return '<div class="operation-material-row ops-row'+(on?' checked':'')+'"><label class="qb-check"><input type="checkbox" data-material-enabled="'+escape(id)+'"'+(on?' checked':'')+' aria-label="'+escape(m.name)+' 자동 매입"></label><span class="material-badge" data-tip="material" data-id="'+escape(id)+'">'+materialArt(id)+'</span><span class="qb-name">'+escape(m.name)+'<small>보유 <b data-operation-stock="'+escape(id)+'">'+num(state.materials[id]||0)+'</b> / '+num(cap)+'</small></span><label class="ops-target">목표<input type="number" data-material-target="'+escape(id)+'" min="0" step="1" required max="'+cap+'" value="'+target+'" aria-label="'+escape(m.name)+' 목표 재고">개</label><span class="qb-unit">'+(m.rare?'제안가':'개당 '+num(Sim.getMaterialPrices(id).auto)+' G')+'</span></div>';}).join('')+'</div><div class="ops-actions"><button type="button" class="secondary-button" data-action="material-cancel">변경 취소</button><button type="submit" class="primary-button">'+icon('check')+' 매입 설정 저장</button></div></form>';
    } else if(ui.operationsTab==='production'){
      // Top: the (up to 3) running plans with save / delete. Below: filter chips and a scrolling list of gear with
      // level, stats, materials and price, each with an "add" button.
      const plans=Object.entries(data.craftRules).filter(([id])=>Object.hasOwn(town.operations?.craftRules||{},id)),full=plans.length>=3;
      const f=ui.autoFilter||(ui.autoFilter={slot:'all',ready:true,band:'all'}),unlocked=new Set(Sim.getUnlockedRecipes(state).map(r=>r.id));
      const recipes=[...DATA.recipes].filter(r=>!r.bossRecipe&&(!r.unlockDrop||(state.unlockedDrops||[]).includes(r.id))&&(f.slot==='all'||r.slot===f.slot)&&(!f.band||f.band==='all'||Math.floor(Math.min(Sim.getRecipeLevel(r),30)/10)===Number(f.band))&&(!f.ready||unlocked.has(r.id))).sort((a,b)=>Sim.getRecipeLevel(a)-Sim.getRecipeLevel(b)||a.name.localeCompare(b.name));
      const stat=r=>[['attack','공'],['defense','방'],['hp','체']].filter(([k])=>r[k]).map(([k,n])=>n+' '+num(r[k])).join(' · ')||'–';
      const planRows=plans.length?plans.map(([id,rule])=>{const r=recipe(id);return '<article class="operation-plan ops-row'+(rule.enabled?' checked':'')+'">'+itemArt(r)+'<span class="qb-name">'+escape(r.name)+'<small data-operation-made="'+escape(id)+'"></small></span>'+operationForm('craft',id,rule,r.name)+'<button type="button" class="secondary-button ops-btn ops-del" data-action="auto-remove" data-id="'+escape(id)+'">삭제</button></article>';}).join(''):'<p class="quest-empty">아래 목록에서 자동으로 만들 장비를 추가하세요. (최대 3개)</p>';
      const chips=[['all','전체'],['weapon','무기'],['offhand','보조 장비'],['armor','갑옷'],['accessory','장신구']].map(([id,label])=>'<button type="button" class="ops-chip'+(f.slot===id?' selected':'')+'" data-action="auto-filter" data-slot="'+id+'">'+label+'</button>').join('')+'<button type="button" class="ops-chip'+(f.ready?' selected':'')+'" data-action="auto-filter" data-ready="1">'+icon('check')+' 만들 수 있는 것만</button><span class="ops-break"></span>'+[['all','모든 레벨'],['0','Lv.1–9'],['1','Lv.10–19'],['2','Lv.20–29'],['3','Lv.30']].map(([id,label])=>'<button type="button" class="ops-chip'+((f.band||'all')===id?' selected':'')+'" data-action="auto-filter" data-band="'+id+'">'+label+'</button>').join('');
      const rows=recipes.length?recipes.map(r=>{const planned=Object.hasOwn(town.operations?.craftRules||{},r.id),can=unlocked.has(r.id);
        return '<div class="ops-recipe'+(can?'':' locked')+'">'+itemArt(r)+'<span class="qb-name">'+escape(r.name)+'<small>제작 Lv.'+Sim.getRecipeLevel(r)+' · '+escape(slotNames[r.slot]||'')+'</small></span><span class="or-stat">'+stat(r)+'</span><span class="or-cost">'+Object.entries(r.cost).map(([k,n])=>'<span class="or-mat'+((state.materials[k]||0)<n?' short':'')+'" data-tip="'+escape(DATA.materials[k].name+' · 보유 '+num(state.materials[k]||0)+'개')+'">'+materialArt(k)+'<b>'+num(n)+'</b></span>').join('')+'</span><b class="or-price">'+num(r.price)+' G</b>'+(planned?'<span class="or-added">등록됨</span>':'<button type="button" class="secondary-button or-add" data-action="auto-add" data-id="'+escape(r.id)+'"'+isDisabled(full||!can)+'>'+icon('plus')+'추가</button>')+'</div>';}).join(''):'<p class="quest-empty">조건에 맞는 장비가 없어요.</p>';
      content='<div class="operation-status" data-operation-status="craft"></div><h4 class="ops-sub">자동 제작 중 <small>'+plans.length+' / 3 · 사용을 켜면 그 수만큼 재고를 유지해요 (팔리면 다시 만들어요)</small></h4><div class="operation-plans ops-list">'+planRows+'</div><div class="ops-chips ops-filter">'+chips+'</div><div class="ops-recipes">'+rows+'</div>';
    } else if(ui.operationsTab==='display'){
      const keep=data.autoDisplay.keepQuality,choices=[['none','보관 안 함'],...DATA.qualityOrder.slice().reverse().map(id=>[id,id==='normal'?'전부 보관':DATA.qualities[id].name+' 이상'])];
      content='<div class="operation-status" data-operation-status="display"></div><form class="ops-form ops-list" data-operation-form="display"><label class="ops-row ops-toggle"><input type="checkbox" name="enabled"'+(data.autoDisplay.enabled?' checked':'')+' aria-label="자동 진열 사용"><span class="qb-name">자동 진열<small>물류 직원이 창고 장비를 빈 진열대로 옮겨요</small></span></label><h4 class="ops-sub">이 품질 이상은 팔지 않고 창고에 보관</h4><div class="ops-chips">'+choices.map(([id,label])=>'<label class="ops-chip"><input type="radio" name="keepQuality" value="'+id+'"'+(keep===id?' checked':'')+'><b class="'+(id==='none'||id==='normal'?'':'quality-'+id)+'">'+label+'</b></label>').join('')+'</div><div class="ops-actions"><button class="primary-button" type="submit">'+icon('check')+' 진열·보관 설정 저장</button></div></form><div class="ops-stats"><span>'+icon('box')+'창고 <b>'+num(Sim.getEquipmentUsage(state))+' / '+num(Sim.getEquipmentCapacity(state))+'</b></span><span>'+icon('lock')+'보관 잠금 <b>'+num(town.inventory.filter(i=>i.locked).length)+'</b></span><span>'+icon('shelf')+'진열 <b>'+num(displayedItems().length)+' / '+num(Sim.getStockCapacity(state))+'</b></span></div>';
    } else {
      content='<div class="operation-status" data-operation-status="support"></div><div class="operation-role-grid ops-roles">'+Object.entries(staffRoles).map(([id,meta])=>'<article class="operation-role-card">'+icon(meta.icon)+'<span class="qb-name">'+meta.name+'<small>'+meta.description+'</small></span><b data-operation-role-count="'+id+'"></b></article>').join('')+'</div><div class="ops-actions"><button class="secondary-button" data-action="nav" data-tab="upgrades">'+icon('building')+' 시설 배치</button><button class="primary-button" data-action="nav" data-tab="staff">'+icon('people')+' 고용·역할 배정</button></div>';
    }
    $('#modal-body').innerHTML='<div class="operation-tabs" role="tablist" aria-label="자동 운영 설정">'+tabs.map(([id,ic,label])=>'<button type="button" role="tab" aria-selected="'+(ui.operationsTab===id)+'" class="'+(ui.operationsTab===id?'active':'')+'" data-action="operations-tab" data-tab="'+id+'">'+icon(ic)+label+'</button>').join('')+'</div><div id="operations-content">'+content+'</div>';
    updateOperationStatus();
  }
  function submitOperationForm(form) {
    const kind=form.dataset.operationForm,id=form.dataset.id;
    const get=name=>form.querySelector('[name="'+name+'"]');
    let result;
    if(kind==='material-batch'){
      result=Sim.setMaterialPurchaseRules(state,ui.materialDraft||{});
      if(!result.ok){act(result,{refresh:false});return;}ui.materialDraft={};act(result);return;
    } else if(kind==='customer'){
      result=Sim.setCustomerService(state,{enabled:!!get('enabled').checked});
    } else if(kind==='display'){
      const selected=Array.from(form.querySelectorAll('[name="keepQuality"]')).find(el=>el.checked);
      result=Sim.setAutoDisplay(state,{enabled:!!get('enabled').checked,keepQuality:selected?.value||'none'});
    } else if(kind==='add-craft'){
      ui.autoRecipeId=get('recipeId').value;
      result=Sim.setAutoCraftRule(state,ui.autoRecipeId,{enabled:true,targetStock:Number(get('targetStock').value)});
    } else if(kind==='craft'){
      // Any [저장] saves every auto-craft plan on screen at once (the others used to lose their unsaved ticks).
      const forms=[...document.querySelectorAll('form[data-operation-form="craft"]')];
      const rules=forms.map(f=>({id:f.dataset.id,rule:{enabled:!!f.querySelector('[name="enabled"]').checked,targetStock:Number(f.querySelector('[name="targetStock"]').value)}}));
      if(rules.some(r=>!(r.rule.targetStock>=1))){toast('유지할 재고는 1개 이상으로 정해주세요.',true);return;}
      let last=null;for(const r of rules){last=Sim.setAutoCraftRule(state,r.id,r.rule);if(!last.ok)break;}
      result=last||{ok:true,message:'자동 제작 설정을 저장했어요.'};
      if(result.ok&&rules.length>1)result={...result,message:'자동 제작 '+rules.length+'개 설정을 저장했어요.'};
    } else {
      const rule={enabled:!!get('enabled').checked,targetStock:Number(get('targetStock').value)};
      result=Sim.setMaterialPurchaseRule(state,id,rule);
    }
    if(act(result))renderOperations(true);
  }
  const bossTimer = value => {const n=Math.max(0,Math.ceil((Number(value)||0)/gameRate()));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');};
  // Boss window (2026-11): bosses are fought only by parties the player sends. Shows what the boss needs and drops,
  // then (when it is out and the town is open) the adventurers who can go right now, to pick a party and send it.
  function renderBoss(force=false) {
    const b=Sim.getBosses(state).find(b=>b.id===ui.modalData);
    if(!b){$('#modal-body').innerHTML=empty('이 보스를 찾지 못했어요','월드맵에서 보스 표식을 다시 선택해 주세요.','shield');return;}
    const r=region(b.regionId),town=townCatalog().find(t=>t.id===r?.townId),party=b.activeParty,opened=!!state.towns[r?.townId];
    if(ui.bossPickFor!==b.id){ui.bossPickFor=b.id;ui.bossPick=[];}
    const info=opened&&!party&&b.cooldownRemaining<=0?Sim.getDispatchInfo(state,b.id):null;
    // Every resident in a fixed order with what they are doing (2026-11-09, same as incident dispatch); busy ones are greyed out.
    const all=(info?.candidates||[]).slice().sort((x,y)=>{const ax=state.adventurers.find(a=>a.id===x.id),ay=state.adventurers.find(a=>a.id===y.id);return (ay?.level||0)-(ax?.level||0)||String(x.id).localeCompare(String(y.id));}),free=all.filter(c=>!c.block),busy=all.filter(c=>c.block);
    ui.bossPick=ui.bossPick.filter(id=>free.some(c=>c.id===id));
    const chance=ui.bossPick.length?Sim.quoteParty(state,b.id,ui.bossPick):0;
    const sig=[b.id,Math.ceil(b.cooldownRemaining),party?.id,Math.ceil(party?.remaining||0),party?.crisis?(party.crisis.active+':'+Math.ceil(party.crisis.realLeft)+':'+party.crisis.chosen):'',state.gold>=Sim.getRaidCrisisCost?.(b.id),opened,free.map(c=>c.id+':'+c.power).join(','),busy.length,ui.bossPick.join(',')].join('|');if(!force&&ui.modalSignature===sig)return;ui.modalSignature=sig;
    $('#modal-title').textContent=b.name;
    const status=party?'토벌 중':b.cooldownRemaining>0?'재출현 대기':!opened?'마을을 열어야 갈 수 있어요':'출현 중 · 파견할 수 있어요';
    const timer=party?bossTimer(party.remaining):b.cooldownRemaining>0?bossTimer(b.cooldownRemaining):'';
    const stones=(2+Math.floor((b.baseMinPower??b.minPower)/65))+'~'+(4+Math.floor((b.baseMinPower??b.minPower)/65));
    const recipes=bossRecipeList(b.id);
    // 보스 약점 (2026-11-10): one line — which weapons it is weak to and what that does.
    const weakNames=(b.weak||(DATA.bosses||[]).find(x=>x.id===b.id)?.weak||[]).map(t=>(DATA.equipment?.weaponTypes||[]).find(w=>w.id===t)?.name||t);
    const weakLine=weakNames.length?'<p class="boss-weak">'+icon('sword')+' 약점 <b>'+escape(weakNames.join('·'))+'</b> — 이 무기를 든 모험가 1명마다 성공률 +5%p (최대 +15%p)</p>':'';
    const drops=weakLine+'<div class="boss-drops"><h4>'+icon('gem')+' 드랍품</h4><div class="boss-drop-list">'
      +recipes.slice(0,6).map(rc=>'<span class="boss-drop" data-tip="'+escape(rc.name+' · 희귀 설계도')+'">'+itemArt(rc)+'<b>'+escape(rc.name)+'</b></span>').join('')
      +(recipes.length>6?'<span class="boss-drop more">외 '+(recipes.length-6)+'종</span>':'')+'</div>'
      +'<p class="boss-drop-note">'+itemPic('rare_recipe_scroll','rare-scroll')+'희귀 설계도 <b class="rare-rate">'+Math.round((b.rareChance??.12)*100)+'%</b> (토벌대 중 한 명 · 확정까지 '+(b.pityLeft||8)+'회) · 골드 약 '+num(b.gold)+' G씩 · 경험치 '+num(b.xp)+' · 강화석 '+stones+'개</p></div>';
    const head='<div class="world-boss-banner '+(party?'fighting':b.cooldownRemaining>0?'cooldown':'ready')+'"><span>'+icon('shield')+'</span><div><small>'+escape(town?.name||'')+' · '+escape(r?.name||'')+'</small><h3>'+escape(status)+'</h3></div>'+(timer?'<strong>'+timer+'</strong>':'')+'</div>'
      // Recommended level: the level at which an adventurer's power reaches the boss's requirement (same scale as the hunting grounds).
      +'<div class="metrics-grid four-columns">'+metric('권장 레벨','Lv.'+Math.max(1,Math.round((b.minPower-8)/4.2+1)),'')+metric('필요 전투력',num(b.minPower),'','sword')+metric('최대 인원',b.partySize,'명','people')+metric('토벌 시간',secondsLabel(b.duration),'','clock')+'</div>';
    let body='';
    if(party){
      body=crisisBand(party.crisis,'raid-crisis',b.id,Sim.getRaidCrisisCost?Sim.getRaidCrisisCost(b.id):0,party.roles&&party.roles.includes('support'))+'<div class="mini-progress"><i style="width:'+pct(party.total-party.remaining,party.total)+'%"></i></div><p class="boss-progress-note">토벌까지 '+secondsLabel(party.remaining)+' · 예상 성공률 '+Math.round(party.successChance*100)+'%</p><div class="raid-members">'+party.memberIds.map(id=>{const a=state.adventurers.find(a=>a.id===id);return '<button data-action="hero" data-id="'+escape(id)+'">'+escape(a?.name||'모험가')+'</button>';}).join('')+'</div>';
    }else if(!opened){
      body='<p class="modal-description">'+escape(town?.name||'이 마을')+'에 지점을 열면 그 마을 모험가를 골라 보낼 수 있어요.</p>';
    }else if(b.cooldownRemaining>0){
      body='<p class="modal-description">보스가 다시 나타나면 파티를 골라 보낼 수 있어요.</p>';
    }else{
      const rows=all.length?all.map(c=>{const a=state.adventurers.find(x=>x.id===c.id),on=ui.bossPick.includes(c.id),full=!on&&ui.bossPick.length>=b.partySize,weak=c.power<b.minPower,locked=!!c.block;
        return '<button type="button" class="boss-pick'+(on?' on':'')+(weak?' weak':'')+(locked?' busy':'')+'" data-action="boss-pick" data-id="'+escape(c.id)+'"'+isDisabled(full||locked)+' aria-pressed="'+on+'"><span class="choice-radio"></span>'+portrait(a,0,40)+'<span class="bp-name"><b>'+escape(a.name)+'</b><small>Lv.'+a.level+' · '+escape(a.job)+(c.weak?' · <em class="bp-weak">약점 무기</em>':'')+'</small><small class="bp-status'+(locked?' wait':'')+'">'+escape(locked?c.block:'바로 출발 가능')+'</small></span><span class="bp-power'+(weak?' low':'')+'">'+icon('sword')+num(c.power)+'</span></button>';}).join(''):'<p class="quest-empty">이 마을에 모험가가 없어요.</p>';
      const tone=chance>=.7?'good':chance>=.45?'mid':'low';
      body='<h4 class="boss-pick-title">'+icon('people')+' 파티 고르기 <small>'+ui.bossPick.length+' / '+b.partySize+'명</small></h4><div class="boss-pick-list">'+rows+'</div>'
        +(busy.length?'<p class="boss-busy-note">흐리게 보이는 '+busy.length+'명은 하던 일을 마치면 보낼 수 있어요.</p>':'')
        +'<div class="boss-dispatch"><span>예상 성공률 <b class="'+tone+'">'+(ui.bossPick.length?Math.round(chance*100)+'%':'–')+'</b></span><button class="primary-button" data-action="boss-dispatch" data-id="'+escape(b.id)+'"'+isDisabled(!ui.bossPick.length)+'>'+icon('flame')+' 파견하기</button></div>';
    }
    $('#modal-body').innerHTML=head+drops+body;portraits($('#modal-body'));
  }

  // 위기 순간 (2026-11-09): a red band over the fight with three answers; after it, one quiet line about what happened.
  function crisisBand(c,action,id,cost,cleric){
    if(!c)return '';
    if(c.active)return '<div class="crisis-band"><div class="cb-head"><b>'+icon('flame')+' 위기!</b><span>파티가 몰리고 있어요</span><strong>'+Math.ceil(c.realLeft??c.left??0)+'초</strong></div><div class="cb-choices">'
      +'<button class="cb-choice" data-action="'+action+'" data-id="'+escape(id)+'" data-choice="potion"'+isDisabled(state.gold<cost)+'><b>물약 보내기</b><small>'+num(cost)+' G · 성공률 +'+(cleric?16:12)+'%p</small></button>'
      +'<button class="cb-choice" data-action="'+action+'" data-id="'+escape(id)+'" data-choice="hold"><b>버텨라!</b><small>공짜 · 반반으로 ±6%p</small></button>'
      +'<button class="cb-choice retreat" data-action="'+action+'" data-id="'+escape(id)+'" data-choice="retreat"><b>후퇴 명령</b><small>다치지 않고 돌아옴 · 보상 없음</small></button></div><p class="cb-note">안 고르면 그대로 싸워요(손해 없음).</p></div>';
    const said={potion:'물약을 보냈어요.',hold:c.delta>0?'버텨 냈어요!':'버티다 밀렸어요…',none:'위기를 그냥 넘겼어요.'}[c.chosen];
    return said?'<p class="crisis-done">'+icon('flame')+' '+escape(said)+'</p>':'';
  }
  function renderFame(force) {
    const fame=Sim.getFame(state),offers=Sim.getRecruitOffers(state),town=getTown(),ranks=DATA.campaign?.fameRanks||[];
    const sig=[state.gold,fame.value,town.id,town.staff.length,...offers.map(o=>o.id+':'+Math.ceil((o.expiresAt-state.time)/10))].join('|');
    if(!force&&ui.modalSignature===sig)return;ui.modalSignature=sig;
    $('#modal-body').innerHTML='<div class="fame-banner"><span class="fame-emblem">'+icon('star')+'</span><div><small>대장간 명성'+(currentTitle()?' · 칭호 「'+escape(currentTitle())+'」':'')+'</small><h3>'+escape(fame.rankName)+'</h3></div><strong>'+num(fame.value)+'<small>명성</small></strong></div><div class="fame-progress"><div class="status-track"><i style="width:'+pct(fame.progress,1)+'%"></i></div><p>'+(fame.nextThreshold===null?'가장 높은 명성에 도달했어요.':'다음 명성 단계까지 '+num(Math.max(0,fame.nextThreshold-fame.value))+' · 목표 '+num(fame.nextThreshold))+'</p></div><div class="fame-ranks">'+ranks.map((r,i)=>'<span class="'+(i===fame.rank?'current':i<fame.rank?'reached':'')+'">'+icon(i<=fame.rank?'star':'lock')+'<b>'+escape(r.name)+'</b><small>명성 '+num(r.min)+'</small></span>').join('')+'</div><h3 class="modal-section-title">'+icon('people')+' '+escape(town.name)+'을 찾아온 인재 <small>'+offers.length+'명</small></h3><div class="recruit-grid">'+(offers.length?offers.map(o=>'<article class="recruit-card"><div class="recruit-heading">'+staffPortrait(o,74)+'<div><span class="small-badge">'+(o.kind==='apprentice'?'방문 견습생':'방문 장인')+'</span><h3>'+escape(o.name)+' <small>'+(o.potentialGrade||'C')+(o.gradeLegacy?'(기존)':'')+'등급</small></h3><p>'+escape(Sim.getStaffRank(o.role==='smith'?1:o))+' · Lv. '+(o.role==='smith'?1:o.craftLevel)+'</p></div></div><div class="recruit-stats"><span>손놀림 <b>'+num(o.dexterity)+'</b></span><span>언변 <b>'+num(o.eloquence)+'</b></span><span>체력 <b>'+num(o.maxStamina)+'</b></span></div><div class="recruit-wage"><span>매달 지급할 급여</span><b>'+num(o.salary)+' G</b></div><p class="recruit-expiry">'+secondsLabel(o.expiresAt-state.time)+' 후 다른 마을로 떠나요</p><button class="primary-button" data-action="hire-recruit" data-id="'+escape(o.id)+'"'+isDisabled(state.gold<o.cost||town.staff.length>=30)+'>'+icon('plus')+num(o.cost)+' G · 고용하기</button></article>').join(''):empty('새로운 인연을 기다려요','우수·명품 장비와 보스 토벌로 명성을 쌓아보세요. 인재가 찾아오면 이곳에서 조건을 확인할 수 있어요.','people'))+'</div><div class="modal-link-row"><button class="secondary-button" data-action="nav" data-tab="staff">'+icon('hammer')+' 직원 관리</button><button class="secondary-button" data-action="nav" data-tab="inn">'+icon('bed')+' 여관 빈자리 보기</button><button class="secondary-button" data-action="finance">'+icon('coin')+' 골드 사용 계획</button></div><p class="provisional-note">새로운 고용비·보상 수치는 임시 설정입니다. 전체 경제 밸런스 검토는 별도로 진행할 예정이에요.</p>';portraits($('#modal-body'));
  }
  function renderTraining(force) {
    const w=getTown().staff.find(w=>w.id===ui.modalData);
    if(!w){$('#modal-body').innerHTML=empty('현재 지점의 직원을 선택해 주세요','직원 관리에서 훈련할 직원을 고를 수 있어요.','hammer');return;}
    const quote=Sim.getTrainingQuote(state,w.id),task=quote.activeTraining;
    const sig=[w.id,w.craftLevel,w.eloquence,w.maxStamina,w.salary,w.salaryDebt,state.gold,task?.id,Math.ceil(task?.remaining||0),quote.ok].join(':');if(!force&&ui.modalSignature===sig)return;ui.modalSignature=sig;
    // Training raises what the role uses: smiths craft level; sellers 말솜씨; the other roles 체력.
    if(quote.stat){
      const name=quote.statName;$('#modal-title').textContent=w.name+'의 '+name+' 훈련';
      $('#modal-body').innerHTML='<div class="training-person">'+staffPortrait(w,94)+'<div><h3>'+escape(w.name)+'</h3><p>'+escape(Sim.getStaffRank(w))+'</p><b>'+name+' '+quote.from+'</b></div></div>'+(task?'<div class="training-progress"><h3>'+icon('book')+' '+name+' '+(quote.from+(task.gain||0))+'을 향해 배우는 중</h3><div class="status-track"><i style="width:'+pct(task.total-task.remaining,task.total)+'%"></i></div><p>교육 자리로 이동 후 남은 훈련 '+secondsLabel(task.remaining)+'</p><small>'+(w.salaryDebt?'미지급 급여를 정산하면 훈련을 이어가요.':'훈련하는 동안에는 일을 쉽니다.')+'</small></div>':'<div class="training-quote"><span>현재 <b>'+name+' '+quote.from+'</b></span>'+icon('arrow')+'<span>훈련 후 <b>'+name+' '+quote.to+'</b></span></div><div class="metrics-grid three-columns">'+metric('훈련 비용',num(quote.cost),'G','coin')+metric('훈련 시간',secondsLabel(quote.duration||30),'','clock')+metric('현재 월급',num(w.salary),'G')+'</div><p class="modal-description">'+escape(quote.stat==='eloquence'?'말솜씨가 높을수록 장비를 더 비싸게 팔아요.':'체력이 높을수록 쉬지 않고 오래 일해요.')+'</p><button class="primary-button" data-action="start-training" data-id="'+escape(w.id)+'"'+isDisabled(!quote.ok)+'>'+icon('book')+(quote.cost?num(quote.cost)+' G · 훈련 시작':name+'이 최고치예요')+'</button>')+'<button class="secondary-button full-button" data-action="nav" data-tab="staff">직원 관리로 돌아가기</button>';portraits($('#modal-body'));
      return;
    }
    $('#modal-title').textContent=w.name+'의 제작 훈련';
    $('#modal-body').innerHTML='<div class="training-person">'+staffPortrait(w,94)+'<div><h3>'+escape(w.name)+'</h3><p>'+escape(Sim.getStaffRank(w))+'</p><b>제작기술 Lv. '+w.craftLevel+'</b></div></div>'+(task?'<div class="training-progress"><h3>'+icon('book')+' 제작기술 Lv. '+task.targetLevel+'을 향해 배우는 중</h3><div class="status-track"><i style="width:'+pct(task.total-task.remaining,task.total)+'%"></i></div><p>교육 자리로 이동 후 남은 훈련 '+secondsLabel(task.remaining)+'</p><small>'+(w.salaryDebt?'미지급 급여를 정산하면 훈련을 이어가요.':'훈련하는 동안에는 제작과 판매를 쉽니다.')+'</small></div>':'<div class="training-quote"><span>현재 <b>Lv. '+w.craftLevel+'</b></span>'+icon('arrow')+'<span>훈련 후 <b>Lv. '+quote.toLevel+'</b></span></div><div class="metrics-grid three-columns">'+metric('훈련 비용',num(quote.cost),'G','coin')+metric('훈련 시간',secondsLabel(quote.duration||30),'','clock')+metric('현재 월급',num(w.salary),'G')+'</div><p class="modal-description">'+escape(quote.message)+'</p><button class="primary-button" data-action="start-training" data-id="'+escape(w.id)+'"'+isDisabled(!quote.ok)+'>'+icon('book')+(w.craftLevel>=30?'최고 제작기술에 도달했어요':num(quote.cost)+' G · 훈련 시작')+'</button>')+'<button class="secondary-button full-button" data-action="nav" data-tab="staff">직원 관리로 돌아가기</button>';portraits($('#modal-body'));
  }
  function renderInvasion(force) {
    const townId=ui.modalData||state.activeTownId,town=state.towns[townId],inv=Sim.getInvasion(state,townId);
    if(!town){$('#modal-body').innerHTML=empty('운영 중인 마을을 선택해 주세요','월드맵에서 내 지점을 살펴보세요.','map');return;}
    $('#modal-title').textContent=town.name+'의 방어와 회복';
    if(!inv){if(force||ui.modalSignature!=='peace:'+townId){ui.modalSignature='peace:'+townId;$('#modal-body').innerHTML='<div class="peace-banner">'+icon('shield')+'<h3>오늘은 평온한 마을이에요.</h3><p>침공이 시작되면 이 마을의 모험가 전원이 돌아옵니다.<br>모두 집결한 뒤 함께 방어전을 치르고, 다친 모험가들은 여관에서 회복해요.</p></div><div class="invasion-explainer"><span>'+icon('people')+' 전원 귀환</span><span>'+icon('shield')+' 함께 방어</span><span>'+icon('bed')+' 여관 요양</span><span>'+icon('gem')+' 특별 제작 재료</span></div><button class="secondary-button full-button" data-action="nav" data-tab="inn">'+icon('bed')+' 여관 준비하기</button>';}return;}
    const phase=invasionPhase(inv),quote=Sim.getReliefQuote(state,townId),members=inv.memberIds.map(id=>state.adventurers.find(a=>a.id===id)).filter(Boolean),recovering=members.filter(a=>a.injuryUntil>state.time),phaseIndex=['recalling','battle','recovery','resolved'].indexOf(phase),reward=inv.reward||{},material=DATA.materials[reward.material];
    const sig=[townId,inv.id,phase,inv.arrivedCount,Math.ceil(inv.battleRemaining),Math.ceil(inv.injuryRemaining),inv.totalWalletLoss,inv.reliefFunded,state.gold,quote.cost,quote.count,...members.map(a=>a.id+':'+Math.ceil(a.injuryUntil-state.time)+':'+a.gold+':'+a.medicalCost)].join('|');if(!force&&ui.modalSignature===sig)return;ui.modalSignature=sig;
    const progress=phase==='recalling'?pct(inv.arrivedCount,inv.totalMembers):phase==='battle'?pct(inv.battleTotal-inv.battleRemaining,inv.battleTotal):100;
    const headline=phase==='recalling'?'모두 돌아올 때까지 기다려요.':phase==='battle'?'모두 모였어요. 마을을 지켜냅시다.':phase==='recovery'?'이제는 함께 회복할 시간이에요.':'모험가들이 다시 길을 나섭니다.';
    $('#modal-body').innerHTML='<div class="invasion-banner phase-'+phase+'"><span>'+icon(phase==='recovery'?'heart':'shield')+'</span><div><small>'+escape(inv.invaderName||'마을 침공')+'</small><h3>'+headline+'</h3><p>'+escape(invasionLabels[phase])+'</p></div></div><div class="invasion-phases">'+[['recalling','전원 귀환'],['battle','마을 방어'],['recovery','치료와 회복'],['resolved','일상으로']].map(([key,label],i)=>'<span class="'+(i===phaseIndex?'current':i<phaseIndex?'done':'')+'"><b>'+(i+1)+'</b>'+label+'</span>').join('')+'</div><div class="invasion-progress"><div class="status-track"><i style="width:'+progress+'%"></i></div><p>'+(phase==='recalling'?'<b>'+inv.arrivedCount+' / '+inv.totalMembers+'명 도착</b> · 마지막 모험가가 집결해야 전투를 시작합니다.':phase==='battle'?'전원 '+inv.totalMembers+'명 방어 중 · '+secondsLabel(inv.battleRemaining)+' 남음':recovering.length?'현재 '+recovering.length+'명 회복 중 · 가장 긴 요양 '+secondsLabel(inv.injuryRemaining):'남은 요양 없음')+'</p></div><div class="metrics-grid three-columns">'+metric('방어 참가',inv.totalMembers,'명','people')+metric('이번 침공 부상자',inv.injuredCount||0,'명','heart')+metric('모험가 지갑에서 지출',num(inv.totalWalletLoss||0),'G','coin')+'</div>'+(inv.rewarded?'<div class="invasion-reward">'+materialArt(reward.material)+'<div><small>대장간이 받은 특별 보상 · 공유 창고 지급 완료</small><h3>'+escape(material?.name||'수호의 불씨')+' × '+num(reward.amount)+'</h3></div>'+icon('check')+'</div>':'<p class="supply-note">방어전을 마치면 대장간에 '+escape(material?.name||'수호의 불씨')+' '+num(reward.amount)+'개를 지급합니다.</p>')+'<h3 class="modal-section-title">'+icon('people')+' 마을 모험가들의 상태</h3><div class="invasion-members">'+members.map(a=>{const arrived=inv.arrivedIds.includes(a.id),loss=inv.walletLossByHero?.[a.id],injured=a.injuryUntil>state.time,assisted=inv.assistedIds?.includes(a.id);return '<button class="invasion-member '+(injured?'injured':'')+'" data-action="hero" data-id="'+escape(a.id)+'"><span class="member-state-icon">'+icon(injured?'bed':phase==='recalling'?(arrived?'check':'move'):phase==='battle'?'shield':'heart')+'</span><span><b>'+escape(a.name)+'</b><small>'+(phase==='recalling'?(arrived?'집결 완료':'마을로 귀환 중'):injured?'요양 '+secondsLabel(a.injuryUntil-state.time):escape(heroStatus(a)))+(assisted?' · 구호 지원됨':'')+'</small>'+(loss?'<small>침공 지출 −'+num(loss.total)+' G'+(a.medicalCost?' · 미납 치료비 '+num(a.medicalCost)+' G':'')+'</small>':'')+'</span><strong>'+num(a.gold)+' G</strong>'+icon('arrow')+'</button>';}).join('')+'</div><div class="relief-panel"><div><h3>'+icon('heart')+' 대장간의 회복 지원</h3><p>치료비 지원 · 요양 시간 절반</p><small>'+(quote.count?quote.count+'명 지원 · 1명당 생활비 +'+num(quote.aidPerHero)+' G':escape(quote.message))+'</small>'+(inv.reliefFunded?'<small>이 방어전에 지원한 금액 '+num(inv.reliefFunded)+' G</small>':'')+'</div><button class="primary-button" data-action="fund-relief" data-id="'+escape(townId)+'"'+isDisabled(!quote.ok)+'>'+icon('heart')+(quote.count?num(quote.cost)+' G · 구호 지원':'지원할 부상자가 없어요')+'</button></div><div class="modal-link-row"><button class="secondary-button" data-action="incident-town" data-id="'+escape(townId)+'">'+icon('shop')+' 이 마을 보기</button><button class="secondary-button" data-action="finance">'+icon('coin')+' 골드 사용처 살펴보기</button></div>';
  }
  function renderFinance(force) {
    const pay=Sim.getPayroll(state),choices=Sim.getGoldSinks(state),lab=Sim.getResearch?Sim.getResearch(state):null,sig=[state.gold,pay.totalSalary,pay.totalDebt,pay.daysUntil,JSON.stringify(choices),lab&&lab.open,lab&&lab.totalLevels].join('|');if(!force&&ui.modalSignature===sig)return;ui.modalSignature=sig;
    const labCard=lab?'<button class="research-entry'+(lab.open?'':' locked')+'" data-action="research"><span class="gold-sink-icon">'+icon(lab.open?'book':'lock')+'</span><div><h3>대장간 연구 <small>'+lab.totalLevels+' / '+lab.maxTotal+'단계</small></h3><p>'+(lab.open?'골드를 들여 모든 지점의 제작·판매·강화·여관을 영구히 강화해요. 이번 진행에만 적용돼요.':'2호점을 열면 연구소가 열려요. 미리 어떤 연구가 있는지 볼 수 있어요.')+'</p></div>'+icon('arrow')+'</button>':'';
    $('#modal-body').innerHTML=labCard+'<div class="metrics-grid three-columns">'+metric('보유 골드',num(state.gold),'G','coin')+metric('한 달 직원 급여',num(pay.totalSalary),'G')+metric('미지급 급여',num(pay.totalDebt),'G')+'</div><div class="finance-payday">'+icon('calendar')+' 다음 급여일 '+escape(calendarDayLabel(pay.nextPayDay))+' · '+pay.daysUntil+'일 남음'+(pay.upkeep?' · 지점 유지비 '+num(pay.upkeep)+' G':'')+'<button class="text-button" data-action="finance-payroll">급여 자세히 보기 '+icon('arrow')+'</button></div><div class="gold-sink-grid">'+choices.map(c=>'<button class="gold-sink-card" data-action="gold-use" data-id="'+escape(c.id)+'"><span class="gold-sink-icon">'+icon({'train-staff':'book','fund-relief':'heart','hire-recruit':'people','upgrade-inn':'bed','expand-shop':'building','pay-wages':'coin','place-furnace':'flame','place-display':'shelf'}[c.action]||'coin')+'</span><div><h3>'+escape(c.label)+'</h3><span class="sink-cost '+(c.available?'ready':'')+'">'+(c.cost!==null&&c.cost!==undefined?num(costValue(c.cost))+' G':({training:'교육할 직원 없음',relief:'지금은 구호할 일 없음',recruit:'찾아온 인재 없음',inn:'최고 단계',shop:'최고 단계',warehouse:'최고 단계',wages:'밀린 급여 없음',furnace:'설치 한도 · 대장간 확장 필요',display:'설치 한도 · 대장간 확장 필요'})[c.id]||'지금은 없음')+'</span></div>'+icon('arrow')+'</button>').join('')+'</div><div class="finance-other"><div class="modal-link-row"><button class="secondary-button" data-action="nav" data-tab="quests">'+icon('scroll')+' 재료 의뢰</button></div></div>';
  }
  // --- Forge research (dist/research.js): per-save gold sink, opens with the second branch ---
  function renderResearch(force) {
    const lab=Sim.getResearch?Sim.getResearch(state):null;
    if(!lab){$('#modal-body').innerHTML=empty('연구소를 준비 중이에요','잠시 후 다시 열어 주세요.','book');return;}
    const sig=['research',state.gold,lab.towns,lab.totalLevels].join('|');if(!force&&ui.modalSignature===sig)return;ui.modalSignature=sig;
    const banner='<div class="research-banner'+(lab.open?'':' locked')+'"><span>'+icon(lab.open?'book':'lock')+'</span><div><small>'+(lab.open?'모든 지점에 적용 · 이번 진행에만 유지':'아직 잠겨 있어요')+'</small><h3>'+(lab.open?'골드로 대장간의 비법을 연구해요':'2호점을 열면 연구소가 열려요')+'</h3><p>1~5단계는 지점 2곳, 6~8단계는 3곳, 9~10단계는 4곳이 필요해요.</p></div><strong>'+num(lab.spent)+'<small>G 투자</small></strong></div>';
    // While the lab is locked the banner already says "2호점을 열면 연구소가 열려요", so the cards don't repeat it 8 times.
    const cards='<div class="research-grid">'+lab.nodes.map(n=>{const q=n.quote,maxed=n.level>=n.maxLevel;
      return '<article class="research-card'+(maxed?' maxed':'')+'"><div class="research-head"><span class="research-icon">'+icon(n.icon)+'</span><div><h4>'+escape(n.name)+'</h4><small>'+n.level+' / '+n.maxLevel+'단계</small></div></div><div class="research-pips">'+Array.from({length:n.maxLevel},(_,i)=>'<i class="'+(i<n.level?'on':'')+'"></i>').join('')+'</div><p>'+escape(n.description)+'</p><div class="research-effect"><span>지금 <b>'+escape(n.level?n.current:'없음')+'</b></span>'+(maxed?'':icon('arrow')+'<span>다음 <b>'+escape(n.nextEffect)+'</b></span>')+'</div>'+(maxed?'<button class="secondary-button" disabled>'+icon('check')+' 최고 단계</button>':'<button class="primary-button" data-action="research-buy" data-id="'+escape(n.id)+'"'+isDisabled(!q.ok)+'>'+icon('book')+num(q.cost)+' G · '+q.next+'단계 연구</button>'+(q.ok||!lab.open?'':'<small class="research-reason">'+escape(q.reason)+'</small>'))+'</article>';}).join('')+'</div>';
    $('#modal-body').innerHTML=banner+cards+'<p class="provisional-note">연구 효과와 비용은 임시 설정입니다. 전체 경제 밸런스 검토 때 다시 맞춰요.</p>';
  }
  // --- Achievements (dist/achievements.js): PERMANENT profile, stored apart from the game save ---
  const Ach=window.ForgeAchievements||null;
  let achProfile=null,achCheckAt=0;
  function readAchievementProfile(){if(!Ach)return null;try{return Ach.normalizeProfile(JSON.parse(localStorage.getItem(Ach.PROFILE_KEY)||'null'));}catch(_){return Ach.blankProfile();}}
  function achievementProfile(){if(!achProfile)achProfile=readAchievementProfile();return achProfile;}
  // Another tab may have unlocked something meanwhile: keep the union, never drop an unlock.
  function saveAchievementProfile(){
    if(!Ach||!achProfile)return;
    const stored=readAchievementProfile();if(stored)for(const [id,at] of Object.entries(stored.unlocked))if(!achProfile.unlocked[id])achProfile.unlocked[id]=at;
    try{localStorage.setItem(Ach.PROFILE_KEY,JSON.stringify(achProfile));}catch(_){}
  }
  function currentTitle(){if(!Ach)return null;const p=achievementProfile();return p&&p.title&&Ach.LIST.find(a=>a.id===p.title)?.title||null;}
  function renderBrandTitle(){
    const el=$('.brand small');if(!el||!Ach)return;const title=currentTitle();
    const text=title?'칭호 · '+title:'LITTLE EMBER · A BLACKSMITH STORY';if(el.textContent!==text)el.textContent=text;
  }
  function checkAchievements(){
    const p=achievementProfile();if(!p||saveBlocked)return;
    const fresh=Ach.evaluate(p,Ach.metrics(state,Sim));if(!fresh.length)return;
    saveAchievementProfile();sfx('fanfare');
    for(const d of fresh)pushFeed('achievement','업적 달성 · '+d.name+(d.title?' · 칭호 「'+d.title+'」':''),{kind:'achievements',id:d.category,label:'업적 보기'},{kind:'achievements',id:d.category});
    toast('업적 달성 · '+fresh.map(d=>d.name).join(', '),false,{kind:'achievements',id:fresh[0].category,label:'보기'});
    if(ui.modal==='achievements')renderAchievements(true);
  }
  // --- Tutorial -----------------------------------------------------------------------------------------------
  // 1) Tour: dims the game and lights up one part of the screen at a time ([다음] / [건너뛰기]). The game is paused.
  // 2) Missions (once per browser, cannot be skipped): the player really handles a craft request, sets up auto-craft
  //    and hires someone. A waiting step moves on only when the player has done the lit thing; a watching step lets the
  //    game run until the work is really done. If the needed window was closed it is opened again.
  const TOUR_STEPS=[
    {title:'작은 불꽃 대장간에 오신 걸 환영해요!',body:'모험가들에게 장비를 만들어 팔고, 마을에서 제일가는 대장간으로 키워 보세요. 화면을 하나씩 알려 드릴게요.'},
    {target:'.village-forge@bottom',title:'우리 대장간',body:'누르면 대장간 안으로 들어가요. 작업대에서 장비를 만들고, 다 만든 장비를 진열하면 판매 직원이 모험가에게 팔아요.'},
    {target:'.village-inn@bottom',title:'여관',body:'사냥에서 돌아온 모험가들이 쉬는 곳이에요. 여관이 넓을수록 마을에 머무는 모험가가 늘어나요.'},
    {target:'#calendar-chip',title:'달력',body:'오늘 날짜와 이번 계절 행사예요. 누르면 달력과 축제를 볼 수 있어요.'},
    {target:'.gold-pill',title:'골드',body:'가진 돈이에요. 누르면 월급과 골드를 쓸 곳(성장 준비·연구소)을 볼 수 있어요.'},
    {target:'.main-nav',title:'메뉴',body:'대장간 · 캐릭터 · 의뢰 · 시설 배치 · 자동 운영 · 월드맵 · 연구 · 업적 · 환경설정이 모두 여기 있어요.'},
    {target:'.main-nav [data-tab="world"]',title:'월드맵',body:'모험가들이 사냥하는 곳과 다른 마을이 있어요. 조건을 채우면 다음 마을에 새 지점을 열 수 있어요.'},
    {target:'#game-feed',title:'소식',body:'돌발 사건, 명품 완성, 마을 습격 같은 소식이 여기에 올라와요. 누르면 그 일을 바로 볼 수 있어요.'},
    {target:'.main-nav .nav-settings',title:'도움말',body:'궁금한 게 생기면 환경설정 › 도움말을 열어 보세요. 이제 대장간 일을 직접 해 볼게요!'}
  ];
  // Korean particle after a name: 을/를, 이/가 chosen by whether the last syllable ends in a consonant.
  const josa=(word,withFinal,without)=>{const w=String(word||''),c=w.charCodeAt(w.length-1);return w+((c>=0xAC00&&c<=0xD7A3&&(c-0xAC00)%28)?withFinal:without);};
  const mission={};
  const tutorialTown=()=>getTown();
  const missionOrder=()=>state.orders.find(o=>o.id===mission.orderId);
  const openWindow=(type,setup)=>{if(ui.modal!==type){if(setup)setup();showModal(type);}};
  // The furnace job for the tutorial request, for the live "만드는 중" line.
  const missionCraftText=()=>{
    const o=missionOrder(),r=recipe(mission.recipeId),name=r?.name||'장비';
    if(!o)return josa(name,'을','를')+' 만들고 있어요.';
    const job=Object.values(state.towns).flatMap(t=>t.queue).find(q=>q.orderId===o.id);
    if(o.reservedItemId)return josa(name,'이','가')+' 완성됐어요! '+(mission.hero||'모험가')+'님이 받으러 오면 바로 전달돼요.';
    if(!job)return josa(name,'을','를')+' 화덕에 올리는 중이에요.';
    if(job.status!=='working')return '대장장이가 화덕 앞으로 가고 있어요. 도착하면 '+josa(name,'을','를')+' 만들기 시작해요.';
    return '대장장이가 '+josa(name,'을','를')+' 두드리고 있어요… '+Math.round((1-job.remaining/job.total)*100)+'%';
  };
  // Auto-craft: the first ready recipe the shop already has materials for (else the cheapest, with materials given).
  function missionAutoRecipe(){
    const ready=Sim.getUnlockedRecipes(state).filter(r=>!r.bossRecipe&&!r.unlockDrop).sort((a,b)=>Sim.getRecipeLevel(a)-Sim.getRecipeLevel(b)||a.name.localeCompare(b.name));
    return ready.find(r=>Object.entries(r.cost).every(([k,n])=>(state.materials[k]||0)>=n*3))||ready[0]||null;
  }
  const MISSION_STEPS=[
    // ── 제작 의뢰 ──
    {group:'제작 의뢰',title:'손님이 부탁하러 왔어요!',body:()=>(mission.hero||'모험가')+'님이 '+josa((recipe(mission.recipeId)?.name||'장비'),'을','를')+' 만들어 달라고 부탁했어요. 의뢰는 의뢰소에서 받아요. 같이 처리해 볼게요.',
      before:()=>{if(ui.modal)closeModal();if(ui.view!=='shop')setView('shop');if(!mission.orderId){const made=Sim.createTutorialOrder(state);if(made.ok){mission.orderId=made.order.id;mission.recipeId=made.recipe.id;mission.hero=made.adventurer.name;invalidate();render(true);}}}},
    {group:'제작 의뢰',target:'.main-nav [data-tab="quests"]',title:'의뢰소 열기',body:'오른쪽 아래 빛나는 [의뢰] 버튼을 눌러 보세요.',done:()=>ui.modal==='quests',before:()=>{ui.questTab='materials';},ensure:()=>{if(ui.modal&&ui.modal!=='quests')closeModal();}},
    {group:'제작 의뢰',target:'#quest-tab-content',title:'재료 의뢰',body:'여기는 재료 의뢰예요. 부족한 재료를 골라 의뢰를 걸면 모험가들이 사냥하면서 모아다 줘요. 지금은 넘어갈게요.',
      ensure:()=>{openWindow('quests',()=>{ui.questTab='materials';});if(ui.questTab!=='materials'){ui.questTab='materials';renderModal(true);}}},
    {group:'제작 의뢰',target:'[data-action="quest-tab"][data-tab="orders"]',title:'제작 의뢰 탭',body:'[제작 의뢰] 탭을 눌러 보세요. 모험가가 부탁한 장비가 여기 모여요.',done:()=>ui.modal==='quests'&&ui.questTab==='orders',
      ensure:()=>openWindow('quests',()=>{ui.questTab='materials';})},
    {group:'제작 의뢰',target:()=>'[data-action="select-order"][data-id="'+mission.orderId+'"]',title:()=>(mission.hero||'모험가')+'의 부탁',body:()=>(mission.hero||'모험가')+'님의 의뢰를 눌러 보세요.',done:()=>ui.modal==='quests'&&ui.selectedOrder===mission.orderId,
      ensure:()=>{openWindow('quests',()=>{ui.questTab='orders';});if(ui.questTab!=='orders'){ui.questTab='orders';renderModal(true);}}},
    {group:'제작 의뢰',target:'.order-selection',title:'맞는 장비가 없어요',body:'창고와 진열대에 이 장비가 없으니 새로 만들어야 해요. 원래는 재료가 필요하지만, 처음이니까 재료는 제가 챙겨 드릴게요!',
      ensure:()=>{openWindow('quests',()=>{ui.questTab='orders';});if(ui.questTab!=='orders'||ui.selectedOrder!==mission.orderId){ui.questTab='orders';ui.selectedOrder=mission.orderId;ui.modalSignature='';renderModal(true);}},
      after:()=>{const r=recipe(mission.recipeId);if(r){const need={};for(const [k,n] of Object.entries(r.cost)){const lack=n-(state.materials[k]||0);if(lack>0)need[k]=lack;}if(Object.keys(need).length)Sim.grantTutorialSupplies(state,{materials:need});ui.modalSignature='';renderModal(true);}}},
    {group:'제작 의뢰',target:()=>'[data-action="order-make"][data-id="'+mission.orderId+'"]',title:'만들기',body:'재료를 넣어 뒀어요. [새로 제작해서 즉시 납품하기]를 눌러 보세요.',
      done:()=>{const o=missionOrder();return !o||o.status!=='open'||!!o.reservedItemId||Object.values(state.towns).some(t=>t.queue.some(q=>q.orderId===mission.orderId));},
      ensure:()=>{openWindow('quests',()=>{ui.questTab='orders';});if(ui.questTab!=='orders'||ui.selectedOrder!==mission.orderId){ui.questTab='orders';ui.selectedOrder=mission.orderId;ui.modalSignature='';renderModal(true);}}},
    // Watch it being made: the workshop room (where the furnaces are), with the workbench panel out of the way.
    {group:'제작 의뢰',watch:true,title:'대장장이가 만드는 중',body:missionCraftText,before:()=>{if(ui.modal)closeModal();if(ui.view!=='shop')setView('shop');const panel=$('.work-panel');if(panel)panel.hidden=true;scene?.focusRoom?.('workshop');},
      ensure:()=>{if(ui.modal)closeModal();if(scene&&scene.view!=='world'&&scene.shopRoom!=='workshop')scene.focusRoom('workshop');},
      done:()=>{const o=missionOrder();return !o||o.status!=='open';}},
    {group:'제작 의뢰',title:'전달 완료!',after:()=>{scene?.focusRoom?.('shop');},body:()=>{const o=missionOrder();return (mission.hero||'모험가')+'님이 '+josa((recipe(mission.recipeId)?.name||'장비'),'을','를')+' 받아 갔어요. 의뢰비 '+num(o?.payout||0)+' G를 받았어요! 제작 의뢰는 이렇게 받고, 만들고, 전달하면 돼요. 앞으로는 보스를 잡아 희귀 설계도를 얻은 모험가가 전용 장비를 이렇게 부탁하러 와요.';}},
    // ── 자동 운영 ──
    {group:'자동 운영',title:'매번 직접 만들 필요 없어요',body:'자동 운영에서 장비를 정해 두면, 직원들이 그 장비를 알아서 만들어 재고를 채워 둬요. 하나 정해 볼게요.'},
    {group:'자동 운영',target:'.main-nav [data-tab="operations"]',title:'자동 운영 열기',body:'오른쪽 아래 빛나는 [자동 운영] 버튼을 눌러 보세요.',done:()=>ui.modal==='operations',ensure:()=>{if(ui.modal&&ui.modal!=='operations')closeModal();}},
    {group:'자동 운영',target:'[data-action="operations-tab"][data-tab="production"]',title:'자동 제작 탭',body:'[자동 제작] 탭을 눌러 보세요.',done:()=>ui.modal==='operations'&&ui.operationsTab==='production',ensure:()=>openWindow('operations')},
    {group:'자동 운영',target:()=>'.ops-recipe .or-add[data-id="'+(mission.autoId||'')+'"]',title:()=>(recipe(mission.autoId)?.name||'장비')+' 추가',body:()=>'창고에 재료가 있는 '+(recipe(mission.autoId)?.name||'장비')+' 옆 [추가]를 눌러 보세요.',
      done:()=>Object.hasOwn(tutorialTown()?.operations?.craftRules||{},mission.autoId),
      before:()=>{const r=missionAutoRecipe();mission.autoId=r?.id||null;if(r&&!Object.entries(r.cost).every(([k,n])=>(state.materials[k]||0)>=n*3)){const need={};for(const [k,n] of Object.entries(r.cost))need[k]=Math.max(0,n*3-(state.materials[k]||0));Sim.grantTutorialSupplies(state,{materials:need});}const f=ui.autoFilter||(ui.autoFilter={});f.slot='all';f.ready=true;f.band='all';},
      ensure:()=>{openWindow('operations',()=>{ui.operationsTab='production';});if(ui.operationsTab!=='production'){ui.operationsTab='production';renderOperations(true);}}},
    {group:'자동 운영',target:'.operation-plan',title:'사용 켜고 저장',body:'[사용]에 체크하고 [저장]을 눌러 보세요. 재고 수만큼 늘 채워 둬요.',done:()=>!!tutorialTown()?.operations?.craftRules?.[mission.autoId]?.enabled,
      ensure:()=>{openWindow('operations',()=>{ui.operationsTab='production';});if(ui.operationsTab!=='production'){ui.operationsTab='production';renderOperations(true);}}},
    {group:'자동 운영',title:'자동 제작 시작!',body:()=>'지금부터 직원들이 '+josa((recipe(mission.autoId)?.name||'이 장비'),'을','를')+' '+(tutorialTown()?.operations?.craftRules?.[mission.autoId]?.targetStock||3)+'개까지 알아서 만들어 두고, 팔리면 다시 채워요. 재료가 떨어지지 않게 [재료 매입] 탭에서 자동 매입도 켤 수 있어요.',before:()=>{if(ui.modal)closeModal();}},
    // ── 직원 고용 ──
    {group:'직원 고용',title:'일손을 늘려요',body:'직원이 많을수록 더 많이 만들고 더 많이 팔 수 있어요. 직원을 한 명 뽑아 볼게요.'},
    {group:'직원 고용',target:'.main-nav [data-tab="characters"]',title:'캐릭터 열기',body:'오른쪽 아래 빛나는 [캐릭터] 버튼을 눌러 보세요. 모험가와 직원을 볼 수 있어요.',done:()=>['adventurers','staff'].includes(ui.modal),ensure:()=>{if(ui.modal&&!['adventurers','staff'].includes(ui.modal))closeModal();}},
    {group:'직원 고용',target:'[data-action="modal-switch"][data-id="staff"]',title:'직원 탭',body:'[직원] 탭을 눌러 보세요.',done:()=>ui.modal==='staff',before:()=>{mission.staff=tutorialTown()?.staff.length||0;},ensure:()=>{if(!['adventurers','staff'].includes(ui.modal))showModal('adventurers');}},
    {group:'직원 고용',target:'[data-action="hire-candidate"]:not([disabled])',title:'지원자 고용',body:'지원자 목록이에요. 빛나는 [고용] 버튼을 눌러 이 지원자를 뽑아 보세요. 처음이니 고용비가 모자라면 제가 보태 드릴게요!',
      done:()=>(tutorialTown()?.staff.length||0)>mission.staff||(mission.waited>8&&!document.querySelector('[data-action="hire-candidate"]')),
      before:()=>{mission.waited=0;},
      ensure:()=>{openWindow('staff');mission.waited=(mission.waited||0)+1;const costs=[...document.querySelectorAll('[data-action="hire-candidate"]')].map(b=>Number((b.textContent.match(/[\d,]+/)||['0'])[0].replace(/,/g,''))).filter(n=>n>0);const need=costs.length?Math.min(...costs)-state.gold:0;if(need>0){Sim.grantTutorialSupplies(state,{gold:need});ui.modalSignature='';renderModal(true);}}},
    {group:'직원 고용',title:'준비 끝!',body:'새 직원은 매달 1일에 월급을 받아요. 골드를 넉넉히 두세요. 이제부터 왼쪽 달력 아래에 [퀘스트]가 생기고, 가끔 [돌발] 사건도 일어나요. 눌러서 확인해 보세요. 마음껏 대장간을 키워 보세요!',before:()=>{if(ui.modal)closeModal();}}
  ];
  let tutorialSteps=null,tutorialStep=-1,tutorialPaused=false,tutorialWasPaused=false,tutorialOnEnd=null,tutorialPoll=0,tutorialRect='',tutorialForced=false;
  function runGuide(steps,{pause,forced,onEnd}){
    if(!$('#canvas-wrap'))return;
    tutorialSteps=steps;tutorialOnEnd=onEnd||null;tutorialPaused=!!pause;tutorialForced=!!forced;tutorialStep=0;
    if(pause){tutorialWasPaused=!!ui.paused;ui.paused=true;renderHeader();}
    clearInterval(tutorialPoll);tutorialPoll=setInterval(tickTutorial,250);
    enterTutorialStep();
  }
  function startTutorial(){if(ui.modal)closeModal();runGuide(TOUR_STEPS,{pause:true,onEnd:()=>{if(!preferences.missionsDone)setTimeout(startMissions,300);}});}
  function startMissions(){for(const k of Object.keys(mission))delete mission[k];runGuide(MISSION_STEPS,{pause:false,forced:true,onEnd:()=>{preferences.missionsDone=true;savePreferences();syncIncidents();}});}
  // Sudden incidents start once the hands-on tutorial is over (the first one comes 3 game days later).
  function syncIncidents(){
    if(!preferences.missionsDone)return;
    if(Sim.enableIncidents&&!(state.incidents&&state.incidents.enabled))Sim.enableIncidents(state,true);
    if(Sim.enableQuests&&!(state.questBook&&state.questBook.enabled))Sim.enableQuests(state,true); // growth quests, same moment
    if(Sim.enableCrises&&!(state.raidState&&state.raidState.crisisOn))Sim.enableCrises(state,true); // crises in boss fights and dispatches
    if(Sim.setRareOrdersOnly&&!state.rareOrdersOnly)Sim.setRareOrdersOnly(state,true); // craft requests: rare-recipe holders only (user decision)
  }
  function endTutorial(skipped){
    const onEnd=tutorialOnEnd;clearInterval(tutorialPoll);tutorialSteps=null;tutorialStep=-1;tutorialOnEnd=null;tutorialForced=false;$('#tutorial')?.remove();
    if(tutorialPaused){ui.paused=saveBlocked||tutorialWasPaused;lastFrame=performance.now();renderHeader();}tutorialPaused=false;
    preferences.tutorialDone=true;savePreferences();
    // Skipping the tour still leads into the hands-on missions; those themselves cannot be skipped.
    if(onEnd)onEnd();
  }
  const stepValue=v=>typeof v==='function'?v():v;
  function enterTutorialStep(){const step=tutorialSteps&&tutorialSteps[tutorialStep];if(!step)return;try{step.before&&step.before();}catch(_){}try{step.ensure&&step.ensure();}catch(_){}tutorialRect='';renderTutorial();}
  function nextTutorialStep(){
    const step=tutorialSteps&&tutorialSteps[tutorialStep];try{step&&step.after&&step.after();}catch(_){}
    if(!tutorialSteps||tutorialStep>=tutorialSteps.length-1){endTutorial(false);return;}
    tutorialStep++;enterTutorialStep();
  }
  function tickTutorial(){
    const step=tutorialSteps&&tutorialSteps[tutorialStep];if(!step)return;
    // Missions need the game running (the request is really made); a pause would leave the player stuck.
    if(tutorialForced&&ui.paused&&!saveBlocked){ui.paused=false;lastFrame=performance.now();renderHeader();}
    try{step.ensure&&step.ensure();}catch(_){}
    if(step.done){let ok=false;try{ok=!!step.done();}catch(_){}if(ok){sfx('unlock');nextTutorialStep();return;}}
    renderTutorial(true);
  }
  function tutorialTargetRect(step,el){
    const [selector,part]=(stepValue(step.target)||'').split('@');
    const target=selector?$(selector):null;if(!target||target.closest('[hidden]'))return null;
    if(step._scrolled!==tutorialStep){step._scrolled=tutorialStep;try{target.scrollIntoView({block:'nearest'});}catch(_){}}
    const box=target.getBoundingClientRect();if(!(box.width>4&&box.height>4))return null;
    const frame=el.getBoundingClientRect(),scale=frame.width/el.offsetWidth||1,pad=6;
    const top=part==='bottom'?box.top+box.height*.48:box.top,height=part==='bottom'?box.height*.52:box.height;
    return {x:(box.left-frame.left)/scale-pad,y:(top-frame.top)/scale-pad,w:box.width/scale+pad*2,h:height/scale+pad*2};
  }
  function renderTutorial(onlyIfChanged){
    const wrap=$('#canvas-wrap'),step=tutorialSteps&&tutorialSteps[tutorialStep];if(!wrap||!step)return;
    let el=$('#tutorial');if(!el){el=document.createElement('div');el.id='tutorial';el.className='tutorial';wrap.append(el);}
    const r=step.watch?null:tutorialTargetRect(step,el),title=stepValue(step.title),body=stepValue(step.body);
    const key=(r?[r.x,r.y,r.w,r.h].map(Math.round).join(','):'none')+'|'+title+'|'+body;
    if(onlyIfChanged&&key===tutorialRect)return;tutorialRect=key;
    // Counter per mission ("제작 의뢰 · 3 / 9"), or for the whole tour.
    const same=step.group?tutorialSteps.filter(s=>s.group===step.group):tutorialSteps,count=(step.group?step.group+' · ':'')+(same.indexOf(step)+1)+' / '+same.length;
    const waiting=!!step.done,last=tutorialStep===tutorialSteps.length-1;
    const actions=(tutorialForced?'':'<button type="button" class="text-button" data-tut="skip">건너뛰기</button>')+(step.watch?'<span class="tut-wait">'+icon('clock')+' 잠시 지켜봐 주세요</span>':waiting?'<span class="tut-wait">'+icon('arrow')+' 빛나는 곳을 눌러 보세요</span>':'<button type="button" class="primary-button" data-tut="next">'+(last?'시작하기':'다음')+'</button>');
    el.innerHTML=(step.watch?'<div class="tut-block"></div>':'<div class="tut-dim"></div>')+(r?'<div class="tut-hole'+(waiting?' pulse':'')+'"></div>':'')+'<div class="tut-card'+(step.watch?' top':r?'':' center')+'"><small>'+escape(count)+'</small><h3>'+escape(title)+'</h3><p>'+escape(body)+'</p><div class="tut-actions'+(tutorialForced?' forced':'')+'">'+actions+'</div></div>';
    const card=el.querySelector('.tut-card');
    if(r){
      Object.assign(el.querySelector('.tut-hole').style,{left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px'});
      // The dim layer gets a window cut out where the lit part is; clicks go through that window to the real button.
      const x1=r.x,y1=r.y,x2=r.x+r.w,y2=r.y+r.h;
      el.querySelector('.tut-dim').style.clipPath='polygon(evenodd,0 0,100% 0,100% 100%,0 100%,0 0,'+x1+'px '+y1+'px,'+x2+'px '+y1+'px,'+x2+'px '+y2+'px,'+x1+'px '+y2+'px,'+x1+'px '+y1+'px)';
      const W=el.offsetWidth,H=el.offsetHeight,cw=320;
      card.style.width=cw+'px';const ch=card.offsetHeight||150;card.style.left=Math.max(12,Math.min(W-cw-12,r.x+r.w/2-cw/2))+'px';
      let y=r.y+r.h+12;if(y+ch>H-12)y=r.y-12-ch;if(y<12){y=Math.max(12,Math.min(H-ch-12,r.y+r.h/2-ch/2));card.style.left=(r.x+r.w+12+cw<W?r.x+r.w+12:Math.max(12,r.x-cw-12))+'px';}
      card.style.top=y+'px';
    }
    if(!waiting&&!step.watch)card.querySelector('[data-tut="next"]')?.focus({preventScroll:true});
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-tut]');if(!b)return;
    e.stopPropagation();sfx('click');
    if(b.dataset.tut==='skip'&&!tutorialForced)endTutorial(true);else if(b.dataset.tut==='next')nextTutorialStep();
  },true);
  // Keys: Esc skips the tour only; during missions game shortcuts (pause, speed, close window) are held back.
  document.addEventListener('keydown',e=>{
    if(tutorialStep<0)return;
    if(tutorialForced){const typing=e.target.closest&&e.target.closest('input,textarea,select');if(e.key==='Escape'||(!typing&&!['Tab','Enter'].includes(e.key))){e.stopPropagation();if(e.key==='Escape'||e.code==='Space')e.preventDefault();}return;}
    if(e.key==='Escape'){e.stopPropagation();endTutorial(true);}
  },true);
  window.addEventListener('resize',()=>{if(tutorialStep>=0)renderTutorial();});
  // Top-left calendar card: "1년 여름 3일", then this season's event and where it stands (N일 전 · 진행 중 · 종료).
  // Salary list: each person's own skill (a sales clerk shows the sales level, not crafting).
  function payrollRoleLabel(w){const t=state.towns[w.townId],s=t&&t.staff.find(x=>x.id===w.id);if(!s||s.role==='smith')return '제작기술 Lv. '+w.craftLevel;if(s.role==='sales')return '판매 Lv. '+(s.salesLevel||1);return ({buyer:'재료 매입 담당',logistics:'물류·진열 담당',enhancer:'강화 보조 담당',innkeeper:'여관 관리 담당'})[s.role]||'직원';}
  // Times on screen are real seconds at the current speed, so a speed change redraws whatever is open.
  // News about another town says which one (only when the player runs more than one).
  function otherTownTag(townId){const t=townId&&townId!==state.activeTownId&&Object.keys(state.towns||{}).length>1?state.towns[townId]:null;return t?t.name+' · ':'';}
  // Room-switch arrows: the painted arrow turned up or down (was ▲ / ▼ text).
  function roomArrow(up){return '<span class="room-arrow '+(up?'up':'down')+'">'+icon('arrow')+'</span>';}
  function speedChanged(){invalidate();ui.modalSignature='';render(true);}
  function renderCalendarChip(){
    const el=$('#calendar-chip');if(!el||!Sim.getCalendar)return;
    const cal=Sim.getCalendar(state),info=Sim.getSeasonEvents?Sim.getSeasonEvents(state):null;
    const season=info&&info.calendar?info.calendar.season:cal.month;
    // This season's event; once it is over, the next one coming up (so the chip says what to prepare for, not just "종료").
    let ev=info&&info.events?info.events.find(e=>e.season===season):null;
    const coming=e=>e.status==='upcoming'||e.status==='soon';
    if(ev&&ev.status==='done'){const next=info.events.filter(coming).sort((a,b)=>a.daysUntil-b.daysUntil)[0];if(next)ev=next;}
    const status=!ev?'':ev.status==='active'?'진행 중':coming(ev)?ev.daysUntil+'일 전':'종료';
    const cls=!ev?'':ev.status==='active'?'on':coming(ev)?'soon':'done';
    updateRegion(el,'<b class="cc-date">'+icon('calendar')+escape(cal.label)+'</b>'+(ev?'<span class="cc-event"><span>'+escape(ev.name)+'</span><em class="'+cls+'">'+escape(status)+'</em></span>':''),[cal.label,ev&&ev.id,status].join('|'));
  }
  // ---- 성장 퀘스트 (2026-11-09): the third tab of the request board ----
  const QUEST_GO_LABEL={staff:'직원 창',craft:'작업대',warehouse:'창고',upgrades:'시설 배치',quests:'재료 의뢰',orders:'제작 의뢰',inn:'여관',adventurers:'모험가',operations:'자동 운영',world:'월드맵',research:'연구소',calendar:'달력',fame:'명성'};
  function questGoButton(go){
    if(!go)return '';
    if(go.startsWith('boss:'))return '<button class="secondary-button gq-go" data-action="boss" data-id="'+escape(go.slice(5))+'">'+icon('arrow')+' 보스 창</button>';
    if(go==='craft')return '<button class="secondary-button gq-go" data-action="nav" data-tab="shop">'+icon('arrow')+' 작업대</button>';
    // Straight to the right calendar tab (festival entry / harvest order), not just the month view.
    if(go==='festival')return '<button class="secondary-button gq-go" data-action="festival-open" data-id="">'+icon('arrow')+' 장비 축제</button>';
    if(go==='season')return '<button class="secondary-button gq-go" data-action="season-open" data-id="season">'+icon('arrow')+' 계절 행사</button>';
    if(go==='quests'||go==='orders')return '<button class="secondary-button gq-go" data-action="quest-tab" data-tab="'+(go==='quests'?'materials':'orders')+'">'+icon('arrow')+' '+QUEST_GO_LABEL[go]+'</button>';
    return '<button class="secondary-button gq-go" data-action="nav" data-tab="'+escape(go)+'">'+icon('arrow')+' '+escape(QUEST_GO_LABEL[go]||'바로 가기')+'</button>';
  }
  // Coin for gold, the material's own picture for materials, a trophy for a title.
  function questRewardHtml(q){
    const parts=q.rewardParts||[{kind:'gold',text:q.reward}];
    return parts.map(p=>'<span class="gq-reward-part">'+(p.kind==='mat'?'<span class="gq-mat">'+materialArt(p.mat)+'</span>':icon(p.kind==='title'?'trophy':'coin'))+escape(p.text)+'</span>').join('');
  }
  function renderGrowthQuests(force){
    const box=$('#quest-tab-content');if(!box||!Sim.getQuestBook)return;
    const b=Sim.getQuestBook(state);if(!b)return;
    const sig='growth|'+JSON.stringify(b);if(!force&&ui.modalSignature===sig)return;ui.modalSignature=sig;
    const ch=b.chapter;
    box.innerHTML='<div class="growth-quests"><div class="gq-head"><div><small>성장 퀘스트 · 전체 '+b.claimed+' / '+b.total+'</small><h3>'+escape(ch.name)+' <span>'+ch.done+' / '+ch.total+'</span></h3></div>'+(ch.reward?'<span class="gq-chapter-reward">'+icon('star')+' 장 보상 '+escape(ch.reward)+'</span>':'')+'</div>'
      +'<div class="status-track gq-track"><i style="width:'+pct(ch.done,ch.total)+'%"></i></div>'
      +(b.quests.length?'<div class="gq-list">'+b.quests.map(q=>'<article class="gq-card'+(q.complete?' done':'')+'"><div class="gq-body"><b>'+escape(q.name)+'</b><p>'+escape(q.text)+'</p><div class="gq-progress"><div class="status-track"><i style="width:'+pct(q.progress,q.target)+'%"></i></div><small>'+num(q.progress)+' / '+num(q.target)+'</small></div><span class="gq-reward">'+questRewardHtml(q)+'</span></div><div class="gq-actions">'+(q.complete?'<button class="primary-button" data-action="quest-claim" data-id="'+q.n+'">'+icon('check')+' 보상 받기</button>':questGoButton(q.go))+'</div></article>').join('')+'</div>'
        :'<p class="quest-empty">'+escape(b.next||'지금 할 수 있는 퀘스트를 모두 끝냈어요.')+'</p>')
      +(b.titles.length?'<p class="gq-titles">'+icon('trophy')+' 얻은 칭호: '+b.titles.map(t=>'「'+escape(t)+'」').join(' ')+'</p>':'')
      +'</div>';
  }
  // Buff / debuff icons to the right of the calendar (user request 2026-11-09). Green ring = good, red = bad,
  // dashed = starts later. Hover shows what it is; a tap says it in a toast (phones have no hover).
  const EFFECT_ICON={customers:'people',sale:'coin',craft:'hammer',staff:'person',furnace:'flame',price:'gem',buyStop:'lock',pet:'heart',quality:'star',hire:'plus',other:'star'};
  // Painted icons (art/effects → dist/assets/effects) replace the line icons once they exist.
  const EFFECT_ART={buyStop:'assets/effects/buyStop.png',craft:'assets/effects/craft.png',customers:'assets/effects/customers.png',furnace:'assets/effects/furnace.png',hire:'assets/effects/hire.png',pet:'assets/effects/pet.png',price:'assets/effects/price.png',quality:'assets/effects/quality.png',sale:'assets/effects/sale.png',staff:'assets/effects/staff.png'};
  function renderEffectIcons(){
    const el=$('#effect-icons');if(!el||!Sim.getActiveEffects)return;
    const list=Sim.getActiveEffects(state),sig=list.map(e=>e.kind+e.good+e.text+e.when).join('|');
    if(el.dataset.sig===sig)return;el.dataset.sig=sig;
    const one=e=>{const tip=e.text+' · '+e.when;return '<button type="button" class="effect-icon '+(e.good?'good':'bad')+(e.upcoming?' upcoming':'')+'" data-action="effect-tip" data-tip="'+escape(tip)+'" title="'+escape(tip)+'" aria-label="'+escape(tip)+'">'+(EFFECT_ART[e.kind]?'<img src="'+EFFECT_ART[e.kind]+'" alt="">':icon(EFFECT_ICON[e.kind]||'star'))+(e.good?'':'<i aria-hidden="true">!</i>')+'</button>';};
    // Buffs on the top row, debuffs below; with only one kind it takes the top row (user 2026-11-09).
    const buffs=list.filter(e=>e.good),debuffs=list.filter(e=>!e.good);
    el.innerHTML=(buffs.length?'<div class="effect-row buffs">'+buffs.map(one).join('')+'</div>':'')+(debuffs.length?'<div class="effect-row debuffs">'+debuffs.map(one).join('')+'</div>':'');
  }
  // Left column, under the incidents (user request 2026-11-09): the current growth quests.
  function renderQuestTracker(){
    const el=$('#quest-tracker');if(!el||!Sim.getQuestBook)return;
    const on=!!(state.questBook&&state.questBook.enabled),b=on?Sim.getQuestBook(state):null;
    const sig=b?JSON.stringify([b.chapter,b.quests.map(q=>[q.n,q.progress,q.complete]),b.ready]):'';
    if(el.dataset.sig===sig)return;el.dataset.sig=sig;
    if(!b||!b.quests.length){el.innerHTML='';el.hidden=true;return;}
    el.hidden=false;
    // One text line each (user request 2026-11-09): [퀘스트] 초록숲 창고 2단계 — a click opens the request board's growth tab.
    el.innerHTML=b.quests.map(q=>'<button type="button" class="left-line quest-line'+(q.complete?' done':'')+'" data-action="quest-open" data-id="'+q.n+'" title="'+escape(q.name+' · '+q.text)+'"><b class="ll-tag">[퀘스트]</b><span class="ll-text">'+escape(q.text)+'</span>'+(q.complete?'<small class="ll-when">[완료]</small>':'')+'</button>').join('');
  }
  // ---- 돌발 사건 (2026-11-09): cards under the calendar, a window in the middle of the screen ----
  const INCIDENT_CAT_ICON={손님:'people',사고:'flame',직원:'hammer',모험가:'sword',마을:'shop',시세:'coin',날씨:'sun',특별:'star'};
  // Written out one by one so the one-file build (scripts/package-game.cjs) can embed each picture.
  const INCIDENT_ART={E01:'assets/events/E01.jpg',E02:'assets/events/E02.jpg',E03:'assets/events/E03.jpg',E04:'assets/events/E04.jpg',E05:'assets/events/E05.jpg',E06:'assets/events/E06.jpg',E07:'assets/events/E07.jpg',E08:'assets/events/E08.jpg',E09:'assets/events/E09.jpg',E10:'assets/events/E10.jpg',
    E11:'assets/events/E11.jpg',E12:'assets/events/E12.jpg',E13:'assets/events/E13.jpg',E14:'assets/events/E14.jpg',E15:'assets/events/E15.jpg',E16:'assets/events/E16.jpg',E17:'assets/events/E17.jpg',E18:'assets/events/E18.jpg',E19:'assets/events/E19.jpg',E20:'assets/events/E20.jpg',
    E21:'assets/events/E21.jpg',E22:'assets/events/E22.jpg',E23:'assets/events/E23.jpg',E24:'assets/events/E24.jpg',E25:'assets/events/E25.jpg',E26:'assets/events/E26.jpg',E27:'assets/events/E27.jpg',E28:'assets/events/E28.jpg',E29:'assets/events/E29.jpg',E30:'assets/events/E30.jpg',
    E31:'assets/events/E31.jpg',E32:'assets/events/E32.jpg',E33:'assets/events/E33.jpg',E34:'assets/events/E34.jpg',E35:'assets/events/E35.jpg',E36:'assets/events/E36.jpg',E37:'assets/events/E37.jpg',E38:'assets/events/E38.jpg',E39:'assets/events/E39.jpg',E40:'assets/events/E40.jpg',E41:'assets/events/E41.jpg',E42:'assets/events/E42.jpg',E43:'assets/events/E43.jpg',E44:'assets/events/E44.jpg',E45:'assets/events/E45.jpg',E46:'assets/events/E46.jpg',E47:'assets/events/E47.jpg',E48:'assets/events/E48.jpg',E49:'assets/events/E49.jpg',E50:'assets/events/E50.jpg',E51:'assets/events/E51.jpg',E52:'assets/events/E52.jpg',E53:'assets/events/E53.jpg',E54:'assets/events/E54.jpg',E55:'assets/events/E55.jpg',E56:'assets/events/E56.jpg',E57:'assets/events/E57.jpg',E58:'assets/events/E58.jpg',E59:'assets/events/E59.jpg'};
  const incidentImg=key=>INCIDENT_ART[key]||'';
  function incidentLeft(v){if(v.status==='done')return '결과 보기';if(v.unit==='sec')return Math.ceil(v.left)+'초 남음'; /* same "… 남음" wording as the day/hour lines (2026-11-10) */const d=v.left;return d>=.95?Math.ceil(d-.05)+'일 남음':Math.max(1,Math.ceil(d*24))+'시간 남음';}
  function incidentTone(v){if(v.status==='done')return 'done';if(v.status==='active')return 'active';return v.tier==='instant'||v.tier==='day'?'urgent':v.tier==='three'?'soon':'calm';}
  // The picture: the incident's own painting when it exists, otherwise its category colour with an icon.
  // Each painting is looked up once: a missing file is remembered, so redraws do not ask the server again.
  const incidentArt=new Map();
  function probeIncidentArt(key){if(incidentArt.has(key))return;if(typeof Image==='undefined'||!incidentImg(key)){incidentArt.set(key,'missing');return;}incidentArt.set(key,'loading');const img=new Image();img.onload=()=>{incidentArt.set(key,'ok');const el=$('#incident-list');if(el)el.dataset.sig='';if(ui.modal==='incident'){ui.modalSignature='';renderIncident(true);}};img.onerror=()=>incidentArt.set(key,'missing');img.src=incidentImg(key);}
  function incidentPicture(v,cls){probeIncidentArt(v.key);const ok=incidentArt.get(v.key)==='ok';return '<span class="'+cls+' cat-'+escape(v.cat)+(ok?' has-art':'')+'">'+icon(INCIDENT_CAT_ICON[v.cat]||'star')+(ok?'<img src="'+incidentImg(v.key)+'" alt="">':'')+'</span>';}
  function wireIncidentImages(){}
  function renderIncidentList(){
    const el=$('#incident-list');if(!el||!Sim.getIncidents)return;
    // Open incidents (up to 4) always show; finished ones fill in only up to 5 cards so the column never runs down the screen.
    const all=Sim.getIncidents(state).slice().reverse(),openCount=all.filter(v=>v.status!=='done').length;let doneRoom=Math.max(0,5-openCount);
    const list=all.filter(v=>v.status!=='done'||doneRoom-->0);
    const sig=state.activeTownId+'#'+list.map(v=>v.id+':'+v.status+':'+(v.unit==='sec'?Math.ceil(v.left):Math.ceil(v.left*24))).join('|');
    if(el.dataset.sig===sig)return;el.dataset.sig=sig;
    const fresh=list.filter(v=>!incidentSeen.has(v.id));for(const v of fresh)incidentSeen.add(v.id);
    el.innerHTML=list.map(v=>{const low=v.status==='pending'&&v.left/Math.max(.001,v.total)<.2;
      // One text line (user request 2026-11-09): [돌발] 창고에 쥐 떼 [2시간 남음] — the picture lives in the centre window only.
      return '<button type="button" class="incident-card left-line tone-'+incidentTone(v)+(low?' low':'')+(fresh.includes(v)&&renderIncidentList.ready?' fresh':'')+'" data-action="incident-open" data-id="'+escape(v.id)+'" title="'+escape(v.name)+'"><b class="ll-tag">[돌발]</b><span class="ll-text">'+escape(v.name)+(v.townId&&v.townId!==state.activeTownId&&Object.keys(state.towns).length>1?' ('+escape(v.townName||'')+')':'')+'</span><small class="ll-when">['+escape(v.status==='active'?(v.task?.type==='mission'&&!v.task.sent?'파견 준비 · ':'진행 중 · ')+incidentLeft(v):incidentLeft(v))+']</small></button>';}).join('');
    wireIncidentImages(el);
    if(fresh.length&&renderIncidentList.ready)sfx('open');
    renderIncidentList.ready=true;
  }
  const incidentSeen=new Set();
  function renderIncident(force){
    const v=Sim.getIncidents(state).find(x=>x.id===ui.modalData);
    if(!v){closeModal();return;}
    const mission=v.status==='active'&&v.task?.type==='mission'&&!v.task.sent?Sim.getIncidentMission(state,v.id):null;
    if(mission&&ui.incidentPickFor!==v.id){ui.incidentPickFor=v.id;ui.incidentPick=[];}
    if(mission)ui.incidentPick=(ui.incidentPick||[]).filter(id=>mission.candidates.some(c=>c.id===id&&!c.block));
    const sig=[v.id,v.status,v.unit==='sec'?Math.ceil(v.left):Math.ceil(v.left*24),v.choices.map(c=>c.blocked+c.info).join(','),JSON.stringify(v.task),(ui.incidentPick||[]).join(','),state.gold>0].join('|');
    if(!force&&ui.modalSignature===sig)return;ui.modalSignature=sig;
    $('#modal-title').textContent=v.name;
    const tone=incidentTone(v),when=v.status==='pending'?'<span class="ip-deadline tone-'+tone+'">'+icon('clock')+'마감 '+escape(v.tierLabel)+' · '+escape(incidentLeft(v))+'</span>':v.status==='active'?'<span class="ip-deadline tone-active">'+icon('clock')+escape(incidentLeft(v))+'</span>':'';
    let body='<div class="incident-pop'+(v.status==='pending'?'':' slim')+'">'+incidentPicture(v,'ip-art')+'<div class="ip-head"><span class="ip-cat">'+escape(v.cat)+(v.local?' · '+escape(v.townName)+'에서만':v.townName&&Object.keys(state.towns).length>1?' · '+escape(v.townName):'')+(v.followUp?' · 이어지는 이야기':'')+'</span>'+when+'</div><p class="ip-story">'+escape(v.story)+'</p>';
    if(v.status==='pending'){
      body+='<div class="ip-choices">'+v.choices.map(c=>'<button type="button" class="ip-choice" data-action="incident-choose" data-id="'+escape(v.id)+'" data-index="'+c.index+'"'+isDisabled(!!c.blocked)+'><b>'+escape(c.label)+'</b><small>'+escape(c.blocked?c.blocked+' · '+c.info:c.info)+'</small></button>').join('')+'</div>'
        +'<p class="ip-ignore">그냥 두면: '+escape(v.ignoreInfo)+'</p>'+(v.memory?'<p class="ip-memory">'+icon('book')+' '+escape(v.memory)+'</p>':'');
    }else if(v.status==='active'&&v.task?.type==='deliver'){
      const t=v.task,ready=t.needs.some(n=>n.ready>0);
      body+='<div class="ip-task"><h4>'+icon('box')+' 납품할 것</h4>'+t.needs.map(n=>{const making=n.making||0,left=n.n-n.done-n.ready-making,opts=left>0?(n.options||[]):[];
          // Any need can be put on a furnace straight from here (the incident's town); the finished piece is handed in by itself.
          const status=n.done>=n.n?'완료':[n.ready?'창고에 '+n.ready+'개 있음':'',making?'화덕에서 '+making+'개 만드는 중':''].filter(Boolean).join(' · ')||'창고에 없음';
          const make=opts.length?'<div class="ip-make-list">'+opts.map(o=>'<button class="secondary-button ip-make" data-action="incident-craft" data-id="'+escape(o.id)+'" data-incident="'+escape(v.id)+'">'+icon('hammer')+' '+escape(o.name)+' 만들기</button>').join('')+'</div>'
            :left>0&&n.n>n.done?'<p class="ip-hint">지금 만들 수 있는 설계도가 없어요. 제작기술을 올리면 만들 수 있어요.</p>':'';
          return '<div class="ip-need"><span>'+escape(n.label)+'</span><b>'+n.done+' / '+n.n+'</b><small>'+escape(status)+'</small></div>'+make;}).join('')
        +'<p class="ip-reward">보상 '+num(t.reward)+' G'+(t.rep?' · 명성 +'+t.rep:'')+'</p><button class="primary-button" data-action="incident-deliver" data-id="'+escape(v.id)+'"'+isDisabled(!ready)+'>'+icon('check')+' 창고에서 납품하기</button><p class="ip-hint">여기서 [만들기]로 만든 장비는 완성되면 바로 납품돼요. 창고에 있던 장비는 [창고에서 납품하기]로 내요(잠긴 장비 제외).</p></div>';
    }else if(mission){
      const chance=ui.incidentPick.length?Sim.quoteIncidentMission(state,v.id,ui.incidentPick):0,ctone=chance>=.7?'good':chance>=.45?'mid':'low';
      // Every resident, in a fixed order, with what they are doing (user request 2026-11-09). Busy heroes can be picked:
      // the party waits for them and sets out together.
      const list=mission.candidates;
      body+='<div class="ip-task"><h4>'+icon('people')+' 파견 고르기 <small>'+ui.incidentPick.length+' / '+mission.max+'명 · 최소 '+mission.min+'명 · '+mission.days+'일 · 기준 전투력 '+num(mission.power)+'</small></h4><div class="boss-pick-list">'
        +(list.length?list.map(c=>{const a=state.adventurers.find(x=>x.id===c.id),on=ui.incidentPick.includes(c.id),full=!on&&ui.incidentPick.length>=mission.max,weak=c.power<mission.power,locked=!!c.block;return '<button type="button" class="boss-pick'+(on?' on':'')+(weak?' weak':'')+(c.busy?' busy':'')+'" data-action="incident-pick" data-id="'+escape(c.id)+'"'+isDisabled(full||locked)+' aria-pressed="'+on+'"><span class="choice-radio"></span>'+portrait(a,0,40)+'<span class="bp-name"><b>'+escape(a.name)+'</b><small>Lv.'+a.level+' · '+escape(a.job)+'</small><small class="bp-status'+(c.busy||locked?' wait':'')+'">'+escape(c.status||'')+'</small></span><span class="bp-power'+(weak?' low':'')+'">'+icon('sword')+num(c.power)+'</span></button>';}).join(''):'<p class="quest-empty">이 마을에 모험가가 없어요.</p>')
        +'</div><p class="boss-busy-note">다른 일을 하는 모험가도 고를 수 있어요. 고른 모험가가 모두 일을 마치면 함께 출발해요.</p>'
        +'<div class="boss-dispatch"><span>예상 성공률 <b class="'+ctone+'">'+(ui.incidentPick.length?Math.round(chance*100)+'%':'–')+'</b></span><button class="primary-button" data-action="incident-send" data-id="'+escape(v.id)+'"'+isDisabled(ui.incidentPick.length<mission.min)+'>'+icon('flame')+' 파견하기</button></div></div>';
    }else if(v.status==='active'&&v.task?.type==='mission'){
      body+=v.task.gathering
        ?'<div class="ip-task"><h4>'+icon('people')+' 파견대 모이는 중</h4><p class="ip-reward">'+escape(v.task.heroNames.join(' · '))+' · 예상 성공률 '+Math.round(v.task.chance*100)+'%</p>'
          // 합류 예상 + 다시 고르기 (2026-11-10)
          +(v.task.waiting||[]).map(w=>'<div class="ip-need"><span>'+escape(w.name)+'</span><small>'+escape(w.why||'준비 완료')+(w.why&&w.eta!=null?' · 약 '+escape(secondsLabel(w.eta))+' 뒤 합류':'')+'</small></div>').join('')+'<p class="ip-hint">모두 하던 일을 마치면 함께 출발해요.</p>'
          +'<div class="ip-actions"><button type="button" class="secondary-button" data-action="incident-regather" data-id="'+escape(v.id)+'">'+icon('reset')+' 다시 고르기</button></div></div>'
        :crisisBand(v.task.crisis,'mission-crisis',v.id,v.task.crisis?v.task.crisis.cost:0,false)+'<div class="ip-task"><h4>'+icon('people')+' 파견 중</h4><p class="ip-reward">'+escape(v.task.heroNames.join(' · '))+' · 예상 성공률 '+Math.round(v.task.chance*100)+'%</p></div>';
    }else if(v.status==='active'){
      body+='<div class="ip-task"><p class="ip-reward">약속한 날이 오면 결과가 나와요.</p></div>';
    }else{
      body+='<div class="ip-result">'+icon('check')+'<p>'+escape(v.result||'')+'</p></div><div class="ip-actions"><button class="primary-button" data-action="incident-dismiss" data-id="'+escape(v.id)+'">확인</button></div>';
    }
    $('#modal-body').innerHTML=body+'</div>';wireIncidentImages($('#modal-body'));portraits($('#modal-body'));
  }
  function renderAchievements(force) {
    const p=achievementProfile();if(!p){$('#modal-body').innerHTML=empty('업적을 준비 중이에요','잠시 후 다시 열어 주세요.','trophy');return;}
    const sum=Ach.summary(p,Ach.metrics(state,Sim)),tab=ui.achievementTab||'all';
    const sig=['ach',tab,sum.unlockedCount,sum.titleId,sum.items.map(i=>Math.floor(i.progress*50)).join('')].join('|');if(!force&&ui.modalSignature===sig)return;ui.modalSignature=sig;
    const banner='<div class="achievement-banner"><span>'+icon('trophy')+'</span><div><small>새 게임을 시작해도 남는 기록</small><h3>'+sum.unlockedCount+' / '+sum.total+' 달성</h3><div class="status-track"><i style="width:'+pct(sum.unlockedCount,sum.total)+'%"></i></div></div><strong>'+num(sum.points)+'<small>/ '+num(sum.maxPoints)+'점</small></strong></div>';
    const titles='<div class="achievement-titles"><b>'+icon('star')+' 칭호</b>'+(sum.titles.length?'<button class="'+(sum.titleId?'':'active')+'" data-action="achievement-title" data-id="">칭호 없음</button>'+sum.titles.map(t=>'<button class="'+(sum.titleId===t.id?'active':'')+'" data-action="achievement-title" data-id="'+escape(t.id)+'">'+escape(t.title)+'</button>').join(''):'<small>칭호가 붙은 업적을 달성하면 여기서 고를 수 있어요. 고른 칭호는 명성 창에도 보여요.</small>')+'</div>';
    const tabs='<div class="achievement-tabs"><button class="'+(tab==='all'?'active':'')+'" data-action="achievement-tab" data-id="all">전체 <small>'+sum.unlockedCount+'/'+sum.total+'</small></button>'+sum.categories.map(c=>'<button class="'+(tab===c.id?'active':'')+'" data-action="achievement-tab" data-id="'+escape(c.id)+'">'+escape(c.name)+' <small>'+c.unlocked+'/'+c.total+'</small></button>').join('')+'</div>';
    const list=sum.items.filter(i=>tab==='all'||i.category===tab);
    const rows='<div class="achievement-list">'+list.map(i=>'<article class="achievement-row'+(i.unlocked?' unlocked':'')+'"><span class="achievement-icon">'+icon(i.unlocked?'trophy':'lock')+'</span><div><h4>'+escape(i.name)+(i.title?' <em>칭호 「'+escape(i.title)+'」</em>':'')+'</h4><p>'+escape(i.description)+'</p>'+(i.unlocked?'<small>'+escape(new Date(i.unlockedAt).toLocaleDateString('ko-KR'))+' 달성</small>':'<div class="status-track"><i style="width:'+pct(i.value,i.target)+'%"></i></div><small>'+num(i.value)+' / '+num(i.target)+'</small>')+'</div><strong>'+i.points+'<small>점</small></strong></article>').join('')+'</div>';
    $('#modal-body').innerHTML=banner+titles+tabs+rows;
  }
  function renderRegion(force) {
    const r=region(ui.modalData);if(!r){$('#modal-body').innerHTML=empty('이 사냥터를 찾지 못했어요','월드맵에서 다시 선택해 주세요.','map');return;}
    const town=townCatalog().find(t=>t.id===r.townId),locals=townHeroes(r.townId),hunting=locals.filter(a=>a.regionId===r.id&&['hunting','raiding'].includes(a.status)),eligible=locals.filter(a=>Sim.getPower(a)>=r.minPower),sig=[r.id,hunting.length,eligible.length].join(':');if(!force&&ui.modalSignature===sig)return;ui.modalSignature=sig;
    $('#modal-title').textContent=r.name;
    $('#modal-body').innerHTML='<div class="region-detail-banner">'+icon(r.biome?.includes('mountain')?'mountain':'map')+'<div><small>'+escape(town?.name||'먼 지역')+'의 사냥터</small><h3>권장 Lv. '+(r.recommendedLevel||1)+'</h3></div></div><p class="modal-description">'+escape(r.description||'모험가가 자신의 장비와 전투력에 맞춰 찾아가는 사냥터입니다.')+'</p><div class="metrics-grid three-columns">'+metric('필요 전투력',num(r.minPower),'','sword')+metric('현재 사냥 중',hunting.length,'명')+metric('마을의 도전 가능 인원',eligible.length,'명')+'</div><h3 class="modal-section-title">'+icon('box')+' 이곳에서 얻는 재료</h3><div class="region-loot">'+Object.keys(r.loot||{}).map(id=>'<span>'+materialArt(id)+escape(DATA.materials[id]?.name||id)+'</span>').join('')+'</div><button class="secondary-button full-button" data-action="focus-town" data-id="'+escape(r.townId)+'">'+icon('map')+' '+escape(town?.name||'마을')+' 주변 살펴보기</button>';
  }
  function renderModal(force=false) {
    if(!ui.modal)return;
    if(!force&&pressedInside($('#modal')))return;
    if(ui.modal==='adventurers')renderHeroList(force);
    else if(ui.modal==='hero')renderHeroDetail(force);
    else if(ui.modal==='item')renderItem(force);
    else if(ui.modal==='recipe')renderRecipeModal();
    else if(ui.modal==='candidate'){
      if(!force)return;const original=window.ForgeRoster?.getById(ui.modalData);if(!original)return;const c=Sim.previewIdentity(state,original,'adventurer');
      $('#modal-title').textContent=c.name;$('#modal-body').innerHTML='<div class="candidate-detail">'+portrait(c,0,144)+'<h3>'+escape(c.job)+'</h3><p>아직 이 마을에서 만나지 못했어요.</p></div><button class="secondary-button full-button" data-action="back-heroes">모험가 도감으로 돌아가기</button>';portraits($('#modal-body'));
    }
    else if(ui.modal==='quests'){
      if(force||!$('#quest-tab-content'))questShell();
      // Keep the tab counts current while the window stays open (an order that ran out left "제작 의뢰 3" over 2 cards).
      {const tabs=$('#modal-body .modal-tabs');if(tabs){const setCount=(tab,n)=>{const b=tabs.querySelector('[data-tab="'+tab+'"]');if(!b)return;let sp=b.querySelector('span');if(n){if(!sp){sp=document.createElement('span');b.append(' ',sp);}if(sp.textContent!==String(n))sp.textContent=n;}else if(sp&&tab!=='orders')sp.remove();else if(sp)sp.textContent='0';};setCount('orders',orders().length);if(Sim.getQuestBook)setCount('growth',(Sim.getQuestBook(state)||{}).ready||0);}}
      if(ui.questTab==='materials')renderMaterialQuests(force);else if(ui.questTab==='growth')renderGrowthQuests(force);else renderOrders(force);
      const extra=$('#modal-header-extra');if(extra)extra.innerHTML='<span>'+icon('coin')+' 보유 <b>'+num(state.gold)+' G</b></span>';
    }
    else if(ui.modal==='upgrades')renderFacilities(force);
    else if(ui.modal==='facility')renderFacility(force);
    else if(ui.modal==='staff')renderStaff(force);
    else if(ui.modal==='operations')renderOperations(force);
    else if(ui.modal==='warehouse')renderWarehouse(force);
    else if(ui.modal==='boss')renderBoss(force);
    else if(ui.modal==='incident')renderIncident(force);
    else if(ui.modal==='inn')renderInn(force);
    else if(ui.modal==='town')renderTown(force);
    else if(ui.modal==='calendar')renderCalendar(force);
    else if(ui.modal==='market')renderMarket(force);
    else if(ui.modal==='fame')renderFame(force);
    else if(ui.modal==='training')renderTraining(force);
    else if(ui.modal==='invasion')renderInvasion(force);
    else if(ui.modal==='finance')renderFinance(force);
    else if(ui.modal==='research')renderResearch(force);
    else if(ui.modal==='achievements')renderAchievements(force);
    else if(ui.modal==='region')renderRegion(force);
    else if(ui.modal==='help'&&force)renderHelp();
    else if(ui.modal==='migration')renderMigration(force);    else if(ui.modal==='settings'&&force)renderSettings();
    else if(ui.modal==='save-restore'&&force)renderSaveRestore();
  }
  function render(force=false) {renderVillage();renderHeader();renderCampaignSummary();renderEarlyGuide();renderGoal();renderLogs();renderFeed();renderSide(force||ui.dirty);renderQueue(force||ui.dirty);renderModal(false);ui.dirty=false;}
  function download(textContent,filename) {
    const blob=new Blob([textContent],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function navigate(tab) {
    if(tab==='shop'){closeModal();setView('shop');}
    // The world-map button toggles: pressed on the world map, it goes back to the screen you came from.
    else if(tab==='world'){if(ui.view==='world'&&!ui.modal){setView(ui.viewBeforeWorld&&ui.viewBeforeWorld!=='world'?ui.viewBeforeWorld:'shop');return;}if(ui.view!=='world')ui.viewBeforeWorld=ui.view;closeModal();setView('world');}
    // Grouped menu buttons open their group's first window (the window has tabs for the rest).
    else {if(ui.placement)cancelPlacement();showModal(tab==='characters'?'adventurers':tab==='facilities'?'upgrades':tab);}
  }
  // Windows that share one menu button and switch with tabs at the top.
  const MODAL_GROUPS={characters:[['adventurers','모험가','sword'],['staff','직원','people']],facilities:[['upgrades','대장간','shop'],['inn','여관','bed']]};
  const modalGroupOf=type=>Object.keys(MODAL_GROUPS).find(g=>MODAL_GROUPS[g].some(([t])=>t===type))||null;
  function renderModalSwitch(type){
    const bar=$('#modal-switch');if(!bar)return;
    const group=modalGroupOf(type);bar.hidden=!group;
    bar.innerHTML=group?MODAL_GROUPS[group].map(([t,label,ic])=>'<button class="'+(t===type?'active':'')+'" data-action="modal-switch" data-id="'+t+'">'+icon(ic)+' '+label+'</button>').join(''):'';
  }
  function enterTown(id) {
    const result=Sim.switchTown(state,id);if(!result.ok){act(result);return;}
    cancelPlacement();closeModal();ui.recipeId='iron_sword';ui.craftOrderId=null;ui.side='craft';setView('shop');scene?.render(state,visualTime);save();toast(result.message||'이 지점으로 이동했어요.');
  }
  function showInvasion(id) {
    const townId=state.towns[id]?id:state.campaign?.invasions?.find(inv=>inv.id===id)?.townId||state.activeTownId;
    showModal('invasion',townId);
  }
  function openGoldUse(id) {
    const choice=Sim.getGoldSinks(state).find(c=>c.id===id);if(!choice)return;
    if(choice.action==='train-staff'){if(choice.targetId)showModal('training',choice.targetId);else showModal('staff');}
    else if(choice.action==='fund-relief')showInvasion(choice.townId);
    else if(choice.action==='hire-recruit')showModal('fame');
    else if(choice.action==='upgrade-inn')showModal('inn');
    else if(choice.action==='upgrade-warehouse')showModal('warehouse');
    else if(['expand-shop','place-furnace','place-display'].includes(choice.action))showModal('upgrades');
    else if(choice.action==='pay-wages'){ui.calendarTab='payroll';showModal('calendar');}
  }
  function handleAction(button) {
    const action=button.dataset.action,id=button.dataset.id;
    if(action==='nav')navigate(button.dataset.tab);
    else if(action==='modal-switch'){if(id&&id!==ui.modal)showModal(id);}
    else if(action==='boss-pick'){const list=ui.bossPick||(ui.bossPick=[]);const i=list.indexOf(id);if(i>=0)list.splice(i,1);else list.push(id);renderBoss(true);}
    else if(action==='raid-crisis'){const res=Sim.chooseRaidCrisis(state,id,button.dataset.choice);if(act(res,{refresh:false})){sfx(button.dataset.choice==='retreat'?'close':'battle');invalidate();ui.modalSignature='';if(ui.modal==='boss')renderBoss(true);}}
    else if(action==='mission-crisis'){const res=Sim.chooseMissionCrisis(state,id,button.dataset.choice);if(act(res,{refresh:false})){sfx(button.dataset.choice==='retreat'?'close':'battle');invalidate();renderIncidentList();if(ui.modal==='incident')renderIncident(true);}}
    else if(action==='effect-tip'){toast(button.dataset.tip||'');}
    else if(action==='quest-claim'){const res=Sim.claimQuest(state,Number(id));if(act(res,{refresh:false})){sfx('fanfare');invalidate();ui.modalSignature='';questShell();renderGrowthQuests(true);
      // The gold reward shows at once in the window's "보유" and the top bar (it used to stay at the old amount).
      const extra=$('#modal-header-extra');if(extra)extra.innerHTML='<span>'+icon('coin')+' 보유 <b>'+num(state.gold)+' G</b></span>';renderHeader();}}
    else if(action==='quest-open'){ui.questTab='growth';showModal('quests');}
    else if(action==='incident-regather'){const res=Sim.regatherIncidentMission(state,id);if(act(res,{refresh:false})){ui.incidentPick=[];ui.modalSignature='';renderModal(true);}}
    else if(action==='migration-open'){ui.migPick=null;showModal('migration');}
    else if(action==='mig-pick'){if(!ui.migPick)ui.migPick=new Set();ui.migPick.has(id)?ui.migPick.delete(id):ui.migPick.add(id);ui.modalSignature='';renderModal(true);}
    else if(action==='mig-all'){const free=(Sim.getMigrationCandidates(state)||[]).filter(c=>!c.block).map(c=>c.id);const all=free.every(i=>ui.migPick?.has(i));ui.migPick=new Set(all?[]:free);ui.modalSignature='';renderModal(true);}
    else if(action==='mig-send'){const res=Sim.migrateResidents(state,[...(ui.migPick||[])]);if(act(res,{refresh:false})){ui.migPick=null;if(!(Sim.getMigrationCandidates(state)||[]).length)closeModal();else{ui.modalSignature='';renderModal(true);}}}
    else if(action==='incident-open'){const v=Sim.getIncidents(state).find(x=>x.id===id);if(v)showModal('incident',id);}
    else if(action==='incident-choose'){const res=Sim.chooseIncident(state,id,Number(button.dataset.index));if(act(res,{refresh:false})){invalidate();renderIncidentList();renderIncident(true);}}
    else if(action==='incident-craft'){if(act(Sim.craftForIncident(state,button.dataset.incident,id),{refresh:false})){invalidate();renderIncidentList();renderIncident(true);}}
    else if(action==='incident-deliver'){if(act(Sim.deliverIncident(state,id),{refresh:false})){invalidate();renderIncidentList();renderIncident(true);}}
    else if(action==='incident-pick'){const list=ui.incidentPick||(ui.incidentPick=[]);const i=list.indexOf(id);if(i>=0)list.splice(i,1);else list.push(id);renderIncident(true);}
    else if(action==='incident-send'){if(act(Sim.sendIncidentMission(state,id,ui.incidentPick||[]),{refresh:false})){sfx('battle');ui.incidentPick=[];invalidate();renderIncidentList();renderIncident(true);}}
    else if(action==='incident-dismiss'){Sim.dismissIncident(state,id);save();closeModal();renderIncidentList();}
    else if(action==='boss-dispatch'){const res=Sim.dispatchParty(state,id,ui.bossPick||[]);if(act(res,{refresh:false})){sfx('battle');ui.bossPick=[];invalidate();renderBoss(true);}}
    else if(action==='inventory-view'){ui.inventoryView=button.dataset.view;invalidate();render(true);}
    else if(action==='stock-filter'){ui.stockSlot=button.dataset.slot;invalidate();render(true);}
    else if(action==='list-all')act(Sim.listAllItems(state));
    else if(action==='list-item')act(Sim.listItem(state,id));
    else if(action==='unlist-item')act(Sim.unlistItem(state,id));
    else if(action==='lock-item')act(Sim.toggleItemLock(state,id));
    else if(action==='view'){closeModal();setView(button.dataset.view);}
    else if(action==='enter-workshop'){closeModal();setView('shop');}
    else if(action==='village-inn')showModal('inn');
    else if(action==='close-work'){$('.work-panel').hidden=true;}
    else if(action==='side'){ui.side=button.dataset.side;if(ui.view!=='shop')setView('shop');invalidate();render(true);}
    else if(action==='recipe'){if(!ui.craftOrderId||state.orders.find(o=>o.id===ui.craftOrderId)?.recipeId!==id)ui.craftOrderId=null;ui.recipeId=id;showModal('recipe',id);}
    else if(action==='craft-filter'){const f=craftFilterState();if(button.dataset.slot)ui.recipeFilter=button.dataset.slot;if(button.dataset.ready)f.ready=!f.ready;if(button.dataset.band)f.band=button.dataset.band;invalidate();render(true);}
    // Crafting the recipe of the request being viewed links the piece to that request (auto hand-over when done).
    else if(action==='craft'){const ord=ui.craftOrderId&&state.orders.find(o=>o.id===ui.craftOrderId&&o.status==='open'&&o.recipeId===id);if(ord&&!ord.reservedItemId&&!getTown().queue.some(q=>q.orderId===ord.id)){if(act(Sim.craftForOrder(state,ord.id))){ui.craftOrderId=null;sfx('craftStart');}}else if(act(Sim.craft(state,id)))sfx('craftStart');}
    else if(action==='buy')act(Sim.buyMaterial(state,id,5));
    else if(action==='gather')act(Sim.gather(state));
    else if(action==='hero')showModal('hero',id);
    else if(action==='candidate')showModal('candidate',id);
    else if(action==='back-heroes')showModal('adventurers');
    else if(action==='hero-page'){ui.heroPage=Number(button.dataset.page);renderHeroList(false);$('#hero-results')?.scrollIntoView({block:'nearest'});}
    else if(action==='stock-item'){ui.itemReturn=null;showModal('item',{itemId:id});}
    else if(action==='equipment-item'){ui.itemReturn={heroId:id};showModal('item',{heroId:id,slot:button.dataset.slot});}
    else if(action==='item-back'){if(ui.itemReturn?.heroId)showModal('hero',ui.itemReturn.heroId);else closeModal();}
    else if(action==='quest-tab'){ui.questTab=button.dataset.tab;ui.modalSignature='';if(ui.questTab==='materials')ui.questDraft=newQuestDraft();renderModal(true);}
    else if(action==='quest-step'){const k=button.dataset.material,row=ui.questDraft.rows[k];if(row){row.amount=clamp((Number(row.amount)||1)+Number(button.dataset.amount),1,Math.max(1,Math.min(10000,Sim.getQuestRoom(state,k))));row.checked=true;const input=$('[data-quest-amount="'+k+'"]'),box=$('[data-quest-check="'+k+'"]');if(input)input.value=row.amount;if(box)box.checked=true;updateQuestDraft();}}
    else if(action==='cancel-quest')act(Sim.cancelQuest(state,id));
    else if(action==='commissions'){ui.questTab='orders';showModal('quests');}
    else if(action==='order-craft')openOrderRecipe(id);
    // Auto-craft tab: add a plan from the list (target 0 = keep making), delete a plan, filter the list.
    else if(action==='auto-add'){if(act(Sim.setAutoCraftRule(state,id,{enabled:false,targetStock:3})))renderOperations(true);}
    else if(action==='auto-remove'){if(act(Sim.removeAutoCraftRule(state,id)))renderOperations(true);}
    else if(action==='auto-filter'){const f=ui.autoFilter||(ui.autoFilter={slot:'all',ready:true,band:'all'});if(button.dataset.ready)f.ready=!f.ready;else if(button.dataset.band)f.band=button.dataset.band;else f.slot=button.dataset.slot;renderOperations(true);}
    // From the craft panel: open the material request board with the missing materials checked (amount = shortfall).
    else if(action==='quest-for-recipe'){const r=recipe(id);if(r){ui.questTab='materials';showModal('quests');for(const [k,v] of Object.entries(r.cost)){const row=ui.questDraft.rows[k],lack=v-(state.materials[k]||0);if(row&&lack>0){row.checked=true;row.amount=lack;}}renderMaterialQuests(true);}}
    else if(action==='order-make'){const o=state.orders.find(q=>q.id===id),hero=o&&state.adventurers.find(a=>a.id===o.adventurerId),r=o&&recipe(o.recipeId);const made=Sim.craftForOrder(state,id);if(made.ok){invalidate();ui.dirty=true;save();ui.modalSignature='';render(true);toast((r?.name||'장비')+' 제작 시작! 완성되면 '+(hero?hero.name+'님':'의뢰한 모험가')+'에게 바로 전달돼요.');}else toast(made.message,true);}
    else if(action==='return-order'){ui.questTab='orders';showModal('quests');ui.selectedOrder=id;ui.selectedOrderItem=null;renderOrders(true);}
    else if(action==='select-order'){ui.selectedOrder=id;ui.selectedOrderItem=null;ui.modalSignature='';renderOrders(true);}
    else if(action==='select-order-item'){ui.selectedOrderItem=id;ui.modalSignature='';renderOrders(true);}
    else if(action==='fulfill-order'){
      if(!ui.selectedOrderItem){toast('납품할 진열 장비를 먼저 골라주세요.',true);return;}
      const result=Sim.fulfillOrder(state,id,ui.selectedOrderItem);if(result.ok){ui.selectedOrder=null;ui.selectedOrderItem=null;}act(result);
    }
    else if(action==='build'){act(Sim.buyFacility(state,id));render(true);}
    else if(action==='facility')showModal('facility',id);
    else if(action==='upgrade-furnace'){if(act(Sim.upgradeFurnace(state,id))){if(ui.modal==='upgrades')renderFacilities(true);else renderFacility(true);}}
    // 2026-11: facilities have fixed places; moving was removed.
    else if(action==='cancel-placement')cancelPlacement();
    else if(action==='expand'){if(act(Sim.expandShop(state)))refitSceneCamera();}
    else if(action==='warehouse')showModal('warehouse');
    else if(action==='upgrade-warehouse'){if(act(Sim.upgradeWarehouse(state))){refitSceneCamera();renderModal(true);}}
    else if(action==='warehouse-items'){closeModal();ui.side='inventory';ui.inventoryView='warehouse';setView('shop');invalidate();render(true);}
    else if(action==='hire')act(Sim.hireStaff(state,id));
    else if(action==='hire-candidate')act(Sim.hireRecruitmentCandidate(state,id,state.activeTownId,Date.now()));
    else if(action==='recruitment-ad')act(Sim.postRecruitmentAd(state,state.activeTownId,Date.now()));
    else if(action==='fame')showModal('fame');
    else if(action==='hire-recruit')act(Sim.hireRecruit(state,id));
    else if(action==='training')showModal('training',id);
    else if(action==='start-training')act(Sim.trainStaff(state,id));
    else if(action==='invasion')showInvasion(id);
    else if(action==='fund-relief')act(Sim.fundRelief(state,id||state.activeTownId));
    else if(action==='incident-town')enterTown(id);
    else if(action==='finance')showModal('finance');
    else if(action==='research')showModal('research');
    else if(action==='research-buy'){if(act(Sim.buyResearch(state,id))){sfx('unlock');renderResearch(true);}}
    else if(action==='achievements'){if(id&&Ach&&Ach.CATEGORIES.some(c=>c.id===id))ui.achievementTab=id;showModal('achievements');}
    else if(action==='achievement-tab'){ui.achievementTab=id||'all';renderAchievements(true);}
    else if(action==='achievement-title'){const p=achievementProfile();if(p&&Ach.setTitle(p,id||null)){saveAchievementProfile();renderBrandTitle();renderAchievements(true);toast(p.title?'칭호를 바꿨어요.':'칭호를 숨겼어요.');}}
    else if(action==='achievements-export'){const p=achievementProfile();if(p){download(JSON.stringify(p,null,2),'little-ember-achievements.json');toast('업적 기록을 파일로 내보냈어요.');}}
    else if(action==='achievements-reset-prompt'){const box=$('#achievements-reset-confirm');if(box)box.hidden=false;}
    else if(action==='achievements-reset-cancel'){const box=$('#achievements-reset-confirm');if(box)box.hidden=true;}
    else if(action==='achievements-reset-confirm'){if(Ach){achProfile=Ach.blankProfile();try{localStorage.setItem(Ach.PROFILE_KEY,JSON.stringify(achProfile));}catch(_){}renderBrandTitle();toast('업적 기록을 지웠어요. 지금 진행에서 이미 채운 조건은 곧 다시 달성돼요.');renderSettings();}}
    else if(action==='finance-payroll'){ui.calendarTab='payroll';showModal('calendar');}
    else if(action==='gold-use')openGoldUse(id);
    else if(action==='region')showModal('region',id);
    else if(action==='focus-town')focusWorldTown(id);
    else if(action==='guide-step'){
      const kind=button.dataset.kind,target=button.dataset.target;
      if(kind==='side'){closeModal();ui.side=target;setView('shop');}
      else if(kind==='nav')navigate(target);
      else if(kind==='invasion')showInvasion();
      else if(kind==='finance')showModal('finance');
    }
    else if(action==='pay-wages')act(Sim.payWages(state,id||undefined));
    else if(action==='calendar-tab'){ui.calendarTab=button.dataset.tab;ui.modalSignature='';renderCalendar(true);}
    else if(action==='settings-tab'){ui.settingsTab=button.dataset.tab||'sound';renderSettings();}
    else if(action==='help-topic'){ui.helpTopic=Number(id)||0;renderSettings();}
    else if(action==='tutorial-restart'){closeModal();if(ui.view!=='village'&&typeof setView==='function')setView('village');setTimeout(startTutorial,120);}
    else if(action==='season-open'){ui.calendarTab='season';ui.modalSignature='';showModal('calendar');}
    else if(action==='recipe-open'){cancelPlacement();ui.craftOrderId=null;ui.recipeId=id;ui.side='craft';if(ui.view!=='shop')setView('shop');$('.work-panel').hidden=false;invalidate();render(true);showModal('recipe',id);}
    else if(action==='staff-card'){showModal('staff');setTimeout(()=>{const card=$('#staff-card-'+id);if(card){card.scrollIntoView({block:'center',behavior:'smooth'});card.classList.add('flash');setTimeout(()=>card.classList.remove('flash'),1600);}},0);}
    else if(action==='festival-open'){ui.calendarTab='festival';ui.modalSignature='';showModal('calendar');}
    else if(action==='season-buy'){const amount=button.dataset.amount==='all'?undefined:Number(button.dataset.amount);act(Sim.buySeasonMarket(state,id,amount));}
    else if(action==='season-deliver')act(Sim.deliverSeasonHarvest(state,id));
    else if(action==='season-craft'){const r=recipe(id);if(r){cancelPlacement();ui.craftOrderId=null;ui.recipeId=r.id;ui.side='craft';if(ui.view!=='shop')setView('shop');$('.work-panel').hidden=false;invalidate();render(true);showModal('recipe',r.id);}}
    else if(action==='festival-item'){ui.festivalItem=id;ui.modalSignature='';renderCalendar(false);}
    else if(action==='submit-festival'){const result=Sim.submitFestival(state,ui.festivalItem);if(result.ok)ui.festivalItem=null;act(result);}
    else if(action==='withdraw-festival')act(Sim.withdrawFestival(state,id));
    else if(action==='market')showModal('market');
    else if(action==='boss')showModal('boss',id);
    else if(action==='operations'){ui.operationsTab=button.dataset.tab||'materials';ui.autoRecipeId=ui.recipeId||'iron_sword';showModal('operations');}
    else if(action==='material-cancel'){ui.materialDraft={};renderOperations(true);}
    else if(action==='operations-tab'){ui.operationsTab=button.dataset.tab;renderOperations(true);}
    else if(action==='buy-rare')act(Sim.buyRareOffer(state,id));
    else if(action==='upgrade-inn'){if(act(Sim.upgradeInn(state)))refitSceneCamera();}
    else if(action==='town')showModal('town',id);
    else if(action==='enter-town')enterTown(id);
    else if(action==='open-branch'){const result=Sim.openBranch(state,id);if(act(result,{refresh:false})){enterTown(id);invalidate();render(true);}}
    else if(action==='room-switch'){scene?.focusRoom?.(button.dataset.room||'workshop');}
    else if(action==='camera'){if(button.dataset.camera==='in')scene?.zoomBy(1.15);else if(button.dataset.camera==='out')scene?.zoomBy(1/1.15);else if(button.dataset.camera==='scale-reset')scene?.setViewScale?.(100);else scene?.resetCamera();updateViewScale();}
    else if(action==='pause'){if(saveBlocked){showModal('settings');return;}ui.paused=!ui.paused;renderHeader();}
    // One time button cycles: paused -> 1x -> 2x -> paused.
    else if(action==='speed-toggle'){if(ui.paused){if(saveBlocked){showModal('settings');return;}ui.paused=false;preferences.speed=1;}else if(preferences.speed===1)preferences.speed=2;else ui.paused=true;savePreferences();renderHeader();speedChanged();}
    else if(action==='close')closeModal();
    else if(action==='help'){cancelPlacement();showModal('help');}
    else if(action==='settings')showModal('settings');
    else if(action==='sound'){const on=!(preferences.sound||preferences.music);preferences.sound=on;preferences.music=on;applyAudio();sfx('click');savePreferences();renderHeader();if(ui.modal==='settings')renderSettings();}
    else if(action==='sound-music'){preferences.music=!preferences.music;applyAudio();savePreferences();renderHeader();renderSettings();}
    else if(action==='sound-sfx'){preferences.sound=!preferences.sound;applyAudio();sfx('click');savePreferences();renderHeader();renderSettings();}

    else if(action==='save')save(true);
    else if(action==='retry-save')save(true);
    else if(action==='retry-save-load')retrySavedState();
    else if(action==='export'){download(JSON.stringify(state,null,2),'little-ember-v073-day-'+state.day+'.json');toast('현재 진행을 저장 파일로 내보냈어요.');}
    else if(action==='export-recovery'){const raw=saveStore.exportOriginal();if(raw!==null){download(raw,'little-ember-original-recovery.json');toast('기존 저장 원본을 내보냈어요.');}else toast('기존 저장 원본을 아직 읽을 수 없어요. 다시 불러오기를 먼저 시도해 주세요.',true);}
    else if(action==='accept-new-save'){
      if(save(true,{replace:true})){ui.paused=false;renderHeader();}renderSettings();
    }
    else if(action==='restore-save-backup'){ui.restoreWasPaused=ui.paused;ui.paused=true;showModal('save-restore',button.dataset.key);renderHeader();}
    else if(action==='restore-save-confirm'){
      const restored=saveStore.recover(button.dataset.key);renderSaveStatus();
      if(restored.ok){adoptSavedState(restored.state);toast(state.day+'일 차 백업으로 복구했어요.');}
      else toast(saveProblem(restored.reason),true);
    }
    else if(action==='import')$('#import-input').click();
    else if(action==='reset-prompt')$('#reset-confirm').hidden=false;
    else if(action==='reset-cancel')$('#reset-confirm').hidden=true;
    else if(action==='reset-confirm'){
      const next=Sim.createState(),result=saveStore.save(next,{replace:true});renderSaveStatus();
      if(!result.ok){toast(saveProblem(result.reason),true);return;}
      adoptSavedState(next,{newGame:true});toast('새로운 대장간의 첫날이 시작됐어요.');
    }
  }
  document.addEventListener('click',e=>{
    const button=e.target.closest('button[data-action]');if(button&&!button.disabled){if(!['sound','close'].includes(button.dataset.action))sfx(/tab$/.test(button.dataset.action)||button.closest('.modal-tabs,.segmented')?'tab':'click');handleAction(button);}
    if(e.target.closest('.brand')){e.preventDefault();cancelPlacement();closeModal();setView('shop');}
  });
  $('#modal-backdrop').addEventListener('click',e=>{if(e.target===$('#modal-backdrop'))closeModal();});
  // Volume sliders in the settings window (live while dragging, saved on release).
  document.addEventListener('input',e=>{const kind=e.target.dataset&&e.target.dataset.volume;if(!kind)return;const v=Math.max(0,Math.min(1,Number(e.target.value)/100));if(kind==='music')preferences.musicVolume=v;else preferences.sfxVolume=v;applyAudio();});
  document.addEventListener('change',e=>{const kind=e.target.dataset&&e.target.dataset.volume;if(!kind)return;savePreferences();if(kind==='sfx')sfx('sale');});
  document.addEventListener('submit',e=>{
    if(e.target.dataset.operationForm){e.preventDefault();submitOperationForm(e.target);return;}
    if(e.target.id!=='quest-form')return;e.preventDefault();
    updateQuestDraft();
    const list=questMaterials().filter(k=>ui.questDraft.rows[k].checked).map(k=>({material:k,amount:ui.questDraft.rows[k].amount}));
    const res=Sim.postQuests(state,list);act(res);
    if(res.ok){ui.questDraft=newQuestDraft();renderMaterialQuests(true);}
  });
  document.addEventListener('input',e=>{
    if(e.target.dataset.materialEnabled||e.target.dataset.materialTarget){if(e.target.dataset.materialEnabled)e.target.closest('.ops-row')?.classList.toggle('checked',!!e.target.checked);const id=e.target.dataset.materialEnabled||e.target.dataset.materialTarget;const saved=Sim.getOperations(state).materialRules[id],base=ui.materialDraft[id]||{enabled:!!saved.enabled,targetStock:Math.min(saved.targetStock,Sim.getMaterialCapacity(state))};if(e.target.dataset.materialEnabled)base.enabled=!!e.target.checked;else base.targetStock=Number(e.target.value);ui.materialDraft[id]=base;}
    else if(e.target.dataset.questAmount){const row=ui.questDraft.rows[e.target.dataset.questAmount];if(row&&e.target.value!==''){row.amount=Number(e.target.value);row.checked=true;const box=$('[data-quest-check="'+e.target.dataset.questAmount+'"]');if(box)box.checked=true;updateQuestDraft();}}
  });
  document.addEventListener('change',e=>{
    const el=e.target;
    if(el.dataset.materialEnabled||el.dataset.materialTarget){const id=el.dataset.materialEnabled||el.dataset.materialTarget;const saved=Sim.getOperations(state).materialRules[id],base=ui.materialDraft[id]||{enabled:!!saved.enabled,targetStock:Math.min(saved.targetStock,Sim.getMaterialCapacity(state))};if(el.dataset.materialEnabled)base.enabled=!!el.checked;else base.targetStock=Number(el.value);ui.materialDraft[id]=base;}
    else if(el.dataset.questCheck){const row=ui.questDraft.rows[el.dataset.questCheck];if(row){row.checked=el.checked;updateQuestDraft();}}
    else if(el.dataset.questAmount){const row=ui.questDraft.rows[el.dataset.questAmount];if(row){updateQuestDraft();el.value=row.amount;}}
    else if(el.dataset.staffRole){act(Sim.assignStaff(state,el.dataset.staffRole,el.value));}
    else if(el.dataset.staffFacility){const s=getTown().staff.find(s=>s.id===el.dataset.staffFacility);if(s)act(Sim.assignStaff(state,s.id,s.role,el.value||null));}
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){if(ui.modal)closeModal();else if(ui.placement)cancelPlacement();return;}
    if(e.key==='Tab'&&ui.modal){
      const focusable=Array.from($('#modal').querySelectorAll('button:not([disabled]),input,select,a[href]')).filter(el=>el.offsetParent!==null),first=focusable[0],last=focusable[focusable.length-1];
      if(e.shiftKey&&document.activeElement===first){last?.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first?.focus();e.preventDefault();}return;
    }
    if(e.target.matches('input,select,textarea')||ui.modal)return;
    if(e.code==='Space'&&!e.target.closest('button')){e.preventDefault();if(saveBlocked){showModal('settings');return;}ui.paused=!ui.paused;renderHeader();}
    if(e.altKey&&/^[1-5]$/.test(e.key)){const target=townCatalog()[Number(e.key)-1];if(target&&state.towns[target.id]){e.preventDefault();enterTown(target.id);}return;}
    if(e.key==='['||e.key===']'){const towns=ownedTowns(),index=towns.findIndex(t=>t.id===state.activeTownId),next=(index+(e.key===']'?1:-1)+towns.length)%towns.length;e.preventDefault();enterTown(towns[next].id);return;}
    if(['1','2'].includes(e.key)){preferences.speed=Number(e.key);savePreferences();renderHeader();speedChanged();}
  });
  $('#import-input').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    if(file.size>8*1024*1024){toast('저장 파일은 8MB 이하로 불러와 주세요.',true);e.target.value='';return;}
    try {
      const loaded=Sim.normalizeState(JSON.parse(await file.text()));
      if(!loaded||!Sim.validateState(loaded))throw new Error('invalid');
      const result=saveStore.save(loaded,{replace:true});renderSaveStatus();
      if(!result.ok){toast(saveProblem(result.reason),true);e.target.value='';return;}
      adoptSavedState(loaded);toast(state.day+'일 차 대장간을 불러왔어요.');
    } catch(_){toast('올바른 작은 불꽃 대장간 저장 파일이 아니에요. 현재 진행은 유지됩니다.',true);}e.target.value='';
  });
  document.addEventListener('visibilitychange',()=>{lastFrame=performance.now();if(document.hidden)save();});
  window.addEventListener('pagehide',()=>save());
  window.addEventListener('beforeunload',()=>save());
  let recruitmentTickAt=0;
  if(!saveBlocked)Sim.advanceRecruitment(state,Date.now());
  // Game-styled tooltip (replaces the browser's title tooltip). Lives in #canvas-wrap so it scales with the UI.
  // Elements opt in with data-tip; equipment slots (data-tip="equip") show the item card.
  function equipTipHtml(el){
    const hero=state.adventurers.find(a=>a.id===el.dataset.id),slot=el.dataset.slot,item=hero?.equipment?.[slot];
    if(!item)return '<div class="tip-head"><b>'+escape(slotNames[slot]||'장비')+'</b></div><p class="tip-empty">비어 있음</p>';
    const q=quality(item),s=Sim.getItemStats(item),rows=[['attack','공격력'],['defense','방어력'],['hp','체력']].filter(([k])=>s[k]).map(([k,n])=>'<div class="tip-row"><span>'+n+'</span><b>'+num(s[k])+'</b></div>').join('');
    const opts=(item.options||[]).map(o=>'<div class="tip-row tip-option"><span>'+escape(o.label+' '+({attack:'공격력',defense:'방어력',hp:'체력'}[o.stat]||o.stat))+'</span><b>'+(o.value>0?'+':'')+num(o.value)+'</b></div>').join('');
    return '<div class="tip-head"><b style="color:'+escape(q.color||'#5e4129')+'">'+escape(itemName(item))+(itemLevel(item)?' +'+itemLevel(item):'')+'</b><span class="tip-badge" style="color:'+escape(q.color||'#7b806f')+'">'+escape(q.label||q.name)+'</span></div><small class="tip-sub">'+escape(slotNames[slot]||'')+'</small>'+(rows||'<p class="tip-empty">기본 장비</p>')+(opts?'<div class="tip-sep"></div>'+opts:'');
  }
  function showTip(el){
    const wrap=$('#canvas-wrap');if(!wrap)return;
    let tip=$('#game-tip');if(!tip){tip=document.createElement('div');tip.id='game-tip';tip.className='game-tip';tip.setAttribute('role','tooltip');wrap.appendChild(tip);}
    tip.innerHTML=el.dataset.tip==='equip'?equipTipHtml(el):el.dataset.tip==='material'?materialTipHtml(el.dataset.id):escape(el.dataset.tip);tip.hidden=false;
    const scale=Number(wrap.dataset.uiScale)||1,w=wrap.getBoundingClientRect(),r=el.getBoundingClientRect(),tw=tip.offsetWidth,th=tip.offsetHeight;
    const left=(r.right-w.left)/scale+8,top=(r.top-w.top)/scale,maxX=w.width/scale-tw-6,maxY=w.height/scale-th-6;
    tip.style.left=Math.max(6,left>maxX?(r.left-w.left)/scale-tw-8:left)+'px';tip.style.top=Math.max(6,Math.min(top,maxY))+'px';
  }
  function hideTip(){const tip=$('#game-tip');if(tip)tip.hidden=true;}
  document.addEventListener('mouseover',e=>{const el=e.target.closest?.('[data-tip]');if(el)showTip(el);});
  document.addEventListener('mouseout',e=>{const el=e.target.closest?.('[data-tip]');if(el&&!el.contains(e.relatedTarget))hideTip();});
  document.addEventListener('focusin',e=>{const el=e.target.closest?.('[data-tip]');if(el)showTip(el);else hideTip();});
  document.addEventListener('click',hideTip,true);

  // UI scale: everything drawn over the game uses 1280x720 design pixels and scales with the game frame
  // (frame width / 1280), like the canvas itself. Exposed as --ui-scale on #canvas-wrap.
  const UI_DESIGN_WIDTH=1280;
  function updateUiScale(){
    const wrap=$('#canvas-wrap');if(!wrap)return;
    const scale=Math.max(.2,(wrap.clientWidth||UI_DESIGN_WIDTH)/UI_DESIGN_WIDTH),value=scale.toFixed(4);
    if(wrap.dataset&&wrap.dataset.uiScale===value)return;
  if(wrap.dataset)wrap.dataset.uiScale=value;
  wrap.style?.setProperty?.('--ui-scale',value);
  }
  if(window.ResizeObserver&&$('#canvas-wrap'))new ResizeObserver(updateUiScale).observe($('#canvas-wrap'));
  window.addEventListener('resize',updateUiScale);
  updateUiScale();
  // View scale label (100% = default framing, 200% = zoomed out). Hidden on the world map.
  function updateViewScale(){
    // Room switch (forge view only): shop -> '▲ 작업실 보기 ▲' at the top, workshop -> '▼ 매장 보기 ▼' at the bottom.
    // "▼ 마을로 나가기 ▼" sits at the bottom while the shop room is shown (the exit nook is clickable too).
    const ve=$('#village-exit');if(ve){const room=ui.view==='shop'&&scene?.getRoomFocus?scene.getRoomFocus():null,hide=room!=='shop'||!!ui.placement;if(ve.hidden!==hide)ve.hidden=hide;}
    const sw=$('#room-switch');if(sw){const room=ui.view==='shop'&&scene?.getRoomFocus?scene.getRoomFocus():null,hide=!room||!!ui.placement;if(sw.hidden!==hide)sw.hidden=hide;if(room){const up=room==='shop',key=up?'up':'down';if(sw.dataset.dir!==key){sw.dataset.dir=key;sw.innerHTML=roomArrow(up)+(up?' 작업실 보기 ':' 매장 보기 ')+roomArrow(up);sw.classList.toggle('down',room==='workshop');sw.dataset.room=up?'workshop':'shop';}}}
    const el=$('#view-scale');if(!el||!scene||!scene.getViewScale)return;
    const v=scene.getViewScale(),text=v==null?'':v+'%';
    if(el.hidden!==(v==null))el.hidden=v==null;
    if(el.textContent!==text)el.textContent=text;
  }
  // Developer admin tool hooks (dist/admin.js; only on localhost or with ?admin, never in the standalone build).
  let adminBoost=1,adminBusy=false;
  function adminApply(label,fn){
    if(saveBlocked){toast('저장 보호 중에는 관리툴을 쓸 수 없어요.',true);return null;}
    let r;try{r=fn(state);}catch(err){toast('관리툴 오류: '+(err&&err.message||err),true);return null;}
    if(!Sim.validateState(state))toast('주의: 관리툴 실행 뒤 상태 검증에 실패했어요. 저장이 보호될 수 있어요.',true);
    invalidate();ui.dirty=true;save();render(true);
    if(r&&typeof r.message==='string')toast(r.message,!r.ok);else if(label)toast(label);
    return r;
  }
  function adminFastForward(seconds,onProgress){
    if(saveBlocked||adminBusy||!(seconds>0))return Promise.resolve(false);
    adminBusy=true;const total=seconds;let left=seconds;
    return new Promise(resolve=>{
      const chunk=()=>{
        const slice=Math.min(left,600);Sim.step(state,slice);visualTime+=slice;left-=slice;
        if(onProgress)onProgress(1-left/total);
        if(left>1e-6){setTimeout(chunk,0);return;}
        ui.lastEvent=state.seq;adminBusy=false;invalidate();ui.dirty=true;save();render(true);resolve(true);
      };
      setTimeout(chunk,0);
    });
  }
  function loop(now) {
    const realNow=Date.now();
    if(!saveBlocked&&realNow>=recruitmentTickAt){
      Sim.advanceRecruitment(state,realNow);
      recruitmentTickAt=Math.min(realNow+1000,...Object.values(state.recruitment?.boards||{}).map(board=>board.nextRefreshAt));
    }
    const elapsed=Math.min(.25,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
    if(!ui.paused&&!document.hidden&&!adminBusy){const dt=elapsed*preferences.speed*2*adminBoost;Sim.setIncidentRealRate?.(preferences.speed*2*adminBoost);Sim.step(state,dt);visualTime+=dt;}
    const events=state.events.filter(e=>e.seq>ui.lastEvent);
    if(events.length){ui.lastEvent=Math.max(...events.map(e=>e.seq));for(const e of events){
      eventSound(e);
      if(e.type==='order'){pushFeed(e.type,feedText(e),{kind:'order-craft',id:e.orderId,label:'제작 하기'},feedLink(e));}
      else if(['season-notice','season-start','season-end','season-complete'].includes(e.type)){pushFeed(e.type,e.text,{kind:'season-open',id:e.seasonEvent||'season',label:'행사 보기'},feedLink(e));}
      // 돌발 사건: a new one gets a [살펴보기] button that opens its window; its result is a plain line.
      else if(e.type==='incident'&&e.incidentId){pushFeed(e.type,otherTownTag(e.townId)+String(e.text||'').replace(/^돌발 사건 · /,''),{kind:'incident-open',id:e.incidentId,label:'살펴보기'},{kind:'incident-open',id:e.incidentId});}
      else if(e.type==='incident-result'){pushFeed(e.type,otherTownTag(e.townId)+e.text,null,null);}
      else if(e.type==='quest-ready'){pushFeed('quest-ready',String(e.text||'').replace(/^퀘스트 완료 · /,'')+' 완료!',{kind:'quest-open',id:String(e.questId),label:'보상 받기'},{kind:'quest-open',id:String(e.questId)});}
      // The 서리문 final boss's first fall: a feed line only (2026-11-10 사용자: no "클리어" anywhere in the game).
      // Tagged [보스 토벌] (it was filed under [성장 퀘스트], which it is not).
      // 이주 묻기: a feed line with [보내기], and the list window opens by itself unless another window is open.
      else if(e.type==='migration-ready'){pushFeed('migration',e.text,{kind:'migration-open',id:'',label:'보내기'},{kind:'migration-open',id:''});if(!ui.modal&&!ui.placement){ui.migPick=null;showModal('migration');}}
      else if(e.type==='game-clear'){pushFeed('fame-boss',e.text,null,e.bossId?{kind:'boss',id:e.bossId}:null);sfx('fanfare');}
      else if(e.type==='quest-chapter'){pushFeed('quest-ready',e.text,null,{kind:'quest-open',id:''});}
      // A won boss fight that dropped a rare recipe: say so (the boss line alone does not mention it).
      // The player sends boss parties, so a lost fight or a party called home must be said too (wins already are).
      else if(e.type==='raid-crisis'&&e.bossId){pushFeed('crisis',e.text,{kind:'boss',id:e.bossId,label:'지원하기',crisis:true},{kind:'boss',id:e.bossId});}
      else if(e.type==='mission-crisis'&&e.incidentId){pushFeed('crisis',e.text,{kind:'incident-open',id:e.incidentId,label:'지원하기',crisis:true},{kind:'incident-open',id:e.incidentId});}
      else if(e.type==='boss-ready'&&e.bossId){pushFeed('boss-ready',e.text,{kind:'boss',id:e.bossId,label:'파티 꾸리기'},{kind:'boss',id:e.bossId});}
      else if(e.type==='raid-retreat'||e.type==='raid-recall'){pushFeed('raid-result',e.text,null,e.bossId?{kind:'boss',id:e.bossId}:null);}
      else if(e.type==='raid-victory'&&/희귀 설계도/.test(e.text||'')){pushFeed('rare-recipe',e.text.replace(/^.*?토벌 성공!\s*/,''),null,e.bossId?{kind:'boss',id:e.bossId}:null);}
      // 2026-11-10: migrations were silent (only the journal) — strong heroes vanished from boss/dispatch picks unseen.
      else if(['fame-craft','fame-boss','recipe-unlock','goal','quest-complete','order-complete','arrival','recruit-arrival','migration','invasion-start','invasion-battle','invasion-end','training-complete'].includes(e.type)){pushFeed(e.type,feedText(e),null,feedLink(e));}
    }ui.dirty=true;}
    // The equipment festival opening goes to the feed too (the old centre card is hidden).
    {const fest=Sim.getFestival(state);if(fest&&fest.status==='open'&&fest.year&&fest.year!==preferences.festivalSeenYear){preferences.festivalSeenYear=fest.year;savePreferences();pushFeed('festival','올해 장비 축제 출품이 열렸어요. 최대 '+(fest.maxEntries||3)+'점까지 낼 수 있어요.',{kind:'festival-open',id:'',label:'참가하기'},{kind:'festival-open',id:''});}}
    if(now-achCheckAt>1000){achCheckAt=now;checkAchievements();}
    if(!renderIncidentList.synced){renderIncidentList.synced=true;syncIncidents();}
    renderCalendarChip();renderIncidentList();if(now-(renderQuestTracker.at||0)>500){renderQuestTracker.at=now;renderQuestTracker();renderEffectIcons();}
    updateMoments(elapsed);
    scene?.render(state,visualTime);
    updateViewScale();audioPlace();
    if(ui.view==='village'&&scene){
      const surface=$('#village-actors'),view=$('#village-view'),forge=$('.village-forge'),inn=$('.village-inn');
      if(surface&&view&&forge&&inn){const b=view.getBoundingClientRect(),f=forge.getBoundingClientRect(),i=inn.getBoundingClientRect();
        // Walkers go straight up the dirt path to the middle of each building's door (same doors as the placement above).
        const d=villageDoors(getTown());
        if(b.width&&b.height)scene.renderVillage(surface,state,visualTime,{forge:{x:(f.left+f.width*d.forge-b.left)/b.width,y:(f.top+f.height*.94-b.top)/b.height},inn:{x:(i.left+i.width*d.inn-b.left)/b.width,y:(i.top+i.height*.94-b.top)/b.height}});
      }
    }
    if(now-lastUI>350){render();lastUI=now;}
    requestAnimationFrame(loop);
  }
  notifications=ForgeNotifications.create({
    bossRoot:$('#boss-notifications'),festivalRoot:$('#festival-notifications'),preferences,
    renderIcon:icon,focusFallback:$('#game-canvas'),isBusy:()=>!!ui.modal||!!ui.placement,
    onPreferencesChange:patch=>{Object.assign(preferences,patch);savePreferences();},
    onFestivalJoin:()=>{ui.calendarTab='festival';showModal('calendar');}
  });
  if(window.ForgeAdmin&&ForgeAdmin.enabled(window.location)){
    window.__forgeDebug={Sim,getState:()=>state,refresh:()=>{invalidate();render(true);renderCalendarChip();renderIncidentList();renderQuestTracker();renderEffectIcons();}}; // local testing only
    ForgeAdmin.mount({
      root:$('#canvas-wrap'),Sim,getState:()=>state,apply:adminApply,fastForward:adminFastForward,
      setBoost:v=>{adminBoost=Math.max(1,Number(v)||1);},getBoost:()=>adminBoost,getSpeed:()=>preferences.speed,
      getFeed:()=>feedLog.slice(),feedKinds:FEED_KINDS,pushFeed:(type,text,action,data)=>pushFeed(type,text,action,feedLink({type,...(data||{})})),
      isBusy:()=>adminBusy,openSeason:()=>{ui.calendarTab='season';showModal('calendar');}
    });
  }
  $('#brand-icon').innerHTML=icon('flame');hydrateIcons();renderBrandTitle();
  if(window.ForgeScene){
    scene=new ForgeScene($('#game-canvas'),{
      onSelectAdventurer:id=>showModal('hero',id),
      // Clicking a furnace opens facility placement (where its grade is improved); other facilities show their details.
      onSelectFacility:id=>{const f=getTown().facilities.find(x=>x.id===id);if(f&&f.type==='furnace')showModal('upgrades');else showModal('facility',id);},
      // Dragging a staff member onto a furnace / counter / display / anvil / storage assigns them there.
      onDropStaff:(id,role,facilityId)=>{const w=getTown().staff.find(s=>s.id===id);if(!w)return;if(role==='sales'&&facilityId&&w.role==='logistics')role='logistics';if(w.role===role&&(w.assignedFacilityId||null)===(facilityId||null))return;act(Sim.assignStaff(state,id,role,facilityId||null));render(true);},
      onSelectStaff:id=>{showModal('staff');setTimeout(()=>$('#staff-card-'+id)?.scrollIntoView({block:'center',behavior:'smooth'}),0);},
      // The world map has no side panel, so a town click opens that town's window (opening conditions / branch info).
      onSelectTown:id=>{ui.focusedTown=id;invalidate();showModal('town',id);},
      onSelectBoss:id=>showModal('boss',id),
      onSelectRegion:id=>showModal('region',id),onSelectIncident:id=>showInvasion(id),
      onPlaceFacility:placeFacility,onCancelPlacement:cancelPlacement,
      // Dragging the fixed forge view points the player at the room switch button (glow + shake).
      onDragBlocked:()=>{const sw=$('#room-switch');if(!sw||sw.hidden)return;sw.classList.remove('nudge');void sw.offsetWidth;sw.classList.add('nudge');clearTimeout(sw._nudgeTimer);sw._nudgeTimer=setTimeout(()=>sw.classList.remove('nudge'),900);},
      onSelectStation:station=>{
        if(station==='village'){cancelPlacement();closeModal();setView('village');}
        else if(station==='counter')showModal('staff');
        else if(['upgrades','inn','staff','warehouse'].includes(station))showModal(station);
        else {ui.side=station==='inventory'?'inventory':'craft';if(ui.view!=='shop')setView('shop');$('.work-panel').hidden=false;invalidate();render(true);if(window.innerWidth<760)$('.work-panel').scrollIntoView({behavior:'smooth',block:'start'});}
      }
    });
    if(scene.assetsLoaded?.then)scene.assetsLoaded.then(()=>portraits());
  }
  // This timer does not depend on animation frames or scene rendering succeeding.
  setInterval(()=>save(),5000);
  savePreferences();applyAudio();portraits();render(true);renderSaveStatus();requestAnimationFrame(loop);
  // Title screen: the game waits underneath (paused). The one button continues the saved game, or starts a new one when there is none.
  // Only in a real browser page; ?notitle skips it (tests and tools).
  (function showTitle(){
    if(typeof location==='undefined'||/[?&]notitle\b/.test(location.search||'')||!document.body?.append)return;
    ui.paused=true;renderHeader();
    const el=document.createElement('div');el.id='title-screen';
    el.innerHTML='<div class="title-stage"><div class="title-bg"></div><img class="title-logo" src="assets/title/title-logo.png" alt="대장장이 라이프"><button type="button" class="title-start" aria-label="게임 시작"></button></div>';
    // Inside the game frame (#canvas-wrap) so it always has the game screen's place and size.
    ($('#canvas-wrap')||document.body).append(el);
    const start=el.querySelector('.title-start');
    // While the title is up, keys belong to it: Enter/Space start wherever focus is, and game keys
    // (Space = pause toggle, 1/2 = speed, town hops) must not run the game behind the title.
    const keys=e=>{if(e.key==='Escape')return;e.stopPropagation();if(['Enter','Space','NumpadEnter'].includes(e.code)){e.preventDefault();go();}};
    document.addEventListener('keydown',keys,true);
    const go=()=>{if(el.classList.contains('leaving'))return;sfx('start');document.removeEventListener('keydown',keys,true);el.classList.add('leaving');ui.paused=saveBlocked;lastFrame=performance.now();renderHeader();setTimeout(()=>el.remove(),450);
      // First start of a new game: the tutorial runs once (it can be replayed from 환경설정 › 도움말).
      if(!preferences.tutorialDone&&!saveBlocked&&state.time<600)setTimeout(startTutorial,520);};
    start.addEventListener('click',go);
    // Clicks on the empty title picture do nothing (they must not take focus away and change how the button looks).
    el.addEventListener('mousedown',e=>{if(e.target!==start)e.preventDefault();});
    el.addEventListener('touchstart',e=>{if(e.target!==start)e.preventDefault();},{passive:false});
    setTimeout(()=>start.focus(),50);
  })();
  window.LittleEmber=Object.freeze({version:'0.8.1',snapshot:()=>JSON.parse(JSON.stringify(state)),pause:(paused=true)=>{ui.paused=saveBlocked||!!paused;renderHeader();}});
})();
