
import { z } from "zod";
import { privateRouteHeaders } from "@/lib/navigation/route-input";

const indoorRouteSchema = z.object({
  start_node: z.string().regex(/^[A-Za-z0-9_]{1,64}$/),
  end_node: z.string().regex(/^[A-Za-z0-9_]{1,64}$/),
  walking_speed: z.enum(["accessible", "normal", "fast"]).default("normal"),
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "A JSON route request is required." },
      { status: 400, headers: privateRouteHeaders },
    );
  }

  const parsed = indoorRouteSchema.safeParse(body);

    if (!parsed.success) {
    console.error("Invalid indoor route request:", {
        body,
        issues: parsed.error.issues,
    });

    return Response.json(
        { error: "Select valid starting and destination locations." },
        { status: 400, headers: privateRouteHeaders },
    );
    }

  const { start_node, end_node, walking_speed } = parsed.data;

  if (start_node === end_node) {
    return Response.json(
      { error: "Choose two different locations." },
      { status: 400, headers: privateRouteHeaders },
    );
  }

  try {
    const base =
      process.env.API_BASE_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      (process.env.NODE_ENV === "development"
        ? "http://localhost:8000"
        : "https://six-sense-navigation-api.onrender.com");

    const url = new URL(
      `${base.replace(/\/$/, "")}/api/indoor-route`,
    );

    if (
      url.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !== "production" &&
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      )
    ) {
      throw new Error("Routing API requires HTTPS.");
    }

    url.searchParams.set("start_node", start_node);
    url.searchParams.set("end_node", end_node);
    url.searchParams.set("walking_speed", walking_speed);

    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });

    
    const responseText = await response.text();

    let data: { detail?: string; error?: string };

    try {
    data = JSON.parse(responseText);
    } catch {
    console.error("Indoor backend returned non-JSON:", {
        status: response.status,
        body: responseText.slice(0, 1000),
    });

    return Response.json(
        { error: `Indoor backend error (HTTP ${response.status}). Check the Python backend logs.` },
        { status: 502, headers: privateRouteHeaders },
    );
    }


    if (!response.ok) {
      return Response.json(
        { error: data.detail ?? data.error ?? "No indoor route was found." },
        { status: response.status, headers: privateRouteHeaders },
      );
    }

    return Response.json(data, { headers: privateRouteHeaders });
  
    } catch (error) {
    console.error("Indoor routing proxy failed:", error);

    return Response.json(
        { error: "The indoor routing service is unavailable. Please try again." },
        { status: 502, headers: privateRouteHeaders },
    );
    }

}
