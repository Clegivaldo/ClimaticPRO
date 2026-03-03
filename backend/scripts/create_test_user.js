const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: './.env' });

(async () => {
  const prisma = new PrismaClient();
  try {
    const email = process.argv[2] || 'jaalee_user@example.com';
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({ data: { email } });
    }
    const secret = process.env.JWT_SECRET || 'development_secret_change_me_please';
    const token = jwt.sign({ userId: user.id, email: user.email }, secret, {
      issuer: 'climatic-pro-api',
      audience: 'climatic-pro-app',
      expiresIn: '7d'
    });
    console.log(JSON.stringify({ id: user.id, email: user.email, token }));
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    try { await prisma.$disconnect(); } catch(e){}
  }
})();
