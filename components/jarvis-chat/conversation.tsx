"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, MessageSquare, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";
import type { ChatMessage, ChatReply, DialogueDraft, DialogueFact } from "@/lib/jarvis/dialogue-types";
import { observedTime, PayloadPreview, safeFactHref } from "./display";

type Turn = { id: string; input: string; reply: ChatReply };

async function postJson(path: string, body: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(path, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
    let data: unknown;
    try { data = await response.json(); }
    catch { throw new Error(response.status === 401 ? "로그인이 만료되었습니다. 다시 로그인한 뒤 시도해 주세요." : "응답을 읽지 못했습니다. 입력은 남겨 두었습니다. 잠시 후 다시 시도해 주세요."); }
    if (!response.ok) throw new Error(data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("응답 확인 시간이 지났습니다. 완료 여부를 확인하지 못했습니다. 같은 요청을 다시 확인할 수 있습니다.");
    throw error;
  } finally { clearTimeout(timeout); }
}

function readReply(value: unknown): ChatReply {
  if (!value || typeof value !== "object") throw new Error("대화 응답 형식을 확인하지 못했습니다.");
  const reply = value as ChatReply;
  if (!["answer", "clarify", "propose"].includes(reply.mode) || typeof reply.message !== "string" || !Array.isArray(reply.facts) || !Array.isArray(reply.warnings) || typeof reply.observedAt !== "string"
    || reply.facts.some((fact) => !fact || typeof fact.id !== "string" || typeof fact.title !== "string" || typeof fact.detail !== "string" || typeof fact.href !== "string" || typeof fact.observedAt !== "string")
    || reply.warnings.some((warning) => typeof warning !== "string")
    || (reply.draft !== null && (!reply.draft || typeof reply.draft.id !== "string" || typeof reply.draft.title !== "string" || typeof reply.draft.explanation !== "string" || typeof reply.draft.expiresAt !== "string" || typeof reply.draft.canRequestApproval !== "boolean" || !["CREATE_TASK", "CREATE_CALENDAR_EVENT", "UPDATE_CALENDAR_EVENT"].includes(reply.draft.type) || reply.draft.payload === undefined))) throw new Error("대화 응답의 일부 내용을 확인하지 못했습니다. 다시 시도해 주세요.");
  return reply;
}

const draftLabels = { CREATE_TASK: "할 일 생성 제안", CREATE_CALENDAR_EVENT: "일정 생성 제안", UPDATE_CALENDAR_EVENT: "일정 수정 제안" };

function DraftCard({ draft }: { draft: DialogueDraft }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvalId, setApprovalId] = useState<string | null>(null);
  const inFlight = useRef(false);
  async function requestApproval() {
    if (inFlight.current || approvalId || !draft.canRequestApproval) return;
    if (!Number.isFinite(Date.parse(draft.expiresAt)) || Date.parse(draft.expiresAt) <= Date.now()) { setError("제안 유효기간이 지났습니다. 대화에서 최신 내용으로 다시 요청해 주세요."); return; }
    inFlight.current = true; setPending(true); setError(null);
    try {
      const data = await postJson(`/api/jarvis/proposals/${encodeURIComponent(draft.id)}/request-approval`, {});
      if (!data || typeof data !== "object" || !("approvalId" in data) || typeof data.approvalId !== "string" || !data.approvalId) throw new Error("승인 요청 저장 결과를 확인하지 못했습니다. 같은 버튼으로 다시 확인할 수 있습니다.");
      setApprovalId(data.approvalId);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "승인 요청을 저장하지 못했습니다. 같은 제안으로 다시 시도해 주세요."); }
    finally { inFlight.current = false; setPending(false); }
  }
  return <section aria-label={draftLabels[draft.type]} className="mt-4 min-w-0 space-y-3 rounded-xl border border-line p-3">
    <div className="flex flex-wrap items-center gap-2"><ShieldCheck className="size-4 text-accent" aria-hidden="true" /><h3 className="text-sm font-semibold text-text">{draftLabels[draft.type]}</h3><Badge>{approvalId ? "승인 요청 저장됨" : "아직 실행되지 않음"}</Badge></div>
    <p className="break-words font-medium text-text">{draft.title}</p><p className="whitespace-pre-wrap break-words text-sm text-text-muted">{draft.explanation}</p>
    <PayloadPreview payload={draft.payload} />
    <p className="text-xs text-text-muted">제안 유효기간: {observedTime(draft.expiresAt)}</p>
    {approvalId ? <div role="status" className="space-y-2"><p className="text-sm text-text-muted">승인함에 저장했습니다. 실행하려면 승인함에서 내용을 확인하고 승인해 주세요.</p><Link href="/approvals" className={buttonClass({ variant: "primary" })}>승인함 열기</Link></div> : draft.canRequestApproval ? <div className="space-y-2"><p className="text-xs text-text-muted">아래 버튼은 승인 대기 요청만 만듭니다. 자동으로 승인하거나 실행하지 않습니다.</p><Button type="button" variant="primary" disabled={pending} onClick={requestApproval}>{pending ? "승인 요청 확인 중…" : "승인함으로 보내기"}</Button></div> : <p className="text-sm text-text-muted">실행 연결 준비 중 · 이 제안은 현재 승인함으로 보낼 수 없습니다.</p>}
    {error && <p role="alert" className="break-words text-sm text-negative">{error}</p>}
  </section>;
}

function ReplyCard({ reply, selectedId, onSelectEvent, pending }: { reply: ChatReply; selectedId: string | null; onSelectEvent: (fact: DialogueFact) => void; pending: boolean }) {
  return <Card className="min-w-0">
    <CardHeader><CardTitle>{reply.mode === "clarify" ? "더 확인할 내용" : "JARVIS의 해석·제안"}</CardTitle><Badge>대화</Badge></CardHeader>
    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-text">{reply.message}</p>
    <p className="mt-2 text-xs text-text-muted">조회 기준: {observedTime(reply.observedAt)}</p>
    {reply.warnings.length > 0 && <section aria-label="확인이 필요한 정보" className="mt-4 rounded-lg border border-line p-3"><h3 className="mb-2 text-sm font-medium text-text">확인이 필요한 정보</h3><ul className="list-inside list-disc space-y-1 text-sm leading-6 text-text-muted">{reply.warnings.map((warning, index) => <li key={index} className="break-words">{warning}</li>)}</ul></section>}
    <section aria-label="조회한 기록" className="mt-4 border-t border-line pt-3"><h3 className="mb-2 text-sm font-semibold text-text">조회한 기록</h3>
      {reply.facts.length === 0 ? <p className="text-sm text-text-muted">이번 답변에서 확인된 기록이 없습니다. 대화 내용을 확인된 사실로 저장하지 않습니다.</p> : <ul className="divide-y divide-line">{reply.facts.map((fact) => {
        const href = safeFactHref(fact.href);
        return <li key={fact.id} className="min-w-0 space-y-1 py-3 first:pt-0"><p className="break-words text-sm font-medium text-text">{fact.title}</p><p className="whitespace-pre-wrap break-words text-sm leading-6 text-text-muted">{fact.detail}</p><p className="text-xs text-text-muted">기록 확인 시각: {observedTime(fact.observedAt)}</p>{href ? <Link href={href} className="inline-block text-xs font-medium text-accent underline underline-offset-4">원본 기록 열기</Link> : <p className="text-xs text-text-muted">원본 링크를 확인할 수 없습니다.</p>}{fact.id.startsWith("event:") && <div className="pt-2"><Button type="button" size="sm" disabled={pending} aria-pressed={selectedId === fact.id} aria-label={`${fact.title} · ${fact.detail} · 수정 대상으로 선택`} onClick={() => onSelectEvent(fact)}>{selectedId === fact.id ? "수정 대상으로 선택됨" : "수정 대상으로 선택"}</Button></div>}</li>;
      })}</ul>}
    </section>
    {reply.draft && <DraftCard key={reply.draft.id} draft={reply.draft} />}
  </Card>;
}

export function JarvisConversation() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentInput, setSentInput] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<DialogueFact | null>(null);
  const busy = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !input.trim()) return;
    if (input.length > 2000) { setError("한 번에 2,000자까지 입력할 수 있습니다."); return; }
    const message = input.trim();
    // A retained UI target must not survive a cancellation into a later slot reply.
    const clearSelection = /취소|하지\s*마|만들지\s*마|그만/.test(message);
    if (clearSelection) setSelectedEvent(null);
    const history: ChatMessage[] = turns.flatMap((turn) => [{ role: "user" as const, content: turn.input.slice(0, 2000) }, { role: "assistant" as const, content: turn.reply.message.slice(0, 2000) }]);
    const messages = [...history, { role: "user" as const, content: message }].slice(-6);
    busy.current = true; setPending(true); setError(null); setSentInput(message);
    try {
      const reply = readReply(await postJson("/api/jarvis/chat", { messages, ...(selectedEvent && !clearSelection ? { selectedSourceId: selectedEvent.id } : {}) }));
      setTurns((current) => [...current, { id: crypto.randomUUID(), input: message, reply }].slice(-3));
      setInput("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "응답을 받지 못했습니다. 입력을 유지했으니 다시 시도해 주세요."); }
    finally { busy.current = false; setPending(false); setSentInput(null); inputRef.current?.focus(); }
  }
  return <div className="mx-auto max-w-3xl space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium text-accent">JARVIS</p><h1 className="mt-1 text-xl font-semibold text-text">자비스와 대화</h1><p className="mt-2 max-w-prose text-sm leading-6 text-text-muted">할 일, 일정, 지원 기회를 함께 확인하고 다음 행동을 준비하세요.</p></div>{turns.length > 0 && <Button variant="ghost" disabled={pending} onClick={() => { setTurns([]); setInput(""); setError(null); setSelectedEvent(null); inputRef.current?.focus(); }}>대화 비우기</Button>}</header>
    <p className="text-xs leading-5 text-text-muted">최근 대화는 이 화면의 메모리에서만 사용하며 영구 저장하지 않습니다. 새로고침하면 초기화됩니다. 승인함으로 보낸 행동 요청은 별도로 남습니다.</p>
    {turns.length === 0 && !pending && <Card><CardHeader><CardTitle>무엇부터 볼까요?</CardTitle><MessageSquare className="size-5 text-accent" aria-hidden="true" /></CardHeader><p className="text-sm leading-6 text-text-muted">예: “현재 할 일 목록 보여줘”, “내일 일정 확인해줘”, “현재 커리어 기회 목록 보여줘”</p><p className="mt-2 text-xs leading-5 text-text-muted">정보가 부족하면 먼저 확인합니다. 행동을 제안해도 승인 전에는 실행하지 않습니다.</p></Card>}
    <div role="log" aria-live="polite" aria-label="최근 대화" className="space-y-4">{turns.map((turn) => <article key={turn.id} className="space-y-3"><div className="ml-4 rounded-xl bg-accent-soft p-3"><p className="mb-1 text-xs font-medium text-accent">내 요청</p><p className="whitespace-pre-wrap break-words text-sm leading-6 text-text">{turn.input}</p></div><ReplyCard reply={turn.reply} pending={pending} selectedId={selectedEvent?.id ?? null} onSelectEvent={(fact) => { setSelectedEvent(fact); inputRef.current?.focus(); }} /></article>)}</div>
    {pending && <div role="status" className="space-y-2 rounded-xl border border-line p-4"><p className="break-words text-sm text-text">{sentInput}</p><p className="text-sm text-text-muted">기록과 요청을 확인하고 있습니다…</p></div>}
    <Card><form onSubmit={send} className="space-y-3" aria-busy={pending}>
      {selectedEvent && <section aria-label="선택한 수정 대상" className="rounded-lg border border-line p-3"><p className="text-xs font-medium text-accent">선택한 수정 대상</p><p className="mt-1 break-words text-sm font-medium text-text">{selectedEvent.title}</p><p className="mt-1 whitespace-pre-wrap break-words text-xs text-text-muted">{selectedEvent.detail}</p><p className="mt-2 text-xs text-text-muted">변경할 날짜·시각·길이를 아래에 적어 주세요. 대상을 선택해도 일정은 변경되지 않습니다.</p><Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setSelectedEvent(null)}>선택 해제</Button></section>}
      <Field label="자비스에게 요청하기" htmlFor="jarvis-message" hint="일정 요청에는 대상, 날짜와 시각을 구체적으로 적어 주세요. 이 앱의 시각은 JST입니다."><textarea ref={inputRef} id="jarvis-message" value={input} onChange={(event) => setInput(event.target.value)} disabled={pending} maxLength={2000} required rows={3} aria-describedby="jarvis-input-length" className="w-full min-w-0 resize-y rounded-lg border border-line bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted disabled:cursor-wait disabled:opacity-60" placeholder="현재 할 일 목록 보여줘" /></Field>
      <div className="flex items-center justify-between gap-3"><span id="jarvis-input-length" className="text-xs text-text-muted">{input.length.toLocaleString("ko-KR")} / 2,000자</span><Button type="submit" variant="primary" disabled={pending || !input.trim()}><ArrowUp className="size-4" aria-hidden="true" />{pending ? "확인 중…" : error ? "다시 보내기" : "보내기"}</Button></div>
      {error && <ErrorState what={error} fix="입력 내용은 유지됩니다. 내용을 확인한 뒤 다시 보내거나 잠시 후 시도해 주세요." />}
    </form></Card>
  </div>;
}
