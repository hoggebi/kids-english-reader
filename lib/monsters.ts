export type Monster = {
  id: string;
  name: string;
  emoji: string;
  img?: string;
  hp: number;
  isBoss?: boolean;
};

// 일반 몬스터 4~5종. img가 있으면 이미지를, 없으면 emoji를 화면에 쓴다.
// 캐릭터를 나중에 바꾸고 싶으면: public/monsters/ 에 새 PNG를 넣고 여기 img 경로만 바꾸면 된다.
export const MONSTERS: Monster[] = [
  { id: "slime", name: "슬라임", emoji: "🟢", img: "/monsters/slime.png", hp: 3 },
  { id: "mushroom", name: "버섯 몬스터", emoji: "🍄", img: "/monsters/mushroom.png", hp: 3 },
  { id: "bat", name: "박쥐 몬스터", emoji: "🦇", img: "/monsters/bat.png", hp: 3 },
  { id: "rock", name: "돌 몬스터", emoji: "🪨", img: "/monsters/rock.png", hp: 4 },
  { id: "imp", name: "작은 괴물", emoji: "👾", img: "/monsters/imp.png", hp: 3 },
];

export const BOSS_MONSTER: Monster = {
  id: "boss",
  name: "대왕 괴물",
  emoji: "👹",
  img: "/monsters/boss.png",
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
