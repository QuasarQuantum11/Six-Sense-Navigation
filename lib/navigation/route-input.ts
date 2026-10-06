import { z } from "zod";

export const routeInputSchema = z.object({
  start_lat: z.number().finite().min(-90).max(90),
  start_lon: z.number().finite().min(-180).max(180),
  end_lat: z.number().finite().min(-90).max(90),
  end_lon: z.number().finite().min(-180).max(180),
});

export const ltbRouteInputSchema = routeInputSchema.pick({ start_lat: true, start_lon: true }).extend({
  end_node: z.string().regex(/^[A-Za-z0-9_]{1,64}$/),
});

export const privateRouteHeaders = { "Cache-Control": "private, no-store" };
