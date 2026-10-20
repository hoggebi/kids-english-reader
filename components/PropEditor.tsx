"use client";

import { useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { SCALE_MAX, SCALE_MIN, clampPlacement, movePlacement, pointToCanvas, scalePlacement, type Placement } from "@/lib/placement";

// 소품 위치 편집 표시(편집 중에만 그려진다). 미리보기 캔버스 위에 덮이는 투명 레이어이고,
// 좌표는 항상 캔버스의 실제 영역(getBoundingClientRect) 기준 0~1이라 기기·화면 크기와 무관하다.
// 소품 상자와 크기 핸들에만 touch-action:none을 줘서 화면 스크롤은 막지 않는다.
export function PropEditOverlay({ value, onChange, label }: { value: Placement; onChange: (p: Placement) => void; label: string }) {
  const layerRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value; // eslint-disable-line react-hooks/refs -- 드래그 중 최신 값을 읽기 위한 사본
  const drag = useRef<{ id: number; offX: number; offY: number } | null>(null);
  const resize = useRef<{ id: number; startDist: number; startScale: number } | null>(null);

  const rect = () => layerRef.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 1, height: 1 };

  function down(e: ReactPointerEvent<HTMLDivElement>) {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (drag.current || resize.current) return; // 두 번째 손가락은 무시
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const pt = pointToCanvas(e.clientX, e.clientY, rect());
    // 손가락과 소품 중심의 차이를 유지해서, 누르는 순간 소품이 중앙으로 튀지 않게 한다.
    drag.current = { id: e.pointerId, offX: valueRef.current.x - pt.x, offY: valueRef.current.y - pt.y };
  }
  function move(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const pt = pointToCanvas(e.clientX, e.clientY, rect());
    onChange(clampPlacement({ ...valueRef.current, x: pt.x + d.offX, y: pt.y + d.offY }));
  }
  function end(e: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current?.id === e.pointerId) drag.current = null;
  }

  function hDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (drag.current || resize.current) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const r = rect();
    const v = valueRef.current;
    const cx = r.left + v.x * r.width;
    const cy = r.top + v.y * r.height;
    resize.current = { id: e.pointerId, startDist: Math.max(8, Math.hypot(e.clientX - cx, e.clientY - cy)), startScale: v.scale };
  }
  function hMove(e: ReactPointerEvent<HTMLDivElement>) {
    const s = resize.current;
    if (!s || s.id !== e.pointerId) return;
    const r = rect();
    const v = valueRef.current;
    const dist = Math.hypot(e.clientX - (r.left + v.x * r.width), e.clientY - (r.top + v.y * r.height));
    onChange(clampPlacement({ ...v, scale: s.startScale * (dist / s.startDist) }));
  }
  function hEnd(e: ReactPointerEvent<HTMLDivElement>) {
    if (resize.current?.id === e.pointerId) resize.current = null;
  }

  function key(e: ReactKeyboardEvent<HTMLDivElement>) {
    const big = e.shiftKey ? 0.05 : 0.01;
    const v = valueRef.current;
    if (e.key === "ArrowLeft") onChange(movePlacement(v, -big, 0));
    else if (e.key === "ArrowRight") onChange(movePlacement(v, big, 0));
    else if (e.key === "ArrowUp") onChange(movePlacement(v, 0, -big));
    else if (e.key === "ArrowDown") onChange(movePlacement(v, 0, big));
    else if (e.key === "+" || e.key === "=") onChange(scalePlacement(v, 1.06));
    else if (e.key === "-" || e.key === "_") onChange(scalePlacement(v, 1 / 1.06));
    else return;
    e.preventDefault();
  }

  return (
    <div ref={layerRef} className="absolute inset-0" style={{ zIndex: 20, pointerEvents: "none" }} data-testid="prop-edit-layer">
      <div
        role="button"
        tabIndex={0}
        aria-label={`${label} 위치 바꾸기. 끌어서 옮기고, 화살표 키로 조금씩 움직여요.`}
        data-testid="prop-edit-box"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
        onKeyDown={key}
        style={{
          position: "absolute",
          left: `${value.x * 100}%`,
          top: `${value.y * 100}%`,
          width: `${value.scale * 100}%`,
          aspectRatio: "1 / 1",
          minWidth: 44,
          minHeight: 44,
          transform: "translate(-50%, -50%)",
          border: "3px dashed #0284c7",
          borderRadius: 14,
          background: "rgba(2,132,199,0.08)",
          boxShadow: "0 0 0 2px rgba(255,255,255,0.8)",
          touchAction: "none",
          cursor: "grab",
          pointerEvents: "auto",
          outlineOffset: 3,
        }}
      >
        {/* 크기 핸들(눌러서 끌면 크기가 바뀐다). 손가락 영역은 44px */}
        <div
          data-testid="prop-edit-handle"
          aria-hidden
          onPointerDown={hDown}
          onPointerMove={hMove}
          onPointerUp={hEnd}
          onPointerCancel={hEnd}
          onLostPointerCapture={hEnd}
          style={{ position: "absolute", right: -22, bottom: -22, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none", cursor: "nwse-resize" }}
        >
          <span style={{ width: 22, height: 22, borderRadius: 999, background: "#0284c7", border: "3px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,.35)" }} />
        </div>
      </div>
    </div>
  );
}

// 편집 중에만 보이는 버튼들: 크기 −/+, 앞으로/뒤로, 기본 위치, 취소, 저장.
export function PropEditControls({
  value,
  onChange,
  onDefault,
  onCancel,
  onSave,
  dirty,
  saveLabel = "저장",
  note,
}: {
  value: Placement;
  onChange: (p: Placement) => void;
  onDefault: () => void;
  onCancel: () => void;
  onSave: () => void;
  dirty: boolean;
  saveLabel?: string;
  note?: string;
}) {
  const btn = "min-h-[44px] px-4 rounded-full bg-white border-2 border-gray-200 text-gray-700 text-sm font-bold active:scale-95 transition disabled:opacity-40";
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-sky-50 border-2 border-sky-200 p-3" data-testid="prop-edit-controls">
      <p className="text-sm font-bold text-sky-800">소품을 손가락으로 끌어서 옮기고 크기도 바꿔 보세요. {saveLabel}을 눌러야 적용돼요.</p>
      {note && <p className="text-xs text-sky-700">{note}</p>}
      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={() => onChange(scalePlacement(value, 1 / 1.12))} disabled={value.scale <= SCALE_MIN + 1e-6} className={btn} aria-label="소품 작게">
          크기 −
        </button>
        <button onClick={() => onChange(scalePlacement(value, 1.12))} disabled={value.scale >= SCALE_MAX - 1e-6} className={btn} aria-label="소품 크게">
          크기 +
        </button>
        <button onClick={() => onChange({ ...value, layer: "front" })} aria-pressed={value.layer === "front"} className={`${btn} ${value.layer === "front" ? "!border-sky-500 !text-sky-700" : ""}`}>
          앞으로
        </button>
        <button onClick={() => onChange({ ...value, layer: "back" })} aria-pressed={value.layer === "back"} className={`${btn} ${value.layer === "back" ? "!border-sky-500 !text-sky-700" : ""}`}>
          뒤로
        </button>
        <button onClick={onDefault} className={btn}>
          기본 위치
        </button>
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 min-h-[48px] rounded-full bg-gray-100 text-gray-700 font-bold active:scale-95 transition">
          취소
        </button>
        <button onClick={onSave} disabled={!dirty} className="flex-1 min-h-[48px] rounded-full bg-sky-600 text-white font-bold disabled:opacity-40 active:scale-95 transition">
          {saveLabel}
        </button>
      </div>
    </div>
  );
}
