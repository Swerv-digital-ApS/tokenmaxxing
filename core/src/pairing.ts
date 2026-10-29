/** Crockford base32: no I, L, O or U, so a code survives being read off a screen and typed on a phone. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const SECRET_LENGTH = 8;

/** A phone sign-in code's secret: 40 random bits, so it only holds up because redeeming is rate limited. */
export function phoneSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SECRET_LENGTH));
  return Array.from(bytes, (b) => ALPHABET[b & 31]).join("");
}

/** `42-K7QF-M2XP`: the player's number, then the secret in two halves. */
export const formatPhoneCode = (userId: number, secret: string) =>
  `${userId}-${secret.slice(0, 4)}-${secret.slice(4)}`;

/**
 * Reads a phone code however it was typed: `42-K7QF-M2XP`, ` 42 k7qf m2xp ` and `42K7QFM2XP` are the same code,
 * and O, I and L count as 0, 1 and 1. Typed separators must sit where the code has them, so a dropped
 * character can't slide the player's number into the secret.
 */
export function parsePhoneCode(input: unknown): { userId: number; secret: string } | null {
  if (typeof input !== "string") return null;
  const s = input.trim().toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1");
  const m = /^(\d{1,12})[\s-]*([0-9A-HJKMNP-TV-Z]{4})[\s-]*([0-9A-HJKMNP-TV-Z]{4})$/.exec(s);
  return m ? { userId: Number(m[1]), secret: m[2]! + m[3]! } : null;
}
