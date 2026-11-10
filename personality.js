(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ForgePersonality = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Identity has its own deterministic hash stream. Giving a person a name or
  // drawing a preview must never consume the hunt / craft economy RNG.
  const VERSION = 1;
  const COPY_FIELDS = Object.freeze(['baseName', 'traitId', 'identityVersion', 'name']);
  const IDENTITY_FIELDS = COPY_FIELDS.filter(field => field !== 'name');
  const DEFAULT_EFFECTS = Object.freeze({
    staffSpeed: 1, staffFatigue: 1, staffSalary: 1, craftXp: 1,
    masterworkChance: 0, salesEloquence: 1,
    huntDuration: 1, huntFatigue: 1, adventurerXp: 1,
    enhancementChance: 0, purchasePrice: 1, maxHp: 1, attack: 1
  });
  const DEFINITIONS = [
    { id: 'diligent', prefix: '성실한', weight: 22, premiumWeight: 23,
      staffDescription: '일할 때 체력 소모가 15% 적어요.',
      adventurerDescription: '사냥에서 쌓이는 피로가 10% 적어요.',
      effects: { staffFatigue: .85, huntFatigue: .9 } },
    { id: 'lazy', prefix: '나태한', weight: 12, premiumWeight: 4,
      staffDescription: '제작 속도가 10% 느리지만 신규 채용 기본 월급이 15% 저렴해요.',
      adventurerDescription: '사냥 시간이 10% 길지만 사냥 피로는 15% 적어요.',
      effects: { staffSpeed: .9, staffSalary: .85, huntDuration: 1.1, huntFatigue: .85 } },
    { id: 'clever', prefix: '명석한', weight: 18, premiumWeight: 21,
      staffDescription: '제작기술 경험치를 15% 더 얻어요.',
      adventurerDescription: '모험 경험치를 15% 더 얻어요.',
      effects: { craftXp: 1.15, adventurerXp: 1.15 } },
    { id: 'divine', prefix: '신의 손', weight: 2, premiumWeight: 8,
      staffDescription: '명품 이상 품질 확률이 5%p 높아요.',
      adventurerDescription: '장비 강화 성공 확률이 3%p 높아요.',
      effects: { masterworkChance: .05, enhancementChance: .03 } },
    { id: 'eloquent', prefix: '달변의', weight: 14, premiumWeight: 14,
      staffDescription: '판매할 때 언변의 효과가 10% 높아요.',
      adventurerDescription: '장비를 살 때 가격을 5% 할인받아요.',
      effects: { salesEloquence: 1.1, purchasePrice: .95 } },
    { id: 'hardy', prefix: '튼튼한', weight: 16, premiumWeight: 16,
      staffDescription: '일할 때 체력 소모가 10% 적어요.',
      adventurerDescription: '최대 체력이 10% 높아요.',
      effects: { staffFatigue: .9, maxHp: 1.1 } },
    { id: 'meticulous', prefix: '꼼꼼한', weight: 10, premiumWeight: 10,
      staffDescription: '제작 속도가 5% 느린 대신 명품 이상 품질 확률이 2%p 높아요.',
      adventurerDescription: '사냥 시간이 5% 길고 장비 강화 성공 확률이 2%p 높아요.',
      effects: { staffSpeed: .95, masterworkChance: .02, huntDuration: 1.05, enhancementChance: .02 } },
    { id: 'brisk', prefix: '성급한', weight: 6, premiumWeight: 4,
      staffDescription: '제작 속도가 5% 빠르지만 일할 때 체력을 15% 더 써요.',
      adventurerDescription: '공격력이 5% 높지만 사냥 피로가 10% 더 쌓여요.',
      effects: { staffSpeed: 1.05, staffFatigue: 1.15, attack: 1.05, huntFatigue: 1.1 } }
  ].map(trait => Object.freeze({ ...trait, name: trait.prefix, rarity: trait.id === 'divine' ? 'rare' : 'common', effects: Object.freeze({ ...trait.effects }) }));
  const BY_ID = Object.freeze(Object.fromEntries(DEFINITIONS.map(trait => [trait.id, trait])));

  // Most names use a broad syllable pool; a smaller familiar-name pool keeps
  // names such as 도란 possible without tying them to a sprite or profession.
  // Duplicated display names are intentional. actor.id remains the identity.
  const FAMILIAR_NAMES = Object.freeze([
    '도란', '아린', '루카', '엘린', '테오', '미하', '리안', '세라',
    '한스', '에다', '벨', '유리', '로언', '루미', '실바', '노아',
    '토비', '브람', '리오', '니아', '카일', '레아', '아벨', '미라',
    '레온', '유나', '엘라', '니코', '루나', '리나', '시온', '에린',
    '나린', '라온', '마리', '티아', '로아', '테스', '리엔', '노엘',
    '시아', '키라', '이안', '레나', '세린', '다온', '아론', '델라',
    '베른', '소라', '하린', '카야', '제노', '로제', '메이', '세온',
    '아일', '유엘', '에밀', '노라', '타린', '라엘', '로빈', '셀린'
  ]);
  const FIRST = Object.freeze(['가', '나', '다', '라', '마', '바', '사', '아', '자', '카', '타', '파', '하', '레', '리', '루', '로', '에', '엘', '세', '시', '소', '테', '티', '토', '미', '니', '노', '네', '베', '비', '보', '제', '지', '조', '케', '키', '코', '데', '디']);
  const LAST = Object.freeze(['란', '린', '론', '르', '온', '안', '엔', '엘', '오', '아', '라', '나', '리', '니', '미', '민', '유', '윤', '진', '현', '솔', '빈', '수', '하', '린느', '리안', '리온', '리엘', '미르', '미아', '벨', '벨라', '린다', '르나', '루아', '디아', '시아', '세라', '티아', '리나']);
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const actorIdValid = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,99}$/.test(value);
  const baseNameValid = value => typeof value === 'string' && value === value.trim() && /^[가-힣A-Za-z][가-힣A-Za-z '·-]{0,23}$/.test(value);
  const hasIdentity = actor => IDENTITY_FIELDS.some(key => own(actor, key));
  const kindValid = kind => kind === 'staff' || kind === 'adventurer';
  const peopleValid = people => record(people) && Object.keys(people).length === 2 && own(people, 'version') && own(people, 'seed') && people.version === VERSION &&
    Number.isInteger(people.seed) && people.seed >= 0 && people.seed <= 0xffffffff;

  function hash(text) {
    let value = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 0x01000193);
    value = Math.imul(value ^ value >>> 16, 0x85ebca6b);
    value = Math.imul(value ^ value >>> 13, 0xc2b2ae35);
    return (value ^ value >>> 16) >>> 0;
  }

  function readSeed(s) {
    if (!record(s)) throw new TypeError('인물 정보를 저장할 게임 상태가 필요합니다.');
    if (own(s, 'people')) {
      if (!peopleValid(s.people)) throw new Error('인물 이름과 성격의 저장 형식이 올바르지 않습니다.');
      return s.people.seed;
    }
    const source = Number.isInteger(s.worldSeed) ? s.worldSeed : Number.isInteger(s.seed) ? s.seed : Number.isInteger(s.rng) ? s.rng : 927416;
    return hash('little-ember-people-v1|' + (source >>> 0));
  }

  function identityValid(actor) {
    return record(actor) && COPY_FIELDS.every(field => own(actor, field)) && actor.identityVersion === VERSION && baseNameValid(actor.baseName) &&
      typeof actor.traitId === 'string' && own(BY_ID, actor.traitId) &&
      actor.name === BY_ID[actor.traitId].prefix + ' ' + actor.baseName;
  }

  function assertActor(actor, kind) {
    if (!record(actor) || !actorIdValid(actor.id) || !kindValid(kind)) throw new TypeError('직원 또는 모험가의 고유 정보를 확인해주세요.');
    if (hasIdentity(actor) && !identityValid(actor)) throw new Error('저장된 인물 이름이나 성격이 올바르지 않습니다.');
  }

  function generate(seed, actor, kind, options) {
    const key = seed + '|' + kind + '|' + actor.id;
    const nameRoll = hash(key + '|name');
    const baseName = nameRoll % 8 === 0 ? FAMILIAR_NAMES[hash(key + '|familiar') % FAMILIAR_NAMES.length] :
      FIRST[hash(key + '|first') % FIRST.length] + LAST[hash(key + '|last') % LAST.length];
    const weightKey = options && options.premium === true ? 'premiumWeight' : 'weight';
    let roll = hash(key + '|trait') / 0x100000000 * 100;
    let chosen = DEFINITIONS[DEFINITIONS.length - 1];
    for (const trait of DEFINITIONS) {
      if (roll < trait[weightKey]) { chosen = trait; break; }
      roll -= trait[weightKey];
    }
    return { baseName, traitId: chosen.id, identityVersion: VERSION, name: chosen.prefix + ' ' + baseName };
  }

  function ensure(s, actor, kind, options) {
    assertActor(actor, kind);
    const seed = readSeed(s);
    if (!own(s, 'people') && hasIdentity(actor)) throw new Error('인물 정보의 기준 시드가 없습니다.');
    if (!own(s, 'people')) s.people = { version: VERSION, seed };
    // An existing valid identity is never rerolled by a new role, premium flag,
    // changed appearance, a new town, or repeated loading.
    if (!hasIdentity(actor)) Object.assign(actor, generate(seed, actor, kind, options));
    return actor;
  }

  function preview(s, actor, kind, options) {
    assertActor(actor, kind);
    const seed = readSeed(s);
    const copy = { ...actor };
    if (!hasIdentity(actor)) Object.assign(copy, generate(seed, actor, kind, options));
    return copy;
  }

  function actorEntries(s) {
    if (!record(s)) throw new TypeError('게임 상태가 필요합니다.');
    const entries = [];
    const append = (list, kind) => {
      if (!Array.isArray(list)) throw new TypeError('인물 목록 형식이 올바르지 않습니다.');
      for (const actor of list) entries.push({ actor, kind });
    };
    if (s.towns !== undefined) {
      if (!record(s.towns)) throw new TypeError('마을 목록 형식이 올바르지 않습니다.');
      for (const town of Object.values(s.towns)) {
        if (!record(town)) throw new TypeError('마을 정보가 올바르지 않습니다.');
        if (town.staff !== undefined) append(town.staff, 'staff');
      }
    }
    if (s.adventurers !== undefined) append(s.adventurers, 'adventurer');
    if (s.campaign !== undefined) {
      if (!record(s.campaign)) throw new TypeError('캠페인 정보가 올바르지 않습니다.');
      if (s.campaign.recruitOffers !== undefined) append(s.campaign.recruitOffers, 'staff');
    }
    if (s.recruitment !== undefined) {
      if (!record(s.recruitment)) throw new TypeError('직원 모집 정보가 올바르지 않습니다.');
      if (s.recruitment.boards !== undefined) {
        if (!record(s.recruitment.boards)) throw new TypeError('채용 게시판 정보가 올바르지 않습니다.');
        for (const board of Object.values(s.recruitment.boards)) {
          if (!record(board)) throw new TypeError('채용 게시판 정보가 올바르지 않습니다.');
          if (board.candidates !== undefined) append(board.candidates, 'staff');
        }
      }
    }
    return entries;
  }

  function initialize(s) {
    const seed = readSeed(s), entries = actorEntries(s);
    // Check the whole migration first: a damaged identity must not be silently
    // replaced, nor leave the remaining old actors half migrated.
    for (const { actor, kind } of entries) {
      assertActor(actor, kind);
      if (!own(s, 'people') && hasIdentity(actor)) throw new Error('인물 정보의 기준 시드가 없습니다.');
    }
    if (!own(s, 'people')) s.people = { version: VERSION, seed };
    for (const { actor, kind } of entries) if (!hasIdentity(actor)) Object.assign(actor, generate(seed, actor, kind, { premium: actor.premium === true }));
    return s;
  }

  function validate(s) {
    try {
      const entries = actorEntries(s);
      if (!own(s, 'people')) return entries.every(({ actor, kind }) => record(actor) && actorIdValid(actor.id) && kindValid(kind) && !hasIdentity(actor));
      if (!peopleValid(s.people)) return false;
      return entries.every(({ actor }) => actorIdValid(actor && actor.id) && identityValid(actor));
    } catch (_) { return false; }
  }

  function copyTrait(trait) { return { ...trait, effects: { ...trait.effects } }; }
  function getTraits() { return DEFINITIONS.map(copyTrait); }
  function getTrait(actor) { return identityValid(actor) ? copyTrait(BY_ID[actor.traitId]) : null; }
  function effect(actor, key) {
    const neutral = own(DEFAULT_EFFECTS, key) ? DEFAULT_EFFECTS[key] : 1;
    if (!identityValid(actor)) return neutral;
    const values = BY_ID[actor.traitId].effects;
    return own(values, key) ? values[key] : neutral;
  }

  return Object.freeze({ VERSION, COPY_FIELDS, initialize, ensure, preview, getTrait, getTraits, effect, validate });
});
