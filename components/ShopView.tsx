"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DecoratedPet from "./DecoratedPet";
import { CoinAmount } from "./Coin";
import { SHOP_BY_ID, SHOP_ITEMS, SHOP_SLOT_LABEL, type ShopItem, type ShopSlot } from "@/lib/shopCatalog";
import { CHAPTER_SPECIES, VOCAB_SPECIES, MAX_STAGE, loadPet, type PetState, type PetTrack } from "@/lib/pet";
import { buyItem, equipItem, friendKey, loadShop, refreshShopFromServer, setGoal, shopBalance, type Equipped } from "@/lib/shop";
import { autoPush } from "@/lib/sync";

export type Friend = { track: PetTrack; generation: number };
type Filter = "all" | ShopSlot;

const TRACK_LABEL: Record<PetTrack, string> = { chapter: "챕터·청크북", vocab: "단어장" };

// 상점에는 지금 키우는 친구(챕터·청크북, 단어장 각 1명)만 보여 준다. 예전에 졸업한 친구는 도감에서 "꾸미기"를 눌러
// 들어왔을 때(extra)만 그 친구를 함께 보여 준다. 성장 단계가 바뀌어도 같은 친구로 본다.
function listFriends(extra: Friend | null): { friend: Friend; key: string; pet: PetState; name: string; graduated: boolean }[] {
  const out: { friend: Friend; key: string; pet: PetState; name: string; graduated: boolean }[] = [];
  (["chapter", "vocab"] as PetTrack[]).forEach((track) => {
    const species = track === "vocab" ? VOCAB_SPECIES : CHAPTER_SPECIES;
    const cur = loadPet(track);
    species.forEach((sp, i) => {
      const gen = i + 1;
      if (cur.generation < gen) return;
      const graduated = cur.generation > gen;
      if (graduated && !(extra && extra.track === track && extra.generation === gen)) return; // 예전 친구는 도감에서 들어온 경우에만
      const pet: PetState = graduated ? { stage: MAX_STAGE, generation: gen } : { stage: cur.stage, generation: gen };
      out.push({
        friend: { track, generation: gen },
        key: friendKey(track, gen),
        pet,
        name: sp.stages[MAX_STAGE - 1].name.replace("완벽한 성체 ", ""),
        graduated,
      });
    });
  });
  return out;
}

export default function ShopView({ initialFriend, onClose }: { initialFriend?: Friend | null; onClose: () => void }) {
  const [tick, setTick] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [focus, setFocus] = useState<string | null>(null); // 눌러서 보고 있는 상품
  const [preview, setPreview] = useState<Partial<Record<ShopSlot, string | null>>>({}); // 저장 전 미리보기
  const [buying, setBuying] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "warn" } | null>(null);
  const [sparkle, setSparkle] = useState(0);
  const [bubble, setBubble] = useState<string | null>(null);
  const [justBought, setJustBought] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const friends = useMemo(() => listFriends(initialFriend ?? null), [tick, initialFriend]); // eslint-disable-line react-hooks/exhaustive-deps
  const state = useMemo(() => loadShop(), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const balance = useMemo(() => shopBalance(), [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener("shop-changed", bump);
    window.addEventListener("coins-changed", bump);
    // 다른 기기에서 산 것과 쓴 코인을 반영
    refreshShopFromServer().then(bump);
    const ts = timers.current;
    return () => {
      window.removeEventListener("shop-changed", bump);
      window.removeEventListener("coins-changed", bump);
      ts.forEach(clearTimeout);
    };
  }, []);

  // 처음 열 때 친구 선택: 도감에서 눌렀으면 그 친구, 아니면 첫 번째 친구
  useEffect(() => {
    if (selectedKey || friends.length === 0) return;
    const want = initialFriend ? friendKey(initialFriend.track, initialFriend.generation) : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 저장소에서 읽은 친구 목록으로 처음 한 번만 고른다
    setSelectedKey(friends.find((f) => f.key === want)?.key ?? friends[0].key);
  }, [friends, initialFriend, selectedKey]);

  const current = friends.find((f) => f.key === selectedKey) ?? null;
  const saved: Equipped = useMemo(() => (current ? state.equipped[current.key] ?? {} : {}), [current, state]);

  // 화면에 그릴 장착 = 저장된 장착 + 아직 저장하지 않은 미리보기
  const shown: Equipped = useMemo(() => {
    const e: Equipped = { ...saved };
    (Object.keys(preview) as ShopSlot[]).forEach((slot) => {
      const id = preview[slot];
      if (id) e[slot] = id;
      else delete e[slot];
    });
    return e;
  }, [saved, preview]);
  const previewing = Object.keys(preview).length > 0;

  const flash = useCallback((text: string, tone: "ok" | "warn" = "ok") => {
    setMessage({ text, tone });
    const t = setTimeout(() => setMessage(null), 3500);
    timers.current.push(t);
  }, []);

  function selectFriend(key: string) {
    setSelectedKey(key);
    setPreview({}); // 친구를 바꾸면 미리보기는 취소
    setFocus(null);
    setJustBought(null);
  }

  function tapItem(item: ShopItem) {
    setFocus(item.id);
    setJustBought(null);
    setBubble(null);
    // 무료 미리보기: 실제 장착에는 영향이 없다
    setPreview((p) => ({ ...p, [item.slot]: item.id }));
  }

  function cancelPreview() {
    setPreview({});
    setFocus(null);
  }

  function equip(item: ShopItem) {
    if (!current) return;
    equipItem(current.key, item.slot, item.id);
    setPreview((p) => {
      const n = { ...p };
      delete n[item.slot];
      return n;
    });
    setJustBought(null);
    setBubble(null);
    autoPush();
    flash(`${current.name}에게 ${item.name}을(를) 꾸며 줬어요!`);
  }

  function unequip(slot: ShopSlot) {
    if (!current) return;
    equipItem(current.key, slot, null);
    setPreview((p) => {
      const n = { ...p };
      delete n[slot];
      return n;
    });
    autoPush();
  }

  async function buy(item: ShopItem) {
    if (buying) return;
    setBuying(true);
    const r = await buyItem(item.id);
    setBuying(false);
    setTick((t) => t + 1);
    if (r.ok) {
      setJustBought(item.id);
      setSparkle((n) => n + 1);
      setBubble(Math.random() < 0.5 ? "호야, 나 멋있어졌지?" : "우리가 모은 코인으로 샀어!");
      const t = setTimeout(() => setSparkle(0), 900);
      timers.current.push(t);
      autoPush();
    } else {
      flash(r.message, "warn");
    }
  }

  const goalId = state.goal;
  const items = SHOP_ITEMS.filter((i) => filter === "all" || i.slot === filter);
  const focusItem = focus ? SHOP_BY_ID[focus] : null;
  const owned = (id: string) => state.owned.includes(id);

  return (
    <div className="w-full max-w-4xl flex flex-col gap-4" data-testid="shop-view">
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="min-h-[44px] text-sm text-gray-500 underline">
          ← 돌아가기
        </button>
        <h2 className="text-xl font-bold text-gray-800">친구 꾸미기 상점</h2>
        <span className="w-16" aria-hidden />
      </div>

      {friends.length === 0 ? (
        <p className="text-sm text-gray-500">아직 만난 친구가 없어요.</p>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="꾸밀 친구 고르기">
            {friends.map((f) => (
              <button
                key={f.key}
                role="tab"
                aria-selected={f.key === selectedKey}
                onClick={() => selectFriend(f.key)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition active:scale-95 ${
                  f.key === selectedKey ? "bg-sky-600 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                {f.name} <span className="opacity-70 text-xs">· {TRACK_LABEL[f.friend.track]}{f.graduated ? " · 졸업" : ""}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
            {/* 큰 미리보기 */}
            <div className="lg:w-1/2 flex flex-col gap-2">
              <div className="relative">
                {current && (
                  <DecoratedPet pet={current.pet} track={current.friend.track} equipped={shown} alt={`${current.name} 미리보기`} forceScene className="w-full" />
                )}
                {sparkle > 0 && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={sparkle} src="/shop/star_sparkle.png" alt="" className="ho-shop-sparkle absolute inset-0 w-full h-full object-contain pointer-events-none" />
                )}
                {bubble && (
                  <div className="absolute left-3 top-3 max-w-[70%] rounded-2xl bg-white/95 border-2 border-sky-200 px-3 py-1.5 text-sm font-bold text-gray-700 shadow">
                    {bubble}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {previewing && (
                  <button onClick={cancelPreview} className="min-h-[44px] px-4 rounded-full bg-gray-100 text-gray-700 text-sm font-bold">
                    미리보기 취소
                  </button>
                )}
                {(Object.keys(saved) as ShopSlot[]).map((slot) => (
                  <button key={slot} onClick={() => unequip(slot)} className="min-h-[44px] px-4 rounded-full bg-white border-2 border-gray-200 text-gray-600 text-sm font-bold">
                    {SHOP_SLOT_LABEL[slot]} 해제
                  </button>
                ))}
              </div>
              {previewing && <p className="text-xs text-gray-400">지금은 미리보기예요. 사거나 장착하기 전에는 저장되지 않아요.</p>}
            </div>

            {/* 상품 */}
            <div className="lg:w-1/2 flex flex-col gap-3">
              <div className="flex gap-2" role="tablist" aria-label="상품 종류">
                {(["all", "prop", "background", "effect"] as Filter[]).map((f) => (
                  <button
                    key={f}
                    role="tab"
                    aria-selected={filter === f}
                    onClick={() => setFilter(f)}
                    className={`flex-1 min-h-[44px] rounded-full text-sm font-bold transition ${filter === f ? "bg-sky-600 text-white" : "bg-gray-100 text-gray-600"}`}
                  >
                    {f === "all" ? "전체" : SHOP_SLOT_LABEL[f]}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2" data-testid="shop-grid">
                {items.map((item) => {
                  const isOwned = owned(item.id);
                  const equippedHere = saved[item.slot] === item.id;
                  const isFocus = focus === item.id;
                  const isGoal = goalId === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => tapItem(item)}
                      aria-pressed={isFocus}
                      data-testid={`shop-item-${item.id}`}
                      className={`relative flex flex-col items-center gap-1 rounded-2xl p-2 text-center transition active:scale-95 min-h-[44px] ${
                        isFocus ? "bg-sky-50 border-2 border-sky-500" : item.rare ? "bg-violet-50 border-2 border-violet-300" : "bg-gray-50 border-2 border-transparent"
                      }`}
                    >
                      {item.rare && <span className="absolute top-1 left-1 text-[10px] font-bold text-violet-700 bg-violet-100 rounded-full px-1.5">레어</span>}
                      {item.isNew && !isGoal && <span className="absolute top-1 right-1 text-[10px] font-bold text-white bg-sky-600 rounded-full px-1.5" data-testid={`shop-new-${item.id}`}>NEW</span>}
                      {isGoal && <span className="absolute top-1 right-1 text-[10px] font-bold text-amber-700 bg-amber-100 rounded-full px-1.5">목표</span>}
                      <div className="w-full aspect-square rounded-xl overflow-hidden flex items-center justify-center bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.asset} alt={item.name} loading="lazy" className={`w-full h-full ${item.slot === "background" ? "object-cover" : "object-contain"}`} />
                      </div>
                      <span className="text-xs font-bold text-gray-800 leading-tight">{item.name}</span>
                      <span className="text-xs text-gray-500">
                        {equippedHere ? "장착 중" : isOwned ? "보유 중" : <CoinAmount amount={item.price} size={14} />}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* 선택한 상품 */}
              {focusItem && (
                <div className="rounded-2xl bg-gray-50 p-4 flex flex-col gap-2" data-testid="shop-detail">
                  <div className="flex items-baseline justify-between">
                    <p className="font-bold text-gray-800">
                      {focusItem.name} <span className="text-xs text-gray-400">· {SHOP_SLOT_LABEL[focusItem.slot]}</span>
                    </p>
                    <CoinAmount amount={focusItem.price} size={20} className="font-bold text-amber-700" />
                  </div>

                  {owned(focusItem.id) ? (
                    <div className="flex gap-2 flex-wrap">
                      {saved[focusItem.slot] === focusItem.id ? (
                        <button onClick={() => unequip(focusItem.slot)} className="min-h-[48px] px-5 rounded-full bg-gray-200 text-gray-700 font-bold">
                          해제하기
                        </button>
                      ) : (
                        <button onClick={() => equip(focusItem)} className="min-h-[48px] px-5 rounded-full bg-sky-600 text-white font-bold active:scale-95 transition">
                          {justBought === focusItem.id ? "친구에게 꾸며주기" : "장착하기"}
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-500 flex items-center gap-1">내 코인 <CoinAmount amount={balance} size={16} /></p>
                      <button
                        onClick={() => buy(focusItem)}
                        disabled={buying || balance < focusItem.price}
                        className="min-h-[48px] px-5 rounded-full bg-amber-500 text-white font-bold disabled:opacity-40 active:scale-95 transition"
                      >
                        {buying ? "구매하는 중..." : `${focusItem.price}코인으로 구매`}
                      </button>
                      {balance < focusItem.price && (
                        <p className="text-sm font-bold text-amber-700">{focusItem.price - balance}코인 더 모으면 살 수 있어요</p>
                      )}
                      <button
                        onClick={() => {
                          setGoal(goalId === focusItem.id ? null : focusItem.id);
                          autoPush();
                        }}
                        className="min-h-[44px] px-4 rounded-full bg-white border-2 border-amber-200 text-amber-700 text-sm font-bold self-start"
                      >
                        {goalId === focusItem.id ? "모으는 중 (누르면 취소)" : "이걸 모으는 중으로 정하기"}
                      </button>
                    </>
                  )}
                </div>
              )}

              {message && (
                <p className={`text-sm font-bold ${message.tone === "warn" ? "text-red-600" : "text-sky-700"}`} role="status">
                  {message.text}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
