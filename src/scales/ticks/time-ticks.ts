import type { Formatter } from "../../chart/formatter";
import { DataStore } from "../../data/data-store";
import type { TimeScaleRange } from "../time-scale";

export type TimeTickKind = "year" | "month" | "week" | "day" | "hour";

export interface TimeTick {
  index: number;
  time: number;
  label: string;
  kind: TimeTickKind;
  priority: number;
}

export interface TimeTickOptions {
  dataStore: DataStore;
  visibleRange: TimeScaleRange;
  formatter: Formatter;
  targetTickCount?: number;
}

type TickGranularity = TimeTickKind;

interface TickCandidate {
  granularity: TickGranularity;
  step: number;
}

interface CalendarParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  weekday: number;
  dayNumber: number;
  weekNumber: number;
  monthNumber: number;
}

type CalendarPartsResolver = (timestamp: number) => CalendarParts;

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

const priorityByKind: Record<TimeTickKind, number> = {
  year: 5,
  month: 4,
  week: 3,
  day: 2,
  hour: 1,
};

const weekdayByShortName: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export class TimeTickGenerator {
  generate(options: TimeTickOptions): TimeTick[] {
    const targetTickCount = options.targetTickCount ?? 8;
    const times = options.dataStore.times();
    if (times.length === 0) return [];

    const startIndex = Math.max(0, Math.floor(options.visibleRange.from));
    const endIndex = Math.min(times.length, Math.ceil(options.visibleRange.to));
    if (startIndex >= endIndex) return [];

    const firstTime = times[startIndex];
    const lastTime = times[endIndex - 1];
    const candidates = this.getCandidatesForDuration(lastTime - firstTime);
    const resolveCalendarParts = createCalendarPartsResolver(options.formatter);

    for (const candidate of candidates) {
      const ticks = this.buildTicks(
        times,
        startIndex,
        endIndex,
        candidate,
        options,
        resolveCalendarParts
      );
      if (ticks.length > 0 && ticks.length <= targetTickCount) {
        return ticks;
      }
    }

    return this.buildTicks(
      times,
      startIndex,
      endIndex,
      candidates.at(-1)!,
      options,
      resolveCalendarParts
    );
  }

  private getCandidatesForDuration(duration: number): TickCandidate[] {
    if (duration <= 2 * DAY_MS) {
      return [
        { granularity: "hour", step: 1 },
        { granularity: "hour", step: 2 },
        { granularity: "hour", step: 3 },
        { granularity: "hour", step: 6 },
        { granularity: "hour", step: 12 },
      ];
    }

    if (duration <= 60 * DAY_MS) {
      return [
        { granularity: "day", step: 1 },
        { granularity: "day", step: 2 },
        { granularity: "week", step: 1 },
        { granularity: "week", step: 2 },
      ];
    }

    if (duration <= 365 * DAY_MS) {
      return [
        { granularity: "week", step: 1 },
        { granularity: "week", step: 2 },
        { granularity: "month", step: 1 },
        { granularity: "month", step: 3 },
      ];
    }

    if (duration <= 5 * 365 * DAY_MS) {
      return [
        { granularity: "month", step: 1 },
        { granularity: "month", step: 3 },
        { granularity: "month", step: 6 },
        { granularity: "year", step: 1 },
      ];
    }

    return [
      { granularity: "year", step: 1 },
      { granularity: "year", step: 2 },
      { granularity: "year", step: 5 },
      { granularity: "year", step: 10 },
    ];
  }

  private buildTicks(
    times: readonly number[],
    startIndex: number,
    endIndex: number,
    candidate: TickCandidate,
    options: TimeTickOptions,
    resolveCalendarParts: CalendarPartsResolver
  ): TimeTick[] {
    const ticks: TimeTick[] = [];
    const usedIndices = new Set<number>();

    for (let index = startIndex; index < endIndex; index++) {
      const time = times[index];
      const current = resolveCalendarParts(time);
      const previous =
        index > 0 ? resolveCalendarParts(times[index - 1]) : undefined;

      if (!this.isBoundary(current, previous, candidate)) continue;
      if (usedIndices.has(index)) continue;

      const kind = classifyBoundary(current, previous);
      ticks.push({
        index,
        time,
        kind,
        priority: priorityByKind[kind],
        label: formatTickLabel(options.formatter, kind, time),
      });
      usedIndices.add(index);
    }

    return ticks;
  }

  private isBoundary(
    current: CalendarParts,
    previous: CalendarParts | undefined,
    candidate: TickCandidate
  ) {
    if (!isAligned(current, candidate)) return false;
    if (!previous) return true;

    switch (candidate.granularity) {
      case "year":
        return current.year !== previous.year;
      case "month":
        return current.monthNumber !== previous.monthNumber;
      case "week":
        return current.weekNumber !== previous.weekNumber;
      case "day":
        return current.dayNumber !== previous.dayNumber;
      case "hour":
        return (
          current.hour !== previous.hour ||
          current.dayNumber !== previous.dayNumber
        );
    }
  }
}

export function generateTimeTicks(options: TimeTickOptions): TimeTick[] {
  return new TimeTickGenerator().generate(options);
}

function isAligned(parts: CalendarParts, candidate: TickCandidate) {
  switch (candidate.granularity) {
    case "year":
      return parts.year % candidate.step === 0;
    case "month":
      return parts.monthNumber % candidate.step === 0;
    case "week":
      return parts.weekNumber % candidate.step === 0;
    case "day":
      return parts.dayNumber % candidate.step === 0;
    case "hour":
      return parts.hour % candidate.step === 0;
  }
}

function classifyBoundary(
  current: CalendarParts,
  previous: CalendarParts | undefined
): TimeTickKind {
  if (!previous) {
    if (current.month === 1 && current.day === 1 && current.hour === 0) {
      return "year";
    }
    if (current.day === 1 && current.hour === 0) return "month";
    if (current.weekday === 1 && current.hour === 0) return "week";
    if (current.hour === 0) return "day";
    return "hour";
  }

  if (current.year !== previous.year) return "year";
  if (current.monthNumber !== previous.monthNumber) return "month";
  if (current.weekNumber !== previous.weekNumber) return "week";
  if (current.dayNumber !== previous.dayNumber) return "day";
  return "hour";
}

function formatTickLabel(
  formatter: Formatter,
  kind: TimeTickKind,
  timestamp: number
) {
  switch (kind) {
    case "year":
      return formatter.formatYear(timestamp);
    case "month":
      return formatter.formatMonth(timestamp);
    case "week":
    case "day":
      return formatter.formatDay(timestamp);
    case "hour":
      return formatter.formatHour(timestamp);
  }
}

function createCalendarPartsResolver(
  formatter: Formatter
): CalendarPartsResolver {
  const timeZone = formatter.getTimeZone?.();
  const timeZoneFormatter = timeZone
    ? createTimeZoneCalendarFormatter(timeZone)
    : undefined;
  const cache = new Map<number, CalendarParts>();

  return (timestamp: number) => {
    const cachedParts = cache.get(timestamp);
    if (cachedParts) return cachedParts;

    const parts = timeZoneFormatter
      ? getTimeZoneCalendarParts(timestamp, timeZoneFormatter)
      : getLocalCalendarParts(timestamp);
    const calendarParts = completeCalendarParts(parts);
    cache.set(timestamp, calendarParts);
    return calendarParts;
  };
}

function completeCalendarParts(
  parts: Omit<CalendarParts, "dayNumber" | "weekNumber" | "monthNumber">
): CalendarParts {
  const dayNumber = Math.floor(
    Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS
  );

  return {
    ...parts,
    dayNumber,
    weekNumber: Math.floor((dayNumber + 3) / 7),
    monthNumber: parts.year * 12 + parts.month - 1,
  };
}

function getLocalCalendarParts(timestamp: number) {
  const date = new Date(timestamp);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    weekday: date.getDay(),
  };
}

function createTimeZoneCalendarFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
    weekday: "short",
  });
}

function getTimeZoneCalendarParts(
  timestamp: number,
  formatter: Intl.DateTimeFormat
) {
  const parts = formatter.formatToParts(timestamp);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)?.value;

  return {
    year: Number(part("year")),
    month: Number(part("month")),
    day: Number(part("day")),
    hour: Number(part("hour")),
    weekday: weekdayByShortName[part("weekday") ?? "Sun"] ?? 0,
  };
}
