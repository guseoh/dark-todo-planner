import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
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

export const getDdayLabel = (dateKey: string) => {
  const diff = differenceInCalendarDays(parseDateKey(dateKey), parseDateKey(todayKey()));
  if (diff === 0) return "D-Day";
  return diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
};

export const getDayIndex = (date: Date) => getDay(date);

const fixedKoreanHolidays: Record<string, string> = {
  "01-01": "신정",
  "03-01": "삼일절",
  "05-05": "어린이날",
  "06-06": "현충일",
  "08-15": "광복절",
  "10-03": "개천절",
  "10-09": "한글날",
  "12-25": "성탄절",
};

export const getKoreanHolidayName = (dateKey: string) => fixedKoreanHolidays[dateKey.slice(5)];
