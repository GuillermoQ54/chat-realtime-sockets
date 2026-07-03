const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_in_production';

/**
 * Hash a plain text password
 * @param {string} password 
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compare plain text password with its hash
 * @param {string} password 
 * @param {string} hashedPassword 
 * @returns {Promise<boolean>} Match result
 */
async function comparePassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Generate a JWT token containing the username
 * @param {string} username 
 * @returns {string} Signed JWT token
 */
function generateToken(username) {
  return jwt.sign(
    { username },
    JWT_SECRET,
    { expiresIn: '7d' } // Token valid for 7 days
  );
}

/**
 * Verify a JWT token
 * @param {string} token 
 * @returns {object|null} Decoded payload or null if invalid
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken
};
