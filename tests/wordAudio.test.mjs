import assert from "node:assert/strict";
import fs from "node:fs";
import { wordAudioUrl, wordAudioSlug } from "../lib/wordAudio.ts";
import { B1_WORDS } from "../lib/lessonDataB1.ts";

// B1 핵심 단어는 모두 녹음 파일이 public/audio 에 있다
for (const ws of Object.values(B1_WORDS)) {
  for (const [en] of ws) {
    const url = wordAudioUrl(en);
    assert.ok(url, `${en} url`);
    assert.ok(fs.existsSync(`public${url}`), `${en} file ${url}`);
  }
}
// 대소문자·앞뒤 공백은 무시, 녹음 없는 단어는 null
assert.equal(wordAudioUrl(" Check On "), "/audio/W_B1_check_on.mp3");
assert.equal(wordAudioSlug("take care of"), "take_care_of");
assert.equal(wordAudioUrl("zebra"), null);
assert.equal(wordAudioUrl(""), null);
// manifest의 id와 파일 규칙이 같다(voice-pack은 로컬 작업 폴더라 저장소에 없으면 건너뛴다)
const MANIFEST = "voice-pack/b1/manifest_words.json";
if (fs.existsSync(MANIFEST)) {
  const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  for (const it of m.items) assert.equal(wordAudioUrl(it.text), `/audio/${it.id}.mp3`, it.text);
}
console.log("wordAudio ok");
