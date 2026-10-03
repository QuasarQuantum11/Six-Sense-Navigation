import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "@e965/xlsx";
import { parseAllocatePlusWorkbook } from "./allocate-plus";

function makeWorkbook(rows: unknown[][]): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rows),
    "Allocate+",
  );
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xls" });
  return bytes as ArrayBuffer;
}

describe("parseAllocatePlusWorkbook", () => {
  it("parses the supplied Allocate+ export", () => {
    const bytes = Uint8Array.from(
      readFileSync(resolve(process.cwd(), "timetable-35090812.xls")),
    );
    const entries = parseAllocatePlusWorkbook(bytes.buffer);

    expect(entries).toHaveLength(5);
    expect(entries[0]).toMatchObject({
      day: "Thursday",
      time: "10:00",
      location: "Science Building",
      room: "CG10",
      subjectCode: "FIT3080_CL_S2_BLENDED",
    });
    expect(entries.at(-1)).toMatchObject({
      day: "Wednesday",
      location: "Learning and Teaching Building",
      room: "G02",
    });
  });

  it("skips leading blank rows and parses Allocate+ class details", () => {
    const data = makeWorkbook([
      [],
      [
        "Subject Code",
        "Description",
        "Group",
        "Activity",
        "Day",
        "Time",
        "Campus",
        "Location",
        "Staff",
        "Duration",
        "Dates",
      ],
      [
        "FIT3162_CL_S2_ON-CAMPUS",
        "COMP SC PROJ 2",
        "Studio",
        "03_OnCampus",
        "Wed",
        "14:00",
        "CL",
        "CL_Anc-19.LTB_G02",
        "-",
        "3 hrs",
        "29/7-16/9, 30/9-21/10",
      ],
    ]);

    expect(parseAllocatePlusWorkbook(data)).toEqual([
      {
        day: "Wednesday",
        time: "14:00",
        location: "Learning and Teaching Building",
        subjectCode: "FIT3162_CL_S2_ON-CAMPUS",
        subjectDescription: "COMP SC PROJ 2",
        classGroup: "Studio",
        activity: "03_OnCampus",
        campus: "CL",
        sourceLocation: "CL_Anc-19.LTB_G02",
        room: "G02",
        staff: "",
        duration: "3 hrs",
        classDates: "29/7-16/9, 30/9-21/10",
      },
    ]);
  });

  it("rejects workbooks without the expected Allocate+ headers", () => {
    const data = makeWorkbook([["Day", "Time"], ["Mon", "10:00"]]);

    expect(() => parseAllocatePlusWorkbook(data)).toThrow(
      "Could not find the Allocate+ columns",
    );
  });
});