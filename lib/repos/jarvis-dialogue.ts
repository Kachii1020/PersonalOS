import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCareerDashboardForClient } from "./career";
import { isCalendarExecutorEnabled, readCalendarTargetForDraft } from "./jarvis-calendar-actions";
import { upsertEvents } from "./events";
import { expandOccurrences } from "@/lib/integrations/caldav/rrule";
import { callStructured } from "@/lib/ai/client";
import { DIALOGUE_SCHEMA, DIALOGUE_SYSTEM, buildDialoguePrompt } from "@/lib/ai/prompts/dialogue";
import { groundDialogueIntent, validateDialogueIntent } from "@/lib/jarvis/dialogue-grounding";
import { parseCreateTaskPayload } from "@/lib/jarvis/action-payload";
import { parseCalendarActionPayload } from "@/lib/jarvis/calendar-action-payload";
import { dialogueTaskStatusLabel, filterDialogueCareer, literalContainsPattern } from "@/lib/jarvis/dialogue-record-filters";
import type { ChatMessage, ChatReply, DialogueDraft, DialogueFact, DialogueIntent, DialogueReadFilters } from "@/lib/jarvis/dialogue-types";
import type { JsonValue } from "@/lib/jarvis/types";

type Client = SupabaseClient<Database>;
type CalendarRow = Database["public"]["Tables"]["calendars"]["Row"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];
export class DialogueRequestError extends Error { constructor(message: string, readonly status = 400) { super(message); this.name = "DialogueRequestError"; } }
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const DAY = 86_400_000;
const jstDate = (now: Date) => new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
const describeTime = (time: string | null) => time ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Tokyo", dateStyle: "short", timeStyle: "short" }).format(new Date(time)) : "명시 없음";
export const calendarDialogueExecutionReady = isCalendarExecutorEnabled;

export function validateChatMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 6) throw new DialogueRequestError("대화는 최근 6개 메시지까지 보낼 수 있습니다.");
  const messages = input.map((item): ChatMessage => {
    if (!item || typeof item !== "object" || Array.isArray(item) || Object.keys(item).some((key) => !["role", "content"].includes(key))) throw new DialogueRequestError("대화 형식을 확인하세요.");
    const { role, content } = item as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string" || !content.trim() || content.length > 2000) throw new DialogueRequestError("메시지는 1~2,000자로 입력하세요.");
    return { role, content: content.trim() };
  });
  if (messages[messages.length - 1].role !== "user") throw new DialogueRequestError("마지막 메시지는 사용자 요청이어야 합니다.");
  return messages;
}
export async function requireDialogueOwner() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new DialogueRequestError("로그인이 필요합니다.", 401);
  const allowed = await client.rpc("is_allowed_user");
  if (allowed.error || !allowed.data) throw new DialogueRequestError("허용된 계정만 사용할 수 있습니다.", 403);
  return { client, ownerId: data.user.id };
}

export async function readDialogueTasks(client: Client, now: Date, filters: DialogueReadFilters = {}, day: string | null = null) {
  let query = client.from("tasks").select("id,title,due_at,status,priority", { count: "exact" });
  if (filters.taskStatus !== "all") query = query.eq("status", filters.taskStatus ?? "open");
  if (day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || new Date(day).toISOString().slice(0, 10) !== day) throw new DialogueRequestError("마감 날짜를 확인하세요.");
    const start = new Date(`${day}T00:00:00+09:00`).toISOString();
    query = query.gte("due_at", start).lt("due_at", new Date(Date.parse(start) + DAY).toISOString());
  }
  if (filters.keyword) query = query.filter("title", "imatch", literalContainsPattern(filters.keyword));
  if (filters.order === "priority") query = query.order("priority", { ascending: false, nullsFirst: false });
  const result = await query.order("due_at", { ascending: true, nullsFirst: false }).order("id").limit(20);
  if (result.error) throw new Error(`할 일 조회 실패: ${result.error.message}`);
  const facts: DialogueFact[] = result.data.map(row => ({ id: `task:${row.id}`, title: row.title,
    detail: `${dialogueTaskStatusLabel(row.status)} 할 일 · 마감 ${describeTime(row.due_at)} (JST) · 우선순위 점수 ${row.priority ?? "미지정"}`,
    href: "/tasks", observedAt: now.toISOString() }));
  return { facts, count: result.count ?? facts.length,
    warnings: (result.count ?? 0) > 20 ? [`조건에 맞는 할 일 중 ${filters.order === "priority" ? "우선순위 점수" : "마감"}순 20개만 표시합니다.`] : [] };
}

export async function readDialogueSnapshot(client: Client, now: Date, day = jstDate(now), days = 14) {
  const from = new Date(`${day}T00:00:00+09:00`).toISOString();
  const to = new Date(Date.parse(from) + days * DAY).toISOString();
  const [tasks, calendars, candidates] = await Promise.all([
    readDialogueTasks(client, now),
    client.from("calendars").select("*").order("id").limit(100),
    client.from("events").select("*").lt("starts_at", to).or(`ends_at.gt.${from},rrule.not.is.null`).order("starts_at").order("id").limit(201),
  ]);
  for (const result of [calendars, candidates]) if (result.error) throw new Error(`대화 데이터 조회 실패: ${result.error.message}`);
  const warnings: string[] = [...tasks.warnings];
  if (candidates.data!.length > 200) warnings.push("일정 후보가 많아 일부만 조회했습니다. 조회 범위를 좁혀 주세요.");
  if (calendars.data!.length === 100) warnings.push("캘린더 조회 한도에 도달했습니다. 쓰기 대상은 별도로 다시 확인합니다.");
  const observedAt = now.toISOString();
  const taskFacts = tasks.facts;
  const eventCandidates: (DialogueFact & { startsAt: string })[] = [];
  const eventRows = new Map<string, EventRow>();
  let occurrenceCount = 0;
  let eventComplete = candidates.data!.length <= 200;
  for (const row of candidates.data!.slice(0, 200)) {
    const calendar = calendars.data!.find((value) => value.id === row.calendar_id);
    if (!calendar?.last_synced_at || now.getTime() - Date.parse(calendar.last_synced_at) > 5 * 60_000) {
      warnings.push("캘린더는 저장된 동기화 결과입니다. 실제 빈 시간이나 최신 변경을 확정하지 않습니다.");
    }
    if (row.rrule) {
      eventComplete = false;
      warnings.push("반복 일정은 표시용 전개 결과입니다. 전체 건수나 빈 시간의 확정 근거로 사용하지 않습니다.");
    }
    try {
      const occurrences = expandOccurrences({ startsAt: row.starts_at, endsAt: row.ends_at, isAllDay: row.is_all_day, rrule: row.rrule, exdates: row.exdates ?? [] }, new Date(from), new Date(to));
      occurrenceCount += occurrences.length;
      for (const occurrence of occurrences.slice(0, 20)) {
        const id = row.rrule ? `occurrence:${row.id}:${occurrence.startsAt}` : `event:${row.id}`;
        eventCandidates.push({ id, title: row.summary, startsAt: occurrence.startsAt, detail: `${describeTime(occurrence.startsAt)}–${describeTime(occurrence.endsAt)} (JST)${row.rrule ? " · 반복 일정(변경 제외)" : ""}`, href: "/calendar", observedAt: calendar?.last_synced_at ?? observedAt });
        if (!row.rrule) eventRows.set(id, row);
      }
    } catch { eventComplete = false; warnings.push("일부 일정의 반복 규칙을 읽지 못했습니다. 캘린더 원본을 확인하세요."); }
  }
  const eventFacts: DialogueFact[] = eventCandidates.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id)).slice(0, 20).map(({ id, title, detail, href, observedAt }) => ({ id, title, detail, href, observedAt }));
  if (occurrenceCount > 20) warnings.push("일정은 조회한 항목 중 시작 시각순 20개만 표시합니다.");
  return { taskFacts, eventFacts, eventRows, calendars: calendars.data!, taskCount: tasks.count ?? taskFacts.length, occurrenceCount,
    eventComplete, warnings: [...new Set(warnings)], taskWarnings: tasks.warnings, from, to, observedAt };
}

async function writableCalendar(client: Client): Promise<CalendarRow> {
  const result = await client.from("calendars").select("*").eq("is_writable", true);
  if (result.error) throw result.error;
  if (result.data.length !== 1 || result.data[0].kind !== "caldav" || result.data[0].display_name !== (process.env.APP_CALENDAR_NAME ?? "Personal OS")) throw new DialogueRequestError("설정된 앱 전용 캘린더가 정확히 하나인지 동기화 상태를 확인하세요.");
  return result.data[0];
}
export async function createDialogueDraftForOwner(input: {
  ownerId: string; type: DialogueDraft["type"]; title: string; explanation: string;
  payload: JsonValue; sourceSnapshot: JsonValue; executable: boolean;
}): Promise<DialogueDraft> {
  const result = await createAdminClient().from("dialogue_action_drafts").insert({ owner_id: input.ownerId, action_type: input.type,
    title: input.title, explanation: input.explanation, payload: input.payload, source_snapshot: input.sourceSnapshot, executable: input.executable }).select("id,expires_at").single();
  if (result.error) throw new Error(`대화 제안 저장 실패: ${result.error.message}`);
  return { id: result.data.id, type: input.type, title: input.title, explanation: input.explanation, payload: input.payload,
    expiresAt: result.data.expires_at, canRequestApproval: input.executable };
}

export async function answerDialogue(input: { messages: ChatMessage[]; selectedSourceId?: string | null }, dependencies?: {
  owner?: { client: Client; ownerId: string };
  interpret?: (messages: ChatMessage[], sources: DialogueFact[], now: Date) => Promise<DialogueIntent>;
}) : Promise<ChatReply> {
  const messages = validateChatMessages(input.messages);
  const { client, ownerId } = dependencies?.owner ?? await requireDialogueOwner();
  const now = new Date();
  let snapshot = await readDialogueSnapshot(client, now);
  let careerFacts: DialogueFact[] = [];
  let careerRows: Awaited<ReturnType<typeof getCareerDashboardForClient>>["opportunities"] = [];
  const careerFact = (row: typeof careerRows[number]): DialogueFact => ({ id: `opportunity:${row.id}`, title: row.title,
    detail: `자격 ${row.assessment.eligibility} · 모집 ${row.assessment.lifecycle} · 선택 ${row.decision}`,
    href: `/opportunities/${row.id}`, observedAt: row.source?.checkedAt ?? now.toISOString() });
  try {
    // Only derived status/title enter model context, never raw career facts,
    // requirements, documents, descriptions or full source snapshots.
    const career = await getCareerDashboardForClient(client);
    careerRows = career.opportunities;
    careerFacts = careerRows.slice(0, 20).map(careerFact);
    if (career.opportunities.length > 20) snapshot.warnings.push("지원 기회는 최근 20개만 조회했습니다.");
  } catch { snapshot.warnings.push("지원 기회를 조회하지 못했습니다. 해당 정보는 답변 근거로 사용하지 않습니다."); }
  const sources = [...snapshot.taskFacts, ...snapshot.eventFacts, ...careerFacts];
  if (input.selectedSourceId && !snapshot.eventRows.has(input.selectedSourceId)) throw new DialogueRequestError("선택한 일정이 현재 조회 범위에 없습니다. 다시 조회하고 선택하세요.");
  const sourceIds = sources.map((source) => source.id);
  const intent = dependencies?.interpret ? await dependencies.interpret(messages, sources, now) : validateDialogueIntent((await callStructured<unknown>({
    purpose: "dialogue", system: DIALOGUE_SYSTEM, userMessage: buildDialoguePrompt(messages, sources, now, input.selectedSourceId), schema: DIALOGUE_SCHEMA,
    maxTokens: 1800, effort: "low", retries: 0, timeoutMs: 45_000,
  })).data);
  if (intent.kind === "update_calendar" && input.selectedSourceId) intent.sourceId = input.selectedSourceId;
  const grounded = groundDialogueIntent(intent, messages, now, sourceIds, input.selectedSourceId);
  const base = { observedAt: now.toISOString(), warnings: snapshot.warnings, facts: [] as DialogueFact[], draft: null };
  if (grounded.needsClarification) return { ...base, mode: "clarify", message: grounded.message };
  if (grounded.kind === "read_tasks") {
    const filters = grounded.readFilters ?? {};
    const tasks = await readDialogueTasks(client, now, filters, grounded.queryDate);
    const conditions = [filters.taskStatus === "all" ? "모든 상태" : filters.taskStatus === "done" ? "완료" : "미완료",
      ...(grounded.queryDate ? [`${grounded.queryDate} 마감(JST)`] : []), ...(filters.keyword ? [`제목에 “${filters.keyword}” 포함`] : []),
      filters.order === "priority" ? "우선순위 점수 높은 순" : "마감 가까운 순"];
    return { ...base, mode: "answer", message: `조회 조건: ${conditions.join(" · ")}. 조건에 맞는 할 일은 ${tasks.count}개입니다.`, facts: tasks.facts,
      warnings: [...new Set([...base.warnings.filter(warning => !snapshot.taskWarnings.includes(warning)), ...tasks.warnings])] };
  }
  if (grounded.kind === "read_career") {
    const filters = grounded.readFilters ?? {};
    const rows = filterDialogueCareer(careerRows, filters);
    const conditions = [filters.eligibility ? `자격 분류 ${filters.eligibility}` : "모든 자격 분류", ...(filters.keyword ? [`제목에 “${filters.keyword}” 포함`] : [])];
    return { ...base, mode: "answer", message: `조회 조건: ${conditions.join(" · ")}. 현재 조회에서 ${rows.length}개를 확인했습니다. 조회 오류·조건 확인 필요는 지원 가능 확정이 아닙니다.`,
      facts: rows.slice(0, 20).map(careerFact), warnings: [...base.warnings, ...(rows.length > 20 ? ["조건에 맞는 지원 기회 중 최근 20개만 표시합니다."] : [])] };
  }
  if (grounded.kind === "read_calendar") {
    if (grounded.queryDate) snapshot = await readDialogueSnapshot(client, now, grounded.queryDate, 1);
    return { ...base, mode: "answer", message: `${describeTime(snapshot.from)}부터 ${describeTime(snapshot.to)}까지 저장된 일정${snapshot.eventComplete ? ` ${snapshot.occurrenceCount}개` : " 중 조회한 항목"}입니다.`, facts: snapshot.eventFacts, warnings: snapshot.warnings };
  }
  let type: DialogueDraft["type"];
  let payload: JsonValue;
  let title: string;
  const sourceSnapshot: Record<string, JsonValue> = { observedAt: now.toISOString(), timezone: "Asia/Tokyo",
    requestHash: hash(messages.filter((value) => value.role === "user").map((value) => value.content).join("\n")),
    fieldEvidence: grounded.evidence.map(({ messageIndex, text }) => ({ messageIndex, text })),
    targetOrigin: input.selectedSourceId ? "explicit_user_selection" : grounded.sourceId ? "unique_user_title" : "new_user_request" };
  if (grounded.kind === "create_task") {
    type = "CREATE_TASK";
    const task = parseCreateTaskPayload({ title: grounded.title, dueAt: grounded.startsAt });
    payload = task; title = `할 일 추가: ${task.title}`;
  } else {
    const calendar = await writableCalendar(client);
    sourceSnapshot.calendarUrlHash = hash(calendar.source_url);
    const common = { version: 1, calendarId: calendar.id, summary: grounded.title, startsAt: grounded.startsAt, endsAt: grounded.endsAt,
      timezone: "Asia/Tokyo", description: null, location: null };
    if (grounded.kind === "update_calendar") {
      type = "UPDATE_CALENDAR_EVENT";
      const event = snapshot.eventRows.get(grounded.sourceId ?? "");
      if (!event || event.calendar_id !== calendar.id || event.source !== "app" || event.is_all_day || event.rrule) return { ...base, mode: "clarify", message: "앱에서 만든 단일 시간 일정만 수정할 수 있습니다." };
      const named = messages.filter((value) => value.role === "user").some((value) => value.content.includes(event.summary));
      const sameTitles = [...snapshot.eventRows.values()].filter((value) => value.summary === event.summary).length;
      if (!input.selectedSourceId && (!named || sameTitles !== 1)) return { ...base, mode: "clarify", message: "수정할 일정을 조회한 뒤 ‘수정 대상으로 선택’을 눌러 주세요.", facts: snapshot.eventFacts };
      if (!event.etag && !calendarDialogueExecutionReady()) return { ...base, mode: "clarify", message: "일정의 버전 정보가 없습니다. 캘린더를 동기화한 뒤 다시 요청하세요." };
      let remoteHash: string | null = null;
      if (calendarDialogueExecutionReady()) {
        const remote = await readCalendarTargetForDraft(calendar.source_url, event.caldav_href);
        if (remote.uid !== event.caldav_uid) throw new DialogueRequestError("원격 일정의 대상이 달라졌습니다. 다시 조회하세요.", 409);
        await upsertEvents(calendar.id, [{ ...remote.parsedEvent, href: event.caldav_href, etag: remote.etag }], "app");
        const current = await client.from("events").select("*").eq("id", event.id).single();
        if (current.error || !current.data || current.data.caldav_uid !== remote.uid) throw new DialogueRequestError("일정 상태가 변경됐습니다. 다시 조회하세요.", 409);
        Object.assign(event, current.data);
        remoteHash = remote.snapshotHash;
      }
      sourceSnapshot.eventUpdatedAt = event.updated_at;
      sourceSnapshot.eventHrefHash = hash(event.caldav_href);
      payload = parseCalendarActionPayload(type, { ...common, summary: grounded.title ?? event.summary, description: event.description, location: event.location, eventId: event.id,
        expectedUid: event.caldav_uid, expectedEtag: event.etag, beforeSnapshotHash: remoteHash ?? hash(JSON.stringify({ id: event.id, updatedAt: event.updated_at, etag: event.etag })) });
      sourceSnapshot.requiresRemoteSnapshot = remoteHash === null;
      title = `일정 변경: ${(payload as { summary: string }).summary}`;
    } else {
      type = "CREATE_CALENDAR_EVENT";
      payload = parseCalendarActionPayload(type, common); title = `일정 추가: ${(payload as { summary: string }).summary}`;
    }
  }
  const executable = type === "CREATE_TASK" || calendarDialogueExecutionReady();
  const explanation = `${grounded.message} 실제 변경은 별도 승인 후에만 실행됩니다.`;
  const draft = await createDialogueDraftForOwner({ ownerId, type, title, explanation, payload, sourceSnapshot, executable });
  return { ...base, mode: "propose", message: executable ? "입력에서 확인한 실행안입니다. 내용 확인 후 승인함으로 보낼 수 있습니다." : "입력에서 확인한 일정 초안입니다. 캘린더 실행기 연결 전에는 승인 요청을 만들 수 없습니다.", draft };
}

export async function requestDialogueApproval(id: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new DialogueRequestError("제안 ID를 확인하세요.");
  const { client } = await requireDialogueOwner();
  const result = await client.rpc("request_dialogue_approval", { p_draft_id: id });
  if (result.error) throw new DialogueRequestError("제안이 만료됐거나 대상 상태가 바뀌었습니다. 다시 요청해 주세요.", 409);
  return result.data;
}
export async function pruneDialogueDraftsForJob(): Promise<number> {
  const result = await createAdminClient().rpc("prune_dialogue_drafts");
  if (result.error) throw new Error(`초안 정리 실패: ${result.error.message}`);
  return result.data;
}
