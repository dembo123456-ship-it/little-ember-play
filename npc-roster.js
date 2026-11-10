(function (root, factory) {
  'use strict';
  const api = factory();
  root.ForgeRoster = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // The supplied pack contains 20 completed base appearances. The 200 entries
  // below are gameplay identities, NOT 200 supplied color-variant image files.
  // Stable visual IDs keep a future expanded art pack independent of save IDs.
  const bases = [{"id": "npc_001", "name": "로언", "jobId": "swordsman", "job": "검사", "accent": "#bc6147"}, {"id": "npc_002", "name": "루미", "jobId": "mage", "job": "마법사", "accent": "#8964a2"}, {"id": "npc_003", "name": "실바", "jobId": "archer", "job": "궁수", "accent": "#5c8870"}, {"id": "npc_004", "name": "노아", "jobId": "rogue", "job": "도적", "accent": "#657c9a"}, {"id": "npc_005", "name": "세린", "jobId": "swordsman", "job": "검사", "accent": "#3f7f89"}, {"id": "npc_006", "name": "테오", "jobId": "mage", "job": "마법사", "accent": "#4c8e99"}, {"id": "npc_007", "name": "아이린", "jobId": "archer", "job": "궁수", "accent": "#657a47"}, {"id": "npc_008", "name": "카이", "jobId": "rogue", "job": "도적", "accent": "#a04d49"}, {"id": "npc_009", "name": "레온", "jobId": "knight", "job": "기사", "accent": "#6f8da1"}, {"id": "npc_010", "name": "엘라", "jobId": "knight", "job": "기사", "accent": "#84729a"}, {"id": "npc_011", "name": "브란", "jobId": "warrior", "job": "전사", "accent": "#876744"}, {"id": "npc_012", "name": "프레야", "jobId": "warrior", "job": "전사", "accent": "#ab7860"}, {"id": "npc_013", "name": "진", "jobId": "spearman", "job": "창병", "accent": "#b5704e"}, {"id": "npc_014", "name": "린", "jobId": "spearman", "job": "창병", "accent": "#528e8b"}, {"id": "npc_015", "name": "가렌", "jobId": "crossbow", "job": "석궁 사수", "accent": "#718351"}, {"id": "npc_016", "name": "미라", "jobId": "crossbow", "job": "석궁 사수", "accent": "#a67c4e"}, {"id": "npc_017", "name": "에밀", "jobId": "cleric", "job": "성직자", "accent": "#7c97aa"}, {"id": "npc_018", "name": "셀레네", "jobId": "cleric", "job": "성직자", "accent": "#9f6076"}, {"id": "npc_019", "name": "건", "jobId": "fighter", "job": "격투가", "accent": "#b99a49"}, {"id": "npc_020", "name": "유나", "jobId": "fighter", "job": "격투가", "accent": "#4c858b"}];
  const jobs = [{"id": "swordsman", "name": "검사", "englishName": "SWORDSMAN"}, {"id": "knight", "name": "기사", "englishName": "KNIGHT"}, {"id": "warrior", "name": "전사", "englishName": "WARRIOR"}, {"id": "spearman", "name": "창병", "englishName": "SPEARMAN"}, {"id": "archer", "name": "궁수", "englishName": "ARCHER"}, {"id": "crossbow", "name": "석궁 사수", "englishName": "CROSSBOW"}, {"id": "mage", "name": "마법사", "englishName": "MAGE"}, {"id": "cleric", "name": "성직자", "englishName": "CLERIC"}, {"id": "rogue", "name": "도적", "englishName": "ROGUE"}, {"id": "fighter", "name": "격투가", "englishName": "FIGHTER"}];
  const legacy = {npc_001:'raon', npc_002:'luna', npc_003:'rin', npc_004:'sera', npc_009:'bram', npc_017:'tobi'};
  const legacyNames = {bram:'브람', tobi:'토비'};
  const definitions = {
    swordsman:{attack:13,defense:5,hp:100,preferences:['sword','shield','armor']},
    knight:{attack:11,defense:9,hp:120,preferences:['sword','shield','armor']},
    warrior:{attack:17,defense:5,hp:130,preferences:['sword','armor','shield']},
    spearman:{attack:15,defense:4,hp:105,preferences:['sword','armor']},
    archer:{attack:15,defense:3,hp:85,preferences:['bow','armor']},
    crossbow:{attack:17,defense:3,hp:90,preferences:['bow','armor']},
    mage:{attack:18,defense:2,hp:75,preferences:['staff','accessory']},
    cleric:{attack:10,defense:6,hp:110,preferences:['staff','shield','accessory']},
    rogue:{attack:16,defense:3,hp:80,preferences:['sword','accessory']},
    fighter:{attack:14,defense:6,hp:120,preferences:['sword','armor']}
  };
  const firstSyllables=['아','에','이','오','우','라','레','리','루','로','세','시','카','키','테','티','하','유','미','니'];
  const lastSyllables=['엘','온','린','아','오','스','나','루','엔','안','든','벨','란','칸','샤','아르','오르','이르','리안','시온'];
  const usedNames = new Set(bases.map(base => legacyNames[legacy[base.id]] || base.name));
  let nameCursor = 0;
  function nextName() {
    let name;
    do { name = firstSyllables[nameCursor % firstSyllables.length] + lastSyllables[Math.floor(nameCursor++ / firstSyllables.length)]; }
    while (usedNames.has(name));
    usedNames.add(name); return name;
  }
  const characters = [];
  for (let cohort=0;cohort<10;cohort++) {
    bases.forEach((base,index) => {
      const role=definitions[base.jobId], variation=cohort===0?0:((index+cohort*3)%7)-3;
      const id=cohort===0&&legacy[base.id] ? legacy[base.id] : 'hero-'+String(cohort*20+index+1).padStart(3,'0');
      const attack=Math.max(7,role.attack+variation), defense=Math.max(1,role.defense+((index+cohort)%3)-1), hp=role.hp+cohort*2;
      const character={
        id, name:cohort===0 ? (legacyNames[id] || base.name) : nextName(),
        jobId:base.jobId,job:base.job,visualId:base.id,sprite:10+index,color:base.accent,
        attack,defense,hp,maxHp:hp,power:Math.round(attack+defense*.7+hp/25),
        baseStats:Object.freeze({attack,defense,maxHp:hp}),
        preferredType:role.preferences[0],preferences:Object.freeze([...role.preferences]),
        recruitOrder:cohort*20+index,
        description:['첫 모험을 시작한 신참','좋은 장비를 찾는 여행자','새로운 마을을 찾는 모험가','더 먼 사냥터를 꿈꾸는 도전자'][cohort%4]
      };
      characters.push(Object.freeze(character));
    });
  }
  const firstIds=['raon','rin','tobi','luna','bram','sera'];
  characters.sort((a,b) => {
    const ai=firstIds.indexOf(a.id),bi=firstIds.indexOf(b.id);
    return (ai<0?6+a.recruitOrder:ai)-(bi<0?6+b.recruitOrder:bi);
  });
  const byId=new Map(characters.map(character=>[character.id,character]));
  return Object.freeze({
    version:1,baseCount:20,capacity:200,characters:Object.freeze(characters),jobs:Object.freeze(jobs.map(Object.freeze)),
    getCount:()=>characters.length,getById:id=>byId.get(id)||null,
    getByJob:jobId=>characters.filter(character=>character.jobId===jobId)
  });
});
