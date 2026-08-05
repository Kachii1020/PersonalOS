import "server-only";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";
import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";

/**
 * 강의자료 텍스트 추출 (SPEC.md 3절: 업로드 즉시 추출, 요약은 수동).
 *
 * 추출은 AI를 쓰지 않는다. 여기서 모델을 부르면 업로드만으로 돈이 나간다.
 */

export const PDF_MIME = "application/pdf";
export const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

export function isSupported(mimeType: string): boolean {
  return mimeType === PDF_MIME || mimeType === PPTX_MIME;
}

export async function extractText(bytes: Uint8Array, mimeType: string): Promise<string> {
  if (mimeType === PDF_MIME) return normalize(await fromPdf(bytes));
  if (mimeType === PPTX_MIME) return normalize(fromPptx(bytes));
  throw new Error(`지원하지 않는 형식입니다: ${mimeType}. PDF와 PPTX만 읽습니다.`);
}

async function fromPdf(bytes: Uint8Array): Promise<string> {
  const doc = await getDocumentProxy(bytes);
  const { text } = await extractPdfText(doc, { mergePages: true });
  return text;
}

/** PPTX는 OOXML 패키지(zip)다. 슬라이드 XML의 <a:t> 런만 모으면 본문이 된다. */
function fromPptx(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const slides = Object.keys(files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => slideNumber(a) - slideNumber(b));

  if (slides.length === 0) throw new Error("슬라이드를 찾지 못했습니다. PPTX 파일이 맞는지 확인하세요.");

  const parser = new XMLParser({ ignoreAttributes: true });
  return slides
    .map((name) => {
      const runs: string[] = [];
      collectRuns(parser.parse(strFromU8(files[name]!)), runs);
      return runs.join(" ");
    })
    .join("\n\n");
}

function slideNumber(name: string): number {
  return Number(name.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
}

/** <a:t>는 도형·표·자리표시자 어디에나 중첩된다. 키 이름으로 훑는 편이 경로를 가정하는 것보다 안전하다. */
function collectRuns(node: unknown, out: string[]): void {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectRuns(item, out);
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "a:t") {
      for (const t of Array.isArray(value) ? value : [value]) {
        if (typeof t === "string" || typeof t === "number") out.push(String(t));
      }
    } else {
      collectRuns(value, out);
    }
  }
}

/** 추출 결과는 공백·개행이 지저분하다. 저장 전에 한 번 정리해야 요약 프롬프트 토큰이 줄어든다. */
function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
