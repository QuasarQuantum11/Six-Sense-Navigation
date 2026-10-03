import * as XLSX from "@e965/xlsx";

export type AllocatePlusEntry = {
  day: string;
  time: string;
  location: string;
  subjectCode: string;
  subjectDescription: string;
  classGroup: string;
  activity: string;
  campus: string;
  sourceLocation: string;
  room: string;
  staff: string;
  duration: string;
  classDates: string;
};

const dayNames: Record<string, string> = {
  mon: "Monday",
  monday: "Monday",
  tue: "Tuesday",
  tues: "Tuesday",
  tuesday: "Tuesday",
  wed: "Wednesday",
  wednesday: "Wednesday",
  thu: "Thursday",
  thur: "Thursday",
  thurs: "Thursday",
  thursday: "Thursday",
  fri: "Friday",
  friday: "Friday",
  sat: "Saturday",
  saturday: "Saturday",
  sun: "Sunday",
  sunday: "Sunday",
};

const buildingNames: Record<string, string> = {
  ltb: "Learning and Teaching Building",
  sciport: "Science Building",
  menzies: "Menzies Building",
};

function text(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const result = String(value).trim();
  return result === "-" ? "" : result;
}

function normalizeTime(value: string): string {
  const match = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*(am|pm))?$/i);
  if (!match) {
    return value;
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toLowerCase();

  if (minute > 59 || hour > 23 || (meridiem && (hour < 1 || hour > 12))) {
    return value;
  }

  if (meridiem === "pm" && hour !== 12) {
    hour += 12;
  } else if (meridiem === "am" && hour === 12) {
    hour = 0;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseLocation(sourceLocation: string) {
  const locationPart = sourceLocation.split(".").at(-1) ?? sourceLocation;
  const [buildingCode, ...roomParts] = locationPart.split("_");
  const room = roomParts.join("_");

  return {
    location: buildingNames[buildingCode.toLowerCase()] ?? buildingCode,
    room,
  };
}

export function parseAllocatePlusWorkbook(data: ArrayBuffer): AllocatePlusEntry[] {
  const workbook = XLSX.read(data, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;

  if (!sheet) {
    throw new Error("The workbook does not contain a readable sheet.");
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map((cell) => text(cell).toLowerCase());
    return ["subject code", "day", "time", "location"].every((header) =>
      headers.includes(header),
    );
  });

  if (headerIndex < 0) {
    throw new Error(
      "Could not find the Allocate+ columns Subject Code, Day, Time, and Location.",
    );
  }

  const headers = rows[headerIndex].map((cell) => text(cell).toLowerCase());
  const column = (name: string) => headers.indexOf(name.toLowerCase());
  const valueAt = (row: unknown[], name: string) => {
    const index = column(name);
    return index < 0 ? "" : text(row[index]);
  };

  const entries = rows.slice(headerIndex + 1).flatMap((row) => {
    const shortDay = valueAt(row, "Day").toLowerCase();
    const day = dayNames[shortDay];
    const time = normalizeTime(valueAt(row, "Time"));
    const sourceLocation = valueAt(row, "Location");

    if (!day || !time || !sourceLocation) {
      return [];
    }

    const { location, room } = parseLocation(sourceLocation);
    if (!location) {
      return [];
    }

    return [{
      day,
      time,
      location,
      subjectCode: valueAt(row, "Subject Code"),
      subjectDescription: valueAt(row, "Description"),
      classGroup: valueAt(row, "Group"),
      activity: valueAt(row, "Activity"),
      campus: valueAt(row, "Campus"),
      sourceLocation,
      room,
      staff: valueAt(row, "Staff"),
      duration: valueAt(row, "Duration"),
      classDates: valueAt(row, "Dates"),
    }];
  });

  if (entries.length === 0) {
    throw new Error("No timetable classes with a day, time, and location were found.");
  }

  return entries;
}