import type { DialogueReadFilters } from "./dialogue-types";

/** Only user-authored, supported constraints are consumed. Any residual
 * modifier fails closed instead of disappearing from a broader query. */
export function deriveDialogueReadFilters(kind: "read_tasks" | "read_career" | "read_calendar", content: string, dateText: string | null = null): DialogueReadFilters | null {
  let text = content;
  const filters: DialogueReadFilters = {};
  let invalid = false;
  const set = <K extends keyof DialogueReadFilters>(key: K, value: DialogueReadFilters[K]) => {
    if (filters[key] !== undefined && filters[key] !== value) invalid = true;
    filters[key] = value;
  };
  text = text.replace(/제목(?:에|이)?\s*["“']([^"”'\r\n]{1,200})["”'](?:이|가)?\s*(?:들어간|포함된|포함하는|포함)?(?:\s*것만)?/g, (_match, keyword: string) => { if (!keyword.trim()) invalid = true; set("keyword", keyword); return " "; });
  if (dateText && kind === "read_calendar") {
    text = text.replace(dateText, " ");
  } else if (dateText) {
    if (kind !== "read_tasks" || !/(?:마감|기한)/.test(text)) return null;
    const datePattern = dateText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const deadlinePhrase = new RegExp(`(?:${datePattern}(?:에)?\\s*(?:마감|기한)(?:일인|인|일|이)?|(?:마감|기한)(?:일|이)?\\s*${datePattern}(?:인|인것)?)`);
    if (!deadlinePhrase.test(text)) return null;
    text = text.replace(deadlinePhrase, " ");
  }
  if (kind === "read_tasks") {
    text = text.replace(/완료\s*여부와\s*관계없이|완료와\s*미완료를\s*구분하지\s*말고|모든\s*상태(?:의|로)?|상태\s*무관/g, () => { set("taskStatus", "all"); return " "; });
    text = text.replace(/미\s*완료(?:된|한|인)?|아직\s*끝내지\s*않은|끝내지\s*않은|안\s*끝난|남은|진행\s*중(?:인)?/g, () => { set("taskStatus", "open"); return " "; });
    text = text.replace(/완료(?:된|한|인)?|끝낸|끝난|마친/g, () => { set("taskStatus", "done"); return " "; });
    text = text.replace(/우선\s*순위(?:가)?\s*(?:높은\s*)?순(?:서)?(?:으로)?|우선\s*순위\s*내림차순/g, () => { set("order", "priority"); return " "; });
    text = text.replace(/마감(?:이)?\s*가까운\s*순(?:서)?(?:으로)?|마감(?:일)?\s*순(?:서)?(?:으로)?|기한\s*순(?:서)?(?:으로)?/g, () => { set("order", "due"); return " "; });
    text = text.replace(/할\s*일|태스크|tasks?/gi, " ");
  } else if (kind === "read_career") {
    text = text.replace(/(?:지원\s*)?자격(?:을|이)?\s*충족하지\s*못한다고\s*판정된|(?:지원\s*)?자격(?:을|이)?\s*충족하지\s*못한|not_eligible/g, () => { set("eligibility", "not_eligible"); return " "; });
    text = text.replace(/(?:지원\s*)?자격(?:이)?\s*(?:아직\s*)?(?:불확실한|미확정인|확인\s*필요한)|possibly_eligible/g, () => { set("eligibility", "possibly_eligible"); return " "; });
    text = text.replace(/(?:지원\s*)?자격(?:이)?\s*(?:확인된|확정된)|confirmed_eligible/g, () => { set("eligibility", "confirmed_eligible"); return " "; });
    text = text.replace(/다음\s*모집\s*주기(?:로\s*분류된|인)?|next_cycle/g, () => { set("eligibility", "next_cycle"); return " "; });
    text = text.replace(/커리어|지원\s*기회|기회|채용|공고|career|opportunities/gi, " ");
  } else {
    text = text.replace(/(?:일본\s*시간|\bJST\b|Asia\/Tokyo)(?:\s*기준)?/gi, " ").replace(/일정|캘린더|calendar/gi, " ");
  }
  // These are request/list boilerplate, not conditions or inferred defaults.
  text = text.replace(/확인하고\s*싶어|보고\s*싶어|등록된|저장된|들어있는|있는|보여\s*(?:주세요|줄래|줘)|알려\s*(?:주세요|줄래|줘)|(?:조회|확인)해\s*(?:주세요|줘)?|부탁해|뭐가\s*있나요|뭐가\s*있어|뭐\s*있어|뭐야|현재|지금|전체|목록|리스트|조회|주세요|please|current|show|list|my|내|좀|중|것만|항목|부터|만|을|를|은|는|이|가|에|요|[\s,.!?]/gi, "");
  return invalid || text.length > 0 || (kind === "read_calendar" && Object.keys(filters).length > 0) ? null : filters;
}
