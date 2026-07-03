const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

// Initialize database file
function initDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  if (!fs.existsSync(DB_PATH)) {
    const initialData = {
      users: [],
      messages: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

// Read database file synchronously
function readDb() {
  try {
    initDb();
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database file:', error);
    return { users: [], messages: [] };
  }
}

// Write database file synchronously
function writeDb(data) {
  try {
    initDb();
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing database file:', error);
    return false;
  }
}

/**
 * Get user details by username
 * @param {string} username 
 * @returns {object|null} User object or null if not found
 */
function getUser(username) {
  const db = readDb();
  const lowerUsername = username.toLowerCase();
  return db.users.find(u => u.username.toLowerCase() === lowerUsername) || null;
}

/**
 * Create a new user in the database
 * @param {string} username 
 * @param {string} hashedPassword 
 * @returns {object|null} The created user object
 */
function createUser(username, hashedPassword) {
  const db = readDb();
  
  // Double-check duplicates (case-insensitive)
  const lowerUsername = username.toLowerCase();
  const exists = db.users.some(u => u.username.toLowerCase() === lowerUsername);
  if (exists) {
    return null;
  }
  
  const newUser = {
    username, // Keep original casing for display
    password: hashedPassword,
    createdAt: new Date().toISOString()
  };
  
  db.users.push(newUser);
  writeDb(db);
  return newUser;
}

/**
 * Save a new chat message to history
 * @param {string} sender 
 * @param {string} content 
 * @returns {object} The saved message object
 */
function saveMessage(sender, content) {
  const db = readDb();
  
  const newMessage = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    sender,
    content,
    timestamp: new Date().toISOString()
  };
  
  db.messages.push(newMessage);
  
  // Cap message history at last 100 messages to prevent database bloat
  if (db.messages.length > 100) {
    db.messages = db.messages.slice(-100);
  }
  
  writeDb(db);
  return newMessage;
}

/**
 * Retrieve persistent message history
 * @param {number} limit 
 * @returns {Array} Array of historical messages
 */
function getMessageHistory(limit = 50) {
  const db = readDb();
  return db.messages.slice(-limit);
}

module.exports = {
  getUser,
  createUser,
  saveMessage,
  getMessageHistory
};
