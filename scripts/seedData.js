const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Configuración de la base de datos
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'gym_app',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'CONTRASEÑA'
});

// Datos de usuarios
const users = [
  // Usuarios normales
  {
    id: uuidv4(),
    email: 'zequespagnoli@gmail.com',
    name: 'Ezequiel Spagnoli',
  },
  {
    id: uuidv4(),
    email: 'nahuelgamail@gmail.com',
    name: 'Nahuel Mosse',
  },
  // Usuarios de prueba
  {
    id: uuidv4(),
    email: 'test.ezequiel@qa.com',
    name: 'Test Ezequiel',
  },
  {
    id: uuidv4(),
    email: 'test.nahuel@qa.com',
    name: 'Test Nahuel',
  }
];

// Lista de ejercicios
const exercises = [
  // Ejercicios de pecho
  { name: 'Press de Banca', description: 'Ejercicio fundamental para el desarrollo del pectoral'},
  { name: 'Press de Banca Inclinado', description: 'Variación para la parte superior del pectoral'},
  { name: 'Press de Banca Declinado', description: 'Variación para la parte inferior del pectoral'},
  { name: 'Aperturas con Mancuernas', description: 'Ejercicio de aislamiento para el pectoral'},
  { name: 'Flexiones', description: 'Ejercicio corporal para el pecho'},
  { name: 'Press con Máquina', description: 'Ejercicio guiado para pecho'},
  { name: 'Cruces en Polea', description: 'Ejercicio de aislamiento en polea alta y baja'},
  
  // Ejercicios de espalda
  { name: 'Dominadas', description: 'Ejercicio fundamental para la espalda'},
  { name: 'Remo con Barra', description: 'Ejercicio para el grosor de la espalda'},
  { name: 'Remo con Mancuerna', description: 'Ejercicio unilateral para espalda'},
  { name: 'Jalón al Pecho', description: 'Ejercicio en polea para espalda ancha'},
  { name: 'Peso Muerto', description: 'Ejercicio completo para espalda baja y cadena posterior'},
  { name: 'Remo en Máquina', description: 'Ejercicio guiado para espalda'},
  { name: 'Face Pull', description: 'Ejercicio para trapecios y rotadores externos'},
  
  // Ejercicios de piernas
  { name: 'Sentadillas', description: 'Ejercicio fundamental para piernas'},
  { name: 'Prensa de Piernas', description: 'Ejercicio en máquina para cuadriceps'},
  { name: 'Extensiones de Cuádriceps', description: 'Ejercicio de aislamiento para cuádriceps'},
  { name: 'Curl de Femoral', description: 'Ejercicio para isquiotibiales'},
  { name: 'Peso Muerto Rumano', description: 'Ejercicio para isquiotibiales y glúteos'},
  { name: 'Elevación de Talones', description: 'Ejercicio para gemelos'},
  { name: 'Zancadas', description: 'Ejercicio unilateral para piernas'},
  { name: 'Hip Thrust', description: 'Ejercicio para glúteos'},
  
  // Ejercicios de hombros
  { name: 'Press Militar', description: 'Ejercicio fundamental para hombros'},
  { name: 'Elevaciones Laterales', description: 'Ejercicio para deltoides lateral'},
  { name: 'Elevaciones Frontales', description: 'Ejercicio para deltoides anterior'},
  { name: 'Pájaros', description: 'Ejercicio para deltoides posterior'},
  { name: 'Press Arnold', description: 'Variación de press para hombros'},
  
  // Ejercicios de brazos
  { name: 'Curl de Bíceps', description: 'Ejercicio fundamental para bíceps'},
  { name: 'Curl Martillo', description: 'Variación para bíceps y antebrazo'},
  { name: 'Extensiones de Tríceps', description: 'Ejercicio para tríceps'},
  { name: 'Fondos en Paralelas', description: 'Ejercicio corporal para tríceps y pecho'},
  { name: 'Press Francés', description: 'Ejercicio para tríceps'},
  
  // Ejercicios de core/abdomen
  { name: 'Plancha', description: 'Ejercicio isométrico para core'},
  { name: 'Crunch', description: 'Ejercicio tradicional para abdominales'},
  { name: 'Elevación de Piernas', description: 'Ejercicio para abdominales inferiores'},
  { name: 'Russian Twist', description: 'Ejercicio para oblicuos'},
  { name: 'Mountain Climbers', description: 'Ejercicio dinámico para core'}
];

async function seedDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Iniciando seed de la base de datos...');
    
    await client.query('BEGIN');

    // 1. Limpiar datos existentes (opcional - comentar si no quieres borrar datos existentes)
    console.log('🧹 Limpiando datos existentes...');
    await client.query('DELETE FROM AuthCredential');
    await client.query('DELETE FROM AuthProvider');
    await client.query('DELETE FROM Exercise');
    await client.query('DELETE FROM "User"');

    // 2. Insertar usuarios
    console.log('👥 Insertando usuarios...');
    for (const user of users) {
      await client.query(
        'INSERT INTO "User" (id, email, name, updated_at, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [user.id, user.email, user.name]
      );
      console.log(`   ✅ Usuario creado: ${user.name} (${user.email})`);
    }

    // 3. Insertar AuthProviders y AuthCredentials
    console.log('🔐 Creando credenciales de autenticación...');
    for (const user of users) {
      const authProviderId = uuidv4();
      
      // Crear AuthProvider
      await client.query(
        'INSERT INTO AuthProvider (id, user_id, provider, updated_at, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [authProviderId, user.id, 'local']
      );

      // Crear AuthCredential (password: "password123")
      const passwordHash = await bcrypt.hash('password123', 10);
      await client.query(
        'INSERT INTO AuthCredential (id, auth_provider_id, password, updated_at, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [uuidv4(), authProviderId, passwordHash]
      );
      
      console.log(`   ✅ Credenciales creadas para: ${user.name}`);
    }

    // 4. Insertar ejercicios
    console.log('💪 Insertando ejercicios...');
    let exerciseCount = 0;
    
    for (const exercise of exercises) {
      // Asignar ejercicios de forma balanceada entre usuarios
      const userIndex = exerciseCount % users.length;
      const creatorUserId = users[userIndex].id;
      
      // Hacer algunos ejercicios públicos y otros privados
      const isPublic = Math.random() > 0.3; // 70% públicos, 30% privados
      
      await client.query(
        `INSERT INTO Exercise (id, name, description, creator_user_id, public, updated_at, created_at) 
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [uuidv4(), exercise.name, exercise.description, creatorUserId, isPublic]
      );
      
      exerciseCount++;
      console.log(`   ✅ Ejercicio ${exerciseCount}: ${exercise.name} (${exercise.category}) - Creado por: ${users[userIndex].name}`);
    }

    await client.query('COMMIT');
    console.log('\n🎉 Seed completado exitosamente!');
    console.log(`📊 Resumen:`);
    console.log(`   👥 Usuarios creados: ${users.length}`);
    console.log(`   💪 Ejercicios creados: ${exerciseCount}`);
    console.log(`   🔐 Todos los usuarios tienen la contraseña: "password123"`);
    
    console.log('\n📋 Usuarios disponibles para testing:');
    users.forEach(user => {
      console.log(`   📧 ${user.email} - ${user.name} (${user.type})`);
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error durante el seed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar el seed si el script se llama directamente
if (require.main === module) {
  seedDatabase().catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
}

module.exports = seedDatabase;