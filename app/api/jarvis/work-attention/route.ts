import type { NextRequest } from "next/server";
import { workHttp } from "@/lib/jobs/work-http";
import { listWorkAttention } from "@/lib/repos/work-attention";
export async function GET(request: NextRequest) { return workHttp(request, async () => ({ attention: await listWorkAttention() })); }
