import assert from "node:assert/strict";
import fs from "node:fs";
import { b1SeedBody } from "../lib/chunkbookB1.ts";

// B1 문장 음성: 모든 본문·대화 줄이 음성 조각으로 이어지고, 조각 글을 이으면 그 줄과 같다(앱의 voiceIdsFor와 같은 비교).
const pm = JSON.parse(fs.readFileSync("public/voice-pack/manifest.json", "utf8"));
const am = JSON.parse(fs.readFileSync("public/voice-pack/audio-map.json", "utf8"));
const items = new Map(pm.items.map((it) => [it.id, it]));
const norm = (s) => s.replace(/[“”"‘’']/g, "").replace(/\s+/g, " ").trim().toLowerCase();
let n = 0;
for (let l = 201; l <= 208; l++) {
  const body = b1SeedBody(l);
  for (const section of ["passage", "dialogue"]) {
    body.filter((b) => b.section === section).forEach((b, i) => {
      const key = `L${l}_${section === "dialogue" ? "dialogue" : "body"}_${String(i + 1).padStart(2, "0")}`;
      const ids = am.sentences[key];
      assert.ok(ids && ids.length > 0, `${key} missing`);
      for (const id of ids) {
        const it = items.get(id);
        assert.ok(it, `${id} not in manifest`);
        assert.equal(it.audioUrl, `/audio/${id}.mp3`);
        assert.ok(fs.existsSync(`public${it.audioUrl}`), `${id} file`);
        n++;
      }
      assert.equal(norm(ids.map((id) => items.get(id).text).join(" ")), norm(b.en), key);
    });
  }
}
assert.equal(n, 145);
console.log("voicePackB1 ok");
