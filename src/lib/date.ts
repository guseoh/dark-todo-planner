import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ko } from "date-fns/locale";

const WEEK_OPTIONS = { weekStartsOn: 1 as const };

export const toDateKey = (date: Date) => format(date, "yyyy-MM-dd");

export const todayKey = () => toDateKey(new Date());

export const parseDateKey = (dateKey: string) => parseISO(dateKey);

export const formatKoreanDate = (dateKeyOrDate: string | Date, pattern = "M월 d일 EEEE") => {
  const date = typeof dateKeyOrDate === "string" ? parseDateKey(dateKeyOrDate) : dateKeyOrDate;
  return format(date, pattern, { locale: ko });
};

export const getWeekDays = (date = new Date()) => {
  const start = startOfWeek(date, WEEK_OPTIONS);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
};

export const getWeekRange = (date = new Date()) => {
  const start = startOfWeek(date, WEEK_OPTIONS);
  const end = endOfWeek(date, WEEK_OPTIONS);
  return { start: toDateKey(start), end: toDateKey(end) };
};

export const getMonthRange = (date = new Date()) => {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return { start: toDateKey(start), end: toDateKey(end) };
};

export const getMonthGrid = (date = new Date()) => {
  const start = startOfWeek(startOfMonth(date), WEEK_OPTIONS);
  const end = endOfWeek(endOfMonth(date), WEEK_OPTIONS);
  return eachDayOfInterval({ start, end });
};

export const isDateKeyInRange = (dateKey: string, start: string, end: string) =>
  dateKey >= start && dateKey <= end;

export const isTodayDate = (date: Date) => isSameDay(date, new Date());

export const isCurrentMonth = (date: Date, baseDate: Date) => isSameMonth(date, baseDate);

export const getNextMonth = (date: Date) => addMonths(date, 1);

export const getPrevMonth = (date: Date) => subMonths(date, 1);

export const weekdayLabels = ["월", "화", "수", "목", "금", "토", "일"];
