import { ltbRouteInputSchema, privateRouteHeaders } from "@/lib/navigation/route-input";

// Keep browser coordinates on our origin; forward only the validated fields.
export async function POST(request: Request) {
  let input: unknown;
  try { input = await request.json(); }
  catch { return Response.json({ error: "A JSON route request is required." }, { status: 400, headers: privateRouteHeaders }); }
  const parsed = ltbRouteInputSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json({ error: "A valid start and LTB destination are required." }, { status: 400, headers: privateRouteHeaders });
  }
  try {
    const base = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ??
      (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "https://six-sense-navigation-api.onrender.com");
    const url = new URL(`${base.replace(/\/$/, "")}/api/ltb-route`);
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) {
      throw new Error("Routing API requires HTTPS.");
    }
    const response = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data), cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error("Routing service unavailable.");
    const data = await response.json();
    if (data.error || !Array.isArray(data.indoor_path) || data.indoor_path.length === 0) {
      return Response.json({ error: "No LTB route was found." }, { status: 422, headers: privateRouteHeaders });
    }
    return Response.json(data, { headers: privateRouteHeaders });
  } catch {
    return Response.json({ error: "The LTB routing service is unavailable. Please try again." }, { status: 502, headers: privateRouteHeaders });
  }
}
