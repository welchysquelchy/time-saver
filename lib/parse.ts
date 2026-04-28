import type { ParsedEvent } from "./types";

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function toIsoDate(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function toIsoDateTime(dateIso: string, hhmm: string): string {
  const [hour, minute] = hhmm.split(":").map(Number);
  return `${dateIso}T${hour.toString().padStart(2, "0")}:${minute
    .toString()
    .padStart(2, "0")}`;
}

function normalizeText(text: string): string {
  return text.replace(/[—–]/g, "-").replace(/\r/g, "");
}

function normalizeTime(value: string): string {
  const [rawHour, rawMinute] = value.split(":");
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  return `${hour.toString().padStart(2, "0")}:${minute
    .toString()
    .padStart(2, "0")}`;
}

function isValidTime(value: string): boolean {
  const [hourString, minuteString] = value.split(":");
  const hour = Number(hourString);
  const minute = Number(minuteString);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return false;
  }
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function addOneDay(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);
  return toIsoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function normalizeTitleForDedup(rawTitle: string): string {
  return rawTitle
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b\d+(?:[.,]\d+)?\s*h\b/g, "")
    .replace(/\b\d+(?:[.,]\d+)?h\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseEvents(text: string): ParsedEvent[] {
  const normalized = normalizeText(text);
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const events: ParsedEvent[] = [];
  const seenEventSignatures = new Set<string>();
  const now = new Date();

  let inferredYear = now.getFullYear();
  let inferredMonth: number | null = null;
  let currentDate: string | null = null;

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    const monthYearMatch = lowerLine.match(
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})\b/
    );
    if (monthYearMatch) {
      inferredMonth = MONTHS[monthYearMatch[1]];
      inferredYear = Number(monthYearMatch[2]);
    }

    const dateMatch = lowerLine.match(
      /\b(\d{1,2})(?:st|nd|rd|th)?(?:\s|,)+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/
    );
    if (dateMatch) {
      const day = Number(dateMatch[1]);
      const month = MONTHS[dateMatch[2]];
      currentDate = toIsoDate(inferredYear, month, day);
    } else {
      const dayOnlyMatch = lowerLine.match(
        /\b(\d{1,2})(?:st|nd|rd|th)?\b(?:\s*,\s*)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/
      );
      if (dayOnlyMatch && inferredMonth) {
        const day = Number(dayOnlyMatch[1]);
        currentDate = toIsoDate(inferredYear, inferredMonth, day);
      }
    }

    const timeMatch = line.match(/\b(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\b/);
    if (!timeMatch || !currentDate) {
      continue;
    }

    if (/\boff\b/i.test(lowerLine)) {
      continue;
    }

    const startTime = normalizeTime(timeMatch[1]);
    const endTime = normalizeTime(timeMatch[2]);
    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      continue;
    }
    if (startTime === "00:00" && endTime === "00:00") {
      continue;
    }

    const startDateIso = currentDate;
    const endDateIso = endTime < startTime ? addOneDay(currentDate) : currentDate;

    const cleanedTitle = line
      .replace(timeMatch[0], "")
      .replace(/\b(off)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    const title = cleanedTitle || "Shift";
    const signature = `${toIsoDateTime(startDateIso, startTime)}|${toIsoDateTime(
      endDateIso,
      endTime
    )}|${normalizeTitleForDedup(title)}`;
    if (seenEventSignatures.has(signature)) {
      continue;
    }
    seenEventSignatures.add(signature);

    events.push({
      id: `${startDateIso}-${startTime}-${events.length}`,
      title,
      start: toIsoDateTime(startDateIso, startTime),
      end: toIsoDateTime(endDateIso, endTime),
      location: null,
    });
  }

  return events;
}