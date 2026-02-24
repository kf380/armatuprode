/**
 * One-time migration script: backfill Wallet + WalletLot for existing users.
 *
 * Run with: npx tsx prisma/wallet-backfill.ts
 */

import { PrismaClient, WalletLotSource, WalletTransactionType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      wallet: null,
    },
    select: { id: true, coins: true },
  });

  console.log(`Found ${users.length} users without wallet`);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90);

  let migrated = 0;

  for (const user of users) {
    await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.create({
        data: {
          userId: user.id,
          balance: user.coins,
        },
      });

      if (user.coins > 0) {
        await tx.walletLot.create({
          data: {
            walletId: wallet.id,
            source: WalletLotSource.MIGRATION,
            amount: user.coins,
            remaining: user.coins,
            expiresAt,
          },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: WalletTransactionType.CREDIT,
            amount: user.coins,
            source: "MIGRATION",
            reason: "wallet_backfill",
            idempotencyKey: `migration_${user.id}`,
          },
        });
      }
    });

    migrated++;
    if (migrated % 100 === 0) {
      console.log(`Migrated ${migrated}/${users.length}`);
    }
  }

  console.log(`Done. Migrated ${migrated} users.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
