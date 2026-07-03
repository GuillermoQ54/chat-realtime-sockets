let socket = null;
let currentUsername = null;

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const chatScreen = document.getElementById('chat-screen');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const toastContainer = document.getElementById('toast-container');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const usersList = document.getElementById('users-list');
const activeUsersCount = document.getElementById('active-users-count');
const myUsernameEl = document.getElementById('my-username');
const myAvatarCharEl = document.getElementById('my-avatar-char');
const connectionStateText = document.getElementById('connection-state-text');
const netBadge = document.getElementById('net-badge');
const netBadgeText = document.getElementById('net-badge-text');
const chatSidebar = document.getElementById('chat-sidebar');

// Base API URL (automatically adapts to hosted or local domain)
const API_BASE = window.location.origin;

/* ==========================================================================
   INITIALIZATION & SESSION CHECK
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  const storedUser = localStorage.getItem('username');
  
  if (token && storedUser) {
    currentUsername = storedUser;
    startChatSession(token);
  }
});

/* ==========================================================================
   TOAST NOTIFICATION SYSTEM
   ========================================================================== */
/**
 * Display a floating alert toast
 * @param {string} title 
 * @param {string} message 
 * @param {'success'|'error'|'warning'} type 
 */
function showToast(title, message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = '🔔';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'warning') icon = '⚠️';
  
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;
  
  toastContainer.appendChild(toast);
  
  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 4000);
}

/* ==========================================================================
   AUTH TAB SWITCHING
   ========================================================================== */
function switchAuthTab(tab) {
  if (tab === 'login') {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
  } else {
    tabLogin.classList.remove('active');
    tabRegister.classList.add('active');
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
  }
}

/* ==========================================================================
   AUTHENTICATION LOGIC (API CALLS)
   ========================================================================== */
async function handleRegister(event) {
  event.preventDefault();
  const usernameInput = document.getElementById('reg-username');
  const passwordInput = document.getElementById('reg-password');
  
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  
  try {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Fallo al registrar usuario.');
    }
    
    showToast('Registro Exitoso', 'Tu usuario ha sido creado. Ya puedes iniciar sesión.', 'success');
    usernameInput.value = '';
    passwordInput.value = '';
    switchAuthTab('login');
    // Pre-populate login form
    document.getElementById('login-username').value = username;
  } catch (error) {
    showToast('Error de Registro', error.message, 'error');
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  
  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Credenciales inválidas.');
    }
    
    // Save details in local storage
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.username);
    currentUsername = data.username;
    
    usernameInput.value = '';
    passwordInput.value = '';
    
    showToast('Sesión Iniciada', `¡Bienvenido de vuelta, ${currentUsername}!`, 'success');
    startChatSession(data.token);
  } catch (error) {
    showToast('Error de Acceso', error.message, 'error');
  }
}

function handleLogout() {
  // Disconnect socket if any
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  
  // Clear localStorage variables
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  currentUsername = null;
  
  // Reset UI views
  chatScreen.classList.add('hidden');
  authScreen.classList.remove('hidden');
  
  // Reset message board
  messagesContainer.innerHTML = `
    <div class="welcome-box">
      <div class="welcome-icon">💬</div>
      <h3>¡Bienvenido al canal general!</h3>
      <p>Este es el inicio del historial de mensajes guardados del servidor. Los mensajes son seguros y filtrados contra inyecciones HTML.</p>
    </div>
  `;
  
  showToast('Sesión Cerrada', 'Has cerrado tu sesión de forma segura.', 'success');
}

/* ==========================================================================
   SOCKET SESSION MANAGEMENT
   ========================================================================== */
function startChatSession(token) {
  // Update Profile Card in sidebar
  myUsernameEl.textContent = currentUsername;
  myAvatarCharEl.textContent = currentUsername.charAt(0).toUpperCase();
  
  // Transition screens
  authScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  
  // Connect to Socket.IO Server sending the JWT token in auth handshake options
  socket = io(API_BASE, {
    auth: { token }
  });
  
  // --- Configure Socket Event Listeners ---
  
  socket.on('connect', () => {
    updateConnectionStatus(true);
  });
  
  socket.on('disconnect', (reason) => {
    updateConnectionStatus(false);
    if (reason === 'io server disconnect') {
      // Kicked by server (e.g. duplicated token or session expired)
      handleLogout();
      showToast('Sesión Finalizada', 'Desconectado por el servidor.', 'warning');
    } else {
      showToast('Desconectado', 'Se perdió la conexión con el servidor. Reconectando...', 'warning');
    }
  });
  
  socket.on('connect_error', (error) => {
    updateConnectionStatus(false);
    console.error('Socket Connection Error:', error);
    
    // Check if error is related to active duplicate session or authentication failure
    if (error.message.includes('Sesión activa') || error.message.includes('Autenticación fallida')) {
      showToast('Acceso Denegado', error.message, 'error');
      handleLogout();
    } else {
      showToast('Error de Conexión', 'No se pudo establecer conexión con el servidor de sockets.', 'error');
    }
  });
  
  // Receive message history payload
  socket.on('chat:history', (history) => {
    // Clear and redraw chat area excluding welcome message
    const welcome = messagesContainer.querySelector('.welcome-box');
    messagesContainer.innerHTML = '';
    if (welcome) messagesContainer.appendChild(welcome);
    
    history.forEach(msg => appendMessage(msg));
    scrollToBottom();
  });
  
  // Receive individual live messages
  socket.on('chat:message', (message) => {
    appendMessage(message);
    scrollToBottom();
  });
  
  // Receive live updates of user list
  socket.on('users:list', (users) => {
    renderUsersList(users);
  });
  
  // Receive rate limiting or validation errors from socket
  socket.on('chat:error', (errorMessage) => {
    showToast('Alerta de Chat', errorMessage, 'warning');
  });
}

function updateConnectionStatus(isConnected) {
  if (isConnected) {
    connectionStateText.textContent = 'Conectado';
    connectionStateText.className = 'status-text';
    netBadge.className = 'net-badge connected';
    netBadgeText.textContent = 'En línea';
  } else {
    connectionStateText.textContent = 'Desconectado';
    connectionStateText.className = 'status-text offline';
    netBadge.className = 'net-badge disconnected';
    netBadgeText.textContent = 'Sin conexión';
  }
}

/* ==========================================================================
   UI RENDERING: CHAT & USERS LIST
   ========================================================================== */
/**
 * Render a single message into the chat viewport
 * @param {object} msg 
 */
function appendMessage(msg) {
  const { sender, content, timestamp } = msg;
  
  // System messages (joined/left chat notices)
  if (sender === 'System') {
    const row = document.createElement('div');
    row.className = 'system-row';
    row.innerHTML = `<div class="system-bubble">${content}</div>`;
    messagesContainer.appendChild(row);
    return;
  }
  
  const isSelf = sender.toLowerCase() === currentUsername.toLowerCase();
  const row = document.createElement('div');
  row.className = `message-row ${isSelf ? 'self' : 'others'}`;
  
  const timeString = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const avatarChar = sender.charAt(0).toUpperCase();
  
  const avatarEl = document.createElement('div');
  avatarEl.className = 'message-avatar';
  avatarEl.textContent = avatarChar;
  
  const bubbleWrapper = document.createElement('div');
  bubbleWrapper.className = 'message-bubble-wrapper';
  
  const metaEl = document.createElement('div');
  metaEl.className = 'message-meta';
  metaEl.innerHTML = `<span class="sender">${sender}</span><span class="time">${timeString}</span>`;
  
  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'message-bubble';
  // Use textContent to securely escape HTML content (prevents XSS)
  bubbleEl.textContent = content;
  
  bubbleWrapper.appendChild(metaEl);
  bubbleWrapper.appendChild(bubbleEl);
  row.appendChild(avatarEl);
  row.appendChild(bubbleWrapper);
  
  messagesContainer.appendChild(row);
}

/**
 * Render connected users into sidebar list
 * @param {Array<string>} usernames 
 */
function renderUsersList(usernames) {
  usersList.innerHTML = '';
  activeUsersCount.textContent = usernames.length;
  
  usernames.forEach(user => {
    const isSelf = user.toLowerCase() === currentUsername.toLowerCase();
    const li = document.createElement('li');
    if (isSelf) li.className = 'is-self';
    
    const avatarChar = user.charAt(0).toUpperCase();
    
    li.innerHTML = `
      <div class="member-avatar">${avatarChar}</div>
      <span class="member-name">${user} ${isSelf ? '(Tú)' : ''}</span>
      <span class="member-status"></span>
    `;
    usersList.appendChild(li);
  });
}

function sendMessage(event) {
  event.preventDefault();
  if (!socket) return;
  
  const text = messageInput.value.trim();
  if (text.length === 0) return;
  
  socket.emit('chat:message', { content: text });
  messageInput.value = '';
  messageInput.focus();
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/* ==========================================================================
   MOBILE INTERACTION
   ========================================================================== */
function toggleSidebar() {
  chatSidebar.classList.toggle('active');
}
