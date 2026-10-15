// 서버에서 받은 단어장과 이 기기의 단어장을 합친다. 세트 목록과 단어 구성은 서버를 따르되,
// 단어별 학습 기록(상자·다음 복습일·오답 수)은 더 최근에 학습한 쪽을 쓴다.
// 오늘 학습한 기록이 오래된 서버 값으로 되돌아가 사라지는 것을 막는다.
import type { VocabSet, VocabWord } from "./types";

function newerWord(local: VocabWord, server: VocabWord): VocabWord {
  // 학습할 때마다 다음 복습일(nextDueAt)이 새로 정해지므로, 더 늦은 쪽이 더 최근 학습이다. 같으면 상자가 높은 쪽.
  if (local.nextDueAt !== server.nextDueAt) return local.nextDueAt > server.nextDueAt ? { ...server, box: local.box, nextDueAt: local.nextDueAt, wrongCount: local.wrongCount } : server;
  if (local.box !== server.box) return local.box > server.box ? { ...server, box: local.box, wrongCount: local.wrongCount } : server;
  return server;
}

export function mergeVocabSets(local: VocabSet[], server: VocabSet[]): VocabSet[] {
  const localById = new Map(local.map((s) => [s.id, s]));
  return server.map((ss) => {
    const ls = localById.get(ss.id);
    if (!ls) return ss;
    const lw = new Map(ls.words.map((w) => [w.id, w]));
    return { ...ss, words: ss.words.map((w) => (lw.has(w.id) ? newerWord(lw.get(w.id) as VocabWord, w) : w)) };
  });
}
