import { prisma } from "@/lib/prisma";
import { WalletLotSource, WalletTransactionType } from "@prisma/client";

const COIN_EXPIRY_DAYS = 90;

export async function ensureWallet(userId: string) {
  return prisma.wallet.upsert({
    where: { userId },
    update: {},
    create: { userId, balance: 0 },
  });
}

interface CreditCoinsParams {
  userId: string;
  amount: number;
  source: WalletLotSource;
  reason: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export async function creditCoins({
  userId,
  amount,
  source,
  reason,
  idempotencyKey,
  metadata,
}: CreditCoinsParams): Promise<void> {
  if (amount <= 0) return;

  await prisma.$transaction(async (tx) => {
    // Idempotency check
    if (idempotencyKey) {
      const existing = await tx.walletTransaction.findUnique({
        where: { idempotencyKey },
      });
      if (existing) return;
    }

    const wallet = await tx.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0 },
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + COIN_EXPIRY_DAYS);

    await tx.walletLot.create({
      data: {
        walletId: wallet.id,
        source,
        amount,
        remaining: amount,
        expiresAt,
      },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.CREDIT,
        amount,
        source: source.toString(),
        reason,
        idempotencyKey,
        metadata: (metadata ?? undefined) as undefined | Record<string, string | number | boolean>,
      },
    });

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amount } },
    });

    await tx.user.update({
      where: { id: userId },
      data: { coins: { increment: amount } },
    });
  });
}

interface DebitCoinsParams {
  userId: string;
  amount: number;
  reason: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export async function debitCoins({
  userId,
  amount,
  reason,
  idempotencyKey,
  metadata,
}: DebitCoinsParams): Promise<void> {
  if (amount <= 0) return;

  await prisma.$transaction(async (tx) => {
    // Idempotency check
    if (idempotencyKey) {
      const existing = await tx.walletTransaction.findUnique({
        where: { idempotencyKey },
      });
      if (existing) return;
    }

    const wallet = await tx.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0 },
    });

    if (wallet.balance < amount) {
      throw new Error("Coins insuficientes");
    }

    // FIFO: consume oldest lots first
    const lots = await tx.walletLot.findMany({
      where: {
        walletId: wallet.id,
        remaining: { gt: 0 },
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "asc" },
    });

    let remaining = amount;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const consume = Math.min(lot.remaining, remaining);
      await tx.walletLot.update({
        where: { id: lot.id },
        data: { remaining: { decrement: consume } },
      });
      remaining -= consume;
    }

    if (remaining > 0) {
      throw new Error("Coins insuficientes (lots agotados)");
    }

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.DEBIT,
        amount,
        reason,
        idempotencyKey,
        metadata: (metadata ?? undefined) as undefined | Record<string, string | number | boolean>,
      },
    });

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: amount } },
    });

    await tx.user.update({
      where: { id: userId },
      data: { coins: { decrement: amount } },
    });
  });
}

export async function getWalletBalance(userId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    return { balance: 0, expiringIn7Days: 0 };
  }

  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const expiringLots = await prisma.walletLot.findMany({
    where: {
      walletId: wallet.id,
      remaining: { gt: 0 },
      expiresAt: { gt: new Date(), lte: sevenDaysFromNow },
    },
  });

  const expiringIn7Days = expiringLots.reduce((sum, lot) => sum + lot.remaining, 0);

  return { balance: wallet.balance, expiringIn7Days };
}

export async function expireOldLots() {
  const now = new Date();
  let walletsAffected = 0;
  let coinsExpired = 0;

  const expiredLots = await prisma.walletLot.findMany({
    where: {
      remaining: { gt: 0 },
      expiresAt: { lte: now },
    },
    include: { wallet: true },
  });

  const walletMap = new Map<string, number>();
  for (const lot of expiredLots) {
    const current = walletMap.get(lot.walletId) ?? 0;
    walletMap.set(lot.walletId, current + lot.remaining);
  }

  for (const [walletId, totalExpired] of walletMap) {
    const wallet = expiredLots.find((l) => l.walletId === walletId)!.wallet;

    await prisma.$transaction(async (tx) => {
      // Zero out all expired lots for this wallet
      await tx.walletLot.updateMany({
        where: {
          walletId,
          remaining: { gt: 0 },
          expiresAt: { lte: now },
        },
        data: { remaining: 0 },
      });

      await tx.walletTransaction.create({
        data: {
          walletId,
          type: WalletTransactionType.EXPIRY,
          amount: totalExpired,
          reason: "coins_expired",
        },
      });

      await tx.wallet.update({
        where: { id: walletId },
        data: { balance: { decrement: totalExpired } },
      });

      await tx.user.update({
        where: { id: wallet.userId },
        data: { coins: { decrement: totalExpired } },
      });
    });

    walletsAffected++;
    coinsExpired += totalExpired;
  }

  return { walletsAffected, coinsExpired };
}
