require('dotenv').config();

const path = require('path');
const express = require('express');
const { pool, migrate } = require('./db');
const { seed } = require('./seed');
const { validateBookingInput, validateGiftInput } = require('./validate');
const { sendBookingEmails, sendGiftVoucherEmails } = require('./mail');
const { ensureLocalPostgres, createReference, createGiftCode } = require('./postgres');
const { findVoucher, quoteVoucher, redeemVoucher } = require('./vouchers');
const {
  getActiveService,
  availableDates,
  availableSlots,
  parseRange,
} = require('./availability');
const { isRealDate, addDays, londonNow, MAX_ADVANCE_DAYS } = require('./time');

function publicService(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    duration: row.duration,
    price: row.price == null ? null : Number(row.price).toFixed(2),
  };
}

function publicBooking(row) {
  return {
    reference: row.reference,
    customerName: row.customer_name,
    serviceName: row.service_name,
    date: row.appointment_date,
    startTime: row.start_time,
    endTime: row.end_time,
    duration: row.duration_minutes,
    price: row.price == null ? null : Number(row.price).toFixed(2),
    giftCode: row.gift_code || null,
    giftAmount: row.gift_amount == null ? null : Number(row.gift_amount).toFixed(2),
    amountDue: amountDue(row),
    status: row.status,
  };
}

function amountDue(row) {
  if (row.price == null) return null;
  const price = Number(row.price);
  const applied = row.gift_amount == null ? 0 : Number(row.gift_amount);
  return Math.max(0, price - applied).toFixed(2);
}

const BOOKING_SQL = `
  SELECT b.reference,
         b.appointment_date,
         b.start_time,
         b.end_time,
         b.status,
         c.name AS customer_name,
         s.name AS service_name,
         s.price,
         b.gift_code,
         b.gift_amount,
         (EXTRACT(EPOCH FROM (b.end_time - b.start_time)) / 60)::int AS duration_minutes
  FROM bookings b
  JOIN customers c ON c.id = b.customer_id
  JOIN services s ON s.id = b.service_id
`;

async function createBooking(input) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`booking:${input.date}`]);

    const service = await getActiveService(client, input.serviceId);
    if (!service) {
      await client.query('ROLLBACK');
      return { status: 400, body: { error: 'That treatment is not available.' } };
    }

    const slots = await availableSlots(client, service, input.date);
    const slot = slots.find((item) => item.start === input.startTime);
    if (!slot) {
      await client.query('ROLLBACK');
      return { status: 409, body: { error: 'That time is no longer available. Please choose another.' } };
    }

    let gift = null;
    if (input.giftCode) {
      const redeemed = await redeemVoucher(client, input.giftCode, service);
      if (!redeemed.ok) {
        await client.query('ROLLBACK');
        return { status: 400, body: { error: redeemed.error } };
      }
      gift = redeemed.value;
    }

    const customer = await client.query(
      `INSERT INTO customers (name, email, phone)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name, phone = EXCLUDED.phone
       RETURNING id`,
      [input.name, input.email, input.phone],
    );

    let reference = '';
    let inserted = false;
    for (let attempt = 0; attempt < 5 && !inserted; attempt += 1) {
      reference = createReference();
      try {
        await client.query(
          `INSERT INTO bookings (
             reference, customer_id, service_id, appointment_date, start_time, end_time, status, notes, gift_code, gift_amount
           ) VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', $7, $8, $9)`,
          [reference, customer.rows[0].id, service.id, input.date, slot.start, slot.end, input.notes, gift ? gift.code : null, gift ? gift.applied : null],
        );
        inserted = true;
      } catch (error) {
        if (error.code === '23505' && error.constraint === 'bookings_reference_key') continue;
        throw error;
      }
    }
    if (!inserted) throw new Error('Could not create a booking reference.');

    await client.query('COMMIT');

    const saved = await pool.query(`${BOOKING_SQL} WHERE b.reference = $1`, [reference]);
    const booking = publicBooking(saved.rows[0]);
    try {
      await sendBookingEmails({
        ...booking,
        email: input.email,
        phone: input.phone,
        notes: input.notes,
      });
    } catch (error) {
      console.error(`Booking ${booking.reference} was saved, but email sending failed:`, error.message);
    }
    return { status: 201, body: booking };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) { /* already closed */ }
    if (error.code === '23P01') {
      return { status: 409, body: { error: 'That time is no longer available. Please choose another.' } };
    }
    throw error;
  } finally {
    client.release();
  }
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/services', async (_req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, slug, name, description, duration, price
         FROM services
         WHERE active = TRUE
         ORDER BY id`,
      );
      res.json(rows.map(publicService));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/availability/dates', async (req, res, next) => {
    try {
      const service = await getActiveService(pool, Number(req.query.serviceId));
      if (!service) return res.status(400).json({ error: 'Choose a treatment.' });

      const today = londonNow().date;
      const from = typeof req.query.from === 'string' && isRealDate(req.query.from) ? req.query.from : today;
      const to = typeof req.query.to === 'string' && isRealDate(req.query.to) ? req.query.to : addDays(from, 42);
      const range = parseRange(from, to);
      if (!range.ok) return res.status(400).json({ error: range.error });
      if (range.value.empty || to <= today) return res.json({ dates: [] });

      const start = from < today ? today : from;
      const dates = await availableDates(pool, service, start, to);
      res.json({ dates });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/availability', async (req, res, next) => {
    try {
      const service = await getActiveService(pool, Number(req.query.serviceId));
      if (!service) return res.status(400).json({ error: 'Choose a treatment.' });
      const date = typeof req.query.date === 'string' ? req.query.date : '';
      if (!isRealDate(date)) return res.status(400).json({ error: 'Choose a valid date.' });

      const today = londonNow().date;
      if (date < today) return res.json({ date, slots: [] });
      if (date > addDays(today, MAX_ADVANCE_DAYS)) return res.json({ date, slots: [] });

      const slots = await availableSlots(pool, service, date);
      res.json({ date, slots });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/bookings', async (req, res, next) => {
    try {
      const parsed = validateBookingInput(req.body);
      if (!parsed.ok) return res.status(400).json({ error: parsed.error });
      const result = await createBooking(parsed.value);
      res.status(result.status).json(result.body);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/gift-vouchers', async (req, res, next) => {
    try {
      const parsed = validateGiftInput(req.body);
      if (!parsed.ok) return res.status(400).json({ error: parsed.error });

      const client = await pool.connect();
      let voucher = null;
      try {
        await client.query('BEGIN');
        let inserted = false;
        for (let attempt = 0; attempt < 5 && !inserted; attempt += 1) {
          const code = createGiftCode();
          try {
            const created = await client.query(
              `INSERT INTO gift_vouchers (
                 code, purchaser_name, recipient_email, send_to, amount, balance, message
               ) VALUES ($1, $2, $3, $4, $5, $5, $6)
               RETURNING code, amount, purchaser_name, recipient_email, send_to, message`,
              [code, parsed.value.name, parsed.value.email, parsed.value.sendTo, parsed.value.amount, parsed.value.message],
            );
            voucher = created.rows[0];
            inserted = true;
          } catch (error) {
            if (error.code === '23505' && error.constraint === 'gift_vouchers_code_key') continue;
            throw error;
          }
        }
        if (!voucher) throw new Error('Could not create a gift code.');
        await client.query('COMMIT');
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch (_) { /* already closed */ }
        throw error;
      } finally {
        client.release();
      }

      try {
        await sendGiftVoucherEmails({
          code: voucher.code,
          amount: Number(voucher.amount).toFixed(2),
          purchaserName: voucher.purchaser_name,
          email: voucher.recipient_email,
          sendTo: voucher.send_to,
          message: voucher.message,
        });
      } catch (error) {
        console.error(`Gift voucher ${voucher.code} was saved, but email sending failed:`, error.message);
      }

      res.status(201).json({
        code: voucher.code,
        amount: Number(voucher.amount).toFixed(2),
        email: voucher.recipient_email,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/gift-vouchers/check', async (req, res, next) => {
    try {
      const code = typeof req.query.code === 'string'
        ? req.query.code.trim().toUpperCase().replace(/\s+/g, '')
        : '';
      if (!/^GIFT-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(code)) {
        return res.status(400).json({ error: 'Enter a valid gift code.' });
      }
      const service = await getActiveService(pool, Number(req.query.serviceId));
      if (!service) return res.status(400).json({ error: 'Choose a treatment.' });
      const voucher = await findVoucher(pool, code, false);
      const quote = quoteVoucher(voucher, service);
      if (!quote.ok) return res.status(400).json({ error: quote.error });
      res.json({
        code: quote.value.code,
        balance: quote.value.balance,
        applied: quote.value.applied,
        amountDue: quote.value.amountDue,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/bookings/:reference', async (req, res, next) => {
    try {
      if (!/^ALE-[A-Z0-9]{8}$/.test(req.params.reference)) {
        return res.status(404).json({ error: 'Booking not found.' });
      }
      const { rows } = await pool.query(`${BOOKING_SQL} WHERE b.reference = $1`, [req.params.reference]);
      if (!rows[0]) return res.status(404).json({ error: 'Booking not found.' });
      res.json(publicBooking(rows[0]));
    } catch (error) {
      next(error);
    }
  });

  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use((error, _req, res, _next) => {
    console.error(error);
    if (res.headersSent) return;
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  return app;
}

async function start() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing. Copy .env.example to .env and set the database credentials.');
    process.exit(1);
  }

  await ensureLocalPostgres();
  await migrate();
  await seed(pool);

  const port = Number(process.env.PORT || 8080);
  const app = createApp();
  const server = app.listen(port, '127.0.0.1', () => {
    console.log(`A Luxurious Experience is running at http://127.0.0.1:${port}/`);
  });
  server.on('error', (error) => {
    console.error(error.message);
    process.exit(1);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { createApp, start };
