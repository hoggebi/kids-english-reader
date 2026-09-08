export type Monster = {
  id: string;
  name: string;
  emoji: string;
  hp: number;
  isBoss?: boolean;
};

// 일반 몬스터 4~5종. 이미지가 생기면 emoji 대신 img 필드를 추가해서 교체하면 된다.
export const MONSTERS: Monster[] = [
  { id: "slime", name: "슬라임", emoji: "🟢", hp: 3 },
  { id: "mushroom", name: "버섯 몬스터", emoji: "🍄", hp: 3 },
  { id: "bat", name: "박쥐 몬스터", emoji: "🦇", hp: 3 },
  { id: "rock", name: "돌 몬스터", emoji: "🪨", hp: 4 },
  { id: "imp", name: "작은 괴물", emoji: "👾", hp: 3 },
];

export const BOSS_MONSTER: Monster = {
  id: "boss",
  name: "대왕 괴물",
  emoji: "👹",
  hp: 6,
  isBoss: true,
};

// 일반 몬스터를 몇 마리 잡을 때마다 보스가 등장할지 (설정값으로 관리, 나중에 쉽게 조정 가능)
export const BOSS_EVERY = 3;

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
