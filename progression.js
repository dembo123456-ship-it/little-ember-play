(function (root, factory) {
  'use strict';
  const api = factory();
  root.ForgeProgression = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CALENDAR = Object.freeze({daysPerMonth:30,monthsPerYear:4,daysPerYear:120,festivalStart:10,festivalEnd:14,maxEntries:3});
  const SEASONS = ['봄','여름','가을','겨울'];
  const STAT_LABELS = {attack:'공격력',defense:'방어력',hp:'최대 체력'};
  const clamp = (value,lo,hi) => Math.max(lo,Math.min(hi,value));
  const result = (ok,message,extra) => Object.assign({ok,message},extra||{});
  const uid = (s,prefix,ctx) => ctx && ctx.id ? ctx.id(s,prefix) : prefix+'-'+(++s.seq);
  let DATA = null;

  function extendData(data) {
    DATA = data;
    if (data.progression) return;
    data.progression={calendar:CALENDAR,maxCraftLevel:30,ranks:[{min:1,max:9,name:'초급 대장장이'},{min:10,max:19,name:'중급 대장장이'},{min:20,max:30,name:'고급 대장장이'}]};
    const levels={iron_sword:1,oak_bow:2,iron_shield:3,leather_armor:4,copper_ring:5,steel_sword:10,hunter_bow:11,guard_armor:12,crystal_staff:20,mythril_shield:22,mythril_blade:24,dragon_armor:26};
    for(const recipe of data.recipes) recipe.requiredLevel=levels[recipe.id]||Math.max(1,(recipe.tier-1)*10+1);
    const additions=[
      ['apprentice_staff','견습 마법사의 지팡이','staff',2,15,70,{wood:3,crystal:1},8,'첫 주문을 안정적으로 이끄는 작은 지팡이.'],
      ['iron_spear','철제 사냥 창','sword',6,23,105,{iron:4,wood:3},10,'긴 거리를 유지하며 사냥하는 창병의 장비.'],
      ['traveler_charm','여행자의 부적','accessory',7,22,112,{wood:3,leather:2,crystal:1},11,'낯선 길에서 기운을 북돋는 부적.'],
      ['forest_blade','고목의 수호검','sword',8,42,265,{iron:5,wood:4,ancient_heart:1},15,'고목 레이드의 심장을 단련해 만든 초급 명검.'],
      ['ranger_crossbow','순찰자의 석궁','bow',10,39,198,{wood:6,iron:4,leather:2},14,'천천히 당겨도 강력한 화살을 내보낸다.'],
      ['giant_guard','거인의 대방패','shield',13,56,440,{iron:9,giant_core:1,leather:3},19,'돌거인의 핵으로 충격을 분산하는 방패.'],
      ['moon_mantle','달빛 수호복','armor',15,60,520,{leather:8,crystal:4,giant_core:1},21,'정교한 금속 섬유를 덧댄 수호복.'],
      ['star_staff','별무리 지팡이','staff',18,78,720,{wood:6,crystal:5,star_fragment:1},24,'유적의 별 조각을 품은 마도구.'],
      ['frost_bow','서리용의 활','bow',21,104,1120,{wood:8,mythril:4,frost_scale:1},28,'서리용 비늘로 탄성을 높인 명궁의 활.'],
      ['dragon_aegis','서리용 방벽','shield',23,115,1390,{mythril:6,frost_scale:2,iron:8},30,'서리용의 단단한 비늘을 겹쳐 만든 방벽.'],
      ['abyss_blade','심연의 여명검','sword',28,155,2280,{mythril:8,abyss_crystal:1,star_fragment:2},35,'심연의 결정을 정제해 만든 고급 제작품.'],
      ['astral_crown','별빛의 왕관','accessory',30,145,2600,{mythril:6,abyss_crystal:2,star_fragment:3},38,'연간 장비 축제에서도 시선을 모으는 걸작.']
    ];
    for(const [id,name,type,requiredLevel,power,price,cost,duration,description] of additions){
      if(data.recipes.some(recipe=>recipe.id===id))continue;
      const slot=type==='shield'?'offhand':type==='armor'?'armor':type==='accessory'?'accessory':'weapon';
      data.recipes.push({id,name,type,slot,requiredLevel,tier:requiredLevel<10?1:requiredLevel<20?2:3,power,price,cost,duration,description,icon:type==='accessory'?'ring':type,
        attack:slot==='weapon'?power:slot==='accessory'?Math.round(power*.3):0,
        defense:slot==='offhand'?Math.round(power*.75):slot==='armor'?Math.round(power*.6):slot==='accessory'?Math.round(power*.2):0,
        hp:slot==='armor'?power:slot==='offhand'?Math.round(power*.4):slot==='accessory'?Math.round(power*.5):0});
    }
    data.recipes.sort((a,b)=>a.requiredLevel-b.requiredLevel || a.price-b.price);
    const staff={smith:{craftLevel:1,dexterity:55,eloquence:20,salary:120},artisan:{craftLevel:10,dexterity:78,eloquence:32,salary:310},seller:{craftLevel:1,dexterity:24,eloquence:68,salary:110},helper:{craftLevel:3,dexterity:38,eloquence:45,salary:90}};
    for(const candidate of data.staffCandidates)Object.assign(candidate,staff[candidate.id]||{craftLevel:1,dexterity:candidate.craftSkill,eloquence:candidate.salesSkill,salary:100});
    data.staffCandidates.push({id:'master',name:'명장 도란',role:'smith',craftLevel:20,dexterity:92,eloquence:44,craftSkill:92,salesSkill:44,stamina:130,cost:1800,salary:680,spriteIndex:1});
    const regions=[
      ['meadow','햇살 초원',15,28,54,30,'#8ba976',{wood:[2,5],leather:[1,3]},'초원 늑대와 슬라임이 머무는 완만한 사냥터.'],
      ['oldroad','오래된 교역로',20,32,66,36,'#ad9a70',{iron:[2,4],leather:[2,4]},'길을 막은 도적 무리를 물리치는 교역로.'],
      ['riverbank','안개 강변',38,40,105,46,'#81a7a1',{wood:[4,7],leather:[2,4],iron:[2,5]},'짙은 안개 속 수서 마물의 흔적을 쫓는다.'],
      ['abandoned_mine','폐광 깊은 갱도',60,49,160,62,'#8e8b84',{iron:[5,9],crystal:[2,4]},'수정 광맥을 지키는 지하 마물의 영역.'],
      ['fortress','무너진 요새',72,53,185,68,'#a08b82',{iron:[6,10],leather:[4,6],crystal:[2,4]},'무너진 성벽을 배회하는 갑옷 망령의 요새.'],
      ['coast','산호 해안',92,62,235,82,'#7fb7b2',{wood:[6,10],crystal:[3,6],leather:[3,6]},'파도 사이로 나타나는 단단한 갑각 마물을 상대한다.'],
      ['catacombs','달의 지하묘지',110,67,270,92,'#9583b0',{crystal:[4,7],mythril:[2,4]},'달의 문양이 새겨진 지하 통로와 수호자들.'],
      ['desert','유리 모래사막',145,76,340,112,'#c4a571',{crystal:[5,9],mythril:[3,6],leather:[4,7]},'낮에는 모래 전갈, 밤에는 수정 정령이 나타난다.'],
      ['canyon','붉은 협곡',175,82,410,128,'#b47f66',{iron:[8,13],mythril:[4,7],leather:[5,8]},'험준한 절벽의 비룡과 철갑 짐승의 서식지.'],
      ['tundra','얼어붙은 황야',205,88,490,148,'#8faeb7',{mythril:[5,9],leather:[6,10],crystal:[5,8]},'오랜 추위에 적응한 대형 마물들이 돌아다닌다.'],
      ['icekeep','침묵의 얼음성',245,96,585,174,'#91c2d2',{mythril:[6,11],crystal:[6,11]},'왕국의 흔적을 지키는 고대 빙결 병사들.'],
      ['astral','별이 떨어진 고원',300,108,720,206,'#a095cf',{mythril:[8,13],crystal:[8,14],leather:[7,11]},'별빛에 물든 강력한 생명들이 모이는 고원.'],
      ['lava','재의 심장부',350,118,860,240,'#c77964',{mythril:[10,16],crystal:[10,16],iron:[12,20]},'최고 수준의 장비를 요구하는 뜨거운 화산 지대.']
    ];
    for(const [id,name,minPower,duration,gold,xp,color,loot,description] of regions)if(!data.regions.some(r=>r.id===id))data.regions.push({id,name,minPower,duration,gold,xp,color,loot,description});
    data.regions.sort((a,b)=>a.minPower-b.minPower);
    data.towns=[
      {id:'greenwood',name:'초록숲 마을',subtitle:'새 모험이 시작되는 작은 숲 마을',openingCost:0,requiredLevel:1,requiredReputation:0,regionIds:['greenwood','meadow','oldroad','quarry'],x:.14,y:.62},
      {id:'stonebridge',name:'돌다리 마을',subtitle:'광산과 유적을 잇는 교역 거점',openingCost:9000,requiredLevel:2,requiredReputation:1800,regionIds:['riverbank','ruins','abandoned_mine','fortress'],x:.34,y:.43},
      {id:'moonhaven',name:'달빛 항구',subtitle:'설산과 바다가 만나는 항구',openingCost:30000,requiredLevel:2,requiredReputation:6000,regionIds:['ridge','coast','catacombs'],x:.55,y:.64},
      {id:'sunspire',name:'해오름 성채',subtitle:'용의 땅과 사막으로 통하는 성채',openingCost:80000,requiredLevel:3,requiredReputation:18000,regionIds:['abyss','desert','canyon'],x:.72,y:.38},
      {id:'frostgate',name:'서리문 마을',subtitle:'최후의 황야를 향하는 모험가의 마을',openingCost:180000,requiredLevel:3,requiredReputation:40000,regionIds:['tundra','icekeep','astral','lava'],x:.88,y:.60}
    ];
    // 2026-11 balance: monthly branch upkeep (rent·관리비) paid with wages, so costs grow with the chain.
    // 2026-11-10 (2배속 10시간 기준): the 4th/5th branch rents ate ~2/3 of late income, so the last goals were
    // out of reach (gold grew ~15k/h after 20h). 35000→25000, 70000→45000.
    const UPKEEP={greenwood:0,stonebridge:6000,moonhaven:15000,sunspire:25000,frostgate:45000};
    for(const town of data.towns)town.upkeep=UPKEEP[town.id]||0;
    for(const town of data.towns)for(const id of town.regionIds){const region=data.regions.find(r=>r.id===id);if(region)region.townId=town.id;}
    const shop=data.upgrades && data.upgrades.find(u=>u.id==='shop');if(shop)shop.description='실제 바닥과 시설 배치 공간 확장';
  }

  function getCalendar(s,ctx){
    const dayLength=(ctx&&ctx.DATA||DATA).dayLength;
    const absoluteDay=Math.floor(Math.max(0,s.time)/dayLength)+1;
    const year=Math.floor((absoluteDay-1)/CALENDAR.daysPerYear)+1;
    const dayOfYear=(absoluteDay-1)%CALENDAR.daysPerYear+1;
    const month=Math.floor((dayOfYear-1)/CALENDAR.daysPerMonth)+1;
    const day=(dayOfYear-1)%CALENDAR.daysPerMonth+1;
    const minutes=Math.floor(((s.time%dayLength)/dayLength)*24*60);
    return {year,month,day,dayOfYear,absoluteDay,hour:Math.floor(minutes/60),minute:minutes%60,season:SEASONS[month-1],label:year+'년 '+SEASONS[month-1]+' '+day+'일'};
  }
  function getRecipeLevel(recipe){return recipe && recipe.requiredLevel || 1;}
  // 2026-11 balance: exponential curve so craft Lv30 is a long-term goal instead of a one-hour milestone.
  const CRAFT_XP_BASE=50,CRAFT_XP_GROWTH=1.25;
  function getCraftXpNeeded(level){return level>=30?0:Math.round(CRAFT_XP_BASE*Math.pow(CRAFT_XP_GROWTH,level));}
  function getStaffRank(worker){const level=typeof worker==='number'?worker:worker.craftLevel||1;return level>=20?'고급 대장장이':level>=10?'중급 대장장이':'초급 대장장이';}
  function canWork(worker){return !(worker.salaryDebt>0)&&worker.stamina>=worker.maxStamina*.2;}
  function initializeStaff(s,worker,ctx){
    const candidate=ctx.DATA.staffCandidates.find(c=>c.id===worker.candidateId)||{};
    if(worker.craftLevel==null)worker.craftLevel=candidate.craftLevel||1;
    if(worker.craftXp==null)worker.craftXp=0;
    if(worker.salesLevel==null)worker.salesLevel=1;
    if(worker.salesXp==null)worker.salesXp=0;
    if(worker.dexterity==null)worker.dexterity=candidate.dexterity||worker.craftSkill||30;
    if(worker.eloquence==null)worker.eloquence=candidate.eloquence||worker.salesSkill||20;
    if(worker.salary==null)worker.salary=candidate.salary||Math.round(70+worker.dexterity*.7+worker.eloquence*.3);
    if(worker.baseSalary==null)worker.baseSalary=worker.salary;
    if(worker.salaryBaseLevel==null)worker.salaryBaseLevel=worker.craftLevel;
    if(worker.salaryDebt==null)worker.salaryDebt=0;
    if(worker.salaryPaid==null)worker.salaryPaid=0;
    if(worker.hiredAt==null)worker.hiredAt=s.time;
  }
  function initialize(s,ctx){
    const calendar=getCalendar(s,ctx);
    if(!s.payroll)s.payroll={lastPeriod:Math.floor((calendar.absoluteDay-1)/30),totalPaid:0};
    if(!s.festival)s.festival={year:calendar.year,entries:[],results:[],settledYear:calendar.dayOfYear>14?calendar.year:calendar.year-1};
    if(s.stats.wages==null)s.stats.wages=0;
    if(s.stats.festivalPrize==null)s.stats.festivalPrize=0;
    for(const town of ctx.getOwnedTowns(s))for(const worker of town.staff)initializeStaff(s,worker,ctx);
  }
  function normalize(s,ctx){initialize(s,ctx);return s;}
  function getItemBonus(item){
    const bonus={attack:0,defense:0,hp:0};
    for(const option of item&&item.options||[])if(Object.hasOwn(bonus,option.stat)&&Number.isFinite(option.value))bonus[option.stat]+=option.value;
    return bonus;
  }
  function onCraft(s,town,item,worker,ctx){
    const recipe=ctx.DATA.recipes.find(r=>r.id===item.recipeId);
    const level=getRecipeLevel(recipe);
    const count=(ctx.DATA.qualities[item.quality]||ctx.DATA.qualities.normal).options;
    const remaining=['attack','defense','hp'];
    item.options=[];
    for(let i=0;i<count;i++){
      const stat=remaining.splice(Math.floor(ctx.random(s)*remaining.length),1)[0];
      const multiplier=stat==='hp'?5:1;
      const magnitude=(1+Math.floor(ctx.random(s)*(2+level/5)))*multiplier;
      const negative=ctx.random(s)<.23;
      item.options.push({id:stat+(negative?'-minus':'-plus'),label:STAT_LABELS[stat],stat,value:negative?-magnitude:magnitude});
    }
    const bonus=getItemBonus(item), value=bonus.attack*2+bonus.defense*2+bonus.hp*.2;
    item.price=Math.max(1,Math.round(item.price*(1+clamp(value/Math.max(50,item.price),-.15,.15))));
    item.craftedBy=worker.name;item.craftedAt=s.time;
    awardCraftGrowth(s,item,worker,ctx);
  }
  function awardCraftGrowth(s,item,worker,ctx){
    const recipe=ctx.DATA.recipes.find(r=>r.id===item.recipeId),level=getRecipeLevel(recipe),rank=(ctx.DATA.qualities[item.quality]||ctx.DATA.qualities.normal).rank||0;
    worker.dexterity=Math.min(100,Math.round((worker.dexterity+.1+rank*.05)*100)/100);
    worker.craftSkill=Math.min(100,Math.round((worker.craftSkill+.1+rank*.05)*100)/100);
    if(worker.craftLevel<30){
      const before=worker.craftLevel;worker.craftXp+=Math.max(1,Math.round((12+level*2+rank*3)*(ctx.personalityEffect?ctx.personalityEffect(worker,'craftXp'):1)*(1+(ctx.researchEffect?ctx.researchEffect(s,'craftXp'):0))));
      while(worker.craftLevel<30&&worker.craftXp>=getCraftXpNeeded(worker.craftLevel)){worker.craftXp-=getCraftXpNeeded(worker.craftLevel);worker.craftLevel++;}
      if(worker.craftLevel>=30)worker.craftXp=0;
      if(before!==worker.craftLevel){worker.salary=Math.round(worker.baseSalary*(1+(worker.craftLevel-worker.salaryBaseLevel)*.025));ctx.log(s,'level',worker.name+'의 제작기술이 Lv.'+worker.craftLevel+'이 되었습니다. '+getStaffRank(worker)+'!');}
    }
  }

  function getPayroll(s,ctx){
    const calendar=getCalendar(s,ctx),staff=[];
    for(const town of ctx.getOwnedTowns(s))for(const w of town.staff)staff.push({id:w.id,townId:town.id,townName:town.name,name:w.name,salary:w.salary||0,debt:w.salaryDebt||0,craftLevel:w.craftLevel,dexterity:w.dexterity,eloquence:w.eloquence,fatigue:Math.round((1-w.stamina/w.maxStamina)*100)});
    const nextPayDay=(Math.floor((calendar.absoluteDay-1)/30)+1)*30+1;
    const upkeep=ctx.getOwnedTowns(s).reduce((sum,town)=>{const d=(ctx.DATA.towns||[]).find(x=>x.id===town.id);return sum+(d&&d.upkeep||0);},0);
    return {nextPayDay,daysUntil:nextPayDay-calendar.absoluteDay,totalSalary:staff.reduce((sum,w)=>sum+w.salary,0),totalDebt:staff.reduce((sum,w)=>sum+w.debt,0),totalPaid:s.payroll?s.payroll.totalPaid:0,upkeep,totalUpkeep:s.payroll&&s.payroll.totalUpkeep||0,staff};
  }
  function payWages(s,staffId,ctx){
    if(!ctx&&staffId&&typeof staffId==='object'){ctx=staffId;staffId=null;}
    let paid=0,found=false;
    for(const town of ctx.getOwnedTowns(s))for(const w of town.staff){
      if(staffId&&w.id!==staffId)continue;found=true;
      const payment=Math.min(Math.floor(s.gold),w.salaryDebt||0);
      s.gold-=payment;w.salaryDebt-=payment;w.salaryPaid+=payment;paid+=payment;
    }
    if(!found)return result(false,'해당 직원을 찾을 수 없습니다.');
    if(!paid)return result(false,'미지급 월급이 없거나 골드가 부족합니다.');
    s.payroll.totalPaid+=paid;s.stats.wages+=paid;
    ctx.log(s,'payroll','미지급 월급 '+paid+'G를 지급했습니다.');
    return result(true,paid+'G 지급 완료', {paid});
  }
  function runPayroll(s,period,ctx){
    let due=0,paid=0;
    const boundary=period*30*ctx.DATA.dayLength;
    for(const town of ctx.getOwnedTowns(s))for(const worker of town.staff){
      const workedDays=clamp((boundary-worker.hiredAt)/ctx.DATA.dayLength,0,30);
      const bill=Math.ceil(worker.salary*workedDays/30);worker.salaryDebt+=bill;due+=bill;
      const payment=Math.min(Math.floor(s.gold),worker.salaryDebt);s.gold-=payment;worker.salaryDebt-=payment;worker.salaryPaid+=payment;paid+=payment;
    }
    s.payroll.totalPaid+=paid;s.stats.wages+=paid;
    let upkeep=0;
    for(const town of ctx.getOwnedTowns(s)){const d=(ctx.DATA.towns||[]).find(x=>x.id===town.id);upkeep+=d&&d.upkeep||0;}
    const upkeepPaid=Math.min(Math.max(0,Math.floor(s.gold)),upkeep);s.gold-=upkeepPaid;
    s.payroll.totalUpkeep=(s.payroll.totalUpkeep||0)+upkeepPaid;s.stats.upkeep=(s.stats.upkeep||0)+upkeepPaid;
    ctx.log(s,'payroll','월급 정산: '+paid+'G 지급'+(due>paid?' · 미지급 '+(due-paid)+'G':'')+(upkeep?' · 지점 유지비 '+upkeepPaid+'G'+(upkeepPaid<upkeep?' (골드 부족으로 '+(upkeep-upkeepPaid)+'G 감면)':''):'')+'. 미지급 직원은 지급 후 작업에 복귀합니다.');
  }
  function getFestivalScore(item,ctx){
    const data=ctx&&ctx.DATA||DATA,recipe=data.recipes.find(r=>r.id===item.recipeId);
    if(!recipe)return 0;
    const quality=data.qualities[item.quality]||data.qualities.normal;
    const enhancement=data.enhancement,level=item.enhance||0;
    const factor=quality.multiplier*(ctx&&ctx.getItemEnhancementMultiplier?ctx.getItemEnhancementMultiplier(level):1+Math.min(level,enhancement.statSoftCap)*enhancement.statBonusPerLevel+Math.max(0,level-enhancement.statSoftCap)*enhancement.advancedStatBonusPerLevel);
    const bonus=getItemBonus(item);
    const stats=ctx&&ctx.getItemStats?ctx.getItemStats(item):{attack:Math.max(0,recipe.attack*factor+bonus.attack),defense:Math.max(0,recipe.defense*factor+bonus.defense),hp:Math.max(0,recipe.hp*factor+bonus.hp)};
    return Math.max(0,Math.round(stats.attack*.9+stats.defense*1.1+stats.hp*.25+getRecipeLevel(recipe)*4+quality.festivalBonus+(item.enhance||0)*12));
  }
  function getFestival(s,ctx){
    const c=getCalendar(s,ctx),f=s.festival||{entries:[],results:[],settledYear:0};
    const open=c.dayOfYear>=10&&c.dayOfYear<=14;
    const status=open?'open':c.dayOfYear>=15&&f.settledYear>=c.year?'finished':'upcoming';
    return {year:c.year,status,daysUntil:open?0:c.dayOfYear<10?10-c.dayOfYear:120-c.dayOfYear+10,closesIn:open?15-c.dayOfYear:0,entries:f.entries.filter(e=>e.year===c.year),results:f.results.filter(r=>r.year===c.year||r.year===c.year-1),maxEntries:3,description:'매년 봄 10~14일 접수 · 봄 15일 발표. 최대 3점 중 최고 점수 작품 한 점에 상금 지급. 출품 장비는 결과 발표 후 창고로 돌아옵니다.'};
  }
  function getFestivalCandidates(s,ctx){return ctx.getTown(s).inventory.filter(item=>!item.locked);}
  function submitFestival(s,itemId,ctx){
    const festival=getFestival(s,ctx);if(festival.status!=='open')return result(false,'장비 축제 접수는 매년 봄 10~14일입니다.');
    if(festival.entries.length>=3)return result(false,'한 해에는 최대 3점을 출품할 수 있습니다.');
    const town=ctx.getTown(s),index=town.inventory.findIndex(item=>item.id===itemId);
    if(index<0)return result(false,'선택한 장비를 찾을 수 없습니다.');
    const item=town.inventory[index];if(item.locked)return result(false,'잠금을 해제한 후 출품해주세요.');
    // A shelf item needs a newly reserved warehouse slot for its return.
    // A stored item exchanges its occupied slot for the festival reservation.
    if(item.listed&&ctx.getEquipmentUsage&&ctx.getEquipmentCapacity&&ctx.getEquipmentUsage(s,town.id)>=ctx.getEquipmentCapacity(s,town.id))return result(false,'출품작이 돌아올 창고 공간이 부족합니다. 장비를 진열하거나 창고를 확장해주세요.');
    town.inventory.splice(index,1);item.listed=false;
    const entry={id:uid(s,'festival',ctx),year:festival.year,townId:town.id,townName:town.name,item,score:getFestivalScore(item,ctx),submittedAt:s.time};
    s.festival.entries.push(entry);ctx.log(s,'festival',item.name+'을 장비 축제에 출품했습니다. 심사 점수 '+entry.score+'점.');
    return result(true,'출품 완료. 발표 후 장비는 창고로 반환됩니다.',{entry});
  }
  function withdrawFestival(s,entryId,ctx){
    if(getFestival(s,ctx).status!=='open')return result(false,'접수 기간에만 출품을 취소할 수 있습니다.');
    const index=s.festival.entries.findIndex(e=>e.id===entryId);if(index<0)return result(false,'출품작을 찾을 수 없습니다.');
    const entry=s.festival.entries[index],town=s.towns[entry.townId];if(!town)return result(false,'반환할 지점을 찾을 수 없습니다.');
    s.festival.entries.splice(index,1);entry.item.listed=false;town.inventory.push(entry.item);
    return result(true,'출품을 취소하고 창고로 돌려보냈습니다.');
  }
  function settleFestival(s,year,ctx){
    if(s.festival.settledYear>=year)return;
    const entries=s.festival.entries.filter(e=>e.year===year);
    const sorted=[...entries].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
    const best=sorted[0];
    for(const entry of entries){
      let rank=entry.score>=220+year*8?1:entry.score>=130+year*6?2:entry.score>=70+year*4?3:4;
      const reward=entry===best?({1:1200,2:650,3:320,4:60}[rank]):0;
      const label=['','금상','은상','동상','참가상'][rank];
      s.festival.results.push({year,entryId:entry.id,itemName:entry.item.name,score:entry.score,rank,label,reward});
      s.gold+=reward;s.stats.festivalPrize+=reward;
      if(reward){s.reputation+=rank<4?6-rank:1;ctx.log(s,'festival',year+'년 장비 축제 '+label+'! '+entry.item.name+' · '+entry.score+'점 · 상금 '+reward+'G');}
      const town=s.towns[entry.townId];if(town){entry.item.listed=false;town.inventory.push(entry.item);}
    }
    s.festival.entries=s.festival.entries.filter(e=>e.year!==year);
    s.festival.results=s.festival.results.slice(-12);s.festival.settledYear=year;
  }
  function step(s,dt,ctx){
    const c=getCalendar(s,ctx),period=Math.floor((c.absoluteDay-1)/30);
    while(s.payroll.lastPeriod<period){s.payroll.lastPeriod++;runPayroll(s,s.payroll.lastPeriod,ctx);}
    if(c.year>s.festival.year){settleFestival(s,s.festival.year,ctx);s.festival.year=c.year;}
    if(c.dayOfYear>=15&&s.festival.settledYear<c.year)settleFestival(s,c.year,ctx);
  }
  function validate(s,ctx){
    try{
      const c=getCalendar(s,ctx),p=s.payroll,f=s.festival;
      const number=(value,min=0,max=1e12)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
      const integer=(value,min=0,max=1e12)=>Number.isInteger(value)&&number(value,min,max);
      if(!p||!integer(p.lastPeriod,0,Math.floor((c.absoluteDay-1)/30))||!number(p.totalPaid))return false;
      if(!f||!integer(f.year,1,c.year)||!integer(f.settledYear,0,c.year)||!Array.isArray(f.entries)||f.entries.length>3||!Array.isArray(f.results)||f.results.length>12)return false;
      const ids=new Set();
      for(const town of ctx.getOwnedTowns(s)){
        for(const item of town.inventory)ids.add(item.id);
        for(const w of town.staff)if(!integer(w.salary,1,1e6)||!integer(w.baseSalary,1,1e6)||!integer(w.salaryBaseLevel,1,30)||!number(w.salaryDebt)||!number(w.salaryPaid)||!number(w.hiredAt,0,s.time)||(w.salesLevel!==undefined&&!integer(w.salesLevel,1,30))||(w.salesXp!==undefined&&!integer(w.salesXp,0,1000000)))return false;
      }
      for(const hero of s.adventurers)for(const item of Object.values(hero.equipment||{}))if(item)ids.add(item.id);
      for(const e of f.entries){
        if(!e||typeof e.id!=='string'||!/^festival-[0-9]+$/.test(e.id)||!integer(e.year,1,c.year)||!s.towns[e.townId]||!number(e.score,0,1e6)||!number(e.submittedAt,0,s.time))return false;
        const item=e.item;if(!item||typeof item.id!=='string'||ids.has(item.id)||!ctx.DATA.recipes.some(r=>r.id===item.recipeId)||!ctx.DATA.qualityOrder.includes(item.quality)||!number(item.price,1)||!number(item.power)||!integer(item.enhance,0,ctx.DATA.enhancement.maxLevel)||!number(item.durability,0,100)||item.listed!==false||typeof item.locked!=='boolean')return false;
        ids.add(item.id);
        if(!validateOptions(item))return false;
      }
      for(const r of f.results)if(!r||!integer(r.year,1,c.year)||!integer(r.rank,1,4)||!number(r.reward)||!number(r.score)||typeof r.itemName!=='string'||r.itemName.length>100)return false;
      return true;
    }catch(_){return false;}
  }
  function validateOptions(item){
    if(item.options==null)return true;
    return Array.isArray(item.options)&&item.options.length<=3&&item.options.every(option=>option&&typeof option.id==='string'&&option.id.length<50&&typeof option.label==='string'&&option.label.length<50&&Object.hasOwn(STAT_LABELS,option.stat)&&Number.isInteger(option.value)&&Math.abs(option.value)<=500);
  }
  return Object.freeze({CALENDAR,extendData,initialize,initializeStaff,normalize,step,validate,validateOptions,onCraft,awardCraftGrowth,getItemBonus,getRecipeLevel,canWork,getCalendar,getCraftXpNeeded,getStaffRank,getPayroll,payWages,getFestival,getFestivalCandidates,getFestivalScore,submitFestival,withdrawFestival});
});
