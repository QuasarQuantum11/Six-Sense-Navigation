import { readFileSync } from "node:fs";

// Fixture adapter for the committed OSM GraphML; matches importer field types.
const xml = readFileSync(new URL("../../../components/monash_graph.graphml", import.meta.url), "utf8");
const keys = new Map([...xml.matchAll(/<key id="([^"]+)"[^>]*attr.name="([^"]+)"/g)].map((m) => [m[1], m[2]]));
function data(body: string) {
  return Object.fromEntries([...body.matchAll(/<data key="([^"]+)">([^<]*)<\/data>/g)].map((m) => [keys.get(m[1]), m[2]]));
}
export const nodes = [...xml.matchAll(/<node id="(\d+)">([\s\S]*?)<\/node>/g)].map((m) => {
  const d = data(m[2]);
  return { id: Number(m[1]), latitude: Number(d.y), longitude: Number(d.x), streetCount: Number(d.street_count) };
});
export const edges = [...xml.matchAll(/<edge source="(\d+)" target="(\d+)"[^>]*>([\s\S]*?)<\/edge>/g)].map((m, id) => {
  const d = data(m[3]);
  const first = (value: string | undefined) => value?.startsWith("[") ? JSON.parse(value.replace(/'/g, '"'))[0] : value;
  return {
    id, fromNode: Number(m[1]), toNode: Number(m[2]), osmid: Number(first(d.osmid)),
    length: Number(d.length), weight: d.weight ? Number(first(d.weight)) : null,
    oneway: d.oneway === "True", geometry: d.geometry ?? null,
    name: d.name ?? null, highway: d.highway ?? null,
  };
});
