import { NextResponse } from "next/server";

// Liveness probe for the ALB target group.
//
// This deliberately does not touch the database. The load balancer polls it
// every few seconds, and a transient Neon blip should not cause ECS to kill
// and replace tasks that are otherwise serving fine.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ status: "ok", uptime: process.uptime() });
}
