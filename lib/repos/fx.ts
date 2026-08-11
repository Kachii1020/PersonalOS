import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type FxRate = {
  asOf: string;
  base: string;
  quote: string;
  rate: number;
};

/** 잡 전용. upsert by (as_of, base, quote). */
export async function upsertFxRates(
  rows: Array<{ asOf: string; base: string; quote: string; rate: number }>,
): Promise<number> {
  if (rows.length === 0) return 0;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("fx_rates")
    .upsert(
      rows.map((r) => ({
        as_of: r.asOf,
        base: r.base,
        quote: r.quote,
        rate: r.rate,
      })),
      { onConflict: "as_of,base,quote" },
    )
    .select("id");

  if (error) throw new Error(`환율 저장 실패: ${error.message}`);
  return data?.length ?? 0;
}

/** UI용. 특정 페어의 최신 환율. */
export async function latestFxRate(base: string, quote: string): Promise<FxRate | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fx_rates")
    .select("as_of, base, quote, rate")
    .eq("base", base)
    .eq("quote", quote)
    .order("as_of", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`환율 조회 실패: ${error.message}`);
  if (!data) return null;
  return { asOf: data.as_of, base: data.base, quote: data.quote, rate: Number(data.rate) };
}
