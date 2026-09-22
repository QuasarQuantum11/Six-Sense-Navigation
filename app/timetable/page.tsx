import { TimetableSelector } from "../students/[id]/timetable-selector";

export default function TimetablePage() {
  return (
    <div className="flex flex-1 flex-col items-center bg-white">
      <main className="flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-16 sm:px-16">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">
            Timetable Integration
          </h1>
        </div>

        <TimetableSelector />
      </main>
    </div>
  );
}
