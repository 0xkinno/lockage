import { NextResponse, type NextRequest } from "next/server";
import { cachedSurvey, rateLimited, RATE_LIMIT } from "@/lib/survey-api";

export const dynamic = "force-dynamic";

/**
 * GET /api/survey?address=0x...
 * GET /api/survey?decimals=18&supply=1000000000000&rename=1&mint=0&tax=0
 * The five lines as JSON, each with its verdict and the HyperCore rule behind it. Cached for 60 seconds, rate limited per IP,
 * and the response names the RPC that answered.
 */
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, error: `rate limit: ${RATE_LIMIT.perMinute} requests per minute per IP` }, { status: 429, headers: { "Retry-After": "30" } });
  }
  const { body, cached } = await cachedSurvey(req.nextUrl.searchParams);
  const status = body.ok ? 200 : body.status;
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": body.ok ? "public, s-maxage=60, stale-while-revalidate=30" : "no-store",
      "X-LOCKAGE-Cache": cached ? "hit" : "miss",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
