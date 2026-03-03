const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: './.env' });
const fetch = (...args) => import('node-fetch').then(({default: f})=>f(...args));

(async ()=>{
  const prisma = new PrismaClient();
  try{
    const email = process.argv[2] || 'jaalee_user@example.com';
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) user = await prisma.user.create({ data: { email } });

    const secret = process.env.JWT_SECRET || 'development_secret_change_me_please';
    const appJwt = jwt.sign({ userId: user.id, email: user.email }, secret, { issuer:'climatic-pro-api', audience:'climatic-pro-app', expiresIn:'7d' });

    console.log('Using user:', { id: user.id, email: user.email });

    const res = await fetch('http://localhost:3001/api/v1/sync/jaalee/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${appJwt}` },
    });
    const body = await res.text();
    console.log('STATUS', res.status);
    console.log(body);
  }catch(e){ console.error(e); process.exit(1);} finally { try{ await prisma.$disconnect(); }catch(e){} }
})();
