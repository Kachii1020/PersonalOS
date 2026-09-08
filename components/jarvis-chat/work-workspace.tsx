"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PayloadPreview, observedTime } from "./display";
import type { AttentionItem, WorkChatReply, WorkContext, WorkInput, WorkSnapshot, WorkStatus } from "@/lib/jarvis/work-types";
import type { ChatMessage } from "@/lib/jarvis/dialogue-types";
import type { JsonValue } from "@/lib/jarvis/types";

async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(path, { method, cache: "no-store", credentials: "same-origin", headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(115_000) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "업무 요청에 실패했습니다."); return data as T;
}
const statusLabels: Record<string, string> = { active: "진행 중", paused: "일시 중지", completed: "업무 완료(사용자 표시)", cancelled: "업무 취소", proposed: "검토 전", pending: "승인 대기", approved: "승인됨", executing: "실행 중", executed: "실행 확인 완료", failed: "실패·확인 필요", stale: "업무 변경으로 재검토 필요", expired: "만료", rejected: "거절", processing: "알림 처리 중", ready: "앱 알림함 도착", acknowledged: "사용자 확인" };
function fieldTime(value: string | null) { return value ? new Date(Date.parse(value) + 9 * 3600_000).toISOString().slice(0,16) : ""; }
function parseFieldTime(value: string) { return value ? new Date(`${value}:00+09:00`).toISOString() : null; }
const fieldClass = "w-full rounded-lg border border-line bg-bg p-2 text-sm";

function SourceReference({ reference }: { reference: JsonValue }) {
  if (!reference || typeof reference !== "object" || Array.isArray(reference) || !("available" in reference)) return null;
  const current = reference.current && typeof reference.current === "object" && !Array.isArray(reference.current) ? reference.current : null;
  const kind = reference.kind === "task" ? "할 일" : reference.kind === "event" ? "일정" : "기록";
  const title = current && (typeof current.title === "string" ? current.title : typeof current.summary === "string" ? current.summary : null);
  const state = current && typeof current.status === "string" ? ({ open: "미완료", done: "완료", dropped: "제외됨" } as Record<string, string>)[current.status] : null;
  const observed = typeof reference.observedAt === "string" && Number.isFinite(Date.parse(reference.observedAt)) ? observedTime(reference.observedAt) : null;
  const href = reference.kind === "task" ? "/tasks" : reference.kind === "event" ? "/calendar" : null;
  return <div className="mt-2 text-xs text-text-muted"><p>연결된 {kind}{title ? `: ${title}` : ""} · {reference.available === true ? state ?? "원본 확인됨" : "현재 원본을 찾을 수 없습니다"}{observed ? ` · ${observed} 확인` : ""}</p>{href && reference.available === true && <Link className="text-accent underline" href={href}>{kind} 원본 목록 열기</Link>}</div>;
}

export function WorkWorkspace({ inlineApprovalsEnabled = false, automaticAttentionEnabled = false }: { inlineApprovalsEnabled?: boolean; automaticAttentionEnabled?: boolean }) {
  const [contexts, setContexts] = useState<WorkContext[]>([]);
  const [work, setWork] = useState<WorkSnapshot | null>(null);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [preview, setPreview] = useState<WorkInput | null>(null);
  const [previewRequestId, setPreviewRequestId] = useState<string | null>(null);
  const [input, setInput] = useState(""); const [history, setHistory] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("업무를 선택해 이어가거나, 목표·진행·다음 행동을 적어 새 업무로 저장하세요.");
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const request = useRef<{ fingerprint: string; id: string; revision?: number } | null>(null);
  const mutation = useRef<{ fingerprint: string; id: string } | null>(null);
  const inFlight = useRef(false);
  const refreshList = useCallback(async () => {
    const [c,a] = await Promise.all([api<{contexts:WorkContext[]}>("/api/jarvis/work-contexts"), api<{attention:AttentionItem[]}>("/api/jarvis/work-attention")]);
    setContexts(c.contexts); setAttention(a.attention);
  }, []);
  const choose = useCallback(async (id: string) => {
    const data = await api<{work:WorkSnapshot|null}>(`/api/jarvis/work-contexts/${id}`);
    setWork(data.work); setPreview(null); setPreviewRequestId(null); setHistory([]); request.current=null; mutation.current=null;
    setMessage(data.work ? "최신 업무 상태를 불러왔습니다. 작성 중인 입력은 유지됩니다." : "업무가 없거나 이미 잊은 상태입니다. 다른 업무를 선택하세요.");
    const url = new URL(window.location.href); if(data.work) url.searchParams.set("work",id); else url.searchParams.delete("work");
    window.history.replaceState(null,"",url);
  }, []);
  function chooseNewWork() {
    setWork(null); setHistory([]); setPreview(null); setPreviewRequestId(null); request.current=null; mutation.current=null;
    setMessage("새 업무를 시작합니다. 목표·진행·다음 행동을 적어 업무로 저장하세요.");
    const url = new URL(window.location.href); url.searchParams.delete("work"); window.history.replaceState(window.history.state,"",url);
  }
  async function refreshSelectedWork() {
    if (work) await choose(work.context.id);
    else request.current=null;
    // run() refreshes the lists after this. Never discard the unsent input.
  }
  useEffect(() => {
    void refreshList().then(async () => { const id = new URL(window.location.href).searchParams.get("work"); if(id) await choose(id); }).catch(e=>setError(e.message));
  }, [refreshList,choose]);
  const selectedContextId = work?.context.id;
  useEffect(() => {
    if (!selectedContextId) return; const id=selectedContextId;
    const refresh = async () => { if(inFlight.current)return; try { const data=await api<{work:WorkSnapshot|null}>(`/api/jarvis/work-contexts/${id}`); setWork(current=>current?.context.id===id?data.work:current); } catch(e){setError(e instanceof Error?e.message:"업무 재조회 실패");} };
    const timer=setInterval(()=>void refresh(),10000); window.addEventListener("focus",refresh);
    return()=>{clearInterval(timer);window.removeEventListener("focus",refresh);};
  },[selectedContextId]); // refresh must not replace the user's unsent text
  async function run(job:()=>Promise<void>) {
    if(inFlight.current)return; inFlight.current=true;setBusy(true);setError(null);
    try{await job();await refreshList();}catch(e){setError(e instanceof Error?e.message:"처리 실패. 같은 요청으로 다시 확인하세요.");}
    finally{inFlight.current=false;setBusy(false);}
  }
  async function send() {
    const messages=[...history,{role:"user" as const,content:input.trim()}].slice(-6); if(!input.trim())return;
    const body={messages,contextId:work?.context.id??null}; const fingerprint=JSON.stringify(body);
    if(request.current?.fingerprint!==fingerprint)request.current={fingerprint,id:crypto.randomUUID(),revision:work?.context.revision};
    const response=await api<WorkChatReply>("/api/jarvis/work-chat","POST",{...body,expectedRevision:request.current.revision,requestId:request.current.id});
    setWork(response.work);setPreview(response.preview);setPreviewRequestId(response.preview?response.requestId:null);setMessage(response.message);
    setHistory([...messages,{role:"assistant" as const,content:response.message}].slice(-6));setInput("");request.current=null;
    if(response.work){const u=new URL(window.location.href);u.searchParams.set("work",response.work.context.id);window.history.replaceState(null,"",u);}
  }
  async function savePreview() {
    if(!preview)return; const fingerprint=JSON.stringify(preview);
    if(mutation.current?.fingerprint!==fingerprint)mutation.current={fingerprint,id:crypto.randomUUID()};
    const result=await api<{work:WorkSnapshot|null}>("/api/jarvis/work-contexts","POST",{input:preview,requestId:mutation.current.id,previewRequestId});
    setWork(result.work);setPreview(null);setPreviewRequestId(null);setHistory([]);mutation.current=null;setMessage("업무를 저장했습니다. 이후 명시한 진행 상태는 이 업무에 이어서 저장합니다.");
    if(result.work){const u=new URL(window.location.href);u.searchParams.set("work",result.work.context.id);window.history.replaceState(null,"",u);}
  }
  async function changeStatus(operation:"status"|"forget",status?:WorkStatus) {
    if(!work)return;
    const body={operation,status,expectedRevision:work.context.revision};const fingerprint=work.context.id+JSON.stringify(body);
    if(mutation.current?.fingerprint!==fingerprint)mutation.current={fingerprint,id:crypto.randomUUID()};
    const result=await api<{work:WorkSnapshot|null}>(`/api/jarvis/work-contexts/${work.context.id}`,"PATCH",{...body,requestId:mutation.current.id});
    setWork(result.work);setHistory([]);setPreview(null);setPreviewRequestId(null);request.current=null;mutation.current=null;
    if(operation==="forget"){setPreview(null);setInput("");setMessage("업무 맥락과 미래 알림에서 제외했습니다. 기존 할 일·일정·감사 기록은 삭제하지 않았습니다.");const u=new URL(window.location.href);u.searchParams.delete("work");window.history.replaceState(null,"",u);}
  }
  const partial=!!work?.actions.some(a=>a.status==="executed")&&work.actions.some(a=>["failed","expired","rejected","stale"].includes(a.status));
  return <div className="mx-auto max-w-3xl space-y-4">
    <header><h1 className="text-xl font-semibold">업무 이어하기 · JARVIS</h1><p className="mt-2 text-sm text-text-muted">목표·진행·다음 행동을 기억하고, 각 실행안의 결과를 확인합니다.</p></header>
    <Card><div className="flex flex-wrap gap-2"><label className="min-w-48 flex-1 text-sm">진행 업무<select aria-label="진행 업무 선택" className={fieldClass} value={work?.context.id??""} disabled={busy} onChange={e=>{const id=e.target.value;void run(async()=>{if(id)await choose(id);else chooseNewWork();});}}><option value="">새 업무 / 업무 선택</option>{contexts.map(c=><option key={c.id} value={c.id}>{c.goal} · {statusLabels[c.status]}</option>)}</select></label><Button disabled={busy} onClick={()=>void run(refreshSelectedWork)}>새로고침</Button></div></Card>
    {work&&<Card><h2 className="font-semibold">{work.context.goal}</h2><p className="text-xs text-text-muted">{statusLabels[work.context.status]} · 버전 {work.context.revision} · {observedTime(work.context.updatedAt)}</p><dl className="mt-3 space-y-2 text-sm"><dt className="text-text-muted">확인된 진행</dt><dd className="whitespace-pre-wrap">{work.context.progress||"아직 명시하지 않았습니다."}</dd><dt className="text-text-muted">다음 행동</dt><dd>{work.context.nextStep||"다음 행동을 입력해 주세요."}</dd></dl>
      <div className="mt-4 flex flex-wrap gap-2">{["active","paused"].includes(work.context.status)&&<><Button disabled={busy} onClick={()=>void run(()=>changeStatus("status",work.context.status==="active"?"paused":"active"))}>{work.context.status==="active"?"업무 일시 중지":"업무 재개"}</Button><Button disabled={busy} onClick={()=>void run(()=>changeStatus("status","completed"))}>업무 완료로 표시</Button><Button disabled={busy} onClick={()=>void run(()=>changeStatus("status","cancelled"))}>업무 취소</Button></>}<Button disabled={busy} onClick={()=>{if(window.confirm("이 업무 맥락과 미래 알림에서 제외합니다. 기존 할 일·일정·감사 기록은 유지합니다."))void run(()=>changeStatus("forget"));}}>업무 잊기</Button></div><p className="mt-2 text-xs text-text-muted">업무 상태 변경은 연결된 할 일·일정을 자동 완료하거나 삭제하지 않습니다.</p>
      {work.context.sourceRefs.map((ref,i)=><SourceReference key={i} reference={ref}/>)}
    </Card>}
    <Card><p role="status" className="mb-3 whitespace-pre-wrap text-sm">{message}</p><form onSubmit={e=>{e.preventDefault();void run(send);}}><label className="text-sm">업무 요청<textarea aria-label="업무 요청" className={fieldClass} rows={4} value={input} maxLength={2000} disabled={busy} onChange={e=>setInput(e.target.value)} placeholder="이력서 준비를 업무로 저장해. 프로젝트 설명까지 했고 다음은 성과 수치 정리야. 내일 19:00에 알려줘." /></label><Button type="submit" disabled={busy||!input.trim()} variant="primary">{busy?"확인 중…":error?"같은 요청 다시 확인":"업무 요청 보내기"}</Button></form>{error&&<p role="alert" className="mt-2 text-sm text-negative">{error}</p>}</Card>
    {preview&&<Card><h2 className="font-semibold">업무 저장 미리보기</h2>{([['goal','목표'],['progress','확인된 진행'],['nextStep','다음 행동']] as const).map(([key,label])=><label key={key} className="mt-3 block text-sm">{label}<textarea className={fieldClass} aria-label={label} rows={2} value={preview[key]} onChange={e=>setPreview({...preview,[key]:e.target.value})}/></label>)}
      {([['deadlineAt','마감 시각 (JST)'],['reminderAt','직접 알림 시각 (JST)']] as const).map(([key,label])=><label key={key} className="mt-3 block text-sm">{label}<input aria-label={label} className={fieldClass} type="datetime-local" value={fieldTime(preview[key])} onChange={e=>setPreview({...preview,[key]:parseFieldTime(e.target.value)})}/></label>)}
      <label className="mt-3 block text-sm"><input type="checkbox" disabled={!automaticAttentionEnabled} checked={preview.deadlineReminder} onChange={e=>setPreview({...preview,deadlineReminder:e.target.checked})}/> 마감 24시간 전 알림 허용</label><label className="mt-2 block text-sm"><input type="checkbox" disabled={!automaticAttentionEnabled} checked={preview.resumeReminder} onChange={e=>setPreview({...preview,resumeReminder:e.target.checked})}/> 진행 갱신 후 48시간 재개 알림 허용</label>{!automaticAttentionEnabled&&<p className="mt-2 text-xs text-text-muted">마감·중단 조건 자동 알림은 후속 검증 후 제공합니다. 마감 시각 자체는 저장할 수 있습니다.</p>}<p className="my-3 text-xs text-text-muted">직접 지정 알림은 지정 시각을 기준으로 처리하며 22–08 JST·하루 3개 제한의 예외입니다. 네트워크·기기 상태에 따라 전달이 지연될 수 있습니다. 종료 후 맥락은 30일 보관하며 원문 대화는 저장하지 않습니다.</p><Button variant="primary" disabled={busy} onClick={()=>void run(savePreview)}>업무 저장</Button>
    </Card>}
    {work?.actions.length? <section aria-label="업무 실행안" className="space-y-3">
      <h2 className="font-semibold">{partial?"부분 완료 · 각 결과를 확인하세요":"실행안과 결과"}</h2>
      {!inlineApprovalsEnabled&&<p className="text-sm text-text-muted">대화 내 승인이 비활성화되어 있습니다. 실행안과 기존 결과는 확인할 수 있습니다.</p>}
      {work.actions.map(action=><Card key={action.id}>
        <h3 className="font-medium">{action.draft.title}</h3><p className="my-2 text-sm">{statusLabels[action.status]??action.status}</p><PayloadPreview payload={action.draft.payload}/>
        {["proposed","pending"].includes(action.status)&&<div className="mt-3 flex gap-2">
          <Button variant="primary" disabled={busy||!inlineApprovalsEnabled||(!action.draft.canRequestApproval&&action.status!=="pending")} onClick={()=>void run(async()=>{if(!inlineApprovalsEnabled)return;const r=await api<{work:WorkSnapshot}>(`/api/jarvis/work-contexts/${work.context.id}/actions/${action.id}`,"POST",{decision:"approved"});setWork(r.work);})}>승인하고 실행</Button>
          <Button disabled={busy||!inlineApprovalsEnabled} onClick={()=>void run(async()=>{if(!inlineApprovalsEnabled)return;const r=await api<{work:WorkSnapshot}>(`/api/jarvis/work-contexts/${work.context.id}/actions/${action.id}`,"POST",{decision:"rejected"});setWork(r.work);})}>거절</Button>
        </div>}
        {action.error&&<p className="mt-2 text-sm text-negative">{action.error}</p>}{action.result&&<div className="mt-3 text-sm"><PayloadPreview payload={action.result}/><Link className="text-accent underline" href={action.draft.type==="CREATE_TASK"?"/tasks":"/calendar"}>실제 기록 열기</Link></div>}
        <p className="mt-2 text-xs text-text-muted">이 행동만 승인됩니다. 업무 전체의 완료를 의미하지 않습니다.</p>
      </Card>)}
    </section>:null}
    <section aria-label="업무 알림함" className="space-y-3"><h2 className="font-semibold">업무 알림함</h2>{attention.length===0?<p className="text-sm text-text-muted">업무 저장 시 직접 알림을 지정하면 여기에 표시됩니다.</p>:attention.map(item=><Card key={item.id}><p className="text-sm">{item.reason} · {observedTime(item.dueAt)}</p>{item.kind==="explicit"&&<p className="mt-1 text-xs text-text-muted">지정 시각을 기준으로 처리하며 네트워크·기기 상태에 따라 전달이 지연될 수 있습니다.</p>}<p className="text-xs text-text-muted">{statusLabels[item.status]??item.status} {item.deliveries?`· 발송 수락 ${item.deliveries.accepted} / 기기 수신 ${item.deliveries.received} / 열람 ${item.deliveries.opened} / 불확실 ${item.deliveries.uncertain}`:""}</p><div className="mt-2 flex flex-wrap gap-2"><Button disabled={busy} onClick={()=>void run(()=>choose(item.contextId))}>업무 이어하기</Button>{([['hour','1시간 미루기'],['tomorrow','내일 같은 시각'],['disable','이 조건 끄기'],['ack','확인했어요']] as const).map(([operation,label])=><Button key={operation} disabled={busy} onClick={()=>void run(async()=>{await api(`/api/jarvis/work-attention/${item.id}`,"POST",{operation});if(work)await choose(work.context.id);})}>{label}</Button>)}</div></Card>)}</section>
  </div>;
}
