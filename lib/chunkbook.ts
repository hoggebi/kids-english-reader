"use client";

// 청크북(교재 PDF) 보관·분류.
//  - PDF 본문은 용량이 커서(수십~백 MB) localStorage가 아니라 브라우저 IndexedDB에 Blob으로 저장한다.
//    서버로 올리지 않는다(Vercel 요청 4.5MB 제한, GitHub 파일 100MB 제한).
//  - 메타데이터(레슨 분류·페이지 범위)만 작은 JSON으로 localStorage에 저장하고 동기화 대상에 포함한다.
//  - 새 버전 전용 저장 키(chunkbook-v2-*)를 쓴다.

export type ChunkLesson = {
  lesson: number;
  pages: number[]; // 1부터 시작하는 PDF 페이지 번호
  labels: string[]; // 각 페이지의 PDF 페이지 레이블(예: "Lesson2-1")
};

export type ChunkbookMeta = {
  id: string;
  title: string;
  fileName: string;
  size: number;
  pageCount: number;
  importedAt: number;
  lessons: ChunkLesson[];
  labelSource: "pdf-labels" | "fallback";
  confirmed: boolean; // fallback 범위는 사용자가 확인해야 true
};

const META_KEY = "chunkbook-v2-chunkbooks";
const DB_NAME = "chunkbook-v2-files";
const STORE = "pdfs";

// 레이블을 읽지 못했을 때 쓰는 기본 범위 (42페이지 기준)
export const FALLBACK_RANGES: { lesson: number; start: number; end: number }[] = [
  { lesson: 2, start: 1, end: 6 },
  { lesson: 3, start: 7, end: 11 },
  { lesson: 4, start: 12, end: 17 },
  { lesson: 5, start: 18, end: 24 },
  { lesson: 6, start: 25, end: 30 },
  { lesson: 7, start: 31, end: 36 },
  { lesson: 8, start: 37, end: 42 },
];

// ---------- 메타데이터 ----------
export function loadChunkbooks(): ChunkbookMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChunkbookMeta[]) : [];
  } catch {
    return [];
  }
}

export function saveChunkbooks(books: ChunkbookMeta[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(META_KEY, JSON.stringify(books));
}

// ---------- IndexedDB (PDF 본문) ----------
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("이 브라우저는 큰 파일 저장(IndexedDB)을 지원하지 않아요."));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("저장소를 열지 못했어요."));
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      let result: T;
      req.onsuccess = () => {
        result = req.result;
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error ?? req.error);
      tx.onabort = () => reject(tx.error ?? new Error("저장이 중단됐어요."));
    });
  } finally {
    db.close();
  }
}

export async function putPdf(id: string, blob: Blob): Promise<void> {
  await withStore("readwrite", (s) => s.put(blob, id));
}
export async function getPdf(id: string): Promise<Blob | null> {
  const v = await withStore<Blob | undefined>("readonly", (s) => s.get(id) as IDBRequest<Blob | undefined>);
  return v ?? null;
}
export async function hasPdf(id: string): Promise<boolean> {
  const k = await withStore<IDBValidKey | undefined>("readonly", (s) => s.getKey(id));
  return k !== undefined;
}
export async function deletePdf(id: string): Promise<void> {
  await withStore("readwrite", (s) => s.delete(id));
}

export type StorageInfo = { usage: number; quota: number } | null;
export async function storageEstimate(): Promise<StorageInfo> {
  try {
    const e = await navigator.storage?.estimate?.();
    if (e && typeof e.quota === "number") return { usage: e.usage ?? 0, quota: e.quota };
  } catch {
    /* ignore */
  }
  return null;
}
// 브라우저가 저장소를 임의로 비우지 않도록 요청(허용 여부는 브라우저 판단)
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

// ---------- 레슨 분류 ----------
export function parseLessonLabel(label: string | null | undefined): number | null {
  if (!label) return null;
  const m = /lesson\s*[-_ ]?\s*(\d+)/i.exec(label);
  return m ? Number(m[1]) : null;
}

export function lessonsFromRanges(ranges: { lesson: number; start: number; end: number }[], labels: (string | null)[] | null): ChunkLesson[] {
  return ranges.map((r) => {
    const pages: number[] = [];
    for (let p = r.start; p <= r.end; p++) pages.push(p);
    return { lesson: r.lesson, pages, labels: pages.map((p) => labels?.[p - 1] ?? `p.${p}`) };
  });
}

// 페이지 레이블의 Lesson 번호로 분류한다. 모든 페이지를 읽지 못하면 기본 범위(fallback)를 쓰고 확인을 요구한다.
export function classifyPages(pageCount: number, labels: (string | null)[] | null): { lessons: ChunkLesson[]; source: "pdf-labels" | "fallback" } {
  if (labels && labels.length === pageCount) {
    const byLesson = new Map<number, ChunkLesson>();
    let ok = true;
    labels.forEach((lb, i) => {
      const n = parseLessonLabel(lb);
      if (n === null) {
        ok = false;
        return;
      }
      const cur = byLesson.get(n) ?? { lesson: n, pages: [], labels: [] };
      cur.pages.push(i + 1);
      cur.labels.push(lb as string);
      byLesson.set(n, cur);
    });
    if (ok && byLesson.size > 0) {
      return { lessons: [...byLesson.values()].sort((a, b) => a.lesson - b.lesson), source: "pdf-labels" };
    }
  }
  const clipped = FALLBACK_RANGES.filter((r) => r.start <= pageCount).map((r) => ({ ...r, end: Math.min(r.end, pageCount) }));
  return { lessons: lessonsFromRanges(clipped, labels), source: "fallback" };
}

// ---------- PDF 열기 (pdf.js, 필요할 때만 불러온다) ----------
export type PdfDoc = import("pdfjs-dist").PDFDocumentProxy;

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((m) => {
      m.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return m as unknown as typeof import("pdfjs-dist");
    });
  }
  return pdfjsPromise;
}

// Blob을 통째로 메모리에 올리지 않고 필요한 구간만 읽는다. 실패하면 전체를 읽는 방식으로 대체한다.
export async function openPdf(blob: Blob): Promise<PdfDoc> {
  const pdfjs = await loadPdfjs();
  try {
    class BlobRange extends pdfjs.PDFDataRangeTransport {
      constructor(private source: Blob) {
        super(source.size, null);
      }
      requestDataRange(begin: number, end: number) {
        void this.source
          .slice(begin, end)
          .arrayBuffer()
          .then((buf) => this.onDataRange(begin, new Uint8Array(buf)));
      }
    }
    const task = pdfjs.getDocument({ range: new BlobRange(blob), disableAutoFetch: true, disableStream: true, verbosity: 0 });
    return await task.promise;
  } catch {
    const data = new Uint8Array(await blob.arrayBuffer());
    return await pdfjs.getDocument({ data, verbosity: 0 }).promise;
  }
}

export async function readLabels(doc: PdfDoc): Promise<(string | null)[] | null> {
  try {
    const l = await doc.getPageLabels();
    return l ? l.map((x) => (x == null ? null : String(x))) : null;
  } catch {
    return null;
  }
}

// 페이지를 지정한 가로 픽셀로 그려 객체 URL로 돌려준다.
export async function renderPageUrl(doc: PdfDoc, pageNumber: number, targetWidth: number, quality = 0.82): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = targetWidth / base.width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 만들 수 없어요.");
  await page.render({ canvasContext: ctx, canvas, viewport }).promise;
  page.cleanup();
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지 변환 실패"))), "image/jpeg", quality),
  );
  canvas.width = 0;
  canvas.height = 0;
  return URL.createObjectURL(blob);
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(1)}GB`;
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(n / 1024))}KB`;
}

export function destroyPdf(doc: PdfDoc | null | undefined) {
  if (!doc) return;
  try {
    void doc.loadingTask.destroy().catch(() => undefined);
  } catch {
    /* ignore */
  }
}

// 서버(OCR/번역)로 보낼 JPEG를 base64 문자열(접두어 없음)로 만든다.
export async function renderPageBase64(doc: PdfDoc, pageNumber: number, targetWidth = 1400, quality = 0.8): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: targetWidth / base.width });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 만들 수 없어요.");
  await page.render({ canvasContext: ctx, canvas, viewport }).promise;
  page.cleanup();
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  canvas.width = 0;
  canvas.height = 0;
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}
