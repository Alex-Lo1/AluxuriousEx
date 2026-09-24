function money(value) {
  return Number(value).toFixed(2);
}

async function findVoucher(db, code, lock) {
  const { rows } = await db.query(
    `SELECT id, code, balance, status, amount
     FROM gift_vouchers
     WHERE code = $1
     ${lock ? 'FOR UPDATE' : ''}`,
    [code],
  );
  return rows[0] || null;
}

function quoteVoucher(voucher, service) {
  if (!voucher) {
    return { ok: false, error: 'That gift code cannot be used.' };
  }
  if (voucher.status !== 'active' || Number(voucher.balance) <= 0) {
    return { ok: false, error: 'That gift code has already been used.' };
  }
  if (service.price == null) {
    return { ok: false, error: 'A gift voucher cannot be used for a treatment priced on request.' };
  }

  const price = Number(service.price);
  const balance = Number(voucher.balance);
  const applied = Math.min(price, balance);
  return {
    ok: true,
    value: {
      id: voucher.id,
      code: voucher.code,
      balance: money(balance),
      applied: money(applied),
      amountDue: money(price - applied),
      remaining: money(balance - applied),
    },
  };
}

async function redeemVoucher(db, code, service) {
  const voucher = await findVoucher(db, code, true);
  const quote = quoteVoucher(voucher, service);
  if (!quote.ok) return quote;

  await db.query(
    `UPDATE gift_vouchers
     SET balance = $1::numeric,
         status = CASE WHEN $1::numeric = 0 THEN 'redeemed' ELSE 'active' END
     WHERE id = $2`,
    [quote.value.remaining, quote.value.id],
  );
  return quote;
}

module.exports = { findVoucher, quoteVoucher, redeemVoucher };
