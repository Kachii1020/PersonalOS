import { JarvisConversation } from "@/components/jarvis-chat/conversation";
import { WorkWorkspace } from "@/components/jarvis-chat/work-workspace";

export const metadata = { title: "자비스와 대화 · Personal OS" };
export default function JarvisPage() {
  if(process.env.JARVIS_CONTEXT_ENABLED!=="true")return <JarvisConversation />;
  return <><WorkWorkspace inlineApprovalsEnabled={process.env.JARVIS_INLINE_APPROVALS_ENABLED === "true"} automaticAttentionEnabled={process.env.JARVIS_AUTOMATIC_ATTENTION_ENABLED === "true"}/><details className="mx-auto mt-6 max-w-3xl"><summary className="cursor-pointer text-sm text-text-muted">업무와 무관한 기존 단건 대화</summary><div className="mt-4"><JarvisConversation/></div></details></>;
}
