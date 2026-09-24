const { isRealDate, timeToMinutes, addDays, londonNow, MAX_ADVANCE_DAYS } = require('./time');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+().\-\s]{7,30}$/;
const NAME_PATTERN = /^[\p{L}\p{M}'’.\- ]{2,80}$/u;

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateBookingInput(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Booking details are missing.' };
  }

  const serviceId = Number(body.serviceId);
  if (!Number.isInteger(serviceId) || serviceId <= 0) {
    return { ok: false, error: 'Choose a treatment.' };
  }

  const date = cleanText(body.date);
  if (!isRealDate(date)) {
    return { ok: false, error: 'Choose a valid date.' };
  }

  const today = londonNow().date;
  if (date < today) {
    return { ok: false, error: 'Appointments cannot be booked in the past.' };
  }
  if (date > addDays(today, MAX_ADVANCE_DAYS)) {
    return { ok: false, error: 'Appointments can only be booked up to a year ahead.' };
  }

  const startTime = cleanText(body.startTime);
  if (!/^\d{2}:\d{2}$/.test(startTime) || timeToMinutes(startTime) == null) {
    return { ok: false, error: 'Choose a valid time.' };
  }

  const name = cleanText(body.name);
  if (!NAME_PATTERN.test(name)) {
    return { ok: false, error: 'Enter your full name.' };
  }

  const email = cleanText(body.email).toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }

  const phone = cleanText(body.phone);
  const digitCount = phone.replace(/\D/g, '').length;
  if (!PHONE_PATTERN.test(phone) || digitCount < 7) {
    return { ok: false, error: 'Enter a valid phone number.' };
  }

  const notes = cleanText(body.notes);
  if (notes.length > 1000) {
    return { ok: false, error: 'Notes must be 1000 characters or fewer.' };
  }

  const giftCode = cleanText(body.giftCode).toUpperCase().replace(/\s+/g, '');
  if (giftCode && !/^GIFT-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(giftCode)) {
    return { ok: false, error: 'Enter a valid gift code.' };
  }

  return {
    ok: true,
    value: {
      serviceId,
      date,
      startTime,
      name,
      email,
      phone,
      notes: notes || null,
      giftCode: giftCode || null,
    },
  };
}

const VOUCHER_AMOUNTS = [15, 20, 25, 30, 35, 40, 45, 50];

function validateGiftInput(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Voucher details are missing.' };
  }

  const name = cleanText(body.name);
  if (!NAME_PATTERN.test(name)) {
    return { ok: false, error: 'Enter your name.' };
  }

  const email = cleanText(body.email).toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }

  const sendTo = body.sendTo === 'recipient' || body.sendTo === 'self' ? body.sendTo : '';
  if (!sendTo) {
    return { ok: false, error: 'Choose where to send the voucher.' };
  }

  const custom = cleanText(body.customAmount);
  const selected = Number(body.amount);
  let amount = null;
  if (custom) {
    if (!/^\d+$/.test(custom) || Number(custom) < 15) {
      return { ok: false, error: 'The minimum amount is £15.' };
    }
    if (Number(custom) > 500) {
      return { ok: false, error: 'Enter an amount of £500 or less.' };
    }
    amount = Number(custom);
  } else if (VOUCHER_AMOUNTS.includes(selected)) {
    amount = selected;
  } else {
    return { ok: false, error: 'Choose a voucher amount.' };
  }

  const message = cleanText(body.message);
  if (message.length > 1000) {
    return { ok: false, error: 'Message must be 1000 characters or fewer.' };
  }

  return {
    ok: true,
    value: {
      name,
      email,
      sendTo,
      amount,
      message: message || null,
    },
  };
}

module.exports = { validateBookingInput, validateGiftInput, cleanText };
