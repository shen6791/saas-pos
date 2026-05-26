require("dotenv").config();

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, slug: true }
  });
  console.log(JSON.stringify({ ok: true, tenants }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.code || error.name);
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
