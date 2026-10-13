/**
 * The store's payment endpoint, standing in for a merchant's processor.
 *
 * It answers the way a checkout does — the order and the last four digits of
 * the card it charged — and that is the whole point of it in this demo: when
 * the browser typed a placeholder and the Basis Theory Proxy delivered the
 * real card, the confirmation names the real card's last four.
 *
 * It never stores or logs the card, and it charges nothing.
 */
export async function POST(request) {
  const body = await request.json().catch(() => null);
  const card = body?.card ?? {};
  const number = String(card.number ?? "").replace(/\D/g, "");

  if (!isCardNumber(number)) {
    return decline("Card declined: the card number is not valid.");
  }
  if (isExpired(card.exp_month, card.exp_year)) {
    return decline("Card declined: the card has expired.");
  }

  const order = `ord_${Date.now()}`;
  return Response.json({
    status: "confirmed",
    order_id: order,
    message: `Order ${order} confirmed. Card ending ${number.slice(-4)} charged.`,
  });
}

function decline(message) {
  return Response.json({ status: "declined", message }, { status: 402 });
}

/** Luhn, over 12 to 19 digits. */
function isCardNumber(digits) {
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) digit = digit * 2 > 9 ? digit * 2 - 9 : digit * 2;
    sum += digit;
  }
  return sum % 10 === 0;
}

/** Accepts a two- or four-digit year, as strings or numbers. */
function isExpired(month, year) {
  const m = Number(month);
  const y = Number(String(year ?? "").slice(-2));
  if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(y)) return true;
  const now = new Date();
  const fullYear = 2000 + y;
  return fullYear < now.getUTCFullYear() || (fullYear === now.getUTCFullYear() && m < now.getUTCMonth() + 1);
}
