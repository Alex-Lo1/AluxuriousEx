const { Resend } = require('resend');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const BUSINESS = {
  name: 'A Luxurious Experience',
  address: ['117 Cregagh Road, Castlereagh', 'Belfast'],
  phone: '07445 994304',
  phoneHref: 'tel:07445994304',
};

function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_PATTERN.test(email);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday} ${day} ${MONTHS[month - 1]} ${year}`;
}

function formatDuration(minutes) {
  const total = Number(minutes);
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  if (hours && remainder) return `${hours} hour${hours > 1 ? 's' : ''} ${remainder} mins`;
  if (hours) return `${hours} hour${hours > 1 ? 's' : ''}`;
  return `${remainder} mins`;
}

function formatPrice(price) {
  if (price == null || price === '') return 'Price on request';
  const amount = Number(price);
  return Number.isInteger(amount) ? `£${amount}` : `£${amount.toFixed(2)}`;
}

function detailRows(rows) {
  return rows.map(([label, value]) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #efe8e4;color:#8a6b82;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;width:34%;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #efe8e4;color:#2a242b;font-size:16px;vertical-align:top;">${value}</td>
    </tr>
  `).join('');
}

function emailLayout({ title, intro, rows, footer }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#faf9f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e4ddd8;">
          <tr>
            <td style="background:#2a242b;padding:28px 24px;text-align:center;">
              <p style="margin:0 0 8px;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:#d8a7b1;">${escapeHtml(BUSINESS.name)}</p>
              <h1 style="margin:0;font-family:Helvetica,Arial,sans-serif;font-weight:300;font-size:28px;line-height:1.3;color:#ffffff;">${escapeHtml(title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;font-family:Helvetica,Arial,sans-serif;color:#2a242b;line-height:1.6;">
              ${intro}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
                ${detailRows(rows)}
              </table>
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function customerMessage(booking) {
  const price = formatPrice(booking.price);
  const duration = formatDuration(booking.duration);
  const text = [
    `Hello ${booking.customerName},`,
    '',
    `Your appointment at ${BUSINESS.name} is confirmed.`,
    `Reference: ${booking.reference}`,
    `Treatment: ${booking.serviceName}`,
    `Date: ${formatDate(booking.date)}`,
    `Time: ${booking.startTime}–${booking.endTime}`,
    `Duration: ${duration}`,
    `Price: ${price}`,
    ...(booking.giftCode ? [
      `Gift code: ${booking.giftCode}`,
      `Voucher applied: ${formatPrice(booking.giftAmount)}`,
      `Amount due: ${formatPrice(booking.amountDue)}`,
    ] : []),
    '',
    BUSINESS.name,
    ...BUSINESS.address,
    `Tel: ${BUSINESS.phone}`,
  ].join('\n');

  const html = emailLayout({
    title: 'Booking confirmed',
    intro: `<p style="margin:0 0 16px;font-size:16px;">Hello ${escapeHtml(booking.customerName)},</p>
      <p style="margin:0 0 20px;font-size:16px;">Your appointment is confirmed. Please keep this reference for your visit.</p>`,
    rows: [
      ['Reference', escapeHtml(booking.reference)],
      ['Treatment', escapeHtml(booking.serviceName)],
      ['Date', escapeHtml(formatDate(booking.date))],
      ['Start', escapeHtml(booking.startTime)],
      ['End', escapeHtml(booking.endTime)],
      ['Duration', escapeHtml(duration)],
      ['Price', escapeHtml(price)],
      ...(booking.giftCode ? [
        ['Gift code', escapeHtml(booking.giftCode)],
        ['Voucher applied', escapeHtml(formatPrice(booking.giftAmount))],
        ['Amount due', escapeHtml(formatPrice(booking.amountDue))],
      ] : []),
    ],
    footer: `<p style="margin:24px 0 0;font-size:15px;color:#2a242b;">
        ${escapeHtml(BUSINESS.name)}<br>
        ${BUSINESS.address.map(escapeHtml).join('<br>')}
        <br><a href="${BUSINESS.phoneHref}" style="color:#8a6b82;text-decoration:none;">Tel: ${escapeHtml(BUSINESS.phone)}</a>
      </p>`,
  });

  return {
    to: booking.email,
    subject: `Your booking is confirmed — ${booking.reference}`,
    html,
    text,
  };
}

function ownerMessage(booking) {
  const price = formatPrice(booking.price);
  const duration = formatDuration(booking.duration);
  const notes = booking.notes ? booking.notes : 'None';
  const text = [
    `New booking at ${BUSINESS.name}`,
    `Reference: ${booking.reference}`,
    `Customer: ${booking.customerName}`,
    `Email: ${booking.email}`,
    `Phone: ${booking.phone}`,
    `Treatment: ${booking.serviceName}`,
    `Date: ${formatDate(booking.date)}`,
    `Time: ${booking.startTime}–${booking.endTime}`,
    `Duration: ${duration}`,
    `Price: ${price}`,
    ...(booking.giftCode ? [
      `Gift code: ${booking.giftCode}`,
      `Voucher applied: ${formatPrice(booking.giftAmount)}`,
      `Amount due: ${formatPrice(booking.amountDue)}`,
    ] : []),
    `Notes: ${notes}`,
  ].join('\n');

  const html = emailLayout({
    title: 'New booking',
    intro: '<p style="margin:0 0 20px;font-size:16px;">A customer has just confirmed an appointment.</p>',
    rows: [
      ['Reference', escapeHtml(booking.reference)],
      ['Name', escapeHtml(booking.customerName)],
      ['Email', escapeHtml(booking.email)],
      ['Phone', escapeHtml(booking.phone)],
      ['Treatment', escapeHtml(booking.serviceName)],
      ['Date', escapeHtml(formatDate(booking.date))],
      ['Time', escapeHtml(`${booking.startTime}–${booking.endTime}`)],
      ['Duration', escapeHtml(duration)],
      ['Price', escapeHtml(price)],
      ...(booking.giftCode ? [
        ['Gift code', escapeHtml(booking.giftCode)],
        ['Voucher applied', escapeHtml(formatPrice(booking.giftAmount))],
        ['Amount due', escapeHtml(formatPrice(booking.amountDue))],
      ] : []),
      ['Notes', escapeHtml(notes).replace(/\n/g, '<br>')],
    ],
    footer: '',
  });

  return {
    to: envValue('OWNER_EMAIL'),
    subject: `New booking — ${booking.reference}`,
    html,
    text,
  };
}

function envValue(name) {
  return (process.env[name] || '').trim();
}

async function deliver(resend, message) {
  const { data, error } = await resend.emails.send({
    from: envValue('BOOKING_FROM_EMAIL'),
    to: [message.to],
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
  if (error) {
    const failure = new Error(error.message || 'Resend could not send the email');
    failure.name = 'ResendError';
    throw failure;
  }
  return data;
}

function giftVoucherMessage(voucher) {
  const amount = formatPrice(voucher.amount);
  const forRecipient = voucher.sendTo === 'recipient';
  const introText = forRecipient
    ? `${voucher.purchaserName} has sent you a gift voucher for ${BUSINESS.name}.`
    : `Your gift voucher for ${BUSINESS.name} is ready.`;
  const text = [
    introText,
    `Gift code: ${voucher.code}`,
    `Amount: ${amount}`,
    voucher.message ? `Message: ${voucher.message}` : '',
    '',
    'Enter this code when you book a treatment. It can be used towards the price of the appointment.',
    '',
    BUSINESS.name,
    ...BUSINESS.address,
    `Tel: ${BUSINESS.phone}`,
  ].filter((line) => line !== undefined).join('\n');

  const html = emailLayout({
    title: forRecipient ? 'A gift for you' : 'Your gift voucher',
    intro: `<p style="margin:0 0 16px;font-size:16px;">Hello,</p>
      <p style="margin:0 0 20px;font-size:16px;">${escapeHtml(introText)}</p>
      ${voucher.message ? `<p style="margin:0 0 20px;font-size:16px;">${escapeHtml(voucher.message).replace(/\n/g, '<br>')}</p>` : ''}`,
    rows: [
      ['Gift code', escapeHtml(voucher.code)],
      ['Amount', escapeHtml(amount)],
      ['From', escapeHtml(voucher.purchaserName)],
    ],
    footer: `<p style="margin:24px 0 0;font-size:15px;">Enter this code when booking a treatment. Any amount left on the voucher stays available for another visit.</p>
      <p style="margin:16px 0 0;font-size:15px;color:#2a242b;">
        ${escapeHtml(BUSINESS.name)}<br>
        ${BUSINESS.address.map(escapeHtml).join('<br>')}
        <br><a href="${BUSINESS.phoneHref}" style="color:#8a6b82;text-decoration:none;">Tel: ${escapeHtml(BUSINESS.phone)}</a>
      </p>`,
  });

  return {
    to: voucher.email,
    subject: forRecipient
      ? `A gift voucher from ${voucher.purchaserName}`
      : `Your gift voucher — ${voucher.code}`,
    html,
    text,
  };
}

function giftOwnerMessage(voucher) {
  const text = [
    `New gift voucher at ${BUSINESS.name}`,
    `Gift code: ${voucher.code}`,
    `Amount: ${formatPrice(voucher.amount)}`,
    `Purchaser: ${voucher.purchaserName}`,
    `Email: ${voucher.email}`,
    `Sent to: ${voucher.sendTo === 'recipient' ? 'Recipient' : 'Purchaser'}`,
    `Message: ${voucher.message || 'None'}`,
  ].join('\n');
  const html = emailLayout({
    title: 'New gift voucher',
    intro: '<p style="margin:0 0 20px;font-size:16px;">A gift voucher has been purchased.</p>',
    rows: [
      ['Gift code', escapeHtml(voucher.code)],
      ['Amount', escapeHtml(formatPrice(voucher.amount))],
      ['Name', escapeHtml(voucher.purchaserName)],
      ['Email', escapeHtml(voucher.email)],
      ['Sent to', voucher.sendTo === 'recipient' ? 'Recipient' : 'Purchaser'],
      ['Message', escapeHtml(voucher.message || 'None').replace(/\n/g, '<br>')],
    ],
    footer: '',
  });
  return {
    to: envValue('OWNER_EMAIL'),
    subject: `New gift voucher — ${voucher.code}`,
    html,
    text,
  };
}

async function sendGiftVoucherEmails(voucher) {
  const result = { customer: { sent: false }, owner: { sent: false } };
  if (!isValidEmail(voucher.email)) {
    console.error(`Gift voucher email was not sent for ${voucher.code}: the email address is invalid.`);
    return result;
  }
  if (!envValue('RESEND_API_KEY') || !envValue('BOOKING_FROM_EMAIL')) {
    console.error(`Gift voucher emails were not sent for ${voucher.code}: RESEND_API_KEY or BOOKING_FROM_EMAIL is not set.`);
    return result;
  }

  const resend = new Resend(envValue('RESEND_API_KEY'));
  try {
    await deliver(resend, giftVoucherMessage(voucher));
    result.customer.sent = true;
  } catch (error) {
    console.error(`Gift voucher email failed for ${voucher.code}:`, error.message);
  }

  if (!isValidEmail(envValue('OWNER_EMAIL'))) {
    console.error(`Owner gift notification was not sent for ${voucher.code}: OWNER_EMAIL is missing or invalid.`);
    return result;
  }
  try {
    await deliver(resend, giftOwnerMessage(voucher));
    result.owner.sent = true;
  } catch (error) {
    console.error(`Owner gift notification failed for ${voucher.code}:`, error.message);
  }
  return result;
}

async function sendBookingEmails(booking) {
  const result = { customer: { sent: false }, owner: { sent: false } };

  if (!isValidEmail(booking.email)) {
    console.error(`Customer confirmation was not sent for ${booking.reference}: the email address is invalid.`);
    return result;
  }

  if (!envValue('RESEND_API_KEY') || !envValue('BOOKING_FROM_EMAIL')) {
    console.error(`Booking emails were not sent for ${booking.reference}: RESEND_API_KEY or BOOKING_FROM_EMAIL is not set.`);
    return result;
  }

  const resend = new Resend(envValue('RESEND_API_KEY'));
  const customer = customerMessage(booking);

  try {
    await deliver(resend, customer);
    result.customer.sent = true;
  } catch (error) {
    console.error(`Customer confirmation failed for ${booking.reference}:`, error.message);
  }

  if (!isValidEmail(envValue('OWNER_EMAIL'))) {
    console.error(`Owner notification was not sent for ${booking.reference}: OWNER_EMAIL is missing or invalid.`);
    return result;
  }

  try {
    await deliver(resend, ownerMessage(booking));
    result.owner.sent = true;
  } catch (error) {
    console.error(`Owner notification failed for ${booking.reference}:`, error.message);
  }

  return result;
}

module.exports = {
  isValidEmail,
  customerMessage,
  ownerMessage,
  sendBookingEmails,
  sendGiftVoucherEmails,
};
