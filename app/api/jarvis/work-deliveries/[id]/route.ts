import type { NextRequest } from "next/server";
import { observeWorkDelivery } from "@/lib/repos/work-attention";
import { handleWorkDeliveryObservation } from "@/lib/jarvis/work-delivery-observation";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
 return handleWorkDeliveryObservation(request, (await params).id, observeWorkDelivery);
}
