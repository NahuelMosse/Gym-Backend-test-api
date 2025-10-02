// Dev Auth Server (self-contained)
// Run inside dev_auth_server: npm install && node server.js

require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

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

function generateAccessToken(user) {
  return jwt.sign({ userId: user.id, email: user.email }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
}

function generateRefreshToken(user) {
  return jwt.sign({ userId: user.id }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
}

function findUserByEmail(email) {
  return users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

app.post('/api/v1/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

  const user = findUserByEmail(email);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  refreshTokenStore.set(user.id, refreshToken);

  res.json({ 
    accessToken, 
    refreshToken, 
    user: { 
      id: user.id, 
      email: user.email, 
      name: user.name,
      created_at: user.created_at,
      updated_at: user.updated_at
    } 
  });
});

app.post('/api/v1/auth/refresh', (req, res) => {
  const { refresh_token } = req.body || {};
  if (!refresh_token) return res.status(400).json({ message: 'refresh_token is required' });

  try {
    const payload = jwt.verify(refresh_token, REFRESH_SECRET);
    const userId = payload.userId;
    const stored = refreshTokenStore.get(userId);
    if (!stored || stored !== refresh_token) return res.status(401).json({ message: 'Invalid refresh token' });

    const user = users.find(u => u.id === userId);
    if (!user) return res.status(401).json({ message: 'User not found' });

    const newRefresh = generateRefreshToken(user);
    const newAccess = generateAccessToken(user);
    refreshTokenStore.set(user.id, newRefresh);

    return res.json({ accessToken: newAccess, refreshToken: newRefresh });
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
});

app.get('/api/v1/auth/me', (req, res) => {
  const auth = req.headers.authorization || '';
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ message: 'Missing or invalid Authorization header' });

  const token = parts[1];
  try {
    const payload = jwt.verify(token, ACCESS_SECRET);
    const user = users.find(u => u.id === payload.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ 
      id: user.id, 
      email: user.email, 
      name: user.name,
      created_at: user.created_at,
      updated_at: user.updated_at
    });
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Auth dev server running on http://localhost:${port}`));
