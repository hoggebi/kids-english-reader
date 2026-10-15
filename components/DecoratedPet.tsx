"use client";

import { LAYOUT, PROP_OVERRIDE, SCENE_ASPECT, SHOP_BY_ID } from "@/lib/shopCatalog";
import { getPetImagePath, getSpecies, type PetState, type PetTrack } from "@/lib/pet";
import type { Equipped } from "@/lib/shop";

// 배경(z0) → 효과(z1) → 원본 친구(z2) → 옆 소품(z3). 모두 컨테이너 비율로 배치하고 클릭은 막는다.
export default function DecoratedPet({
  pet,
  track,
  equipped,
  alt,
  className = "",
  still = false,
  forceScene = false,
}: {
  pet: PetState;
  track: PetTrack;
  equipped: Equipped;
  alt: string;
  className?: string;
  still?: boolean; // 학습 중처럼 움직임을 멈춰야 할 때
  forceScene?: boolean; // 장착이 없어도 장면 비율 상자로 그린다
}) {
  const bg = equipped.background ? SHOP_BY_ID[equipped.background] : null;
  const fx = equipped.effect ? SHOP_BY_ID[equipped.effect] : null;
  const prop = equipped.prop ? SHOP_BY_ID[equipped.prop] : null;
  const prefix = getSpecies(pet.generation, track).imagePrefix;
  const f = LAYOUT.friend;
  const p = prop && (prop.animation === "float" ? LAYOUT.tallProp : LAYOUT.prop);
  const po = PROP_OVERRIDE[prefix];
  const e = LAYOUT.effect;

  if (!bg && !fx && !prop && !forceScene) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={getPetImagePath(pet, track)} alt={alt} className={className} />;
  }

  const box = (c: { x: number; y: number; w: number; h: number }, ox?: { x: number; y: number }) => ({
    position: "absolute" as const,
    left: `${((ox?.x ?? c.x) - c.w / 2) * 100}%`,
    top: `${((ox?.y ?? c.y) - c.h / 2) * 100}%`,
    width: `${c.w * 100}%`,
    height: `${c.h * 100}%`,
    objectFit: "contain" as const,
    pointerEvents: "none" as const,
  });

  const anim = (a: string) => (still ? "" : a === "float" ? "ho-shop-float" : a === "pulse" ? "ho-shop-pulse" : "");

  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{ aspectRatio: String(SCENE_ASPECT) }}
      data-testid="decorated-pet"
    >
      {bg && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bg.asset} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none", zIndex: 0 }} />
      )}
      {fx && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fx.asset} alt="" className={anim(fx.animation)} style={{ ...box(e), opacity: 0.8, zIndex: 1 }} />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={getPetImagePath(pet, track)} alt={alt} style={{ ...box(f), zIndex: 2 }} />
      {prop && p && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={prop.asset} alt="" className={anim(prop.animation)} style={{ ...box(p, po && prop.animation !== "float" ? po : undefined), zIndex: 3 }} />
      )}
    </div>
  );
}
