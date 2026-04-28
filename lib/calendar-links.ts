import type { ParsedEvent } from "./types";

export type CalendarPlatform = "apple" | "google" | "outlook";

function formatGoogleDate(dateTime: string): string {
  return new Date(dateTime)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export function buildGoogleCalendarLink(event: ParsedEvent): string {
  const start = formatGoogleDate(event.start);
  const end = formatGoogleDate(event.end);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title || "Shift",
    dates: `${start}/${end}`,
  });

  if (event.location) {
    params.set("location", event.location);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildOutlookCalendarLink(event: ParsedEvent): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    startdt: new Date(event.start).toISOString(),
    enddt: new Date(event.end).toISOString(),
    subject: event.title || "Shift",
  });

  if (event.location) {
    params.set("location", event.location);
  }

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function buildAppleCalendarLink(
  event: ParsedEvent,
  origin: string
): string {
  const params = new URLSearchParams({
    id: event.id,
    start: event.start,
    end: event.end,
    title: event.title || "Shift",
  });

  if (event.location) {
    params.set("location", event.location);
  }

  const baseHttp = `${origin}/api/calendar/apple?${params.toString()}`;

  // webcal:// is more likely to hand off to Apple Calendar outside localhost.
  if (/^https:\/\//i.test(origin)) {
    return baseHttp.replace(/^https:\/\//i, "webcal://");
  }

  return baseHttp;
}

export function detectCalendarPlatform(userAgent: string): CalendarPlatform {
  const ua = userAgent.toLowerCase();

  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isMac = /macintosh|mac os x/.test(ua);
  const isChromeLike = /chrome|crios|chromium|edg\//.test(ua);
  const isSafari = ua.includes("safari") && !isChromeLike;

  // iOS should prefer Apple Calendar handoff.
  if (isIOS) {
    return "apple";
  }

  // On macOS, only Safari defaults to Apple Calendar.
  // Chrome/Edge/Firefox on Mac default to web calendar flows.
  if (isMac && isSafari) {
    return "apple";
  }

  if (ua.includes("windows")) {
    return "outlook";
  }
  return "google";
}

export function buildPreferredCalendarLink(
  event: ParsedEvent,
  platform: CalendarPlatform,
  origin: string
): string {
  if (platform === "apple") {
    return buildAppleCalendarLink(event, origin);
  }
  if (platform === "outlook") {
    return buildOutlookCalendarLink(event);
  }
  return buildGoogleCalendarLink(event);
}

export function getCalendarLabel(platform: CalendarPlatform): string {
  if (platform === "apple") {
    return "Apple Calendar";
  }
  if (platform === "outlook") {
    return "Outlook Calendar";
  }
  return "Google Calendar";
}
