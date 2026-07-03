require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const db = require('./db');
const auth = require('./auth');
const { setupSockets } = require('./socket');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS settings
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Configure CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Global logger middleware
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Rate limiting for Auth API endpoints to prevent brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos desde esta IP. Por favor, intenta de nuevo en 15 minutos.' }
});

app.use('/api/auth/', authLimiter);

// --- Auth Routes ---

// Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validations
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
    }
    
    const cleanUsername = username.trim();
    const usernameRegex = /^[a-zA-Z0-9_]{3,15}$/;
    if (!usernameRegex.test(cleanUsername)) {
      return res.status(400).json({ error: 'El usuario debe tener entre 3 y 15 caracteres y contener solo letras, números o guiones bajos.' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }
    
    // Check if user already exists
    const existingUser = db.getUser(cleanUsername);
    if (existingUser) {
      return res.status(400).json({ error: 'El nombre de usuario ya está registrado.' });
    }
    
    // Hash password and store user
    const hashedPassword = await auth.hashPassword(password);
    db.createUser(cleanUsername, hashedPassword);
    
    return res.status(201).json({ success: true, message: 'Usuario registrado exitosamente.' });
  } catch (error) {
    console.error('Error durante el registro:', error);
    return res.status(500).json({ error: 'Error del servidor durante el registro.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
    }
    
    const cleanUsername = username.trim();
    
    // Fetch user
    const user = db.getUser(cleanUsername);
    if (!user) {
      return res.status(401).json({ error: 'El usuario no existe o la contraseña es incorrecta.' });
    }
    
    // Validate password
    const isPasswordValid = await auth.comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'El usuario no existe o la contraseña es incorrecta.' });
    }
    
    // Generate JWT token
    const token = auth.generateToken(user.username);
    
    return res.json({
      success: true,
      token,
      username: user.username
    });
  } catch (error) {
    console.error('Error durante el inicio de sesión:', error);
    return res.status(500).json({ error: 'Error del servidor durante el inicio de sesión.' });
  }
});

// --- Serve Frontend Static Files ---
const clientPath = path.join(__dirname, '..', '..', 'client', 'src');
app.use(express.static(clientPath));

// Fallback to index.html for Single Page Application behavior
app.get('*', (req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

// Configure Socket.IO server
setupSockets(io);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`Servidor de chat en ejecución en el puerto: ${PORT}`);
  console.log(`Modo: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Sirviendo cliente estático desde: ${clientPath}`);
  console.log(`==================================================`);
});

// Centralized error recovery to prevent crashing in production
process.on('uncaughtException', (err) => {
  console.error('ERROR NO CONTROLADO (uncaughtException):', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('PROMESA RECHAZADA NO CONTROLADA (unhandledRejection):', reason);
});
