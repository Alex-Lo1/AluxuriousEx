CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  duration INTEGER NOT NULL CHECK (duration > 0),
  price NUMERIC(10, 2) CHECK (price IS NULL OR price >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_availability (
  id SERIAL PRIMARY KEY,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  opening_time TIME NOT NULL,
  closing_time TIME NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (day_of_week),
  CHECK (active = FALSE OR closing_time > opening_time)
);

CREATE TABLE IF NOT EXISTS blocked_periods (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT,
  CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  reference TEXT UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES customers (id),
  service_id INTEGER NOT NULL REFERENCES services (id),
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS bookings_date_status_idx
  ON bookings (appointment_date, status);

CREATE INDEX IF NOT EXISTS blocked_periods_date_idx
  ON blocked_periods (date);

CREATE TABLE IF NOT EXISTS gift_vouchers (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  purchaser_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  send_to TEXT NOT NULL CHECK (send_to IN ('self', 'recipient')),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 15),
  balance NUMERIC(10, 2) NOT NULL CHECK (balance >= 0),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS gift_code TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS gift_amount NUMERIC(10, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_no_overlap'
  ) THEN
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_no_overlap
      EXCLUDE USING gist (
        tsrange(
          (appointment_date + start_time),
          (appointment_date + end_time),
          '[)'
        ) WITH &&
      )
      WHERE (status = 'confirmed');
  END IF;
END $$;
