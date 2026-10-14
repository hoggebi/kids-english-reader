// 앱 전체에서 코인을 같은 모양(금화 이미지)으로 보여주기 위한 공통 조각들.
// 이모지 대신 항상 /ho-coin.png를 쓴다.

export function CoinIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/ho-coin.png"
      alt=""
      width={size}
      height={size}
      className={`inline-block shrink-0 object-contain align-middle ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

// 금화 + 숫자(앞에 "+" 같은 기호 가능). 이미지와 숫자는 세로 가운데 정렬.
export function CoinAmount({
  amount,
  prefix = "",
  size = 20,
  className = "",
}: {
  amount: number;
  prefix?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${className}`}>
      <CoinIcon size={size} />
      <span>
        {prefix}
        {amount}
      </span>
    </span>
  );
}

// 문장 안의 🪙 기호를 금화 이미지로 바꿔서 보여준다(응원 말풍선 등).
export function CoinText({ text }: { text: string }) {
  const parts = text.split("🪙");
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <CoinIcon size={16} className="mx-0.5" />}
          {p}
        </span>
      ))}
    </>
  );
}
