const SERVICES = [
  ['sports-package', '4x Sports', 'A package of four 60-minute sports treatments. Booking reserves one 60-minute visit.', 60, 188],
  ['pregnancy-package', '3x Pregnancy', 'A package of three 60-minute pregnancy treatments. Booking reserves one 60-minute visit.', 60, 135],
  ['thai-yoga-package', '3x Thai Yoga Massage', 'A package of three 60-minute Thai yoga massages. Booking reserves one 60-minute visit.', 60, 162],
  ['aromatherapy-full-body', 'Aromatherapy Full Body Massage', 'Full-body aromatherapy massage using essential oils to soothe the nervous system and calm the mind.', 60, 52],
  ['indian-head', 'Indian Head', 'Indian head massage focused on the upper back, shoulders, neck, scalp, and face.', 50, 48],
  ['pregnancy-massage', 'Pregnancy Massage', 'A tailored pregnancy massage to ease discomfort and support relaxation.', 60, 50],
  ['reflexology', 'Reflexology', 'Reflexology treatment working pressure points in the feet to support relaxation and wellbeing.', 50, 48],
  ['swedish-full-body', 'Swedish Full Body', 'Classic Swedish full-body massage to ease tension and improve circulation.', 60, 50],
  ['sports', 'Sports', 'Sports massage focused on muscle recovery, tightness, and performance-related tension.', 60, 52],
  ['warm-bamboo', 'Warm Bamboo Full Body Massage', 'Full-body massage using warm bamboo to soothe tired, stiff muscles.', 60, 52],
  ['thai-foot', 'Thai Foot Massage', 'Thai foot massage working the feet and lower legs.', 50, 48],
  ['synergy-stones', 'Synergy Stones', 'Full-body treatment using synergy stones for deep warmth and relaxation.', 60, 52],
  ['aroma-head-or-reflex', 'Aroma & Indian Head or Reflex', 'Combined aromatherapy session with a choice of Indian head massage or reflexology.', 90, 75],
  ['swedish-head-or-reflex', 'Swedish & Indian Head or Reflex', 'Combined Swedish massage with a choice of Indian head massage or reflexology.', 90, 70],
  ['reflex-and-indian-head', 'Reflex & Indian Head', 'Combined reflexology and Indian head massage.', 75, 72],
  ['orli-candle-full-body', 'Orli Candle Full Body', 'Warm botanical candle oil for a relaxing full-body massage.', 60, 52],
  ['orli-candle-indian-head', 'Orli Candle Indian Head Massage', 'Nourishing hot oil candle used for Indian head massage.', 50, 47],
  ['signature', 'Signature Treatment', 'Head-to-toe aromatherapy massage with hot stones and a hand mask.', 70, 65],
  ['manual-lymphatic-drainage', 'Manual Lymphatic Drainage', 'Light-touch full-body treatment for women. Not a massage. Avoid during menstruation.', 60, null],
  ['thai-yoga-60', 'Thai Yoga Massage 60', 'Relieves tension, supports posture, and helps with fatigue and insomnia.', 60, 60],
  ['thai-yoga-90', 'Thai Yoga Massage 90', 'Longer Thai yoga session for posture, tension relief, and deep relaxation.', 90, 85],
  ['cupping', 'Cupping', '5–10 minutes extra to a treatment. Must be booked alongside a treatment.', 10, 5],
  ['iastm', 'IASTM', '5–10 minutes add-on to a treatment.', 10, 5],
];

const HOURS = [
  [0, '11:00', '18:00', true],
  [1, '17:00', '21:00', true],
  [2, '17:00', '21:00', true],
  [3, '00:00', '00:00', false],
  [4, '17:00', '21:00', true],
  [5, '00:00', '00:00', false],
  [6, '11:00', '18:00', true],
];

async function seed(pool) {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM services');
  if (rows[0].count > 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [slug, name, description, duration, price] of SERVICES) {
      await client.query(
        `INSERT INTO services (slug, name, description, duration, price, active)
         VALUES ($1, $2, $3, $4, $5, TRUE)`,
        [slug, name, description, duration, price],
      );
    }
    for (const [day, opening, closing, active] of HOURS) {
      await client.query(
        `INSERT INTO business_availability (day_of_week, opening_time, closing_time, active)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (day_of_week) DO NOTHING`,
        [day, opening, closing, active],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { seed, SERVICES };
