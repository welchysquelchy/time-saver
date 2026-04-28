import { NextRequest, NextResponse } from "next/server";

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatIcsUtc(dateTime: string): string {
  return new Date(dateTime)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function slugifyFilename(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;

  const id = params.get("id") || `${Date.now()}`;
  const start = params.get("start");
  const end = params.get("end");
  const title = params.get("title") || "Shift";
  const location = params.get("location");

  if (!start || !end) {
    return NextResponse.json(
      { error: "Missing required params: start, end" },
      { status: 400 }
    );
  }

  const nowStamp = formatIcsUtc(new Date().toISOString());
  const startStamp = formatIcsUtc(start);
  const endStamp = formatIcsUtc(end);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TimeSaver//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${id}@timesaver.local`,
    `DTSTAMP:${nowStamp}`,
    `DTSTART:${startStamp}`,
    `DTEND:${endStamp}`,
    `SUMMARY:${escapeIcsText(title)}`,
    location ? `LOCATION:${escapeIcsText(location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  const filenameBase = slugifyFilename(title) || "timesaver-event";

  return new NextResponse(lines, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${filenameBase}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
