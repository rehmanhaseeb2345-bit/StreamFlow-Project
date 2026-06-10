const UNIT_TO_MS = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
  y: 365 * 24 * 60 * 60 * 1000,
};

// Mirrors how jsonwebtoken's `expiresIn` interprets values: a bare number of
// seconds, or a string like "15m" / "7d". Returns null if unparseable.
const parseExpiryToMs = (value) => {
  if (value === undefined || value === null) return null;

  const str = String(value).trim();

  if (/^\d+$/.test(str)) {
    return Number(str) * 1000;
  }

  const match = str.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w|y)$/i);
  if (!match) return null;

  return parseFloat(match[1]) * UNIT_TO_MS[match[2].toLowerCase()];
};

const baseCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
});

export const getAccessTokenCookieOptions = () => {
  const maxAge = parseExpiryToMs(process.env.ACCESS_TOKEN_EXPIRY);
  return maxAge === null ? baseCookieOptions() : { ...baseCookieOptions(), maxAge };
};

export const getRefreshTokenCookieOptions = () => {
  const maxAge = parseExpiryToMs(process.env.REFRESH_TOKEN_EXPIRY);
  return maxAge === null ? baseCookieOptions() : { ...baseCookieOptions(), maxAge };
};

export const getClearCookieOptions = baseCookieOptions;
