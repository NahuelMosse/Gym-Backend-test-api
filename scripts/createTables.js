import { Pool } from 'pg';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Configuración de la base de datos
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'gym_app',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'CONTRASEÑA'
});

async function createTables() {
    const client = await pool.connect();

    try {
        console.log('Creando tablas de la base de datos...');

        await client.query('BEGIN');

        //Aseguramos la extension para la creacion de UUID
        await client.query(
            'CREATE EXTENSION IF NOT EXISTS "pgcrypto"'
        );
        
        // Creo User
        await client.query(`
            CREATE TABLE IF NOT EXISTS "User" (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR NOT NULL,
                name VARCHAR NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW(),
                created_at TIMESTAMP DEFAULT NOW() )
        `);

        // Creo AuthProvider
        await client.query(`
            CREATE TABLE IF NOT EXISTS "AuthProvider" (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                provider VARCHAR NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW(),
                created_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT fk_authprovider_user
                    FOREIGN KEY (user_id)
                    REFERENCES "User"(id)
                    ON DELETE CASCADE )
        `);

        // Creo Auth Credential
        await client.query(`
            CREATE TABLE IF NOT EXISTS "AuthCredential" (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                auth_provider_id UUID NOT NULL,
                password VARCHAR NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW(),
                created_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT fk_authcredential_authprovider
                    FOREIGN KEY (auth_provider_id)
                    REFERENCES "AuthProvider"(id)
                    ON DELETE CASCADE )
        `);

        //Creo Excersice
        await client.query(`
            CREATE TABLE IF NOT EXISTS "Exercise" (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR NOT NULL,
                description VARCHAR,
                creator_user_id UUID NOT NULL,
                public BOOLEAN DEFAULT FALSE,
                updated_at TIMESTAMP DEFAULT NOW(),
                created_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT fk_exercise_user
                    FOREIGN KEY (creator_user_id)
                    REFERENCES "User"(id)
                    ON DELETE CASCADE )
        `);

        await client.query('COMMIT');
        console.log('✅ Tablas creadas correctamente.');
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error al crear las tablas:', err.message);
    } finally {
        client.release();
    }
}

createTables()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
