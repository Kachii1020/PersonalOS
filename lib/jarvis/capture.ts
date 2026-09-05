import type { CaptureClassification, CaptureInput, CreateTaskPayload, ProposedAction } from "./types";

const TASK_PREFIX = /^(?:할\s*일|해야\s*할\s*일|todo|task)\s*[:：-]\s*/i;
const LEARN_PREFIX = /^(?:공부|배우기|학습|learn|study)\s*[:：-]\s*/i;
const URL_ONLY = /^https?:\/\/\S+$/i;

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function taskProposal(input: CaptureInput, title: string): ProposedAction {
  const payload: CreateTaskPayload = {
    title,
    notes: input.sourceUrl ? `출처: ${input.sourceUrl}` : null,
    dueAt: null,
    category: null,
    priority: 60,
    estimatedMinutes: null,
  };

  return {
    type: "CREATE_TASK",
    title: `할 일 추가: ${title}`,
    explanation: "활성 할 일 목록을 바꾸는 작업이므로 사용자 승인이 필요합니다.",
    payload,
    riskLevel: "low",
    idempotencyKey: `capture:${input.id}:create-task:v1`,
  };
}

export function classifyCapture(input: CaptureInput): CaptureClassification {
  const text = compact(input.rawText ?? "");
  const sourceUrl = input.sourceUrl?.trim() || null;

  if (!text && !sourceUrl) {
    return {
      status: "failed",
      summary: "처리할 내용이 없습니다.",
      reason: "텍스트와 URL이 모두 비어 있습니다.",
      proposedAction: null,
    };
  }

  const taskMatch = text.match(TASK_PREFIX);
  if (taskMatch) {
    const title = compact(text.slice(taskMatch[0].length));
    if (!title || title.length > 200) {
      return {
        status: "failed",
        summary: "할 일 제목을 확인하세요.",
        reason: "접두사 뒤에 1~200자로 실행할 내용을 적어야 합니다.",
        proposedAction: null,
      };
    }
    return {
      status: "act_now",
      summary: title,
      reason: "명시적인 할 일 형식으로 입력되었습니다.",
      proposedAction: taskProposal(input, title),
    };
  }

  const learnMatch = text.match(LEARN_PREFIX);
  if (learnMatch) {
    const topic = compact(text.slice(learnMatch[0].length));
    return {
      status: "learn",
      summary: topic || text,
      reason: "학습 의도가 명시되어 학습 큐로 분류했습니다.",
      proposedAction: null,
    };
  }

  if (sourceUrl || URL_ONLY.test(text) || input.kind === "url") {
    const url = sourceUrl ?? text;
    return {
      status: "monitor",
      summary: url,
      reason: "URL은 사실 확인과 중요도 판정 전까지 감시 항목으로 둡니다.",
      proposedAction: null,
    };
  }

  return {
    status: "archive",
    summary: text,
    reason: "명시적인 행동·학습·감시 의도가 없어 참고 메모로 보관했습니다.",
    proposedAction: null,
  };
}
