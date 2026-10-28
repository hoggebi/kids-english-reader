// 앱에 내장한 청크북(호_청크북_앱용A2.pdf, 14쪽 · Lesson 2~8).
//  - 페이지 이미지는 public/chunkbook/a2/pNN.jpg (전체 약 2MB)에 정적 파일로 들어 있다. PDF 원본(약 25MB)은 앱에 넣지 않는다.
//  - 본문·한국어 뜻·문장쓰기 영어 정답은 교재 쪽을 직접 보고 옮겨 확인한 값이다.
//    문장쓰기의 한국어는 교재(문장쓰기 쪽)에 인쇄된 문제 그대로이고, 본문의 한국어 뜻은 교재에 없어 새로 옮긴 번역이다.
//  - 그래서 새 기기·깨끗한 브라우저에서도 PDF를 가져오거나 OCR·번역을 하지 않고 바로 쓸 수 있다.
//  - 이 모듈은 브라우저 저장소를 건드리지 않는다(순수 데이터).

import type { ChunkbookMeta } from "./chunkbook";
import type { BodyLine, PageRoles, WritingItem } from "./chunkLesson";
import { a3Roles, a3SeedBody, a3SeedWriting, isA3Lesson } from "./chunkbookA3.ts";

export const BUILTIN_BOOK_ID = "builtin-a2";
export const BUILTIN_LESSONS = [2, 3, 4, 5, 6, 7, 8] as const;

// PDF 페이지 레이블 순서: Lesson2-1, Lesson2-2, Lesson3-1, … (Lesson당 본문 1쪽 + 문장쓰기 1쪽)
const firstPage = (lesson: number) => (lesson - 2) * 2 + 1;

export const BUILTIN_BOOK: ChunkbookMeta = {
  id: BUILTIN_BOOK_ID,
  title: "호 청크북 A2 · Lesson 2~8",
  fileName: "호_청크북_앱용A2.pdf",
  size: 0,
  pageCount: 14,
  importedAt: 0,
  lessons: BUILTIN_LESSONS.map((lesson) => {
    const p = firstPage(lesson);
    return { lesson, pages: [p, p + 1], labels: [`Lesson${lesson}-1`, `Lesson${lesson}-2`] };
  }),
  labelSource: "pdf-labels",
  confirmed: true,
  builtin: true,
};

export const builtinPageUrl = (page: number) => `/chunkbook/a2/p${String(page).padStart(2, "0")}.jpg`;

export function builtinRoles(lesson: number): PageRoles {
  if (isA3Lesson(lesson)) return a3Roles(lesson);
  const p = firstPage(lesson);
  return { body: [p], writing: p + 1 };
}

type Seed = { body: [string, string][]; dialogue: [string, string][]; writing: [string, string][] };

const SEEDS: Record<number, Seed> = {
  2: {
    body: [
      ["Alana’s uncle also lives in Texas.", "Alana의 삼촌도 텍사스에 살고 있었습니다."],
      ["They play catch, too.", "그들도 캐치볼 놀이를 했습니다."],
      ["“Is it the same man?” Alana asks.", "“그 사람이 같은 남자인가?” Alana가 물었습니다."],
      ["“My uncle is 43,” Pedro says. “How old is yours?”", "“우리 삼촌은 43살이야.” Pedro가 말했습니다. “네 삼촌은 몇 살이야?”"],
      ["“Let’s see. Grandma is 86,” Alana says.", "“어디 보자. 할머니는 86살이야.” Alana가 말했습니다."],
      ["“She is twice as old as Uncle Texas.”", "“할머니는 Texas 삼촌보다 나이가 두 배야.”"],
      ["“I think it’s the same person!” Pedro says.", "“같은 사람인 것 같아!” Pedro가 말했습니다."],
      ["After class, they call Uncle Texas.", "수업이 끝난 뒤, 그들은 Uncle Texas에게 전화를 걸었습니다."],
      ["“What a great surprise!” he says.", "“대단히 놀라운 일이구나!” 그가 말했습니다."],
      ["“Let’s all play catch!”", "“다 같이 캐치볼 하자!”"],
    ],
    dialogue: [
      ["Do you know how old Aunt Lucy is?", "Lucy 이모가 몇 살인지 아니?"],
      ["I guess she’s 40!", "40살인 것 같아!"],
      ["Really? She looks 30.", "정말? 30살로 보이는데."],
      ["Let’s check her birthday card!", "생일 카드를 확인해 보자!"],
    ],
    writing: [
      ["They play catch, too.", "그들도 캐치볼 놀이를 한다."],
      ["“Is it the same man?” Alana asks.", "“그 사람이 같은 남자인가?” Alana가 묻는다."],
      ["After class, they call Uncle Texas.", "수업 후에 그들은 Uncle Texas에게 전화한다."],
      ["“What a great surprise!” he says.", "“대단히 놀라운 일이구나!” 그가 말한다."],
    ],
  },
  3: {
    body: [
      ["“Please don’t run,” Dad says.", "“제발 뛰지 마.” 아빠가 말했습니다."],
      ["“Don’t do this! Don’t do that!” Jesse shouts.", "“이러지 마! 저러지 마!” Jesse가 소리쳤습니다."],
      ["“I’m tired of all these rules!”", "“전 이 모든 규칙들에 지쳤어요!”"],
      ["Dad sighs.", "아빠가 한숨을 쉬었습니다."],
      ["“Okay,” he says. “Let’s switch. You’re the dad, and I’m the son, until six o’clock.”", "“좋아.” 그가 말했습니다. “바꾸자. 네가 아빠고, 내가 아들이야, 여섯 시까지.”"],
      ["“Great!” Jesse says. “Clean your room!”", "“좋아!” Jesse가 말했습니다. “네 방을 청소해!”"],
      ["Dad cleans Jesse’s room.", "아빠가 Jesse의 방을 청소했습니다."],
      ["“Good job! I’ll buy you a smartphone!” Jesse says.", "“잘했어! 내가 너에게 스마트폰을 사줄게!” Jesse가 말했습니다."],
      ["Dad smiles and points at his watch.", "아빠가 미소 지으며 손목시계를 가리켰습니다."],
      ["“It’s six o’clock.”", "“여섯 시야.”"],
    ],
    dialogue: [
      ["Dad, I’m tired of all these rules.", "아빠, 저는 이 모든 규칙들이 지겨워요."],
      ["Okay, let’s switch our roles.", "좋아, 우리 역할을 바꾸자."],
      ["I’m going to play a game then.", "그럼 난 게임을 할 거예요."],
      ["Okay, but only until 7 o’clock. Then, you need to study.", "좋아, 하지만 7시까지만이야. 그다음엔 공부해야 해."],
    ],
    writing: [
      ["“I’m tired of all these rules!”", "“전 이 모든 규칙들에 지쳤어요!”"],
      ["“You’re the dad, and I’m the son, until six o’clock.”", "“네가 아빠고, 내가 아들이야, 여섯 시까지.”"],
      ["“I’ll buy you a smartphone!”", "“내가 너에게 스마트폰을 사줄게!”"],
      ["Dad smiles and points at his watch.", "아빠가 미소 지으며 그의 손목시계를 가리킨다."],
    ],
  },
  4: {
    body: [
      ["Do you like sports?", "여러분은 스포츠를 좋아하나요?"],
      ["Sports are fun with friends.", "스포츠는 친구들과 함께 하면 재미있습니다."],
      ["They are also great family activities.", "그것들은 또한 아주 좋은 가족 활동들입니다."],
      ["Sports keep your family healthy.", "스포츠는 여러분의 가족을 건강하게 지켜 줍니다."],
      ["They burn calories.", "그것들은 칼로리를 태웁니다."],
      ["They also make muscles strong.", "그것들은 또한 근육을 강하게 만듭니다."],
      ["Sports teach your family important lessons.", "스포츠는 여러분의 가족에게 중요한 교훈을 가르쳐 줍니다."],
      ["They teach you good manners.", "그것들은 여러분에게 좋은 예절을 가르쳐 줍니다."],
      ["They also teach you cooperation.", "그것들은 또한 협동을 가르쳐 줍니다."],
      ["Does your family like sports?", "여러분의 가족은 스포츠를 좋아하나요?"],
      ["Maybe you can play one this weekend.", "어쩌면 이번 주말에 하나 해 볼 수 있어요."],
    ],
    dialogue: [
      ["What sport does your family like to play?", "너희 가족은 어떤 운동을 하는 것을 좋아하니?"],
      ["My family likes to play volleyball.", "우리 가족은 배구하는 것을 좋아해."],
      ["Where do you like to play it?", "그것을 어디에서 하는 것을 좋아하니?"],
      ["We like to play it at the beach.", "우리는 해변에서 하는 것을 좋아해."],
    ],
    writing: [
      ["Sports are fun with friends.", "스포츠는 친구들과 함께 하면 재미있습니다."],
      ["They are also great family activities.", "그것들은 또한 아주 좋은 가족 활동들입니다."],
      ["They also make muscles strong.", "그것들은 또한 근육을 강하게 만듭니다."],
      ["They teach you good manners.", "그것들은 여러분에게 좋은 예절을 가르쳐 줍니다."],
    ],
  },
  5: {
    body: [
      ["I am at Tim’s house.", "나는 Tim의 집에 있었습니다."],
      ["“Let’s play my new game, Ricky!” he says.", "“내 새 게임을 해보자, Ricky야!” 그가 말했습니다."],
      ["“But it’s only for one player,” I say.", "“하지만 이건 오직 한 플레이어만 할 수 있잖아.” 내가 말했습니다."],
      ["I watch Tim play.", "나는 Tim이 게임하는 것을 지켜보았습니다."],
      ["After an hour, I feel a little angry.", "한 시간이 지나자, 나는 조금 화가 났습니다."],
      ["“Can I have a turn?” I say.", "“내 차례를 가져도 될까?” 내가 말했습니다."],
      ["Tim keeps playing.", "Tim은 계속 게임을 했습니다."],
      ["Finally, I stand up.", "마침내, 나는 자리에서 일어났습니다."],
      ["Tim looks at me, but it’s too late.", "Tim이 나를 쳐다보았지만, 너무 늦었습니다."],
      ["“I’m going home,” I say.", "“나 집에 갈래.” 내가 말했습니다."],
    ],
    dialogue: [
      ["Hey, why are you leaving?", "이봐, 왜 가는 거야?"],
      ["Because I’m upset. I want to play the game, too.", "화가 나서 그래. 나도 게임을 하고 싶어."],
      ["I’m so sorry. Let’s take turns!", "정말 미안해. 번갈아 하자!"],
      ["That sounds good!", "좋아!"],
    ],
    writing: [
      ["“Let’s play my new game, Ricky!”", "“내 새 게임을 해보자, Ricky야!”"],
      ["“But it’s only for one player.”", "“하지만 이건 오직 한 플레이어만 할 수 있잖아.”"],
      ["After an hour, I feel a little angry.", "한 시간 후, 나는 약간 화난 기분이 든다."],
      ["“Can I have a turn?”", "“내 차례를 가져도 될까?”"],
    ],
  },
  6: {
    body: [
      ["Hi Ricky,", "안녕 Ricky,"],
      ["I’m really sorry about yesterday.", "어제 일은 정말 미안해."],
      ["I hurt your feelings.", "내가 네 기분을 상하게 했어."],
      ["I understand now.", "이제 이해해."],
      ["My new game is exciting.", "내 새 게임은 신나는 게임이야."],
      ["But that’s no excuse.", "하지만 그건 변명이 안돼."],
      ["You’re my friend.", "너는 내 친구야."],
      ["It isn’t right to forget about you.", "너를 잊어버리는 건 옳지 않아."],
      ["Can you forgive me?", "네가 날 용서해 줄래?"],
      ["I hope so.", "그러길 바라."],
      ["Let’s hang out.", "같이 놀자."],
      ["How about later today?", "오늘 이따가 어때?"],
      ["This time, we’ll do something fun for both of us.", "이번에 우리는 둘 다에게 재미있는 것을 할 거야."],
      ["See you later, Tim", "나중에 보자, Tim"],
    ],
    dialogue: [
      ["I’m sorry for not playing with you yesterday.", "어제 너와 같이 놀지 않아서 미안해."],
      ["It hurt my feelings.", "내 기분이 상했어."],
      ["I feel bad. Can you forgive me?", "마음이 안 좋아. 나를 용서해 줄래?"],
      ["Okay, just don’t do it again.", "좋아, 다시는 그러지 마."],
    ],
    writing: [
      ["I hurt your feelings.", "내가 네 기분을 상하게 했어."],
      ["But that’s no excuse.", "하지만 그건 변명이 안돼."],
      ["Can you forgive me?", "네가 날 용서해 줄래?"],
      ["This time, we’ll do something fun for both of us.", "이번에 우리는 둘 다에게 재미있는 것을 할 거야."],
    ],
  },
  7: {
    body: [
      ["Jane notices her friends are acting strangely.", "Jane은 친구들이 이상하게 행동하는 것을 알아챘습니다."],
      ["“She’s coming!” Kim whispers.", "“그녀가 오고 있어!” Kim이 속삭였습니다."],
      ["“Don’t let her see!” Chris says.", "“그녀가 보지 못하게 해!” Chris가 말했습니다."],
      ["They run away.", "그들은 도망쳤습니다."],
      ["Jane is confused.", "Jane은 어리둥절했습니다."],
      ["“Why are they being weird?” she thinks.", "“왜 그들은 이상하게 구는 걸까?” 그녀는 생각했습니다."],
      ["She wants to find out.", "그녀는 알아내고 싶었습니다."],
      ["Jane looks for her friends.", "Jane은 친구들을 찾아보았습니다."],
      ["They aren’t in the hall.", "그들은 복도에 없었습니다."],
      ["They’re hiding in the classroom.", "그들은 교실에 숨어 있었습니다."],
      ["“Happy Birthday!” they shout.", "“생일 축하해!” 그들이 외쳤습니다."],
      ["They give her a cake.", "그들은 그녀에게 케이크를 주었습니다."],
      ["“Wow!” Jane says. “What a nice surprise!”", "“우와!” Jane이 말했습니다. “정말 멋진 깜짝 선물이야!”"],
    ],
    dialogue: [
      ["Thanks for the nice surprise!", "멋진 깜짝 선물 고마워!"],
      ["Sorry for being weird earlier. Did I make you upset?", "아까 이상하게 굴어서 미안해. 내가 널 속상하게 했니?"],
      ["A little. But I always trust you.", "조금. 하지만 난 항상 널 믿어."],
      ["Right, we’re good friends.", "맞아, 우리는 좋은 친구야."],
    ],
    writing: [
      ["They run away.", "그들은 도망친다."],
      ["“Why are they being weird?” she thinks.", "“왜 그들은 이상하게 구는 걸까?” 그녀는 생각한다."],
      ["She wants to find out.", "그녀는 알아내고 싶어 한다."],
      ["Jane looks for her friends.", "Jane은 친구들을 찾아본다."],
    ],
  },
  8: {
    body: [
      ["Listening is important.", "잘 듣는 것은 중요합니다."],
      ["It shows you care.", "그것은 여러분이 관심이 있음을 보여 줍니다."],
      ["But listening isn’t easy.", "하지만 잘 듣는 것은 쉽지 않습니다."],
      ["Are you a good listener?", "여러분은 말을 잘 들어주는 사람인가요?"],
      ["Let’s check the list.", "목록을 확인해 봅시다."],
      ["I look at my friends while they talk.", "나는 친구들이 말하는 동안 그들을 바라봅니다."],
      ["I nod as they talk.", "나는 그들이 말할 때 고개를 끄덕입니다."],
      ["I wait until they finish.", "나는 그들이 끝낼 때까지 기다립니다."],
      ["I ask them questions.", "나는 그들에게 질문을 합니다."],
      ["Two or more checks? You listen well!", "체크가 두 개 이상인가요? 여러분은 잘 듣는군요!"],
      ["Only one check? That’s okay.", "체크가 한 개뿐인가요? 괜찮아요."],
      ["Keep practicing!", "계속 연습하세요!"],
      ["You’ll get better.", "당신은 더 나아질 거예요."],
    ],
    dialogue: [
      ["Are you listening to me?", "내 말 듣고 있니?"],
      ["Of course! Why?", "물론이지! 왜?"],
      ["Because you look bored.", "지루해 보여서."],
      ["Sorry, I’ll stop and listen.", "미안, 멈추고 들을게."],
    ],
    writing: [
      ["Are you a good listener?", "여러분은 말을 잘 들어주는 사람인가요?"],
      ["I look at my friends while they talk.", "나는 친구들이 말하는 동안 그들을 바라본다."],
      ["I nod as they talk.", "나는 그들이 말할 때 고개를 끄덕인다."],
      ["You’ll get better.", "당신은 더 나아질 거예요."],
    ],
  },
};

export function builtinSeedBody(lesson: number): BodyLine[] {
  if (isA3Lesson(lesson)) return a3SeedBody(lesson);
  const s = SEEDS[lesson];
  if (!s) return [];
  return [
    ...s.body.map(([en, ko]) => ({ en, ko, section: "passage" as const })),
    ...s.dialogue.map(([en, ko]) => ({ en, ko, section: "dialogue" as const })),
  ];
}

export function builtinSeedWriting(lesson: number): WritingItem[] {
  if (isA3Lesson(lesson)) return a3SeedWriting(lesson);
  return (SEEDS[lesson]?.writing ?? []).map(([en, ko]) => ({ en, ko }));
}
