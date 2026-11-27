// 앱에 내장한 청크북 B1 (SEED1_B1_CHUNK.pdf, 24쪽 · Lesson 1~8). 구성은 A3와 똑같다.
//  - PDF는 가로 A4 한 장에 책 2쪽이 펼쳐진 스캔본이다. Lesson마다 3장: [본문·대화 | 단어표 앞] [단어표 뒤 | 핵심 단어 앞] [핵심 단어 뒤 | 문장쓰기].
//  - 앱에서는 원본 페이지 이미지를 보여 주지 않는다(본문·문장쓰기만 쓴다).
//  - A2(2~8)·A3(101~108)와 저장소 키가 겹치지 않도록, 앱 안에서 쓰는 Lesson 번호는 200을 더한 값(201~208)이다.
//    화면에는 lessonNo()(chunkbookA3)로 원래 번호(1~8)를 보여 준다.
//  - 본문·대화 영어와 문장쓰기(영어 정답·한국어 문제)는 교재 쪽을 직접 보고 옮겼다. 문장쓰기 한국어는 교재 그대로,
//    본문·대화의 한국어 뜻은 교재에 없어 새로 옮긴 번역이다.
//  - 이 모듈은 브라우저 저장소를 건드리지 않는다(순수 데이터).

import type { ChunkbookMeta } from "./chunkbook";
import type { BodyLine, PageRoles, WritingItem } from "./chunkLesson";

export const B1_OFFSET = 200;
export const BUILTIN_BOOK_ID_B1 = "builtin-b1";
export const B1_LESSONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export const isB1Lesson = (lesson: number) => lesson > B1_OFFSET;
export const b1Internal = (n: number) => n + B1_OFFSET;
const b1No = (lesson: number) => (isB1Lesson(lesson) ? lesson - B1_OFFSET : lesson);

export const B1_TITLES: Record<number, string> = {
  1: "Where Is Harry? (Part 1)",
  2: "Where Is Harry? (Part 2)",
  3: "Mr. Garcia’s Surprise",
  4: "Learning Adventures",
  5: "Puppy Love (Part 1)",
  6: "Puppy Love (Part 2)",
  7: "Tap and Tell",
  8: "A Bow-Wow for Puppy Chow",
};

const firstPage = (n: number) => (n - 1) * 3 + 1;

export const BUILTIN_BOOK_B1: ChunkbookMeta = {
  id: BUILTIN_BOOK_ID_B1,
  title: "호 청크북 B1 · Lesson 1~8",
  fileName: "SEED1_B1_CHUNK.pdf",
  size: 0,
  pageCount: 24,
  importedAt: 0,
  lessons: B1_LESSONS.map((n) => {
    const p = firstPage(n);
    return {
      lesson: b1Internal(n),
      pages: [p, p + 1, p + 2],
      labels: [`Lesson${n}-1 본문·단어`, `Lesson${n}-2 단어·핵심단어`, `Lesson${n}-3 핵심단어·문장쓰기`],
    };
  }),
  labelSource: "pdf-labels",
  confirmed: true,
  builtin: true,
};

export function b1Roles(lesson: number): PageRoles {
  const p = firstPage(b1No(lesson));
  return { body: [p], writing: p + 2 };
}

type Seed = { body: [string, string][]; dialogue: [string, string][]; writing: [string, string][] };

// 내용은 Lesson 단위로 채운다. 아직 없는 Lesson은 비어 있고, 화면에는 "준비 중"으로 보인다.
const SEEDS: Record<number, Seed> = {
  1: {
    body: [
      ["Brent’s class owns a pet hamster.", "Brent네 반은 반려 햄스터를 키웁니다."],
      ["His name is Harry.", "햄스터의 이름은 Harry입니다."],
      ["Everyone loves him.", "모두가 Harry를 좋아합니다."],
      ["This week, it is Brent’s turn to take care of Harry.", "이번 주는 Brent가 Harry를 돌볼 차례입니다."],
      ["“Don’t forget about Harry,” the teacher says kindly.", "“Harry를 잊지 마.” 선생님이 친절하게 말씀하십니다."],
      ["On Monday, Brent feeds Harry.", "월요일에 Brent는 Harry에게 먹이를 줍니다."],
      ["On Tuesday, Brent forgets about Harry.", "화요일에 Brent는 Harry를 깜빡 잊어버립니다."],
      ["On Wednesday, Brent suddenly remembers.", "수요일에 Brent는 갑자기 기억이 납니다."],
      ["He checks on Harry.", "Brent는 Harry를 확인합니다."],
      ["Harry’s cage is empty!", "Harry의 우리가 비어 있어요!"],
      ["Brent looks everywhere.", "Brent는 모든 곳을 찾아봅니다."],
      ["He doesn’t find him.", "Brent는 Harry를 찾지 못합니다."],
      ["Where did Harry go?", "Harry는 어디로 갔을까요?"],
    ],
    dialogue: [
      ["Our class needs a pet.", "우리 반에 반려동물이 필요해."],
      ["What pet should we get?", "어떤 반려동물을 키울까?"],
      ["How about a hamster?", "햄스터는 어때?"],
      ["Sure! Then, we’ll need a cage for it.", "좋아! 그럼 햄스터 우리가 필요하겠다."],
    ],
    writing: [
      ["Brent’s class owns a pet hamster.", "Brent의 반은 반려 햄스터를 가지고 있다."],
      ["This week, it is Brent’s turn to take care of Harry.", "이번 주는 Brent가 Harry를 돌볼 차례다."],
      ["On Tuesday, Brent forgets about Harry.", "화요일에 Brent는 Harry에 대해 잊어버린다."],
      ["Brent looks everywhere.", "Brent는 모든 곳을 찾아본다."],
    ],
  },
  2: {
    body: [
      ["Brent looks for Harry the hamster.", "Brent는 햄스터 Harry를 찾아봅니다."],
      ["He asks his classmates to help.", "Brent는 반 친구들에게 도와 달라고 부탁합니다."],
      ["“Is he under a desk?” asks Brent.", "“Harry가 책상 밑에 있니?” Brent가 묻습니다."],
      ["“No, he isn’t,” Jim answers.", "“아니, 없어.” Jim이 대답합니다."],
      ["“Is he behind the green bookshelf?” asks Brent hopefully.", "“초록색 책장 뒤에 있니?” Brent가 희망을 갖고 묻습니다."],
      ["“No,” says Lisa.", "“아니.” Lisa가 말합니다."],
      ["Then, Brent hears an unusual noise.", "그때, Brent는 이상한 소리를 듣습니다."],
      ["He looks inside Sarah’s desk.", "Brent는 Sarah의 책상 안을 들여다봅니다."],
      ["It’s Harry!", "Harry예요!"],
      ["He is eating Sarah’s peanuts.", "Harry는 Sarah의 땅콩을 먹고 있습니다."],
      ["Everyone is glad to see Harry.", "모두 Harry를 보게 되어 기뻐합니다."],
      ["“I won’t forget to feed Harry again!” says Brent.", "“다시는 Harry에게 먹이 주는 걸 잊지 않을 거야!” Brent가 말합니다."],
    ],
    dialogue: [
      ["We’re getting a kitten. Are you excited?", "우리 새끼 고양이를 데려올 거야. 신나니?"],
      ["Oh, Mom. Yes! What do we need to do?", "와, 엄마. 네! 우리는 뭘 해야 해요?"],
      ["First, we need to get pet food.", "먼저, 반려동물 먹이를 사야 해."],
      ["And let’s buy some toys, too!", "그리고 장난감도 좀 사요!"],
    ],
    writing: [
      ["“Is he under a desk?” asks Brent.", "“그가 책상 밑에 있니?” Brent가 묻는다."],
      ["Then, Brent hears an unusual noise.", "그때, Brent는 이상한 소리를 듣는다."],
      ["He looks inside Sarah’s desk.", "그는 Sarah의 책상 안을 들여다본다."],
      ["Everyone is glad to see Harry.", "모두들 Harry를 봐서 기쁘다."],
    ],
  },
  3: {
    body: [
      ["Mr. Garcia walks into the classroom.", "Garcia 선생님이 교실로 걸어 들어오십니다."],
      ["“Good morning!” he calls cheerfully.", "“좋은 아침!” 선생님이 기분 좋게 외치십니다."],
      ["The students are usually loud.", "학생들은 평소에 시끄럽습니다."],
      ["But not today.", "하지만 오늘은 아닙니다."],
      ["They just say, “Hello.”", "학생들은 그냥 “안녕하세요.”라고만 말합니다."],
      ["The students are around the big table.", "학생들은 큰 탁자 주위에 모여 있습니다."],
      ["They hide their work.", "학생들은 자기들의 작업물을 숨깁니다."],
      ["“Do they have a secret?” Mr. Garcia wonders.", "“아이들에게 비밀이 있나?” Garcia 선생님은 궁금해하십니다."],
      ["Finally, he says, “Time for class!”", "마침내 선생님이 말씀하십니다. “수업 시간이에요!”"],
      ["The students hold up a big picture.", "학생들이 큰 그림을 들어 올립니다."],
      ["It says, “Happy Teachers’ Day!”", "그림에는 “스승의 날 축하드려요!”라고 쓰여 있습니다."],
      ["The students smile.", "학생들이 미소 짓습니다."],
      ["Mr. Garcia smiles back.", "Garcia 선생님도 웃으며 답하십니다."],
      ["“Thanks, everyone!” he says.", "“모두 고마워요!” 선생님이 말씀하십니다."],
    ],
    dialogue: [
      ["Teachers’ Day is coming soon. Should we do something special?", "곧 스승의 날이야. 우리 뭔가 특별한 걸 해야 할까?"],
      ["Yes, we can draw a picture for our teacher.", "응, 선생님께 그림을 그려 드릴 수 있어."],
      ["That’s nice. And we can sing a song, too!", "좋다. 그리고 노래도 불러 드릴 수 있어!"],
      ["Great! Let’s plan this together.", "좋아! 같이 계획해 보자."],
    ],
    writing: [
      ["Mr. Garcia walks into the classroom.", "Garcia 선생님이 교실 안으로 걸어 들어온다."],
      ["They hide their work.", "그들은 그들의 작업물을 숨긴다."],
      ["Finally, he says, “Time for class!”", "마침내 그가 말한다. “수업 시간이다!”"],
      ["The students hold up a big picture.", "학생들이 큰 그림을 들어 올린다."],
    ],
  },
  4: {
    body: [
      ["VR can take students to amazing places right in their classroom.", "VR(가상현실)은 학생들을 바로 교실에서 놀라운 장소들로 데려갈 수 있습니다."],
      ["Students can visit the Amazon rainforest.", "학생들은 아마존 열대우림을 방문할 수 있습니다."],
      ["They can see interesting plants.", "흥미로운 식물들을 볼 수 있습니다."],
      ["They can find strange animals.", "낯선 동물들을 발견할 수 있습니다."],
      ["Students can visit an old city.", "학생들은 고대 도시를 방문할 수 있습니다."],
      ["They can walk in the streets.", "거리를 걸어 다닐 수 있습니다."],
      ["They can meet people from long ago.", "먼 옛날의 사람들을 만날 수 있습니다."],
      ["It’s like they are really there.", "마치 정말 그곳에 있는 것 같습니다."],
      ["Students can’t do these things by reading books.", "학생들은 책을 읽는 것으로는 이런 것들을 할 수 없습니다."],
      ["So, VR is more exciting!", "그래서 VR이 더 흥미진진합니다!"],
    ],
    dialogue: [
      ["We’re going to use VR headsets in our classroom.", "우리 교실에서 VR 헤드셋을 쓸 거래."],
      ["What are we going to use them for?", "그걸로 뭘 하는데?"],
      ["We can fly in the sky with them.", "그걸 쓰고 하늘을 날 수 있어."],
      ["That’s amazing! I can’t wait to try them!", "정말 놀랍다! 빨리 해 보고 싶어!"],
    ],
    writing: [
      ["They can find strange animals.", "그들은 낯선 동물들을 발견할 수 있습니다."],
      ["Students can visit an old city.", "학생들은 고대 도시를 방문할 수 있습니다."],
      ["They can walk in the streets.", "그들은 거리에서 걸어 다닐 수 있습니다."],
      ["They can meet people from long ago.", "그들은 먼 옛날의 사람들을 만날 수 있습니다."],
    ],
  },
  // Lesson 5·6: 교재에서 한 따옴표 안에 여러 문장인 대사는 문장마다 줄을 나누고 따옴표를 줄마다 닫았다.
  5: {
    body: [
      ["“Why is Tappy always napping?” Celina complains.", "“Tappy는 왜 맨날 낮잠만 자요?” Celina가 불평합니다."],
      ["“Good question,” Mom says.", "“좋은 질문이야.” 엄마가 말씀하십니다."],
      ["“I have a book about puppies. You can read it while Tappy naps.”", "“엄마한테 강아지에 대한 책이 있어. Tappy가 낮잠 자는 동안 읽어 보렴.”"],
      ["“Puppies need lots of sleep.”", "“강아지는 잠을 많이 자야 합니다.”"],
      ["“They sleep twelve to eighteen hours a day.”", "“강아지는 하루에 12시간에서 18시간을 잡니다.”"],
      ["“They also need exercise.”", "“강아지는 운동도 필요합니다.”"],
      ["Tappy wakes up.", "Tappy가 잠에서 깹니다."],
      ["Celina closes the book.", "Celina는 책을 덮습니다."],
      ["“Want to go for a walk, Tappy?” Celina asks.", "“산책하러 갈래, Tappy?” Celina가 묻습니다."],
      ["“Tap! Tap! Tap!” Tappy’s tail answers.", "“탁! 탁! 탁!” Tappy의 꼬리가 대답합니다."],
    ],
    dialogue: [
      ["I can’t wait to see my puppy!", "빨리 내 강아지를 보고 싶어!"],
      ["Wow, you really like her.", "와, 너 강아지를 정말 좋아하는구나."],
      ["Yes, she’s so cute. But she’s always sleeping.", "응, 정말 귀여워. 그런데 맨날 잠만 자."],
      ["Well, that’s how puppies grow strong!", "음, 강아지들은 그렇게 튼튼하게 자라는 거야!"],
    ],
    writing: [
      ["“I have a book about puppies.”", "“나는 강아지들에 대한 책이 있어.”"],
      ["“They sleep twelve to eighteen hours a day.”", "“그들은 하루에 12시간에서 18시간을 잡니다.”"],
      ["“They also need exercise.”", "“그들은 또한 운동이 필요합니다.”"],
      ["“Want to go for a walk, Tappy?” Celina asks.", "“산책하러 가고 싶니, Tappy?” Celina가 묻는다."],
    ],
  },
  6: {
    body: [
      ["“Puppies are a big responsibility.”", "“강아지를 키우는 건 큰 책임입니다.”"],
      ["“They also need baths and playtime,” Celina reads in the puppy book.", "“강아지는 목욕과 놀이 시간도 필요합니다.” Celina가 강아지 책에서 읽습니다."],
      ["Celina gives Tappy a sniff.", "Celina가 Tappy의 냄새를 맡아 봅니다."],
      ["“Ugh! Tappy, you smell terrible!”", "“윽! Tappy, 너한테서 고약한 냄새가 나!”"],
      ["Celina gives Tappy a bath.", "Celina가 Tappy를 목욕시킵니다."],
      ["Now, Tappy’s ready to play.", "이제 Tappy는 놀 준비가 되었습니다."],
      ["Celina has a squeaky puppy toy.", "Celina에게는 찍찍 소리 나는 강아지 장난감이 있습니다."],
      ["She throws it to Tappy.", "Celina가 장난감을 Tappy에게 던집니다."],
      ["Tappy catches it!", "Tappy가 장난감을 잡았어요!"],
      ["“Good job, Tappy!” Celina says.", "“잘했어, Tappy!” Celina가 말합니다."],
      ["“Tap! Tap! Tap!” Tappy’s tail agrees.", "“탁! 탁! 탁!” Tappy의 꼬리가 맞다고 합니다."],
    ],
    dialogue: [
      ["Umm, Mom? What’s all this?", "음, 엄마? 이게 다 뭐예요?"],
      ["Those are the things we need to do for our dog.", "우리 강아지를 위해 해야 할 일들이야."],
      ["Do we have to give him a bath often?", "강아지를 자주 목욕시켜야 해요?"],
      ["Of course! Dogs need clean fur to stay healthy.", "물론이지! 개는 건강하려면 털이 깨끗해야 해."],
    ],
    writing: [
      ["“Puppies are a big responsibility.”", "“강아지들은 큰 책임입니다.”"],
      ["“Tappy, you smell terrible!”", "“Tappy, 너한테 고약한 냄새가 나!”"],
      ["Celina gives Tappy a bath.", "Celina가 Tappy를 목욕시킨다."],
      ["Now, Tappy’s ready to play.", "이제 Tappy는 놀 준비가 되었다."],
    ],
  },
  // Lesson 7: Celina의 일기. 첫 줄 "Dear Diary,"와 끝 서명 "Celina"도 교재 그대로 한 줄씩 넣었다.
  7: {
    body: [
      ["Dear Diary,", "일기장에게,"],
      ["Today, Tappy came to Show and Tell.", "오늘 Tappy가 발표 수업(Show and Tell)에 왔어."],
      ["I explained her name to my classmates.", "나는 반 친구들에게 Tappy의 이름을 설명했어."],
      ["I also talked about proper puppy care.", "올바른 강아지 관리에 대해서도 이야기했어."],
      ["Other kids brought their pets, too.", "다른 아이들도 반려동물을 데려왔어."],
      ["Two kids brought their cats.", "두 명은 고양이를 데려왔어."],
      ["Four kids brought hamsters.", "네 명은 햄스터를 데려왔어."],
      ["And guess what?", "그리고 있잖아?"],
      ["Five kids brought dogs!", "다섯 명이 개를 데려왔어!"],
      ["Tappy was excited to meet them.", "Tappy는 친구들을 만나서 신이 났어."],
      ["“Tap! Tap! Tap!” Tappy greeted her new friends.", "“탁! 탁! 탁!” Tappy는 새 친구들에게 인사했어."],
      ["Celina", "Celina가"],
    ],
    dialogue: [
      ["How was Show and Tell today?", "오늘 발표 수업은 어땠어?"],
      ["It was great! So many students brought fish.", "정말 좋았어! 아주 많은 학생들이 물고기를 데려왔어."],
      ["Really? How many students?", "정말? 몇 명이나?"],
      ["Five! They were the most popular pets!", "다섯 명! 물고기가 가장 인기 있는 반려동물이었어!"],
    ],
    writing: [
      ["I explained her name to my classmates.", "나는 반 친구들에게 그녀의 이름을 설명했어."],
      ["I also talked about proper puppy care.", "나는 또한 올바른 강아지 관리에 대해 이야기했어."],
      ["Four kids brought hamsters.", "네 명의 아이들이 햄스터를 데려왔어."],
      ["Tappy greeted her new friends.", "Tappy는 그녀의 새로운 친구들과 인사했어."],
    ],
  },
  8: {
    body: [
      ["Puppies get bigger day by day.", "강아지는 나날이 커집니다."],
      ["It’s important to watch their diets.", "강아지의 식습관을 잘 살피는 것이 중요합니다."],
      ["Puppies need puppy food.", "강아지에게는 강아지 먹이가 필요합니다."],
      ["And sometimes treats are okay.", "그리고 가끔은 간식도 괜찮습니다."],
      ["Cheese and bacon are good treats.", "치즈와 베이컨은 좋은 간식입니다."],
      ["But they should only have a little.", "하지만 조금만 먹어야 합니다."],
      ["Chocolate, grapes, and avocados are dangerous.", "초콜릿, 포도, 아보카도는 위험합니다."],
      ["Even little pieces can hurt puppies.", "작은 조각조차도 강아지를 아프게 할 수 있습니다."],
      ["They’re never okay as treats.", "이것들은 절대 간식으로 괜찮지 않습니다."],
      ["Healthy puppies have great diets.", "건강한 강아지는 훌륭한 식습관을 가지고 있습니다."],
      ["And healthy puppies are happy puppies!", "그리고 건강한 강아지는 행복한 강아지예요!"],
    ],
    dialogue: [
      ["My dog never listens to me.", "우리 개는 내 말을 전혀 안 들어."],
      ["How about training him with treats?", "간식으로 훈련시켜 보는 건 어때?"],
      ["Treats? Well, I have some chocolate at home.", "간식? 음, 집에 초콜릿이 좀 있는데."],
      ["That’s a bad idea! Try cheese or bacon.", "그건 안 좋은 생각이야! 치즈나 베이컨을 줘 봐."],
    ],
    writing: [
      ["Puppies get bigger day by day.", "강아지들은 나날이 커집니다."],
      ["Cheese and bacon are good treats.", "치즈와 베이컨은 좋은 간식들입니다."],
      ["Even little pieces can hurt puppies.", "작은 조각들조차 강아지들을 아프게 할 수 있습니다."],
      ["Healthy puppies have great diets.", "건강한 강아지들은 훌륭한 식습관을 갖고 있습니다."],
    ],
  },
};

export function b1SeedBody(lesson: number): BodyLine[] {
  const s = SEEDS[b1No(lesson)];
  if (!s) return [];
  return [
    ...s.body.map(([en, ko]) => ({ en, ko, section: "passage" as const })),
    ...s.dialogue.map(([en, ko]) => ({ en, ko, section: "dialogue" as const })),
  ];
}

export function b1SeedWriting(lesson: number): WritingItem[] {
  return (SEEDS[b1No(lesson)]?.writing ?? []).map(([en, ko]) => ({ en, ko }));
}

export const b1Ready = (lesson: number) => b1SeedBody(lesson).length > 0;
