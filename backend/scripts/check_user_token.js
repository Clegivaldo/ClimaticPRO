const { PrismaClient } = require('@prisma/client');

(async ()=>{
  const prisma = new PrismaClient();
  try {
    const u = await prisma.user.findUnique({ where: { email: 'jaalee_user@example.com' } });
    if (!u) return console.log('user not found');
    console.log(JSON.stringify({ id: u.id, email: u.email, jaaleeToken: u.jaaleeToken }));
  } catch (e) { console.error(e); process.exit(1);} finally { try{ await prisma.$disconnect(); } catch(e){} }
})();
