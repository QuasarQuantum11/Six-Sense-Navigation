import { describe, expect, it } from "vitest";
import { searchBuildings } from "../search";

const buildings = [
  { name: "Learning and Teaching Building" },
  { name: "Menzies Building" },
  { name: "Sir Louis Matheson Library" },
  { name: "Sports and Recreation Centre" },
];

const names = (query: string) =>
  searchBuildings(buildings, query).map((building) => building.name);

describe("building search", () => {
  it.each(["", "   "])("returns every building for a blank query (%j)", (query) => {
    expect(names(query)).toEqual(buildings.map((building) => building.name));
  });

  it("matches part of a name, ignoring case and extra spaces", () => {
    expect(names("LIBRARY")).toEqual(["Sir Louis Matheson Library"]);
    expect(names("  louis   matheson ")).toEqual(["Sir Louis Matheson Library"]);
  });

  it("lists names that start with the query first", () => {
    expect(names("s")).toEqual([
      "Sir Louis Matheson Library",
      "Sports and Recreation Centre",
      "Menzies Building",
    ]);
    expect(names("building")).toEqual([
      "Learning and Teaching Building",
      "Menzies Building",
    ]);
  });

  it("does not match misspellings or out-of-order words", () => {
    expect(names("libary")).toEqual([]);
    expect(names("library matheson")).toEqual([]);
  });
});
