"use server";

import { revalidateTag } from "next/cache";

/** 6시간 캐시를 기다리지 않고 지금 다시 받는다 (SPEC.md 12절). */
export async function refreshWiki(): Promise<void> {
  revalidateTag("wiki");
}
