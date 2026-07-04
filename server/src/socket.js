const { verifyToken } = require('./auth');
const { saveMessage, getMessageHistory } = require('./db');

// Map of socket.id -> { username, connectedAt }
const connectedUsers = {};

// Map of socket.id -> Array of timestamps (for rate limiting)
const messageTimestamps = {};

/**
 * Configure socket.io events and middlewares
 * @param {object} io - Socket.io server instance
 */
function setupSockets(io) {
  // Middleware to authenticate socket connections with JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth ? socket.handshake.auth.token : null;
    
    if (!token) {
      return next(new Error('Autenticación fallida: Token de acceso no proporcionado.'));
    }
    
    const decoded = verifyToken(token);
    if (!decoded || !decoded.username) {
      return next(new Error('Autenticación fallida: Sesión inválida o expirada.'));
    }
    
    const username = decoded.username;
    
    // Check if the username is already connected in any socket session
    const isAlreadyActive = Object.values(connectedUsers).some(
      user => user.username.toLowerCase() === username.toLowerCase()
    );
    
    if (isAlreadyActive) {
      return next(new Error('Sesión activa: Este usuario ya está conectado en otra pestaña o dispositivo.'));
    }
    
    // Attach username to the socket object for future reference
    socket.username = username;
    next();
  });

  io.on('connection', (socket) => {
    const username = socket.username;
    
    // Register user session
    connectedUsers[socket.id] = {
      username,
      connectedAt: new Date().toISOString()
    };
    messageTimestamps[socket.id] = [];
    
    console.log(`[Socket] Conexión establecida: ${username} (Socket ID: ${socket.id})`);
    
    // Send message history to the newly connected user
    const history = getMessageHistory(50);
    socket.emit('chat:history', history);
    
    // Broadcast active users list to everyone
    broadcastUserList(io);
    
    // Broadcast join notification message
    const joinMessage = {
      id: 'system_' + Date.now() + Math.random().toString(36).substr(2, 4),
      sender: 'System',
      content: `${username} se ha unido al chat.`,
      timestamp: new Date().toISOString()
    };
    socket.broadcast.emit('chat:message', joinMessage);
    
    // Handle chat message event
    socket.on('chat:message', (data) => {
      try {
        if (!data || typeof data.content !== 'string') {
          return socket.emit('chat:error', 'Formato de mensaje inválido.');
        }
        
        const content = data.content.trim();
        if (content.length === 0) {
          return socket.emit('chat:error', 'El mensaje no puede estar vacío.');
        }
        
        if (content.length > 500) {
          return socket.emit('chat:error', 'El mensaje excede el límite de 500 caracteres.');
        }
        
        // --- Rate Limiting (Spam protection) ---
        const now = Date.now();
        // Clean timestamps older than 10 seconds (10000ms)
        messageTimestamps[socket.id] = messageTimestamps[socket.id].filter(t => now - t < 10000);
        
        if (messageTimestamps[socket.id].length >= 5) {
          return socket.emit('chat:error', 'Límite de spam alcanzado. Máximo 5 mensajes cada 10 segundos.');
        }
        
        messageTimestamps[socket.id].push(now);
        // ----------------------------------------
        
        // Save to DB and broadcast
        const savedMessage = saveMessage(username, content);
        io.emit('chat:message', savedMessage);
      } catch (error) {
        console.error(`Error procesando mensaje de ${username}:`, error);
        socket.emit('chat:error', 'Ocurrió un error al procesar tu mensaje.');
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Desconexión de ${username} (Socket ID: ${socket.id}). Razón: ${reason}`);
      
      // Cleanup tracking states
      delete connectedUsers[socket.id];
      delete messageTimestamps[socket.id];
      
      // Broadcast updated active users list
      broadcastUserList(io);
      
      // Broadcast leave notification
      const leaveMessage = {
        id: 'system_' + Date.now() + Math.random().toString(36).substr(2, 4),
        sender: 'System',
        content: `${username} ha abandonado el chat.`,
        timestamp: new Date().toISOString()
      };
      io.emit('chat:message', leaveMessage);
    });
  });
}

/**
 * Emit the current list of online users to all clients
 * @param {object} io - Socket.io server instance
 */
function broadcastUserList(io) {
  // Get list of unique online usernames
  const onlineUsernames = [...new Set(Object.values(connectedUsers).map(u => u.username))];
  io.emit('users:list', onlineUsernames);
}

module.exports = {
  setupSockets
};
