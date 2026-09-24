const {
  weekdayIndex,
  addDays,
  daysBetween,
  londonNow,
  buildSlots,
  isRealDate,
  MAX_RANGE_DAYS,
  MAX_ADVANCE_DAYS,
} = require('./time');

async function getActiveService(db, serviceId) {
  const { rows } = await db.query(
    `SELECT id, slug, name, description, duration, price, active
     FROM services
     WHERE id = $1 AND active = TRUE`,
    [serviceId],
  );
  return rows[0] || null;
}

async function getActiveServiceBySlug(db, slug) {
  const { rows } = await db.query(
    `SELECT id, slug, name, description, duration, price, active
     FROM services
     WHERE slug = $1 AND active = TRUE`,
    [slug],
  );
  return rows[0] || null;
}

async function loadSchedule(db, from, to) {
  const hoursResult = await db.query(
    `SELECT day_of_week, opening_time, closing_time
     FROM business_availability
     WHERE active = TRUE`,
  );
  const bookingResult = await db.query(
    `SELECT appointment_date, start_time, end_time
     FROM bookings
     WHERE status = 'confirmed'
       AND appointment_date >= $1
       AND appointment_date < $2`,
    [from, to],
  );
  const blockResult = await db.query(
    `SELECT date, start_time, end_time
     FROM blocked_periods
     WHERE date >= $1 AND date < $2`,
    [from, to],
  );

  const hoursByDay = new Map();
  hoursResult.rows.forEach((row) => {
    hoursByDay.set(row.day_of_week, row);
  });

  const bookingsByDate = new Map();
  bookingResult.rows.forEach((row) => {
    const list = bookingsByDate.get(row.appointment_date) || [];
    list.push(row);
    bookingsByDate.set(row.appointment_date, list);
  });

  const blocksByDate = new Map();
  blockResult.rows.forEach((row) => {
    const list = blocksByDate.get(row.date) || [];
    list.push(row);
    blocksByDate.set(row.date, list);
  });

  return { hoursByDay, bookingsByDate, blocksByDate };
}

function slotsOnDate(schedule, service, date, now = londonNow()) {
  const hours = schedule.hoursByDay.get(weekdayIndex(date));
  if (!hours) return [];
  return buildSlots({
    date,
    duration: service.duration,
    opening: hours.opening_time,
    closing: hours.closing_time,
    bookings: schedule.bookingsByDate.get(date) || [],
    blocks: schedule.blocksByDate.get(date) || [],
    now,
  });
}

function parseRange(from, to) {
  if (!isRealDate(from) || !isRealDate(to) || to < from) {
    return { ok: false, error: 'Choose a valid date range.' };
  }
  const span = daysBetween(from, to);
  if (span < 0 || span > MAX_RANGE_DAYS) {
    return { ok: false, error: 'Date range is too long.' };
  }
  const latest = addDays(londonNow().date, MAX_ADVANCE_DAYS);
  if (from > latest) {
    return { ok: true, value: { from, to, empty: true } };
  }
  return { ok: true, value: { from, to, empty: false } };
}

async function availableDates(db, service, from, to) {
  const schedule = await loadSchedule(db, from, to);
  const now = londonNow();
  const dates = [];
  for (let date = from; date < to; date = addDays(date, 1)) {
    if (slotsOnDate(schedule, service, date, now).length) dates.push(date);
  }
  return dates;
}

async function availableSlots(db, service, date) {
  const next = addDays(date, 1);
  const schedule = await loadSchedule(db, date, next);
  return slotsOnDate(schedule, service, date);
}

module.exports = {
  getActiveService,
  getActiveServiceBySlug,
  availableDates,
  availableSlots,
  parseRange,
};
