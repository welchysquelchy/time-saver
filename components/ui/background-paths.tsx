"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

import { buildPreferredCalendarLink, detectCalendarPlatform, getCalendarLabel, type CalendarPlatform } from "@/lib/calendar-links";
import { extractTextFromImage } from "@/lib/ocr";
import { parseEvents } from "@/lib/parse";
import type { ParsedEvent } from "@/lib/types";
import { Button } from "@/components/ui/button";

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg"];

type ScreenState = "idle" | "processing" | "review" | "error";
type CalendarPreference = "auto" | CalendarPlatform;
type TitlePreference = "ocr" | "fixed";

const TITLE_PREFERENCE_KEY = "time-saver:title-preference";
const CUSTOM_TITLE_KEY = "time-saver:custom-title";

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
  }));

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg className="h-full w-full text-slate-950/80" viewBox="0 0 696 316" fill="none">
        <title>Background Paths</title>
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke="currentColor"
            strokeWidth={path.width}
            strokeOpacity={0.1 + path.id * 0.03}
            initial={{ pathLength: 0.3, opacity: 0.6 }}
            animate={{
              pathLength: 1,
              opacity: [0.3, 0.6, 0.3],
              pathOffset: [0, 1, 0],
            }}
            transition={{
              duration: 20 + (path.id % 10),
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />
        ))}
      </svg>
    </div>
  );
}

export function BackgroundPaths({ title = "TimeSaver" }: { title?: string }) {
  const words = title.split(" ");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [screenState, setScreenState] = useState<ScreenState>("idle");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [ocrStatus, setOcrStatus] = useState("Preparing...");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [events, setEvents] = useState<ParsedEvent[]>([]);
  const [addedAtById, setAddedAtById] = useState<Record<string, number>>({});
  const [extractedTitleById, setExtractedTitleById] = useState<
    Record<string, string>
  >({});
  const [calendarPreference, setCalendarPreference] =
    useState<CalendarPreference>("auto");
  const [titlePreference, setTitlePreference] = useState<TitlePreference>("ocr");
  const [customTitle, setCustomTitle] = useState("Work");
  const [detectedPlatform, setDetectedPlatform] =
    useState<CalendarPlatform>("google");

  const description =
    "Upload screenshot. Extract events. Review quickly. Add to your calendar";
  const [typedDescription, setTypedDescription] = useState("");

  const appOrigin = typeof window === "undefined" ? "" : window.location.origin;
  const calendarPlatform: CalendarPlatform =
    calendarPreference === "auto" ? detectedPlatform : calendarPreference;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setDetectedPlatform(detectCalendarPlatform(navigator.userAgent));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    try {
      const storedTitlePreference = window.localStorage.getItem(TITLE_PREFERENCE_KEY);
      if (storedTitlePreference === "ocr" || storedTitlePreference === "fixed") {
        setTitlePreference(storedTitlePreference);
      }

      const storedCustomTitle = window.localStorage.getItem(CUSTOM_TITLE_KEY);
      if (storedCustomTitle && storedCustomTitle.trim()) {
        setCustomTitle(storedCustomTitle);
      }
    } catch {
      // Ignore storage read failures and keep defaults.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(TITLE_PREFERENCE_KEY, titlePreference);
    } catch {
      // Ignore storage write failures.
    }
  }, [titlePreference]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CUSTOM_TITLE_KEY, customTitle);
    } catch {
      // Ignore storage write failures.
    }
  }, [customTitle]);

  useEffect(() => {
    let index = 0;
    const interval = window.setInterval(() => {
      index += 1;
      setTypedDescription(description.slice(0, index));
      if (index >= description.length) {
        window.clearInterval(interval);
      }
    }, 24);
    return () => window.clearInterval(interval);
  }, []);

  const processImage = async (file: File) => {
    setSelectedFileName(file.name);
    setScreenState("processing");
    setEvents([]);
    setAddedAtById({});
    setExtractedTitleById({});
    setErrorMessage("");
    setOcrProgress(0);
    setOcrStatus("Preparing OCR worker...");

    try {
      const text = await extractTextFromImage(file, (update) => {
        setOcrStatus(update.status || "Processing...");
        setOcrProgress(update.progress);
      });
      const parsed = parseEvents(text);

      if (parsed.length === 0) {
        setScreenState("error");
        setErrorMessage("No events detected from this screenshot.");
        return;
      }

      setExtractedTitleById(
        Object.fromEntries(parsed.map((event) => [event.id, event.title]))
      );

      const preferredTitle = customTitle.trim() || "Work";
      const adjustedEvents =
        titlePreference === "fixed"
          ? parsed.map((event) => ({ ...event, title: preferredTitle }))
          : parsed;

      setEvents(adjustedEvents);
      setScreenState("review");
    } catch {
      setScreenState("error");
      setErrorMessage("Processing failed. Try another screenshot.");
    }
  };

  const onChooseFile = async (file: File | null) => {
    if (!file) {
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setScreenState("error");
      setErrorMessage("Only PNG/JPG/JPEG files are supported.");
      return;
    }
    await processImage(file);
  };

  const updateEvent = (
    id: string,
    key: keyof ParsedEvent,
    value: string | null
  ) => {
    setEvents((current) =>
      current.map((event) =>
        event.id === id
          ? {
              ...event,
              [key]:
                key === "location"
                  ? value && value.trim()
                    ? value
                    : null
                  : (value as string),
            }
          : event
      )
    );
  };

  const applyCustomTitleToEvents = (nextCustomTitle: string) => {
    const preferredTitle = nextCustomTitle.trim() || "Work";
    setEvents((current) =>
      current.map((event) => ({ ...event, title: preferredTitle }))
    );
  };

  const applyExtractedTitlesToEvents = () => {
    setEvents((current) =>
      current.map((event) => ({
        ...event,
        title: extractedTitleById[event.id] ?? event.title,
      }))
    );
  };

  const handleTitlePreferenceChange = (nextPreference: TitlePreference) => {
    setTitlePreference(nextPreference);
    if (nextPreference === "fixed") {
      applyCustomTitleToEvents(customTitle);
      return;
    }
    applyExtractedTitlesToEvents();
  };

  const handleCustomTitleChange = (nextCustomTitle: string) => {
    setCustomTitle(nextCustomTitle);
    if (titlePreference === "fixed") {
      applyCustomTitleToEvents(nextCustomTitle);
    }
  };

  const markEventAdded = (eventId: string) => {
    setAddedAtById((current) => ({
      ...current,
      [eventId]: Date.now(),
    }));
  };

  const orderedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const aAddedAt = addedAtById[a.id] ?? null;
      const bAddedAt = addedAtById[b.id] ?? null;

      if (aAddedAt === null && bAddedAt !== null) {
        return -1;
      }
      if (aAddedAt !== null && bAddedAt === null) {
        return 1;
      }
      if (aAddedAt === null && bAddedAt === null) {
        return 0;
      }

      return (aAddedAt as number) - (bAddedAt as number);
    });
  }, [events, addedAtById]);

  const eventCountLabel = useMemo(
    () => `${events.length} event${events.length === 1 ? "" : "s"} ready`,
    [events.length]
  );

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-white px-4 py-8">
      <div className="absolute inset-0">
        <FloatingPaths position={1} />
        <FloatingPaths position={-1} />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-[28px] border border-black/10 bg-white/90 p-5 shadow-lg backdrop-blur-md sm:p-8"
        >
          <h1 className="mb-3 text-center text-5xl font-bold tracking-tighter sm:text-7xl md:text-8xl">
            {words.map((word, wordIndex) => (
              <span key={wordIndex} className="mr-4 inline-block last:mr-0">
                {word.split("").map((letter, letterIndex) => (
                  <motion.span
                    key={`${wordIndex}-${letterIndex}`}
                    initial={{ y: 24, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{
                      delay: wordIndex * 0.1 + letterIndex * 0.02,
                      type: "spring",
                      stiffness: 160,
                      damping: 20,
                    }}
                    className="inline-block bg-gradient-to-r from-neutral-900 to-neutral-700 bg-clip-text text-transparent"
                  >
                    {letter}
                  </motion.span>
                ))}
              </span>
            ))}
          </h1>

          <p className="mx-auto mb-6 max-w-2xl text-center text-sm text-neutral-600 sm:text-base">
            {typedDescription}
            <span className="ml-0.5 animate-pulse">|</span>
          </p>

          <div className="mx-auto flex max-w-2xl flex-col items-center gap-3">
            {screenState !== "processing" && (
              <Button
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-[1.15rem] border hover:cursor-pointer border-black/10 bg-white px-8 py-6 text-lg font-semibold text-black shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-md sm:w-auto"
              >
                {screenState === "review" ? "Upload another screenshot" : "Upload screenshot"}
                <span className="ml-2">→</span>
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg"
              className="hidden"
              onChange={(event) =>
                onChooseFile(event.currentTarget.files?.[0] ?? null)
              }
            />

            {selectedFileName && screenState !== "processing" && (
              <p className="text-xs text-neutral-500">{selectedFileName}</p>
            )}

            {screenState === "processing" && (
              <div className="w-full rounded-2xl border border-black/10 bg-white p-4">
                <p className="text-center text-sm text-neutral-700">{ocrStatus}</p>
                <div className="mt-3 h-2 w-full rounded-full bg-neutral-200">
                  <motion.div
                    className="h-2 rounded-full bg-neutral-900"
                    initial={{ width: 0 }}
                    animate={{ width: `${ocrProgress}%` }}
                  />
                </div>
                <p className="mt-2 text-center text-xs text-neutral-500">
                  {ocrProgress}% complete
                </p>
              </div>
            )}

            {screenState === "error" && (
              <div className="w-full rounded-2xl border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700">
                {errorMessage}
              </div>
            )}
          </div>

          {screenState === "review" && events.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-6 rounded-2xl border border-black/10 bg-white p-4 sm:p-5"
            >
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-neutral-900">
                  Review and add events
                </h2>
                <span className="text-sm text-neutral-600">{eventCountLabel}</span>
              </div>

              <div className="mb-4">
                <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-600">
                  Calendar target
                </label>
                <select
                  className="w-full rounded-md border border-black/10 bg-white text-black px-3 py-2 text-sm sm:w-72"
                  value={calendarPreference}
                  onChange={(event) =>
                    setCalendarPreference(event.target.value as CalendarPreference)
                  }
                >
                  <option value="auto">Auto ({getCalendarLabel(detectedPlatform)})</option>
                  <option value="apple">Apple Calendar</option>
                  <option value="google">Google Calendar</option>
                  <option value="outlook">Outlook Calendar</option>
                </select>
              </div>

              <div className="mb-4 grid gap-3 sm:max-w-2xl sm:grid-cols-2">
                <label className="text-sm text-neutral-700">
                  Title source
                  <select
                    className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-black"
                    value={titlePreference}
                    onChange={(event) =>
                      handleTitlePreferenceChange(event.target.value as TitlePreference)
                    }
                  >
                    <option value="ocr">Use extracted title</option>
                    <option value="fixed">Always use custom title</option>
                  </select>
                </label>

                {titlePreference === "fixed" && (
                  <label className="text-sm text-neutral-700">
                    Custom title
                    <input
                      className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm text-neutral-900"
                      value={customTitle}
                      onChange={(event) => handleCustomTitleChange(event.target.value)}
                      placeholder="Work"
                    />
                  </label>
                )}
              </div>

              <div className="space-y-3">
                {orderedEvents.map((event) => {
                  const isAdded = addedAtById[event.id] !== undefined;

                  return (
                  <div
                    key={event.id}
                    className={`relative grid gap-3 rounded-xl border p-3 sm:grid-cols-2 ${
                      isAdded
                        ? "border-emerald-300 bg-emerald-50/70"
                        : "border-black/10 bg-white"
                    }`}
                  >
                    {isAdded && (
                      <span className="pointer-events-none absolute right-2 top-2 rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                        Added
                      </span>
                    )}
                    <label className="text-sm text-neutral-700">
                      Title
                      <input
                        className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm text-neutral-900"
                        value={event.title}
                        onChange={(e) => updateEvent(event.id, "title", e.target.value)}
                      />
                    </label>
                    <label className="text-sm text-neutral-700">
                      Location
                      <input
                        className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm text-neutral-900"
                        value={event.location ?? ""}
                        onChange={(e) =>
                          updateEvent(event.id, "location", e.target.value || null)
                        }
                      />
                    </label>
                    <label className="text-sm text-neutral-700">
                      Start
                      <input
                        type="datetime-local"
                        className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm text-neutral-900"
                        value={event.start}
                        onChange={(e) => updateEvent(event.id, "start", e.target.value)}
                      />
                    </label>
                    <label className="text-sm text-neutral-700">
                      End
                      <input
                        type="datetime-local"
                        className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-sm text-neutral-900"
                        value={event.end}
                        onChange={(e) => updateEvent(event.id, "end", e.target.value)}
                      />
                    </label>
                    <div className="sm:col-span-2 flex flex-col gap-2 sm:flex-row">
                      <a
                        href={buildPreferredCalendarLink(event, calendarPlatform, appOrigin)}
                        target={calendarPlatform === "apple" ? "_self" : "_blank"}
                        rel="noreferrer"
                        onClick={() => markEventAdded(event.id)}
                        className="inline-flex items-center justify-center rounded-xl border border-black/15 bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
                      >
                        Add this event to {getCalendarLabel(calendarPlatform)}
                      </a>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-xl border border-black/15 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                        onClick={() => {
                          setEvents((current) =>
                            current.filter((item) => item.id !== event.id)
                          );
                          setAddedAtById((current) => {
                            const next = { ...current };
                            delete next[event.id];
                            return next;
                          });
                          setExtractedTitleById((current) => {
                            const next = { ...current };
                            delete next[event.id];
                            return next;
                          });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </motion.section>
          )}
        </motion.div>
      </div>
    </div>
  );
}
