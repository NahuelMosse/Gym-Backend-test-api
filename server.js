// Dev Auth Server (self-contained)
// Run inside dev_auth_server: npm install && node server.js

require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Manejo de errores de conexión
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

const ACCESS_SECRET = process.env.ACCESS_SECRET || 'dev_access_secret_please_change';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'dev_refresh_secret_please_change';
const ACCESS_EXPIRES_IN = process.env.ACCESS_EXPIRES_IN || '1d';
const REFRESH_EXPIRES_IN = process.env.REFRESH_EXPIRES_IN || '7d';

const users = [
  { 
    id: '1',
    email: 'alice@example.com', 
    name: 'Alice', 
    passwordHash: bcrypt.hashSync('password123', 10),
    created_at: new Date('2024-01-01T00:00:00Z').toISOString(),
    updated_at: new Date().toISOString()
  },
  { 
    id: '2', 
    email: 'bob@example.com', 
    name: 'Bob', 
    passwordHash: bcrypt.hashSync('secret456', 10),
    created_at: new Date('2024-01-02T00:00:00Z').toISOString(),
    updated_at: new Date().toISOString()
  },
];
const refreshTokenStore = new Map();

// Tabla para refresh tokens (si no existe)
const CREATE_REFRESH_TOKENS_TABLE = `
CREATE TABLE IF NOT EXISTS RefreshTokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

// Inicializar tabla de refresh tokens
pool.query(CREATE_REFRESH_TOKENS_TABLE).catch(err => {
  console.error('Error creating refresh tokens table:', err);
});

// Función para encontrar usuario por email con su auth credential
async function findUserByEmail(email) {
  const query = `
    SELECT u.*, ac.password 
    FROM "User" u
    JOIN AuthProvider ap ON u.id = ap.user_id
    JOIN AuthCredential ac ON ap.id = ac.auth_provider_id
    WHERE u.email = $1 AND ap.provider = 'email'
  `;
  const result = await pool.query(query, [email]);
  return result.rows[0];
}

// Función para encontrar usuario por ID
async function findUserById(userId) {
  const result = await pool.query('SELECT * FROM "User" WHERE id = $1', [userId]);
  return result.rows[0];
}

// Función para guardar refresh token
async function saveRefreshToken(userId, token) {
  await pool.query(
    'INSERT INTO RefreshTokens (user_id, token) VALUES ($1, $2)',
    [userId, token]
  );
}

// Función para verificar refresh token
async function verifyRefreshToken(userId, token) {
  const result = await pool.query(
    'SELECT * FROM RefreshTokens WHERE user_id = $1 AND token = $2',
    [userId, token]
  );
  return result.rows.length > 0;
}

// Función para actualizar refresh token
async function updateRefreshToken(oldToken, newToken, userId) {
  await pool.query(
    'UPDATE RefreshTokens SET token = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND token = $3',
    [newToken, userId, oldToken]
  );
}

// Función para obtener todos los ejercicios
async function getAllExercises() {
  const result = await pool.query(`
    SELECT e.*, u.name as creator_name 
    FROM Exercise e
    JOIN "User" u ON e.creator_user_id = u.id
    ORDER BY e.created_at DESC
  `);
  return result.rows;
}

// Función para obtener ejercicios por usuario
async function getExercisesByUser(userId) {
  const result = await pool.query(`
    SELECT e.*, u.name as creator_name 
    FROM Exercise e
    JOIN "User" u ON e.creator_user_id = u.id
    WHERE e.creator_user_id = $1
    ORDER BY e.created_at DESC
  `, [userId]);
  return result.rows;
}

// Función para crear un nuevo ejercicio
async function createExercise(exerciseData) {
  const { id, name, description, creator_user_id, is_public } = exerciseData;
  const result = await pool.query(`
    INSERT INTO Exercise (id, name, description, creator_user_id, public, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *
  `, [id, name, description, creator_user_id, is_public || false]);
  return result.rows[0];
}

function generateAccessToken(user) {
  return jwt.sign({ userId: user.id, email: user.email }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
}

function generateRefreshToken(user) {
  return jwt.sign({ userId: user.id }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
}

function findUserByEmail(email) {
  return users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

// ===== ENDPOINTS DE AUTENTICACIÓN =====

app.post('/api/v1/auth/login', async (req, res) => {
  try{
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const user = findUserByEmail(email);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    
    // Guardar el refresh token en la base de datos
    await saveRefreshToken(user.id, refreshToken);

    // Remover el password de la respuesta
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({ 
      accessToken, 
      refreshToken, 
      user: userWithoutPassword 
    });
  } catch(error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/v1/auth/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body || {};
    if (!refresh_token) return res.status(400).json({ message: 'refresh_token is required' });

    const payload = jwt.verify(refresh_token, REFRESH_SECRET);
    const userId = payload.userId;

    // Verificar si el refresh token existe en la base de datos
    const tokenValid = await verifyRefreshToken(userId, refresh_token);
    if (!tokenValid) return res.status(401).json({ message: 'Invalid refresh token' });

    // Obtener usuario
    const user = await findUserById(userId);
    if (!user) return res.status(401).json({ message: 'User not found' });

    const newRefreshToken = generateRefreshToken(user);
    const newAccessToken = generateAccessToken(user);

    // Actualizar el refresh token en la base de datos
    await updateRefreshToken(refresh_token, newRefreshToken, userId);

    return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
});

app.get('/api/v1/auth/me', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ message: 'Missing or invalid Authorization header' });

    const token = parts[1];
    const payload = jwt.verify(token, ACCESS_SECRET);

    const user = await findUserById(payload.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(user);

  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// ===== ENDPOINTS DE EJERCICIOS =====

// Obtener todos los ejercicios (públicos)
app.get('/api/v1/exercises', async (req, res) => {
  try {
    const exercises = await getAllExercises();
    res.json(exercises);
  } catch (error) {
    console.error('Get exercises error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Obtener ejercicios del usuario actual
app.get('/api/v1/my-exercises', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ message: 'Missing or invalid Authorization header' });

    const token = parts[1];
    const payload = jwt.verify(token, ACCESS_SECRET);
    
    const exercises = await getExercisesByUser(payload.userId);
    res.json(exercises);
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// Crear un nuevo ejercicio
app.post('/api/v1/exercises', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ message: 'Missing or invalid Authorization header' });

    const token = parts[1];
    const payload = jwt.verify(token, ACCESS_SECRET);
    
    const { name, description, is_public } = req.body;
    if (!name) return res.status(400).json({ message: 'Exercise name is required' });

    // Generar UUID para el nuevo ejercicio
    const { v4: uuidv4 } = require('uuid');
    const exerciseId = uuidv4();

    const exerciseData = {
      id: exerciseId,
      name,
      description,
      creator_user_id: payload.userId,
      is_public: is_public || false
    };

    const newExercise = await createExercise(exerciseData);
    res.status(201).json(newExercise);
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    console.error('Create exercise error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ===== ENDPOINTS ADICIONALES =====

// Endpoint de salud para verificar la conexión a la BD
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'OK', database: 'Connected' });
  } catch (error) {
    res.status(500).json({ status: 'Error', database: 'Disconnected', error: error.message });
  }
});

// Obtener todos los usuarios (solo para desarrollo)
app.get('/api/v1/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, name, created_at, updated_at FROM "User"');
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Auth dev server running on http://localhost:${port}`));
