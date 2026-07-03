# VibeChat - Sistema de Chat en Tiempo Real con WebSockets

VibeChat es una aplicación de mensajería instantánea en tiempo real construida bajo una arquitectura cliente-servidor moderna y segura. Emplea **Node.js, Express y Socket.IO** en el backend y una interfaz de usuario responsiva, elegante y fluida con **HTML, CSS (Vanilla) y JavaScript (Vanilla)** en el frontend.

El sistema cuenta con persistencia de historial de mensajería, control de sesiones activas (rechazo de duplicados), cifrado de contraseñas con bcrypt, control de spam por rate-limiting y sanitización contra inyecciones XSS.

---

## 🚀 Características Principales

1. **Autenticación Segura (JWT + Bcryptjs)**: Registro e inicio de sesión con contraseñas encriptadas mediante hashes seguros. Las conexiones WebSocket se autentican usando tokens JSON Web Tokens (JWT) pasados en la etapa de handshake.
2. **Control de Sesiones Duplicadas**: Si un usuario ya tiene una pestaña o dispositivo conectado activamente, se rechazarán automáticamente los nuevos intentos de conexión de sockets con ese mismo nombre de usuario.
3. **Persistencia Ligera**: Registro persistente del historial de mensajes (últimos 100 mensajes) y credenciales de usuario mediante una base de datos ligera file-based JSON.
4. **Protección Anti-Spam (Rate Limiting)**: El servidor Socket.IO limita el envío de mensajes a un máximo de **5 mensajes por cada 10 segundos** por cliente. Si se supera este umbral, el mensaje se descarta y se notifica al usuario.
5. **Seguridad contra Inyecciones (XSS)**: Sanitización y escape estricto de HTML tanto a nivel del servidor (previo a la persistencia y difusión) como en el frontend (usando `textContent` de forma nativa).
6. **Diseño de Interfaz Premium**: Estética oscura basada en Glassmorphism, con fuentes modernas (Outfit e Inter), bordes translúcidos, fondos radiales y animaciones fluidas.
7. **Diseño Responsivo**: Sidebar deslizable adaptado para dispositivos móviles.

---

## 📁 Estructura del Proyecto

```
/chat-realtime-sockets
├── package.json           # Scripts raíz para despliegue automatizado
├── .gitignore             # Exclusión de archivos confidenciales y node_modules
├── README.md              # Documentación técnica del proyecto
├── /server
│   ├── src/
│   │   ├── server.js      # Inicialización del servidor Express y enrutador API
│   │   ├── socket.js      # Lógica de Socket.IO, middlewares de auth y spam-control
│   │   ├── db.js          # Persistencia en archivo db.json
│   │   └── auth.js        # Hashing de passwords y firmado/verificación de JWT
│   ├── package.json       # Dependencias y scripts del backend
│   ├── .env.example       # Plantilla de variables de entorno
│   └── .env               # Variables de entorno activas (creadas en la instalación)
└── /client
    └── src/
        ├── index.html     # Estructura del cliente web (pantallas de auth y chat)
        ├── style.css      # Estilos interactivos y diseño visual responsivo
        └── app.js         # Lógica cliente: consumo de API, sockets, toasts y DOM
```

---

## 🛠️ Instalación y Ejecución Local

### Prerrequisitos
- Tener instalado [Node.js](https://nodejs.org/) (versión 16.x o superior recomendada).

### Pasos para Configurar y Ejecutar

1. **Clonar el Repositorio** (o descargar los archivos del proyecto).
2. **Acceder a la carpeta del proyecto** en tu terminal:
   ```bash
   cd chat-realtime-sockets
   ```
3. **Instalar dependencias y preparar entorno**:
   Para simplificar el proceso, el archivo `package.json` en la raíz contiene un script de construcción que instala las dependencias del servidor automáticamente:
   ```bash
   npm run build
   ```
4. **Configurar Variables de Entorno**:
   - Copia el archivo `.env.example` en `/server` como un nuevo archivo `.env`:
     ```bash
     cp server/.env.example server/.env
     ```
   - Abre el archivo `server/.env` y personaliza el puerto y la clave secreta si lo deseas:
     ```env
     PORT=3000
     JWT_SECRET=tu_secreto_seguro_para_jwt
     NODE_ENV=development
     ```
5. **Iniciar el Servidor**:
   Desde la raíz del proyecto, ejecuta:
   ```bash
   npm start
   ```
   Esto iniciará el servidor en `http://localhost:3000`. Visita esta dirección en tu navegador para interactuar con la aplicación.

---

## ☁️ Instrucciones de Despliegue (Production Ready)

El repositorio está configurado de forma óptima para desplegarse con un solo clic en plataformas como **Render** o **Railway** debido a los scripts de la raíz que dirigen las fases de compilación y ejecución al subdirectorio `/server`.

### Despliegue en Render

1. Crea una cuenta gratuita en [Render](https://render.com/).
2. Conecta tu repositorio de GitHub/GitLab.
3. Crea un nuevo **Web Service**.
4. Configura los siguientes parámetros en el formulario de Render:
   - **Repository**: Selecciona el repositorio de tu proyecto de chat.
   - **Name**: `vibechat-app` (o el nombre de tu preferencia).
   - **Root Directory**: *(Dejar vacío para usar la raíz)*.
   - **Environment / Runtime**: `Node`.
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
5. Configura las siguientes **Variables de Entorno** (Environment Variables) en Render:
   - `PORT`: `3000` (Render asignará uno dinámico automáticamente, pero es buena práctica declararlo).
   - `JWT_SECRET`: `una_clave_secreta_y_larga_de_produccion`
   - `NODE_ENV`: `production`
6. Haz clic en **Deploy Web Service**.
   *Nota: Render soporta conexiones Websockets persistentes en sus Web Services estándar automáticamente.*

### Despliegue en Railway

1. Crea una cuenta en [Railway](https://railway.app/).
2. Haz clic en **New Project** y selecciona **Deploy from GitHub repo**.
3. Selecciona tu repositorio.
4. En **Variables**, añade:
   - `JWT_SECRET`: `tu_clave_secreta`
   - `NODE_ENV`: `production`
5. Railway detectará automáticamente el script `start` en la raíz del proyecto, ejecutará la instalación y expondrá la aplicación.

---

## 🛡️ Seguridad e Implementaciones Técnicas

- **Cifrado**: Contraseñas cifradas unidireccionalmente mediante salt rounds de `bcryptjs`.
- **Restricción de duplicados**: Cuando el cliente se conecta, se verifica la presencia del token JWT y el nombre de usuario decodificado. El servidor escanea el mapa en memoria de sockets activos. Si el usuario ya está conectado, la conexión se aborta arrojando un error controlado de conexión (`connect_error` en el cliente).
- **Sanitización contra XSS**: La entrada del chat pasa por una conversión de caracteres especiales a entidades HTML en el servidor antes de propagarse. Además, el cliente inyecta el contenido de forma segura con `textContent` de JS nativo.
- **Filtro anti-spam**: Un middleware de contadores almacena marcas de tiempo por cada conexión. Se rechaza todo mensaje si el usuario envía más de 5 en un intervalo de 10 segundos.

---

## 📝 Pruebas de Funcionamiento

Para corroborar la robustez del sistema, puedes realizar los siguientes pasos de validación:
1. Abre dos pestañas del navegador (una normal y otra de incógnito) en la dirección del chat.
2. Regístrate e inicia sesión en la pestaña 1 con el usuario `alex`. Envía un mensaje.
3. Intenta iniciar sesión en la pestaña 2 con el mismo usuario `alex`. El sistema mostrará un Toast indicando que la sesión ya está activa y denegará la conexión.
4. Regístrate e inicia sesión en la pestaña 2 con el usuario `beatriz`. Verás que la lista de conectados en ambas pestañas se actualiza en tiempo real mostrando a `alex` y `beatriz`.
5. Envía 6 mensajes seguidos en menos de 10 segundos con `beatriz`. El sexto mensaje será rechazado por el servidor y verás la alerta toast roja de Rate Limiting.
6. Intenta enviar un mensaje con código HTML `<script>alert('XSS')</script>`. Verás que se imprime textualmente en pantalla sin ejecutarse ningún código en el navegador.
