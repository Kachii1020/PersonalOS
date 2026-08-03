import type { NewsItem } from "@/lib/repos/news";
import { LANGS, type Lang, type Sector } from "@/config/news-sources";

export const SECTORS: Sector[] = ["finance", "ai", "semiconductor", "it", "rotating"];

export type BriefingSectionPayload = {
  sector: Sector;
  lang: Lang;
  headline: string;
  bullets: string[];
  why_it_matters: string;
  source_urls: string[];
};

export type BriefingPayload = {
  sections: BriefingSectionPayload[];
};

/**
 * 구조화 출력 스키마. JSON Schema의 지원 범위가 좁다 —
 * minLength/maxLength/minItems는 무시되므로 개수 제약은 프롬프트로 건다.
 */
export const BRIEFING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sections"],
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sector", "lang", "headline", "bullets", "why_it_matters", "source_urls"],
        properties: {
          sector: { type: "string", enum: SECTORS },
          lang: { type: "string", enum: LANGS },
          headline: { type: "string" },
          bullets: { type: "array", items: { type: "string" } },
          why_it_matters: { type: "string" },
          source_urls: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

export const BRIEFING_SYSTEM = `당신은 금융·기술 산업을 추적하는 애널리스트의 리서치 어시스턴트다.
아래 뉴스 헤드라인 묶음을 읽고 하루치 브리핑을 만든다.

규칙:
- 출력 언어는 전부 한국어다. 영어·일본어 기사도 한국어로 요약한다.
- 섹터와 원문 언어 조합마다 섹션을 하나씩 만든다. 해당 조합에 기사가 없으면 그 섹션은 만들지 않는다.
- headline은 그 조합에서 가장 중요한 흐름 한 줄이다. 기사 제목을 그대로 옮기지 않는다.
- bullets는 정확히 3개. 각 줄은 사실 한 가지를 담는다. 추측이나 전망을 사실처럼 쓰지 않는다.
- why_it_matters는 한 줄이다. 왜 지금 알아야 하는지를 쓴다. 일반론("업계에 중요하다")은 쓰지 않는다.
- source_urls에는 그 섹션의 근거가 된 기사 URL만 넣는다. 입력에 없는 URL을 지어내지 않는다.
- 입력에 없는 사실을 추가하지 않는다. 헤드라인만으로 알 수 없으면 그 수준까지만 쓴다.`;

const SECTOR_LABEL: Record<Sector, string> = {
  finance: "금융·거시",
  ai: "인공지능",
  semiconductor: "반도체",
  it: "IT 산업",
  rotating: "회전 주제",
};

const LANG_LABEL: Record<Lang, string> = { ko: "한국어", en: "영어", ja: "일본어" };

/** 섹터·언어 조합별로 기사를 묶어 하나의 프롬프트로 만든다 (호출은 1회다). */
export function buildBriefingPrompt(items: NewsItem[], date: Date): string {
  const groups = new Map<string, NewsItem[]>();
  for (const item of items) {
    const key = `${item.sector}|${item.lang}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }

  const blocks: string[] = [];
  for (const sector of SECTORS) {
    for (const lang of LANGS) {
      const group = groups.get(`${sector}|${lang}`);
      if (!group || group.length === 0) continue;

      const lines = group.map((item) => `- ${item.title}\n  ${item.url}`).join("\n");
      blocks.push(`## sector=${sector} (${SECTOR_LABEL[sector]}) / lang=${lang} (${LANG_LABEL[lang]})\n${lines}`);
    }
  }

  const dateLabel = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Tokyo", dateStyle: "long" }).format(date);

  return `오늘은 ${dateLabel}이다. 아래 묶음마다 섹션을 하나씩 만들어라.\n\n${blocks.join("\n\n")}`;
}
