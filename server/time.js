const CLINIC_TIME_ZONE = 'Europe/London';
const SLOT_MINUTES = 15;
const REST_MINUTES = 30;
const MAX_RANGE_DAYS = 62;
const MAX_ADVANCE_DAYS = 366;

function timeToMinutes(value) {
  const match = String(value).match(/^(\d{2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function minutesToTime(total) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function weekdayIndex(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function addDays(dateStr, days) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysBetween(from, to) {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const start = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  return Math.round((end - start) / 86400000);
}

function londonNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CLINIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const read = (type) => parts.find((part) => part.type === type).value;
  let hour = read('hour');
  if (hour === '24') hour = '00';
  return {
    date: `${read('year')}-${read('month')}-${read('day')}`,
    minutes: Number(hour) * 60 + Number(read('minute')),
  };
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function buildSlots({ date, duration, opening, closing, bookings, blocks, now }) {
  const openingMinutes = timeToMinutes(opening);
  const closingMinutes = timeToMinutes(closing);
  if (openingMinutes == null || closingMinutes == null || closingMinutes <= openingMinutes) return [];
  if (date < now.date) return [];

  const busy = [
    ...bookings.map((item) => {
      const start = timeToMinutes(item.start_time);
      const end = timeToMinutes(item.end_time);
      if (start == null || end == null || end <= start) return null;
      return [start - REST_MINUTES, end + REST_MINUTES];
    }),
    ...blocks.map((item) => [timeToMinutes(item.start_time), timeToMinutes(item.end_time)]),
  ].filter((range) => range && range[0] != null && range[1] != null && range[1] > range[0]);

  const slots = [];
  for (let start = openingMinutes; start + duration <= closingMinutes; start += SLOT_MINUTES) {
    const end = start + duration;
    if (date === now.date && start <= now.minutes) continue;
    const overlaps = busy.some(([busyStart, busyEnd]) => rangesOverlap(start, end, busyStart, busyEnd));
    if (overlaps) continue;
    slots.push({ start: minutesToTime(start), end: minutesToTime(end) });
  }
  return slots;
}

module.exports = {
  CLINIC_TIME_ZONE,
  SLOT_MINUTES,
  REST_MINUTES,
  MAX_RANGE_DAYS,
  MAX_ADVANCE_DAYS,
  timeToMinutes,
  minutesToTime,
  isRealDate,
  weekdayIndex,
  addDays,
  daysBetween,
  londonNow,
  rangesOverlap,
  buildSlots,
};
