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

function PageViewer({
  doc,
  items,
  index,
  total,
  onIndex,
  onClose,
}: {
  doc: PdfDoc;
  items: { page: number; label: string }[];
  index: number;
  total: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const item = items[index];

  useEffect(() => {
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
  }, [doc, item.page]);

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
        {url && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`${item.label} 페이지`} className="max-w-full max-h-full object-contain bg-white" />
        ) : (
          <p className="text-white/80">{failed ? "페이지를 불러오지 못했어요." : "불러오는 중…"}</p>
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
  const book = books[0] ?? null;
  const [imp, setImp] = useState<ImportState>({ phase: "idle" });
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [fileState, setFileState] = useState<"checking" | "ok" | "missing">("checking");
  const [selected, setSelected] = useState<number | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [draft, setDraft] = useState<{ lesson: number; start: number; end: number }[] | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const docRef = useRef<PdfDoc | null>(null);
  const importingRef = useRef(false);

  const bookId = book?.id ?? null;

  // 새로고침 후에도 저장된 PDF를 다시 열 수 있는지 확인하고 문서를 연다.
  useEffect(() => {
    if (!bookId) return;
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
  }, [bookId]);

  useEffect(() => {
    return () => {
      void destroyPdf(docRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void storageEstimate().then((s) => {
      if (!cancelled) setStorage(s);
    });
    return () => {
      cancelled = true;
    };
  }, [bookId, imp.phase]);

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
      onChange([meta]);
      setImp({ phase: "idle" });
    } catch (e) {
      setImp({ phase: "error", message: e instanceof Error ? e.message : "가져오지 못했어요." });
    } finally {
      importingRef.current = false;
    }
  }

  async function handleDelete() {
    if (!book) return;
    if (!confirm("이 기기에서 청크북 PDF와 분류 정보를 지울까요?")) return;
    try {
      await deletePdf(book.id);
    } catch {
      /* ignore */
    }
    destroyPdf(docRef.current);
    docRef.current = null;
    setDoc(null);
    setSelected(null);
    setViewer(null);
    onChange([]);
  }

  function startEditRanges() {
    if (!book) return;
    setDraft(
      book.lessons.map((l) => ({ lesson: l.lesson, start: Math.min(...l.pages), end: Math.max(...l.pages) })),
    );
    setDraftError(null);
  }

  function confirmRanges() {
    if (!book || !draft) return;
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

  // ---------- 가져오기 전 ----------
  if (!book) {
    return (
      <div className="w-full max-w-4xl flex flex-col gap-4">
        <div className="rounded-2xl bg-gray-50 p-5 flex flex-col gap-3 items-start">
          <p className="text-lg font-bold text-gray-800">청크북 PDF를 가져와요</p>
          <p className="text-sm text-gray-600">
            PDF 한 파일을 그대로 보관하고, 페이지 레이블의 Lesson 번호로 Lesson 별로 나눠서 보여줘요.
          </p>
          {fileInput("PDF 파일 선택")}
          {imp.phase === "working" && <p className="text-sm text-sky-700 font-bold">{imp.message}</p>}
          {imp.phase === "error" && <p className="text-sm text-red-600 font-bold">⚠️ {imp.message}</p>}
          <ul className="text-xs text-gray-500 list-disc pl-5 flex flex-col gap-1">
            <li>파일은 서버로 올리지 않고 이 기기 브라우저에만 저장돼요. (큰 스캔 PDF는 서버 업로드 제한이 있어요)</li>
            <li>다른 기기에서 보려면 그 기기에서도 같은 PDF를 한 번 가져와야 해요. 레슨 분류 정보는 동기화돼요.</li>
            {storage && <li>이 기기 저장 공간: 사용 {formatBytes(storage.usage)} / 약 {formatBytes(storage.quota)}</li>}
          </ul>
        </div>
      </div>
    );
  }

  // ---------- 가져온 뒤 ----------
  const needsConfirm = !book.confirmed;
  const editing = draft !== null;

  return (
    <div className="w-full max-w-4xl flex flex-col gap-4">
      <div className="rounded-2xl bg-gray-50 p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-bold text-gray-800 truncate">{book.title}</p>
            <p className="text-xs text-gray-500">
              {book.pageCount}쪽 · {formatBytes(book.size)} · {new Date(book.importedAt).toLocaleDateString("ko-KR")} 가져옴 ·{" "}
              {book.labelSource === "pdf-labels" ? "페이지 레이블로 분류" : "기본 범위로 분류"}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {fileInput("다시 가져오기", false)}
            <button onClick={handleDelete} className="min-h-[48px] px-4 rounded-full bg-gray-100 text-gray-600 font-bold">
              지우기
            </button>
          </div>
        </div>
        {imp.phase === "working" && <p className="text-sm text-sky-700 font-bold">{imp.message}</p>}
        {imp.phase === "error" && <p className="text-sm text-red-600 font-bold">⚠️ {imp.message}</p>}
        {fileState === "missing" && (
          <p className="text-sm text-amber-700 font-bold">
            이 기기에는 PDF 파일이 없어요. 위의 &quot;다시 가져오기&quot;로 같은 PDF를 선택해 주세요.
          </p>
        )}
      </div>

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
              selected === l.lesson ? "border-sky-500 bg-sky-50" : "border-gray-200 bg-white"
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
      {current && doc && fileState === "ok" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold text-gray-700">Lesson {current.lesson} 원본 페이지</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2" data-testid="page-grid">
            {current.pages.map((p, i) => (
              <PageThumb
                key={`${book.id}-${p}`}
                doc={doc}
                docKey={book.id}
                page={p}
                label={current.labels[i] ?? `p.${p}`}
                onOpen={() => setViewer(i)}
              />
            ))}
          </div>
        </div>
      )}
      {current && fileState === "checking" && <p className="text-sm text-gray-500">파일을 여는 중…</p>}
      {!current && <p className="text-sm text-gray-400">Lesson을 눌러 읽고 듣기·문장 보고 쓰기를 시작해요.</p>}

      {viewer !== null && doc && current && (
        <PageViewer
          doc={doc}
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
