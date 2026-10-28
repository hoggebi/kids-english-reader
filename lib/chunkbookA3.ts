// 앱에 내장한 청크북 A3 (SEED1_A3_CHUNK.pdf, 24쪽 · Lesson 1~8).
//  - PDF는 가로 A4 한 장에 책 2쪽이 펼쳐진 스캔본이다. Lesson마다 3장: [본문·대화 | 단어표 앞] [단어표 뒤 | 핵심 단어 앞] [핵심 단어 뒤 | 문장쓰기].
//  - 앱에서는 원본 페이지 이미지를 보여 주지 않는다(본문·문장쓰기만 쓴다).
//  - A2(Lesson 2~8)와 저장소 키가 겹치지 않도록, 앱 안에서 쓰는 Lesson 번호는 100을 더한 값(101~108)이다.
//    화면에는 lessonNo()로 원래 번호(1~8)를 보여 준다.
//  - 이 모듈은 브라우저 저장소를 건드리지 않는다(순수 데이터).

import type { ChunkbookMeta } from "./chunkbook";
import type { BodyLine, PageRoles, WritingItem } from "./chunkLesson";

export const A3_OFFSET = 100;
export const BUILTIN_BOOK_ID_A3 = "builtin-a3";
export const A3_LESSONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export const isA3Lesson = (lesson: number) => lesson > A3_OFFSET;
export const lessonNo = (lesson: number) => (isA3Lesson(lesson) ? lesson - A3_OFFSET : lesson);
export const a3Internal = (n: number) => n + A3_OFFSET;

export const A3_TITLES: Record<number, string> = {
  1: "The New Student",
  2: "What Are Muscles?",
  3: "Out of Breath!",
  4: "It’s an Expression!",
  5: "Reggie the Robot (Part 1)",
  6: "Reggie the Robot (Part 2)",
  7: "The Morning Mix-Up",
  8: "Animal Spots and Stripes",
};

const firstPage = (n: number) => (n - 1) * 3 + 1;

export const BUILTIN_BOOK_A3: ChunkbookMeta = {
  id: BUILTIN_BOOK_ID_A3,
  title: "호 청크북 A3 · Lesson 1~8",
  fileName: "SEED1_A3_CHUNK.pdf",
  size: 0,
  pageCount: 24,
  importedAt: 0,
  lessons: A3_LESSONS.map((n) => {
    const p = firstPage(n);
    return {
      lesson: a3Internal(n),
      pages: [p, p + 1, p + 2],
      labels: [`Lesson${n}-1 본문·단어`, `Lesson${n}-2 단어·핵심단어`, `Lesson${n}-3 핵심단어·문장쓰기`],
    };
  }),
  labelSource: "pdf-labels",
  confirmed: true,
  builtin: true,
};

export function a3Roles(lesson: number): PageRoles {
  const p = firstPage(lessonNo(lesson));
  return { body: [p], writing: p + 2 };
}

type Seed = { body: [string, string][]; dialogue: [string, string][]; writing: [string, string][] };

// 내용은 Lesson 단위로 채운다. 아직 없는 Lesson은 비어 있고, 화면에는 "준비 중"으로 보인다.
const SEEDS: Record<number, Seed> = {
  1: {
    body: [
      ["We are getting checkups at school.", "우리는 학교에서 건강 검진을 받고 있습니다."],
      ["We get weighed first.", "우리는 먼저 몸무게를 잽니다."],
      ["I weigh 22 kilograms.", "나는 몸무게가 22킬로그램입니다."],
      ["Robin weighs 23 kilograms.", "Robin은 몸무게가 23킬로그램입니다."],
      ["“Ray, look at the new girl,” my friend Robin says.", "“Ray, 새로 온 여자아이 좀 봐.” 내 친구 Robin이 말합니다."],
      ["“She looks really warm!”", "“정말 따뜻해 보여!”"],
      ["The new girl goes to the scale.", "새로 온 여자아이가 체중계로 갑니다."],
      ["She takes off her coat and sweater.", "그 아이는 코트와 스웨터를 벗습니다."],
      ["She takes off a vest and scarf.", "조끼와 목도리도 벗습니다."],
      ["And then another sweater.", "그러고 나서 스웨터를 또 한 벌 벗습니다."],
      ["She’s 21 kilograms!", "그 아이는 21킬로그램입니다!"],
    ],
    dialogue: [
      ["Dr. Sue, how tall am I?", "Sue 선생님, 제 키는 얼마나 되나요?"],
      ["You’re 130 centimeters tall.", "키가 130센티미터란다."],
      ["Wow! I’m five centimeters taller than last year.", "와! 작년보다 5센티미터 더 컸어요."],
      ["Great! Keep drinking milk!", "좋아! 계속 우유를 마시렴!"],
    ],
    writing: [
      ["We are getting checkups at school.", "우리는 학교에서 건강 검진을 받고 있다."],
      ["I weigh 22 kilograms.", "나는 몸무게가 22킬로그램이다."],
      ["The new girl goes to the scale.", "새로 온 여자애가 체중계로 간다."],
      ["She takes off her coat and sweater.", "그녀는 그녀의 코트와 스웨터를 벗는다."],
    ],
  },
  2: {
    body: [
      ["Why are muscles so important?", "근육은 왜 그렇게 중요할까요?"],
      ["Without muscles, you couldn’t move.", "근육이 없다면 여러분은 움직일 수 없을 거예요."],
      ["Muscles help you run, write, and smile.", "근육은 여러분이 달리고, 글을 쓰고, 미소 짓도록 도와줍니다."],
      ["How do they work?", "근육은 어떻게 작동할까요?"],
      ["First, your brain sends a signal.", "먼저 여러분의 뇌가 신호를 보냅니다."],
      ["The signal moves through your body.", "그 신호는 여러분의 몸을 통해 이동합니다."],
      ["When it arrives, your muscles move.", "신호가 도착하면 근육이 움직입니다."],
      ["Where do muscles come from?", "근육은 어디에서 생길까요?"],
      ["Your body changes food to muscles.", "여러분의 몸은 음식을 근육으로 바꿉니다."],
      ["For strong muscles, eat meat, beans, and nuts.", "튼튼한 근육을 위해 고기, 콩, 견과류를 먹으세요."],
    ],
    dialogue: [
      ["Good morning, everyone!", "모두들 좋은 아침이에요!"],
      ["What are we learning today, Ms. Potts?", "Potts 선생님, 오늘은 무엇을 배워요?"],
      ["We are learning about muscles. Do you know what they do?", "오늘은 근육에 대해 배울 거예요. 근육이 무슨 일을 하는지 아나요?"],
      ["They help us lift heavy things.", "무거운 물건을 들어 올리게 도와줘요."],
    ],
    writing: [
      ["Muscles help you run, write, and smile.", "근육은 여러분이 달리고, 글을 쓰고, 미소 짓도록 도와줍니다."],
      ["First, your brain sends a signal.", "먼저 여러분의 뇌가 신호를 보냅니다."],
      ["Your body changes food to muscles.", "여러분의 몸은 음식을 근육으로 바꿉니다."],
      ["For strong muscles, eat meat, beans, and nuts.", "튼튼한 근육을 위해 고기, 콩, 그리고 견과류를 먹도록 하세요."],
    ],
  },
  3: {
    body: [
      ["Today, Casey’s class is playing basketball.", "오늘 Casey네 반은 농구를 하고 있습니다."],
      ["He runs back and forth quickly!", "Casey는 빠르게 이리저리 뛰어다닙니다!"],
      ["He’s scoring points for his team!", "그는 팀을 위해 점수를 올리고 있습니다!"],
      ["Casey is out of breath.", "Casey는 숨이 가쁩니다."],
      ["He has to rest for a second.", "그는 잠깐 쉬어야 합니다."],
      ["Casey’s chest feels tight.", "Casey의 가슴이 꽉 조이는 느낌이 듭니다."],
      ["His body needs more air.", "그의 몸은 더 많은 공기가 필요합니다."],
      ["Casey takes some deep breaths.", "Casey는 깊은숨을 몇 번 들이쉽니다."],
      ["His body starts to relax.", "그의 몸이 긴장을 풀기 시작합니다."],
      ["Oh no!", "이런!"],
      ["The other team scored!", "상대 팀이 득점했어요!"],
      ["Time to start running again.", "다시 뛰기 시작할 시간이에요."],
    ],
    dialogue: [
      ["I don’t feel good today.", "오늘은 몸이 좋지 않아."],
      ["Oh no! What’s wrong?", "이런! 무슨 일이야?"],
      ["I have a headache.", "머리가 아파."],
      ["I think you need to get some rest.", "좀 쉬어야 할 것 같아."],
    ],
    writing: [
      ["He runs back and forth quickly!", "그는 빠르게 이리저리 뛰어다닌다!"],
      ["Casey is out of breath.", "Casey는 숨이 가쁘다."],
      ["Casey’s chest feels tight.", "Casey의 가슴이 꽉 조이는 느낌이다."],
      ["Casey takes some deep breaths.", "Casey는 깊은숨을 몇 번 들이쉰다."],
    ],
  },
  4: {
    body: [
      ["“Please give Fredrick a hand,” Mr. Jones says.", "“Fredrick을 좀 도와주렴.” Jones 선생님이 말합니다."],
      ["Justin puts his hand on Fredrick’s hand.", "Justin이 자기 손을 Fredrick의 손 위에 얹습니다."],
      ["“I don’t need a hand,” Fredrick says.", "“나는 도움이 필요 없어.” Fredrick이 말합니다."],
      ["“I need math help.”", "“나는 수학에 도움이 필요해.”"],
      ["“But I don’t know the answer,” Justin says.", "“하지만 난 답을 몰라.” Justin이 말합니다."],
      ["“Put your heads together,” Mr. Jones says.", "“머리를 맞대 보렴.” Jones 선생님이 말합니다."],
      ["Justin touches his head to Fredrick’s head.", "Justin이 자기 머리를 Fredrick의 머리에 댑니다."],
      ["“That isn’t helping, either,” says Fredrick.", "“이것도 도움이 안 돼.” Fredrick이 말합니다."],
      ["Mr. Jones sighs.", "Jones 선생님이 한숨을 쉽니다."],
      ["“I want you to work together.”", "“나는 너희가 함께 노력하길 바란다.”"],
    ],
    dialogue: [
      ["I don’t understand this question.", "이 문제를 이해하지 못하겠어."],
      ["Me neither. What should we do?", "나도 그래. 어떻게 하지?"],
      ["Let’s put our heads together.", "머리를 맞대 보자."],
      ["Sure. Let’s find the answer together!", "좋아. 같이 답을 찾아 보자!"],
    ],
    writing: [
      ["Justin puts his hand on Fredrick’s hand.", "Justin이 그의 손을 Fredrick의 손 위에 놓는다."],
      ["“I need math help.”", "“나는 수학에 도움이 필요해.”"],
      ["Justin touches his head to Fredrick’s head.", "Justin이 그의 머리를 Fredrick의 머리에 댄다."],
      ["“I want you to work together.”", "“나는 너희가 함께 노력하길 바란다.”"],
    ],
  },
  5: {
    body: [
      ["Sophie’s room is messy!", "Sophie의 방은 지저분합니다!"],
      ["Toys and books are everywhere.", "장난감과 책이 사방에 있습니다."],
      ["Sophie needs to tidy up.", "Sophie는 깔끔하게 정리해야 합니다."],
      ["She has a plan.", "그녀에게는 계획이 있습니다."],
      ["She writes a program for her robot.", "그녀는 자기 로봇을 위한 프로그램을 작성합니다."],
      ["It looks like this:", "프로그램은 이렇게 생겼습니다."],
      ["Pick up a ball. Put it in the bin.", "공을 집어. 그것을 쓰레기통에 넣어."],
      ["Pick up a book. Put it on the shelf.", "책을 집어. 그것을 선반 위에 놓아."],
      ["Sophie has many toys.", "Sophie는 장난감이 많습니다."],
      ["She has many books, too.", "책도 많습니다."],
      ["So, she writes many lines.", "그래서 그녀는 많은 줄을 씁니다."],
    ],
    dialogue: [
      ["What a mess! You need to tidy up!", "정말 엉망이네! 정리해야겠다!"],
      ["I’ll write a program for my robot.", "내 로봇을 위한 프로그램을 작성할 거야."],
      ["What kind of program?", "어떤 프로그램인데?"],
      ["I want him to clean my desk.", "로봇이 내 책상을 청소하게 하고 싶어."],
    ],
    writing: [
      ["Sophie needs to tidy up.", "Sophie는 깔끔하게 정리해야 한다."],
      ["She has a plan.", "그녀는 계획이 있다."],
      ["She writes a program for her robot.", "그녀는 그녀의 로봇을 위한 명령 프로그램을 작성한다."],
      ["So, she writes many lines.", "그녀는 많은 행을 쓴다."],
    ],
  },
  6: {
    body: [
      ["Sophie’s robot, Reggie, watches.", "Sophie의 로봇 Reggie가 지켜봅니다."],
      ["“Stop!” he says.", "“멈춰!” 그가 말합니다."],
      ["“There’s a better way.”", "“더 좋은 방법이 있어.”"],
      ["“Look at all your lines. There are patterns.”", "“네 모든 줄을 봐. 패턴이 있어.”"],
      ["He writes a new program.", "그는 새로운 프로그램을 작성합니다."],
      ["Pick up something.", "무언가를 집어."],
      ["Is it a toy? Put it in the bin.", "장난감이야? 그러면 쓰레기통에 넣어."],
      ["Is it a book? Put it on the shelf.", "책이야? 그러면 선반 위에 놓아."],
      ["Repeat.", "반복해."],
      ["Sophie starts the program.", "Sophie가 프로그램을 시작합니다."],
      ["Soon, her room is tidy.", "곧 그녀의 방이 깔끔해집니다."],
      ["“Clever!” Sophie says.", "“똑똑하다!” Sophie가 말합니다."],
      ["“Now, I have a coding teacher!”", "“이제 나한테 코딩 선생님이 있네!”"],
    ],
    dialogue: [
      ["Let’s write a program.", "프로그램을 써 보자."],
      ["What are we going to write?", "무엇을 쓸 건데?"],
      ["Our robot can make breakfast for us.", "우리 로봇이 우리에게 아침을 만들어 줄 수 있어."],
      ["Sure! It can do that every Sunday!", "좋아! 로봇은 그걸 매주 일요일마다 할 수 있어!"],
    ],
    writing: [
      ["“There’s a better way.”", "“더 좋은 방법이 있어.”"],
      ["He writes a new program.", "그는 새로운 프로그램을 작성한다."],
      ["Put it on the shelf.", "그것을 선반 위에 놓아라."],
      ["“Now, I have a coding teacher!”", "“이제 나한테 코딩 선생님이 있네!”"],
    ],
  },
  7: {
    body: [
      ["In the morning, Mom is busy.", "아침에 엄마는 바쁩니다."],
      ["“Help Lily choose nice clothes,” she tells Hugo.", "“Lily가 멋진 옷을 고르도록 도와주렴.” 엄마가 Hugo에게 말합니다."],
      ["“She starts kindergarten today.”", "“오늘 유치원에 들어가거든.”"],
      ["Hugo goes to his sister’s room.", "Hugo는 여동생의 방으로 갑니다."],
      ["Lily chooses a checkered shirt.", "Lily는 체크무늬 셔츠를 고릅니다."],
      ["Then, she picks polka-dot pants.", "그다음 물방울무늬 바지를 고릅니다."],
      ["She also puts on a striped scarf.", "줄무늬 스카프도 두릅니다."],
      ["“Too many patterns!” says Hugo.", "“무늬가 너무 많아!” Hugo가 말합니다."],
      ["Lily doesn’t listen.", "Lily는 듣지 않습니다."],
      ["Hugo shrugs.", "Hugo는 어깨를 으쓱합니다."],
      ["At breakfast, Mom sees Lily.", "아침 식사 때 엄마가 Lily를 봅니다."],
      ["She laughs.", "엄마가 웃습니다."],
      ["“You’re all mixed up!”", "“완전히 뒤죽박죽이구나!”"],
    ],
    dialogue: [
      ["What are you going to wear today?", "오늘 뭘 입을 거니?"],
      ["I want to wear this black sweater.", "이 검은색 스웨터를 입고 싶어."],
      ["What will go nicely with that?", "그것과 잘 어울리는 건 뭘까?"],
      ["I think I will wear the striped pants, too.", "줄무늬 바지도 입으면 좋을 것 같아."],
    ],
    writing: [
      ["Lily chooses a checkered shirt.", "Lily는 체크무늬 셔츠를 선택한다."],
      ["Then, she picks polka-dot pants.", "그런 다음 그녀는 물방울무늬 바지를 고른다."],
      ["She also puts on a striped scarf.", "그녀는 또한 줄무늬 스카프를 걸친다."],
      ["At breakfast, Mom sees Lily.", "아침 식사 때, 엄마는 Lily를 본다."],
    ],
  },
  8: {
    body: [
      ["Some animals have patterns.", "어떤 동물들은 무늬가 있습니다."],
      ["Is there a reason?", "이유가 있을까요?"],
      ["Yes! These patterns help the animals.", "네! 이 무늬들은 동물들을 도와줍니다."],
      ["Leopards have spots.", "표범은 반점이 있습니다."],
      ["The spots look like light and shadow.", "반점은 빛과 그림자처럼 보입니다."],
      ["They help leopards hide in trees.", "반점은 표범이 나무에 숨는 것을 도와줍니다."],
      ["Then, they can hunt for food.", "그러면 표범은 먹이를 사냥할 수 있습니다."],
      ["Zebras have stripes.", "얼룩말은 줄무늬가 있습니다."],
      ["They help zebras escape from lions.", "줄무늬는 얼룩말이 사자로부터 달아나도록 도와줍니다."],
      ["When zebras see lions, they run together.", "얼룩말은 사자를 보면 함께 달립니다."],
      ["They look like one big animal.", "얼룩말들은 한 마리의 큰 동물처럼 보입니다."],
      ["The lions get confused.", "사자들은 혼란스러워합니다."],
      ["So, the zebras can get away.", "그래서 얼룩말들은 도망칠 수 있습니다."],
    ],
    dialogue: [
      ["Where are all the animals?", "동물들이 모두 어디에 있어요?"],
      ["Right there! See the chameleon with green skin?", "바로 저기요! 초록색 피부를 가진 카멜레온 보이니?"],
      ["It looks just like the trees and leaves!", "나무와 나뭇잎이랑 똑같아 보여요!"],
      ["Yes, it’s hiding.", "응, 숨어 있는 거야."],
    ],
    writing: [
      ["The spots help leopards hide in trees.", "반점은 표범들이 나무에 숨는 데 도움이 됩니다."],
      ["Then, they can hunt for food.", "그러면 그들은 먹이를 사냥할 수 있습니다."],
      ["The lions get confused.", "사자들은 혼란스러워합니다."],
      ["So, the zebras can get away.", "그래서 얼룩말들은 도망칠 수 있습니다."],
    ],
  },
};

export function a3SeedBody(lesson: number): BodyLine[] {
  const s = SEEDS[lessonNo(lesson)];
  if (!s) return [];
  return [
    ...s.body.map(([en, ko]) => ({ en, ko, section: "passage" as const })),
    ...s.dialogue.map(([en, ko]) => ({ en, ko, section: "dialogue" as const })),
  ];
}

export function a3SeedWriting(lesson: number): WritingItem[] {
  return (SEEDS[lessonNo(lesson)]?.writing ?? []).map(([en, ko]) => ({ en, ko }));
}

export const a3Ready = (lesson: number) => a3SeedBody(lesson).length > 0;
