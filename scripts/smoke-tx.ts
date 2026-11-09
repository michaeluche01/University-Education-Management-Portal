import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

class RollbackSentinelError extends Error {
  constructor() {
    super("Intentional rollback for smoke-tx verification");
    this.name = "RollbackSentinelError";
  }
}

async function main() {
  const pooledUrl = process.env.DATABASE_URL;
  if (!pooledUrl) {
    throw new Error("DATABASE_URL is not set in environment or .env file.");
  }

  const adapter = new PrismaPg({ connectionString: pooledUrl });
  const prisma = new PrismaClient({ adapter });

  const testCode = `SMOKE_${Date.now()}`;
  let createdInsideTx = false;

  try {
    try {
      await prisma.$transaction(async (tx) => {
        const created = await tx.faculty.create({
          data: {
            name: `Smoke Transaction Faculty ${testCode}`,
            code: testCode,
            description: "Temporary row created inside interactive transaction",
          },
        });

        const foundInside = await tx.faculty.findUnique({
          where: { id: created.id },
        });
        createdInsideTx = Boolean(foundInside && foundInside.code === testCode);

        // Intentionally abort so the transaction rolls back
        throw new RollbackSentinelError();
      });
    } catch (err) {
      if (!(err instanceof RollbackSentinelError)) {
        throw err;
      }
    }

    const foundAfterRollback = await prisma.faculty.findUnique({
      where: { code: testCode },
    });

    if (!createdInsideTx) {
      throw new Error("Row was not visible inside the interactive transaction.");
    }

    if (foundAfterRollback !== null) {
      throw new Error("Row persisted after transaction rollback!");
    }

    console.log(
      JSON.stringify({
        ok: true,
        createdInsideTx,
        rolledBackCleanly: foundAfterRollback === null,
      })
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[smoke-tx] Failed:", err);
  process.exit(1);
});

