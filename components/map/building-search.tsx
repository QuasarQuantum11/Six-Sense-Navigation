"use client";

import { useEffect, useId, useState } from "react";
import { searchBuildings, type BuildingLocation } from "@/lib/buildings/search";

// Accessible building search box (WAI-ARIA combobox with a listbox popup).
// To clear it from outside, remount it with a new `key`.
export default function BuildingSearch({
    label,
    placeholder,
    buildings,
    onSelect,
    onClear,
    selectedLabel,
}: {
    selectedLabel?: string;
    label: string;
    placeholder: string;
    buildings: BuildingLocation[];
    onSelect: (building: BuildingLocation) => void;
    // Called when the user edits or clears a building they had chosen.
    onClear?: () => void;
}) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [hasSelection, setHasSelection] = useState(false);
    const id = useId();
    const listId = `${id}-results`;
    const optionId = (index: number) => `${id}-option-${index}`;

    const results = searchBuildings(buildings, query);

    // Keep the highlighted option visible while moving through a long list.
    useEffect(() => {
        if (activeIndex < 0) return;
        document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: "nearest" });
    });

    function select(building: BuildingLocation) {
        setQuery(building.name);
        setOpen(false);
        setActiveIndex(-1);
        setHasSelection(true);
        onSelect(building);
    }

    function clearSelection() {
        if (!hasSelection) return;
        setHasSelection(false);
        onClear?.();
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        switch (event.key) {
            case "ArrowDown":
                event.preventDefault();
                setOpen(true);
                setActiveIndex((index) => (results.length === 0 ? -1 : (index + 1) % results.length));
                break;
            case "ArrowUp":
                event.preventDefault();
                setOpen(true);
                setActiveIndex((index) =>
                    results.length === 0 ? -1 : (index <= 0 ? results.length : index) - 1
                );
                break;
            case "Enter": {
                if (!open) return;
                event.preventDefault();
                // With nothing highlighted, Enter picks the top result.
                const choice = results[activeIndex >= 0 ? activeIndex : 0];
                if (choice) select(choice);
                break;
            }
            case "Escape":
                if (open) {
                    setOpen(false);
                    setActiveIndex(-1);
                } else {
                    setQuery("");
                    if (selectedLabel) onClear?.();
                    clearSelection();
                }
                break;
        }
    }

    const statusMessage = !open
        ? ""
        : results.length === 0
            ? "No buildings found."
            : `${results.length} building${results.length === 1 ? "" : "s"} found.`;

    return (
        <div>
            <label className="block text-sm font-medium text-slate-800" htmlFor={`${id}-input`}>
                {label}
            </label>
            <div className="relative mt-1">
                <input
                    id={`${id}-input`}
                    type="text"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
                    autoComplete="off"
                    placeholder={placeholder}
                    value={query || (!hasSelection ? selectedLabel ?? "" : "")}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setOpen(true);
                        setActiveIndex(-1);
                        if (selectedLabel) onClear?.();
                        clearSelection();
                    }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => {
                        setOpen(false);
                        setActiveIndex(-1);
                    }}
                    onKeyDown={handleKeyDown}
                    className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
                <ul
                    id={listId}
                    role="listbox"
                    aria-label={`${label} buildings`}
                    hidden={!open || results.length === 0}
                    className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-auto rounded-md border border-slate-300 bg-white py-1 shadow-lg"
                >
                    {results.map((building, index) => (
                        <li
                            key={building.id}
                            id={optionId(index)}
                            role="option"
                            aria-selected={index === activeIndex}
                            // mousedown (not click) so the input's blur doesn't close the list first.
                            onMouseDown={(event) => {
                                event.preventDefault();
                                select(building);
                            }}
                            onMouseEnter={() => setActiveIndex(index)}
                            className={`cursor-pointer px-3 py-2 text-sm ${index === activeIndex ? "bg-blue-700 text-white" : "text-slate-900"}`}
                        >
                            {building.name}
                        </li>
                    ))}
                </ul>
            </div>
            <p className="sr-only" role="status" aria-live="polite">
                {statusMessage}
            </p>
            {open && results.length === 0 && buildings.length > 0 && (
                <p className="mt-2 text-sm text-slate-600">No buildings match &ldquo;{query.trim()}&rdquo;.</p>
            )}
        </div>
    );
}
