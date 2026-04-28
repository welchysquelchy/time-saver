import ical from "ical-generator";
import type { ParsedEvent } from "./types";

export function generateICS(events: ParsedEvent[]) {
  const cal = ical({ name: "TimeSaver" });

  events.forEach((event) => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return;
    }

    cal.createEvent({
      start,
      end,
      summary: event.title || "Shift",
      location: event.location || undefined,
    });
  });

  return cal.toString();
}
