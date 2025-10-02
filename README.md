Dev Auth Server

This is a small self-contained Express server for local development and testing of the Gym-App authentication flow.

Files:
- server.js       : The Express server implementation
- package.json    : Node dependencies and start script
- .env.example    : Example environment variables
- .gitignore      : Ignore node_modules and .env

Quick start:
1. cd dev_auth_server
2. npm install
3. cp .env.example .env  # adjust secrets if needed
4. npm start

Endpoints:
- POST /api/v1/auth/login    { email, password } -> { accessToken, refreshToken, user }
- POST /api/v1/auth/refresh  { refresh_token }   -> { accessToken, refreshToken }
- GET  /api/v1/auth/me       (Authorization: Bearer <accessToken>) -> { user }

Demo users:
- alice@example.com / password123
- bob@example.com   / secret456

Notes:
- This server stores refresh tokens in memory; it's intended only for local development.
- For production use a persistent store and secure secrets (do NOT commit .env with real secrets).
