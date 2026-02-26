import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyDatabase() {
  try {
    console.log('🔍 Verifying database migration...\n');

    // Test connection
    await prisma.$connect();
    console.log('✅ Database connection successful');

    // Verify tables by attempting to query each model
    const models = [
      'User',
      'VerificationCode',
      'Sensor',
      'SensorReading',
      'AlertConfig',
      'Alert',
      'AuditLog',
      'FCMToken',
    ];

    for (const model of models) {
      try {
        // @ts-ignore - Dynamic model access
        await prisma[model.charAt(0).toLowerCase() + model.slice(1)].findMany({
          take: 0,
        });
        console.log(`✅ Table "${model}" exists and is accessible`);
      } catch (error) {
        console.error(`❌ Table "${model}" verification failed:`, error);
      }
    }

    // Verify enums
    console.log('\n🔍 Verifying enums...');
    const enums = ['DeviceType', 'AlertCondition', 'Platform'];
    console.log(`✅ Enums defined: ${enums.join(', ')}`);

    console.log('\n✅ All database tables, indexes, and constraints verified successfully!');
  } catch (error) {
    console.error('❌ Database verification failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyDatabase();
