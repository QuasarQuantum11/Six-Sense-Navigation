import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { privateRouteHeaders } from "@/lib/navigation/route-input";
import { readRealCrowdData, isMissingCrowdTable } from "@/lib/crowd/data";
import { demoDataset } from "@/lib/crowd/demo";
import { estimateCrowd } from "@/lib/crowd/model";
import { requestInstant } from "@/lib/crowd/time";

const inputSchema = z.object({ mode: z.enum(["real", "demo"]), date: z.string().optional(), time: z.string().optional() }).strict();

export async function POST(request: Request) {
  if (!await getSession()) return Response.json({ error: "Sign in to view crowd estimates." }, { status: 401, headers: privateRouteHeaders });
  let input;
  try { input = inputSchema.safeParse(await request.json()); }
  catch { return Response.json({ error: "A JSON estimate request is required." }, { status: 400, headers: privateRouteHeaders }); }
  if (!input.success) return Response.json({ error: "Choose real or demo mode and a valid date and time." }, { status: 400, headers: privateRouteHeaders });
  const now = new Date();
  let at;
  try { at = requestInstant(input.data.mode, input.data.date, input.data.time, now); }
  catch { return Response.json({ error: input.data.mode === "demo" ? "Choose a time on 2026-10-07 for the simulation." : "Choose an unambiguous Melbourne date and time from the current minute through the next seven days." }, { status: 400, headers: privateRouteHeaders }); }
  try {
    const dataset = input.data.mode === "demo" ? demoDataset() : await readRealCrowdData(now, new Date(at.epochMilliseconds));
    return Response.json(estimateCrowd({ ...dataset, mode: input.data.mode, at, now }), { headers: privateRouteHeaders });
  } catch (error) {
    return Response.json({ error: isMissingCrowdTable(error) ? "Real crowd estimates are not set up on this deployment yet. You may explicitly choose simulated data." : "Crowd estimates are temporarily unavailable. Please try again." }, { status: 503, headers: privateRouteHeaders });
  }
}
