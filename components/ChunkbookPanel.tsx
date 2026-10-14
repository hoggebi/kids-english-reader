"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ChunkLessonView from "./ChunkLessonView";
import {
  type ChunkbookMeta,
  classifyPages,
  deletePdf,
  destroyPdf,
  formatBytes,
  getPdf,
  hasPdf,
  lessonsFromRanges,
  openPdf,
  putPdf,
  readLabels,
  renderPageUrl,
  requestPersistence,
  storageEstimate,
} from "@/lib/chunkbook";
import { BUILTIN_BOOK, builtinPageUrl } from "@/lib/chunkbookBuiltin";

type PdfDoc = Awaited<ReturnType<typeof openPdf>>;

// 썸네일 렌더는 동시에 2개까지만 (큰 스캔 페이지를 한꺼번에 디코딩하지 않도록)
let active = 0;
const waiting: (() => void)[] = [];
async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 2) await new Promise<void>((r) => waiting.push(r));
  active += 1;
  try {
    return await fn();
  } finally {
    active -= 1;
    waiting.shift()?.();
  }
}

function PageThumb({ doc, docKey, page, label, onOpen }: { doc: PdfDoc; docKey: string; page: number; label: string; onOpen: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    let created: string | null = null;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        void limited(() => renderPageUrl(doc, page, 360))
          .then((u) => {
            if (cancelled) {
              URL.revokeObjectURL(u);
              return;
            }
            created = u;
            setUrl(u);
          })
          .catch(() => {
            if (!cancelled) setFailed(true);
          });
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
      if (created) URL.revokeObjectURL(created);
    };
  }, [doc, docKey, page]);

  return (
    <button
      ref={ref}
      onClick={onOpen}
      className="flex flex-col items-center gap-1 rounded-xl border-2 border-gray-200 bg-white p-2 active:scale-95 transition min-h-[44px]"
      aria-label={`${label} 미리보기 열기`}
    >
      <div className="w-full aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`${label} 미리보기`} className="w-full h-full object-contain" />
        ) : (
          <span className="text-xs text-gray-400">{failed ? "불러오기 실패" : "불러오는 중…"}</span>
        )}
      </div>
      <span className="text-xs font-bold text-gray-700">{label}</span>
    </button>
  );
}

function BuiltinThumb({ page, label, onOpen }: { page: number; label: string; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex flex-col items-center gap-1 rounded-xl border-2 border-gray-200 bg-white p-2 active:scale-95 transition min-h-[44px]"
      aria-label={`${label} 미리보기 열기`}
    >
      <div className="w-full aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={builtinPageUrl(page)} alt={`${label} 미리보기`} loading="lazy" className="w-full h-full object-contain" />
      </div>
      <span className="text-xs font-bold text-gray-700">{label}</span>
    </button>
  );
}

function PageViewer({
  doc,
  directUrl,
  items,
  index,
  total,
  onIndex,
  onClose,
}: {
  doc: PdfDoc | null;
  directUrl?: (page: number) => string;
  items: { page: number; label: string }[];
  index: number;
  total: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const item = items[index];
  const [badUrl, setBadUrl] = useState<string | null>(null);
  const directSrc = directUrl ? directUrl(item.page) : null;
  const shownUrl = directSrc ?? url;
  const shownFailed = directSrc ? badUrl === directSrc : failed;

  useEffect(() => {
    if (directUrl || !doc) return;
    let cancelled = false;
    let created: string | null = null;
    // 화면 폭에 맞춘 큰 미리보기 (너무 크지 않게 상한)
    const w = Math.min(1400, Math.round(window.innerWidth * (window.devicePixelRatio || 1)));
    void limited(() => renderPageUrl(doc, item.page, w, 0.85))
      .then((u) => {
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        created = u;
        setUrl(u);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [doc, directUrl, item.page]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      else if (e.key === "ArrowRight" && index < items.length - 1) onIndex(index + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, onClose, onIndex]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col" role="dialog" aria-modal="true" aria-label={`${item.label} 미리보기`}>
      <div className="flex items-center justify-between gap-2 p-3 text-white">
        <p className="font-bold">
          {item.label} <span className="text-white/60 text-sm">(PDF {item.page} / {total}쪽)</span>
        </p>
        <button onClick={onClose} className="min-h-[44px] min-w-[44px] px-4 rounded-full bg-white/20 font-bold">
          닫기
        </button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center px-2">
        {shownUrl && !shownFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shownUrl}
            alt={`${item.label} 페이지`}
            onError={() => setBadUrl(shownUrl)}
            className="max-w-full max-h-full object-contain bg-white"
          />
        ) : (
          <p className="text-white/80">{shownFailed ? "페이지를 불러오지 못했어요." : "불러오는 중…"}</p>
        )}
      </div>
      <div className="flex items-center justify-center gap-3 p-3">
        <button
          onClick={() => onIndex(index - 1)}
          disabled={index <= 0}
          className="min-h-[48px] px-6 rounded-full bg-white text-gray-800 font-bold disabled:opacity-40"
        >
          ◀ 이전
        </button>
        <button
          onClick={() => onIndex(index + 1)}
          disabled={index >= items.length - 1}
          className="min-h-[48px] px-6 rounded-full bg-white text-gray-800 font-bold disabled:opacity-40"
        >
          다음 ▶
        </button>
      </div>
    </div>
  );
}

type ImportState =
  | { phase: "idle" }
  | { phase: "working"; message: string }
  | { phase: "error"; message: string };

export default function ChunkbookPanel({
  books,
  onChange,
  onOpenVocab,
}: {
  books: ChunkbookMeta[];
  onChange: (books: ChunkbookMeta[]) => void;
  onOpenVocab?: (lesson: number) => void;
}) {
  // 앱에 내장된 청크북이 기본이다. 이 기기에 직접 가져온 PDF가 실제로 있을 때만 그 교재를 대신 보여준다.
  const custom = books.find((b) => !b.builtin) ?? null;
  const [customCheck, setCustomCheck] = useState<{ id: string; ok: boolean } | null>(null);
  const customReady: "checking" | "yes" | "no" = !custom ? "no" : customCheck?.id === custom.id ? (customCheck.ok ? "yes" : "no") : "checking";
  const book: ChunkbookMeta = custom && customReady === "yes" ? custom : BUILTIN_BOOK;
  const [imp, setImp] = useState<ImportState>({ phase: "idle" });
  const [docState, setDoc] = useState<PdfDoc | null>(null);
  const [fileStateRaw, setFileState] = useState<"checking" | "ok" | "missing">("checking");
  const [selected, setSelected] = useState<number | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ lesson: number; start: number; end: number }[] | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const docRef = useRef<PdfDoc | null>(null);
  const importingRef = useRef(false);

  const bookId = book.id;
  const isBuiltin = !!book.builtin;
  // 내장 교재는 PDF 없이 정적 이미지로 보여 주므로 항상 열려 있는 상태다.
  const doc = isBuiltin ? null : docState;
  const fileState: "checking" | "ok" | "missing" = isBuiltin ? "ok" : fileStateRaw;

  // 직접 가져온 교재의 PDF가 이 기기에 있는지 확인한다(없으면 내장 교재를 보여준다).
  useEffect(() => {
    if (!custom) return;
    let cancelled = false;
    const id = custom.id;
    hasPdf(id)
      .then((ok) => !cancelled && setCustomCheck({ id, ok }))
      .catch(() => !cancelled && setCustomCheck({ id, ok: false }));
    return () => {
      cancelled = true;
    };
  }, [custom?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 새로고침 후에도 저장된 PDF를 다시 열 수 있는지 확인하고 문서를 연다.
  useEffect(() => {
    if (isBuiltin) {
      // 내장 교재는 정적 이미지라 PDF를 열 필요가 없다.
      destroyPdf(docRef.current);
      docRef.current = null;
      return;
    }
    let cancelled = false;
    void (async () => {
      if (importingRef.current) return; // 방금 가져온 문서는 가져오기 쪽에서 이미 연다
      try {
        const blob = await getPdf(bookId);
        if (cancelled) return;
        if (!blob) {
          setFileState("missing");
          return;
        }
        const d = await openPdf(blob);
        if (cancelled) {
          destroyPdf(d);
          return;
        }
        destroyPdf(docRef.current);
        docRef.current = d;
        setDoc(d);
        setFileState("ok");
      } catch {
        if (!cancelled) setFileState("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId, isBuiltin]);

  useEffect(() => {
    return () => {
      void destroyPdf(docRef.current);
    };
  }, []);

  const lessonList = book?.lessons ?? [];
  const current = lessonList.find((l) => l.lesson === selected) ?? null;
  const viewerItems = useMemo(
    () => (current ? current.pages.map((p, i) => ({ page: p, label: current.labels[i] ?? `p.${p}` })) : []),
    [current],
  );

  async function handleFile(file: File) {
    if (importingRef.current) return;
    if (!/pdf$/i.test(file.name) && file.type !== "application/pdf") {
      setImp({ phase: "error", message: "PDF 파일만 가져올 수 있어요." });
      return;
    }
    importingRef.current = true;
    try {
      setImp({ phase: "working", message: `파일을 확인하는 중… (${formatBytes(file.size)})` });
      const est = await storageEstimate();
      if (est && est.quota - est.usage < file.size * 1.1) {
        throw new Error(
          `이 기기의 저장 공간이 부족해요. (필요 ${formatBytes(file.size)}, 남은 공간 약 ${formatBytes(Math.max(0, est.quota - est.usage))})`,
        );
      }
      await requestPersistence();

      setImp({ phase: "working", message: "페이지와 레이블을 읽는 중…" });
      const d = await openPdf(file);
      const labels = await readLabels(d);
      const { lessons, source } = classifyPages(d.numPages, labels);

      setImp({ phase: "working", message: "이 기기에 저장하는 중… (큰 파일은 잠시 걸려요)" });
      const id = `cb-${Date.now().toString(36)}`;
      await putPdf(id, file);
      if (!(await hasPdf(id))) throw new Error("저장을 확인하지 못했어요. 다시 시도해 주세요.");

      const meta: ChunkbookMeta = {
        id,
        title: file.name.replace(/\.pdf$/i, ""),
        fileName: file.name,
        size: file.size,
        pageCount: d.numPages,
        importedAt: Date.now(),
        lessons,
        labelSource: source,
        confirmed: source === "pdf-labels",
      };
      // 이전 교재가 있으면 교체한다 (파일 본문도 정리)
      for (const old of books) void deletePdf(old.id).catch(() => undefined);
      destroyPdf(docRef.current);
      docRef.current = d;
      setDoc(d);
      setFileState("ok");
      setSelected(lessons[0]?.lesson ?? null);
      setDraft(null);
      setCustomCheck({ id, ok: true });
      onChange([meta]);
      setImp({ phase: "idle" });
    } catch (e) {
      setImp({ phase: "error", message: e instanceof Error ? e.message : "가져오지 못했어요." });
    } finally {
      importingRef.current = false;
    }
  }

  async function handleDelete() {
    if (!custom || isBuiltin) return;
    if (!confirm("이 기기에 가져온 PDF를 지우고 기본 청크북으로 돌아갈까요?")) return;
    try {
      await deletePdf(custom.id);
    } catch {
      /* ignore */
    }
    destroyPdf(docRef.current);
    docRef.current = null;
    setDoc(null);
    setSelected(null);
    setViewer(null);
    setCustomCheck(null);
    onChange([]);
  }

  function startEditRanges() {
    if (isBuiltin) return;
    setDraft(
      book.lessons.map((l) => ({ lesson: l.lesson, start: Math.min(...l.pages), end: Math.max(...l.pages) })),
    );
    setDraftError(null);
  }

  function confirmRanges() {
    if (isBuiltin || !draft) return;
    let prevEnd = 0;
    for (const r of draft) {
      if (!(r.start >= 1 && r.end >= r.start && r.end <= book.pageCount)) {
        setDraftError(`Lesson ${r.lesson}의 범위를 확인해 주세요. (1~${book.pageCount}쪽)`);
        return;
      }
      if (r.start <= prevEnd) {
        setDraftError(`Lesson ${r.lesson}의 시작 쪽이 앞 레슨과 겹쳐요.`);
        return;
      }
      prevEnd = r.end;
    }
    const lessons = lessonsFromRanges(draft, null);
    onChange([{ ...book, lessons, confirmed: true, labelSource: book.labelSource }, ...books.slice(1)]);
    setDraft(null);
    setDraftError(null);
  }

  const fileInput = (label: string, primary = true) => (
    <label
      className={`inline-flex items-center justify-center min-h-[48px] px-5 rounded-full font-bold cursor-pointer ${
        primary ? "bg-sky-600 text-white" : "bg-gray-100 text-gray-700"
      } ${imp.phase === "working" ? "opacity-50 pointer-events-none" : ""}`}
    >
      {label}
      <input
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        data-testid="chunkbook-file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void handleFile(f);
        }}
      />
    </label>
  );

  // ---------- 가져온 뒤 ----------
  const needsConfirm = !book.confirmed;
  const editing = draft !== null;

  return (
    <div className="w-full max-w-4xl flex flex-col gap-4">
      {(!isBuiltin || imp.phase !== "idle") && (
      <div className="rounded-2xl bg-gray-50 p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-bold text-gray-800 truncate">{book.title}</p>
            <p className="text-xs text-gray-500">
              {isBuiltin ? (
                <>
                  Lesson 2~8 · {book.pageCount}쪽 · 앱에 들어 있어서 바로 볼 수 있어요
                </>
              ) : (
                <>
                  {book.pageCount}쪽 · {formatBytes(book.size)} · {new Date(book.importedAt).toLocaleDateString("ko-KR")} 가져옴 ·{" "}
                  {book.labelSource === "pdf-labels" ? "페이지 레이블로 분류" : "기본 범위로 분류"}
                </>
              )}
            </p>
          </div>
          {!isBuiltin && (
            <div className="flex gap-2 shrink-0">
              {fileInput("다시 가져오기", false)}
              <button onClick={handleDelete} className="min-h-[48px] px-4 rounded-full bg-gray-100 text-gray-600 font-bold">
                지우고 기본 청크북으로
              </button>
            </div>
          )}
        </div>
        {imp.phase === "working" && <p className="text-sm text-sky-700 font-bold">{imp.message}</p>}
        {imp.phase === "error" && <p className="text-sm text-red-600 font-bold">⚠️ {imp.message}</p>}
        {custom && customReady === "no" && isBuiltin && (
          <p className="text-xs text-gray-500">
            이 기기에는 가져온 PDF가 없어서 기본 청크북을 보여주고 있어요. 따로 할 일은 없어요.
          </p>
        )}
      </div>
      )}

      {(needsConfirm || editing) && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 flex flex-col gap-3" data-testid="range-confirm">
          <p className="font-bold text-amber-800">
            {needsConfirm ? "페이지 레이블을 읽지 못해 기본 범위로 나눴어요. 맞는지 확인해 주세요." : "Lesson 별 페이지 범위"}
          </p>
          {!editing ? (
            <div className="flex flex-wrap gap-2">
              {book.lessons.map((l) => (
                <span key={l.lesson} className="rounded-full bg-white px-3 py-1 text-sm font-bold text-gray-700">
                  Lesson {l.lesson}: {Math.min(...l.pages)}~{Math.max(...l.pages)}쪽
                </span>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {draft.map((r, i) => (
                <div key={r.lesson} className="flex items-center gap-2 text-sm font-bold text-gray-700">
                  <span className="w-20">Lesson {r.lesson}</span>
                  <input
                    type="number"
                    min={1}
                    max={book.pageCount}
                    value={r.start}
                    onChange={(e) => setDraft((d) => d && d.map((x, j) => (j === i ? { ...x, start: Number(e.target.value) } : x)))}
                    className="w-20 rounded-lg border-2 border-gray-200 px-2 py-1"
                    aria-label={`Lesson ${r.lesson} 시작 쪽`}
                  />
                  <span>~</span>
                  <input
                    type="number"
                    min={1}
                    max={book.pageCount}
                    value={r.end}
                    onChange={(e) => setDraft((d) => d && d.map((x, j) => (j === i ? { ...x, end: Number(e.target.value) } : x)))}
                    className="w-20 rounded-lg border-2 border-gray-200 px-2 py-1"
                    aria-label={`Lesson ${r.lesson} 끝 쪽`}
                  />
                  <span>쪽</span>
                </div>
              ))}
            </div>
          )}
          {draftError && <p className="text-sm font-bold text-red-600">⚠️ {draftError}</p>}
          <div className="flex gap-2">
            {!editing ? (
              <>
                {needsConfirm && (
                  <button
                    onClick={() => onChange([{ ...book, confirmed: true }, ...books.slice(1)])}
                    className="min-h-[48px] px-5 rounded-full bg-sky-600 text-white font-bold"
                  >
                    이 범위가 맞아요
                  </button>
                )}
                <button onClick={startEditRanges} className="min-h-[48px] px-5 rounded-full bg-white text-gray-700 font-bold">
                  범위 고치기
                </button>
              </>
            ) : (
              <>
                <button onClick={confirmRanges} className="min-h-[48px] px-5 rounded-full bg-sky-600 text-white font-bold">
                  저장하고 확인
                </button>
                <button
                  onClick={() => {
                    setDraft(null);
                    setDraftError(null);
                  }}
                  className="min-h-[48px] px-5 rounded-full bg-white text-gray-700 font-bold"
                >
                  취소
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Lesson 목록 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="lesson-list">
        {lessonList.map((l) => (
          <button
            key={l.lesson}
            onClick={() => setSelected((cur) => (cur === l.lesson ? null : l.lesson))}
            aria-pressed={selected === l.lesson}
            className={`min-h-[56px] rounded-2xl border-2 px-3 py-2 text-left transition active:scale-95 ${
              selected === l.lesson ? "border-sky-500 bg-sky-50" : "border-transparent bg-gray-50"
            }`}
          >
            <p className="text-sm font-bold text-gray-800">Lesson {l.lesson}</p>
            <p className="text-xs text-gray-500">{l.pages.length}쪽</p>
          </button>
        ))}
      </div>

      {/* Lesson 활동: 읽고 듣기 / 문장 보고 쓰기 */}
      {current && (
        <ChunkLessonView
          key={`${book.id}-${current.lesson}`}
          book={book}
          lessonDef={current}
          doc={doc}
          fileOk={fileState === "ok"}
          onOpenVocab={(l) => onOpenVocab?.(l)}
          onOpenPage={(p) => {
            const i = current.pages.indexOf(p);
            if (i >= 0) setViewer(i);
          }}
        />
      )}

      {/* 원본 페이지 보기 */}
      {current && (isBuiltin || (doc && fileState === "ok")) && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold text-gray-700">Lesson {current.lesson} 원본 페이지</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2" data-testid="page-grid">
            {current.pages.map((p, i) => (
              isBuiltin ? (
                <BuiltinThumb key={`${book.id}-${p}`} page={p} label={current.labels[i] ?? `p.${p}`} onOpen={() => setViewer(i)} />
              ) : (
                doc && (
                  <PageThumb
                    key={`${book.id}-${p}`}
                    doc={doc}
                    docKey={book.id}
                    page={p}
                    label={current.labels[i] ?? `p.${p}`}
                    onOpen={() => setViewer(i)}
                  />
                )
              )
            ))}
          </div>
        </div>
      )}
      {current && !isBuiltin && fileState === "checking" && <p className="text-sm text-gray-500">파일을 여는 중…</p>}

      {viewer !== null && (isBuiltin || doc) && current && (
        <PageViewer
          doc={doc}
          directUrl={isBuiltin ? builtinPageUrl : undefined}
          items={viewerItems}
          index={viewer}
          total={book.pageCount}
          onIndex={setViewer}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}
