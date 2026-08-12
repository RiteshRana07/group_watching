const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const COOKIE_NAME = "wt_session";

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function signToken({ userId, username }) {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: "30d" });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function sessionCookie(token) {
  // httpOnly cookie string for a Set-Cookie header
  const maxAge = 60 * 60 * 24 * 30;
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

function clearCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

function getTokenFromCookies(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  return match ? match.split("=")[1] : null;
}

module.exports = {
  COOKIE_NAME,
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  sessionCookie,
  clearCookie,
  getTokenFromCookies,
};
