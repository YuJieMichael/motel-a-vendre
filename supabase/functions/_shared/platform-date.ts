// Enquiry timelines use the platform's Québec calendar, regardless of the
// visitor's device time zone or the server's UTC clock.
export const PLATFORM_TIME_ZONE = 'America/Toronto';

const platformDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PLATFORM_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function dateValue(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function enquiryDateRange(now = new Date()): { minimumDate: string; maximumDate: string } {
  const parts = platformDateFormatter.formatToParts(now);
  const year = Number(parts.find(part => part.type === 'year')!.value);
  const month = Number(parts.find(part => part.type === 'month')!.value);
  const day = Number(parts.find(part => part.type === 'day')!.value);
  const maximumYear = year + 10;
  return {
    minimumDate: dateValue(year, month, day),
    // A leap-day anniversary falls on the last day of February when the
    // tenth year is not a leap year; never roll the limit into March.
    maximumDate: dateValue(maximumYear, month, Math.min(day, daysInMonth(maximumYear, month))),
  };
}

export function isEnquiryDateInRange(value: string, now = new Date()): boolean {
  if (value.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return false;
  const { minimumDate, maximumDate } = enquiryDateRange(now);
  return value >= minimumDate && value <= maximumDate;
}
