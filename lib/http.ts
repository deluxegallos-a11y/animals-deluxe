import { NextResponse } from "next/server";

const ALLOW = process.env.NEXT_PUBLIC_SITE_URL || "*";

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": ALLOW,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key",
  };
}

export function jsonCors(data: unknown, init: number | ResponseInit = 200) {
  const opts = typeof init === "number" ? { status: init } : init;
  return NextResponse.json(data, { ...opts, headers: { ...corsHeaders(), ...(opts as ResponseInit)?.headers } });
}

export function preflight() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
