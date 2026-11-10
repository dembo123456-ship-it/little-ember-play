(function (root, factory) {
  'use strict';
  const api = factory();
  root.ForgeEquipment = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Catalog coverage and progression intent. New numerical values are provisional;
  // economic/combat balancing is explicitly deferred until the design is complete.
  const families = [
    {id:'axe',name:'도끼',slot:'weapon',type:'axe',names:['벌목꾼의 손도끼','강철 전투도끼','미스릴 양날도끼'],costs:[{iron:3,wood:2},{iron:7,wood:3,leather:1},{mythril:3,iron:6,wood:3}]},
    {id:'spear',name:'창',slot:'weapon',type:'spear',names:['민병대의 짧은 창','강철 돌격창','은빛 성벽창'],costs:[{iron:2,wood:3},{iron:6,wood:4,leather:1},{mythril:3,iron:5,wood:4}]},
    {id:'dagger',name:'단검',slot:'weapon',type:'dagger',names:['정찰자의 단검','그늘의 쌍날','달무리 암살검'],costs:[{iron:3,leather:1},{iron:6,leather:3},{mythril:3,iron:4,crystal:2}]},
    {id:'gauntlet',name:'권갑',slot:'weapon',type:'gauntlet',names:['연습용 철권갑','투사의 강철권갑','유성의 권갑'],costs:[{iron:2,leather:2},{iron:6,leather:4},{mythril:3,leather:5,crystal:2}]},
    {id:'crossbow',name:'석궁',slot:'weapon',type:'crossbow',names:['초심자의 석궁','성벽 수비대 석궁','미스릴 연발석궁'],costs:[{iron:2,wood:3},{iron:5,wood:6,leather:2},{mythril:3,wood:6,crystal:2}]},
    {id:'focus',name:'마도구',slot:'offhand',type:'focus',names:['작은 수정구','별빛의 마도구','달의 공명구'],costs:[{wood:2,crystal:1},{iron:3,crystal:3},{mythril:3,crystal:5}]},
    {id:'tome',name:'성서·마법서',slot:'offhand',type:'tome',names:['견습의 주문서','수호의 성서','은빛 룬 마법서'],costs:[{leather:3,wood:1},{leather:6,crystal:2},{leather:7,mythril:2,crystal:5}]},
    {id:'quiver',name:'화살통',slot:'offhand',type:'quiver',names:['가죽 화살통','순찰대 화살집','바람깃 화살통'],costs:[{leather:3,wood:1},{leather:6,iron:3},{leather:7,mythril:2,wood:5}]},
    {id:'cloth',name:'천옷',slot:'armor',type:'armor',names:['견습의 천 로브','룬을 수놓은 로브','달빛 비단 로브'],costs:[{leather:3,wood:1},{leather:6,crystal:2},{leather:8,crystal:5,mythril:2}]},
    {id:'light',name:'경갑',slot:'armor',type:'armor',names:['정찰자의 경갑','추적자의 가죽 경갑','미스릴 사슬 경갑'],costs:[{leather:4,iron:1},{leather:6,iron:4},{leather:7,mythril:4,iron:3}]},
    {id:'heavy',name:'중갑',slot:'armor',type:'armor',names:['민병대의 흉갑','성채 기사의 중갑','은빛 성벽 중갑'],costs:[{iron:4,leather:2},{iron:9,leather:4},{mythril:5,iron:6,leather:4}]},
    {id:'ring',name:'반지',slot:'accessory',type:'accessory',names:['매듭의 구리 반지','수호의 강철 반지','별무리 은반지'],costs:[{iron:2,wood:1},{iron:4,crystal:2},{mythril:3,crystal:3}]},
    {id:'amulet',name:'목걸이·부적',slot:'accessory',type:'accessory',names:['숲길의 목걸이','여명의 수정 목걸이','달빛 수호 부적'],costs:[{wood:2,leather:1},{leather:3,crystal:2,iron:2},{mythril:2,crystal:4,leather:3}]},
    {id:'belt',name:'허리띠',slot:'accessory',type:'accessory',names:['튼튼한 가죽 허리띠','탐험가의 장비 벨트','미스릴 버클 허리띠'],costs:[{leather:3,iron:1},{leather:5,iron:3},{leather:6,mythril:3,iron:3}]}
  ];
  const jobWeapons = Object.freeze({swordsman:'sword',knight:'sword',warrior:'axe',spearman:'spear',archer:'bow',crossbow:'crossbow',mage:'staff',cleric:'staff',rogue:'dagger',fighter:'gauntlet'});
  const familyDescriptions={axe:'단단한 자루와 묵직한 날을 맞춰 두드린 도끼.',spear:'손에 쥐기 좋은 긴 자루 끝에 정교한 창날을 붙였다.',dagger:'허리춤에 가볍게 걸 수 있도록 날과 손잡이를 다듬었다.',gauntlet:'주먹을 단단히 감싸는 금속판 안쪽에 부드러운 가죽을 덧댔다.',crossbow:'나무 몸체와 금속 걸쇠를 하나씩 맞춘 모험가의 석궁.',focus:'고른 빛을 머금은 결정을 작은 금속 틀로 감쌌다.',tome:'수많은 여정을 견딜 수 있게 모서리를 감싼 두꺼운 책.',quiver:'필요한 화살을 손쉽게 꺼낼 수 있는 튼튼한 화살통.',cloth:'긴 여행에도 움직이기 편하도록 여유 있게 지은 로브.',light:'가죽과 작은 금속판을 이어 만든 가벼운 갑옷.',heavy:'단단한 금속판을 겹치고 꼼꼼하게 연결한 중갑.',ring:'작은 테두리 안에 대장장이의 정성을 담은 반지.',amulet:'낯선 길을 떠나는 모험가에게 건네는 작은 수호 장신구.',belt:'도구와 작은 주머니를 매달 수 있도록 튼튼하게 마감한 허리띠.'};
  const onboarding = {
    basis:'1배속의 실제 활동 플레이를 가정한 목표 동선입니다. 자금·제작·사냥 결과에 따라 달라지며, 2시간 달성 보장이나 최종 밸런스 검증 결과가 아닙니다.',
    balanceStatus:'deferred',
    phases:[
      {id:'first_sale',from:0,to:10,title:'첫 장비와 첫 단골',description:'철 단검 제작 → 창고에서 수동 진열 → 모험가 구매를 확인합니다. 직원이 화로 앞에 도착할 때만 불이 켜지는 것을 익힙니다.',goal:'장비 제작 1회와 직접 진열·판매 1회'},
      {id:'material_cycle',from:10,to:20,title:'재료 의뢰와 좋은 장비 보관',description:'재료 의뢰로 부족한 철광석을 확보하고, 우수 장비 하나를 잠급니다. 봄 10일(1배속 약 18분)에 첫 축제 접수가 열립니다.',goal:'재료 의뢰 완료·잠금 사용·축제 출품 여부 결정'},
      {id:'second_furnace',from:20,to:35,title:'직원을 늘리고 두 화로 가동',description:'월급을 확인한 뒤 직원을 고용하고 두 번째 화덕을 배치합니다. 시설 수와 일하는 직원 수를 함께 늘립니다.',goal:'제조 직원 2명·화덕 2개·잔여 급여 자금 확인'},
      {id:'first_raid',from:35,to:50,title:'보스 재료와 명성',description:'모험가 장비·전투력을 살피고 첫 자동 레이드가 성립할 여건을 만듭니다. 돌아온 희귀 재료를 필요한 만큼 매입합니다.',goal:'레이드 파티 관찰·희귀 재료 거래·명성 단계 확인'},
      {id:'town_defense',from:50,to:70,title:'침공 이후의 운영 판단',description:'침공이 발생하면 귀환과 집결을 관찰합니다. 부상자·개인 지갑·여관 점유를 확인하고 구호 지원 여부를 결정합니다. 여름 1일에 첫 월급이 정산됩니다.',goal:'피해와 보상 확인·월급 확보·구호 여부 결정'},
      {id:'recovery',from:70,to:90,title:'회복과 생산 재정비',description:'저가 장비와 재료 의뢰를 준비해 회복한 모험가의 활동을 돕습니다. 여유 직원에게 유료 훈련을 주고 급여·재료비를 남겨둡니다.',goal:'부상 회복 관찰·필요한 재고만 진열·직원 성장 계획'},
      {id:'second_town',from:90,to:105,title:'2호점 개설 준비',description:'월드맵에서 돌다리 마을의 사냥터와 요구 명성을 확인합니다. 개설비와 함께 새 지점의 직원·재료·여관 운영비를 검토합니다.',goal:'개설 조건·명성·여유 자금이 충족되면 2호점 개설'},
      {id:'two_branches',from:105,to:120,title:'두 마을을 잇는 대장간',description:'지점 전환 단축키로 두 지점의 제작과 재고를 살핍니다. 침공 전용 장비 제작과 다음 축제를 위한 명품 보관을 목표로 잡습니다.',goal:'지점 전환 숙달·전용 제작법 확인·다음 목표 선택'}
    ]
  };

  function makeRecipe(spec) {
    const {id,name,type,slot,requiredLevel,power,price,cost,duration,family,description,source} = spec;
    return {id,name,type,slot,requiredLevel,family:family||type,tier:requiredLevel<10?1:requiredLevel<20?2:3,power,price,cost,duration,
      icon:type==='accessory'?'ring':type,description,source:source||'standard',balanceStatus:'provisional',
      attack:slot==='weapon'?power:slot==='accessory'?Math.round(power*.3):0,
      defense:slot==='offhand'?Math.round(power*.75):slot==='armor'?Math.round(power*.6):slot==='accessory'?Math.round(power*.2):0,
      hp:slot==='armor'?power:slot==='offhand'?Math.round(power*.4):slot==='accessory'?Math.round(power*.5):0};
  }

  function extendData(data) {
    if(data.equipment)return;
    data.equipment={version:1,balanceStatus:'deferred',jobWeapons,
      levelMeaning:'제작기술 요구 레벨. 모험가의 착용 레벨 제한과는 별개이며, 현재 착용 레벨 제한은 적용하지 않습니다.',
      levelBands:[{min:1,max:9,name:'초급'},{min:10,max:19,name:'중급'},{min:20,max:30,name:'고급'}],
      weaponTypes:[{id:'sword',name:'검'},{id:'bow',name:'활'},{id:'staff',name:'지팡이'},{id:'axe',name:'도끼'},{id:'spear',name:'창'},{id:'dagger',name:'단검'},{id:'gauntlet',name:'권갑'},{id:'crossbow',name:'석궁'}],
      offhandTypes:[{id:'shield',name:'방패'},{id:'focus',name:'마도구'},{id:'tome',name:'성서·마법서'},{id:'quiver',name:'화살통'}],
      armorFamilies:families.filter(f=>f.slot==='armor').map(({id,name})=>({id,name})),
      accessoryFamilies:families.filter(f=>f.slot==='accessory').map(({id,name})=>({id,name})),
      qualities:data.qualityOrder.map(id=>({id,...data.qualities[id]})),
      acquisitionSources:[{id:'standard',name:'일반 재료 제작'},{id:'raid',name:'레이드 희귀 재료 제작'},{id:'invasion',name:'침공 특별 재료 제작'}]};
    for(const recipe of data.recipes){
      recipe.family=recipe.type;
      recipe.source=Object.keys(recipe.cost).some(m=>['ancient_heart','giant_core','star_fragment','frost_scale','abyss_crystal'].includes(m))?'raid':'standard';
      recipe.balanceStatus='legacy-unreviewed';
    }
    // Existing IDs, power, costs, sale prices and crafting times remain intact.
    const spear=data.recipes.find(r=>r.id==='iron_spear');if(spear){spear.type='spear';spear.family='spear';spear.icon='spear';}
    const crossbow=data.recipes.find(r=>r.id==='ranger_crossbow');if(crossbow){crossbow.type='crossbow';crossbow.family='crossbow';crossbow.icon='crossbow';}
    for(const family of families){
      [1,10,20].forEach((requiredLevel,i)=>{
        const slot=family.slot,power=slot==='weapon'?[16,36,78][i]:slot==='offhand'?[18,38,74][i]:slot==='armor'?[16,43,86][i]:[12,29,59][i];
        const price=slot==='weapon'?[72,180,470][i]:slot==='offhand'?[82,205,440][i]:slot==='armor'?[86,232,570][i]:[65,158,360][i];
        data.recipes.push(makeRecipe({id:family.id+'_craft_'+requiredLevel,name:family.names[i],type:family.type,slot,family:family.id,requiredLevel,power,price,cost:family.costs[i],duration:[9,16,26][i],description:familyDescriptions[family.id]}));
      });
    }
    const endgame=[['sword','새벽별 장검'],['bow','천공의 장궁'],['staff','별빛 관측자의 지팡이'],['axe','성벽분쇄 도끼'],['spear','서리문 용창'],['dagger','월식의 단검'],['gauntlet','거신의 권갑'],['crossbow','혜성 사냥 석궁'],['shield','별의 성채 방패']];
    for(const [type,name] of endgame)data.recipes.push(makeRecipe({id:'astral_'+type+'_30',name,type,slot:type==='shield'?'offhand':'weapon',requiredLevel:30,power:type==='shield'?145:158,price:2450,cost:{mythril:8,star_fragment:2,abyss_crystal:1},duration:38,description:'최고 제작기술과 여러 레이드 희귀 재료가 필요한 종착 제작법.',source:'raid'}));
    const invasion=[
      {id:'ember_guard_sword',name:'불씨 수비대의 검',type:'sword',slot:'weapon',requiredLevel:8,power:40,price:280,cost:{invasion_ember:1,iron:5,wood:3},duration:15},
      {id:'ember_guard_shield',name:'귀환자의 방패',type:'shield',slot:'offhand',requiredLevel:12,power:56,price:460,cost:{invasion_ember:2,iron:8,leather:4},duration:19},
      {id:'ember_guard_armor',name:'마을 수호자의 갑옷',type:'armor',slot:'armor',family:'heavy',requiredLevel:18,power:78,price:760,cost:{invasion_ember:3,iron:9,leather:6,crystal:3},duration:25},
      {id:'ember_guard_amulet',name:'다시 피는 불씨의 부적',type:'accessory',slot:'accessory',family:'amulet',requiredLevel:24,power:100,price:1500,cost:{invasion_ember:4,mythril:4,crystal:5},duration:31},
      {id:'ember_guard_staff',name:'영원의 봉화 지팡이',type:'staff',slot:'weapon',requiredLevel:30,power:160,price:2600,cost:{invasion_ember:5,mythril:7,star_fragment:2},duration:38}
    ];
    for(const recipe of invasion)data.recipes.push(makeRecipe({...recipe,source:'invasion',description:'마을 침공 방어 보상인 수호의 불씨로만 만드는 특별 장비. 일반 재료 상점에서는 불씨를 살 수 없습니다.'}));
    data.recipes.sort((a,b)=>a.requiredLevel-b.requiredLevel||a.price-b.price||a.id.localeCompare(b.id));
    const staffArt={smith:100,artisan:101,seller:102,helper:103,master:104};
    for(const candidate of data.staffCandidates)if(staffArt[candidate.id]!=null)candidate.spriteIndex=staffArt[candidate.id];
    data.onboarding=onboarding;
  }
  return {version:1,extendData,jobWeapons,onboarding};
});
