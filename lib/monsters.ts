export type Monster = {
  id: string;
  name: string;
  emoji: string;
  img?: string;
  hp: number;
  isBoss?: boolean;
};

const BASE = "/assets/monster-battle/monsters";

// 일반 몬스터 4종 + 보스. 캐릭터를 나중에 바꾸고 싶으면
// public/assets/monster-battle/monsters/ 에 새 PNG를 넣고 img 경로만 바꾸면 된다.
export const MONSTERS: Monster[] = [
  { id: "slime", name: "슬라임", emoji: "🟢", img: `${BASE}/slime.png`, hp: 3 },
  { id: "goblin", name: "고블린", emoji: "👺", img: `${BASE}/goblin.png`, hp: 3 },
  { id: "rock_golem", name: "돌 골렘", emoji: "🪨", img: `${BASE}/rock_golem.png`, hp: 4 },
  { id: "bat", name: "박쥐", emoji: "🦇", img: `${BASE}/bat.png`, hp: 3 },
];

export const BOSS_MONSTER: Monster = {
  id: "dragon_boss",
  name: "드래곤 보스",
  emoji: "🐉",
  img: `${BASE}/dragon_boss.png`,
  hp: 6,
  isBoss: true,
};

// 일반 몬스터를 몇 마리 잡을 때마다 보스가 등장할지 (설정값으로 관리, 나중에 쉽게 조정 가능)
export const BOSS_EVERY = 4;

export function pickRandomMonster(): Monster {
  return MONSTERS[Math.floor(Math.random() * MONSTERS.length)];
}

// 이번 판이 보스전인지 판단 (일반 몬스터를 BOSS_EVERY마리 잡을 때마다 등장)
export function isBossRound(defeatedCount: number): boolean {
  return defeatedCount > 0 && defeatedCount % BOSS_EVERY === 0;
}

export function nextMonster(defeatedCount: number): Monster {
  return isBossRound(defeatedCount) ? BOSS_MONSTER : pickRandomMonster();
}
