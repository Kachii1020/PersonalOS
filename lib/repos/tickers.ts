import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type Ticker = {
  id: string;
  symbol: string;
  displayName: string;
  currency: string;
  isIndex: boolean;
  notionPageId: string | null;
  position: number;
};

type TickerRow = {
  id: string;
  symbol: string;
  display_name: string;
  currency: string;
  is_index: boolean;
  notion_page_id: string | null;
  position: number;
};

function toTicker(r: TickerRow): Ticker {
  return {
    id: r.id,
    symbol: r.symbol,
    displayName: r.display_name,
    currency: r.currency,
    isIndex: r.is_index,
    notionPageId: r.notion_page_id,
    position: r.position,
  };
}

/** UI용 조회. 세션 클라이언트. */
export async function listTickers(): Promise<Ticker[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tickers")
    .select("id, symbol, display_name, currency, is_index, notion_page_id, position")
    .order("position");

  if (error) throw new Error(`티커 조회 실패: ${error.message}`);
  return (data ?? []).map(toTicker);
}

/** 잡 전용 조회. 서비스 롤. */
export async function listTickersForJob(): Promise<Ticker[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tickers")
    .select("id, symbol, display_name, currency, is_index, notion_page_id, position")
    .order("position");

  if (error) throw new Error(`티커 조회 실패: ${error.message}`);
  return (data ?? []).map(toTicker);
}

/** 시드. 이미 있는 symbol은 무시. */
export async function seedTickers(
  tickers: Array<{
    symbol: string;
    displayName: string;
    currency: string;
    isIndex: boolean;
  }>,
): Promise<number> {
  if (tickers.length === 0) return 0;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("tickers")
    .upsert(
      tickers.map((t, i) => ({
        symbol: t.symbol,
        display_name: t.displayName,
        currency: t.currency,
        is_index: t.isIndex,
        position: i,
      })),
      { onConflict: "symbol", ignoreDuplicates: true },
    )
    .select("id");

  if (error) throw new Error(`티커 시드 실패: ${error.message}`);
  return data?.length ?? 0;
}
