"use client";

import { useEffect, useRef, useState } from "react";
import { DAILY_COIN_CAP, coinsEarnedToday } from "@/lib/pet";
import { loadShop, shopBalance } from "@/lib/shop";
import { SHOP_BY_ID } from "@/lib/shopCatalog";

// 앱 맨 위에서 항상 보이는 코인 지갑(잔액 = 모은 코인 − 쓴 코인). 코인을 받을 때마다 "+N"이 떠오르고,
// 옆에 상점 버튼과 지금 모으는 목표 아이템이 보인다.
export default function CoinWallet({ onOpenShop }: { onOpenShop?: () => void }) {
  const [balance, setBalance] = useState(0);
  const [today, setToday] = useState(0);
  const [goal, setGoal] = useState<string | null>(null);
  const [pop, setPop] = useState<{ n: number; key: number } | null>(null);
  const [pulse, setPulse] = useState(0); // 코인을 실제로 받을 때만 올라가서 금화 팝 효과를 다시 건다
  const keyRef = useRef(0);

  useEffect(() => {
    const read = () => {
      setBalance(shopBalance());
      setToday(coinsEarnedToday());
      setGoal(loadShop().goal);
    };
    read();
    const onCoins = (e: Event) => {
      read();
      const granted = (e as CustomEvent<{ granted?: number }>).detail?.granted ?? 0;
      if (granted > 0) {
        keyRef.current += 1;
        setPop({ n: granted, key: keyRef.current });
        setPulse((p) => p + 1);
        setTimeout(() => setPop((p) => (p && p.key === keyRef.current ? null : p)), 1400);
      }
    };
    window.addEventListener("coins-changed", onCoins);
    window.addEventListener("shop-changed", read);
    window.addEventListener("focus", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("coins-changed", onCoins);
      window.removeEventListener("shop-changed", read);
      window.removeEventListener("focus", read);
      window.removeEventListener("storage", read);
    };
  }, []);

  const goalItem = goal ? SHOP_BY_ID[goal] : null;
  const remain = goalItem ? Math.max(0, goalItem.price - balance) : 0;

  return (
    <>
      {/* 스크롤해도 화면 위쪽에 계속 보이도록 붙여 둔다. 코인을 받으면 실시간으로 숫자가 바뀐다 */}
      <div
        className="sticky top-0 z-30 w-full flex justify-center py-1 bg-white/90 backdrop-blur"
        data-testid="coin-wallet-area"
      >
        <div className="flex items-center justify-center gap-7">
          <div className="relative flex flex-col items-center leading-tight" data-testid="coin-wallet">
            {/* 금화와 숫자는 같은 줄에서 세로 가운데 정렬 */}
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={pulse}
                src="/ho-coin.png"
                alt=""
                className={`w-9 h-9 shrink-0 object-contain ${pulse > 0 ? "ho-coin-pop" : ""}`}
              />
              <span className="text-xl font-extrabold tabular-nums text-black" aria-label={`코인 ${balance}개`}>
                {balance}
              </span>
            </div>
            <span className="text-[11px] text-gray-400">
              오늘 {today}/{DAILY_COIN_CAP}
            </span>
            {pop && (
              <span key={pop.key} className="absolute left-full ml-1 top-0.5 text-sm font-black text-amber-500 pointer-events-none whitespace-nowrap">
                +{pop.n}
              </span>
            )}
          </div>

          {onOpenShop && (
            <button
              type="button"
              onClick={onOpenShop}
              data-testid="open-shop"
              aria-label="상점"
              className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl transition-transform duration-150 active:translate-y-[2px] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#075A80]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ho-shop.png" alt="" className="w-14 h-14 object-contain" />
            </button>
          )}
        </div>
      </div>

      {goalItem && (
        <button
          onClick={onOpenShop}
          className="flex items-center gap-2 rounded-full bg-gray-50 border border-gray-200 pl-1 pr-3 py-1 text-left"
          data-testid="shop-goal"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={goalItem.asset} alt="" className="w-9 h-9 rounded-full object-cover bg-white" />
          <span className="text-xs font-bold text-gray-700">
            {goalItem.name} · {remain > 0 ? `${remain}코인 남았어요` : "지금 살 수 있어요!"}
          </span>
        </button>
      )}
    </>
  );
}
