"use client";

import { useEffect, useRef, useState } from "react";
import { DAILY_COIN_CAP, coinsEarnedToday, loadCoinsTotal } from "@/lib/pet";

// 앱 맨 위에서 항상 보이는 코인 지갑. 코인을 받을 때마다 숫자가 오르고 "+N"이 떠오른다.
export default function CoinWallet() {
  const [total, setTotal] = useState(0);
  const [today, setToday] = useState(0);
  const [pop, setPop] = useState<{ n: number; key: number } | null>(null);
  const keyRef = useRef(0);

  useEffect(() => {
    const read = () => {
      setTotal(loadCoinsTotal());
      setToday(coinsEarnedToday());
    };
    read();
    const onCoins = (e: Event) => {
      read();
      const granted = (e as CustomEvent<{ granted?: number }>).detail?.granted ?? 0;
      if (granted > 0) {
        keyRef.current += 1;
        setPop({ n: granted, key: keyRef.current });
        setTimeout(() => setPop((p) => (p && p.key === keyRef.current ? null : p)), 1400);
      }
    };
    window.addEventListener("coins-changed", onCoins);
    window.addEventListener("focus", read);
    return () => {
      window.removeEventListener("coins-changed", onCoins);
      window.removeEventListener("focus", read);
    };
  }, []);

  const full = today >= DAILY_COIN_CAP;

  return (
    <div className="relative inline-flex items-center gap-2 rounded-full bg-amber-50 border-2 border-amber-200 px-4 py-1.5" data-testid="coin-wallet">
      <span className="text-xl" aria-hidden>
        🪙
      </span>
      <span className="font-bold text-amber-700 text-lg tabular-nums">{total}</span>
      <span className="text-xs text-amber-600">{full ? "오늘은 여기까지!" : `오늘 ${today}/${DAILY_COIN_CAP}`}</span>
      {pop && (
        <span key={pop.key} className="absolute -top-4 right-3 text-sm font-black text-amber-500 animate-bounce">
          +{pop.n}
        </span>
      )}
    </div>
  );
}
