const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const assets = [
  { code: 'BRL', symbol: 'BRL', name: 'Brazilian Real', type: 'FIAT', network: 'NONE', decimals: 2 },
  { code: 'EUR', symbol: 'EUR', name: 'Euro', type: 'FIAT', network: 'NONE', decimals: 2 },
  { code: 'USD', symbol: 'USD', name: 'US Dollar', type: 'FIAT', network: 'NONE', decimals: 2 },
  { code: 'GBP', symbol: 'GBP', name: 'Pound Sterling', type: 'FIAT', network: 'NONE', decimals: 2 },
  { code: 'BTC_BITCOIN', symbol: 'BTC', name: 'Bitcoin', type: 'CRYPTO', network: 'BITCOIN', decimals: 8 },
  { code: 'ETH_ETHEREUM', symbol: 'ETH', name: 'Ether', type: 'CRYPTO', network: 'ETHEREUM', decimals: 18 },
  { code: 'SOL_SOLANA', symbol: 'SOL', name: 'Solana', type: 'CRYPTO', network: 'SOLANA', decimals: 9 },
  { code: 'USDT_ETHEREUM', symbol: 'USDT', name: 'Tether USD', type: 'CRYPTO', network: 'ETHEREUM', decimals: 6 },
  { code: 'USDT_TRON', symbol: 'USDT', name: 'Tether USD', type: 'CRYPTO', network: 'TRON', decimals: 6 },
  { code: 'USDT_SOLANA', symbol: 'USDT', name: 'Tether USD', type: 'CRYPTO', network: 'SOLANA', decimals: 6 },
  { code: 'USDC_ETHEREUM', symbol: 'USDC', name: 'USD Coin', type: 'CRYPTO', network: 'ETHEREUM', decimals: 6 },
  { code: 'USDC_SOLANA', symbol: 'USDC', name: 'USD Coin', type: 'CRYPTO', network: 'SOLANA', decimals: 6 },
];

async function main() {
  for (const asset of assets) {
    await prisma.asset.upsert({
      where: { code: asset.code },
      update: {
        symbol: asset.symbol,
        name: asset.name,
        type: asset.type,
        network: asset.network,
        decimals: asset.decimals,
        status: 'ACTIVE',
        depositEnabled: false,
        withdrawEnabled: false,
        exchangeEnabled: false,
      },
      create: {
        ...asset,
        status: 'ACTIVE',
        depositEnabled: false,
        withdrawEnabled: false,
        exchangeEnabled: false,
      },
    });
  }

  const stored = await prisma.asset.findMany({
    orderBy: [{ type: 'asc' }, { symbol: 'asc' }, { network: 'asc' }],
    select: {
      code: true,
      symbol: true,
      type: true,
      network: true,
      decimals: true,
      status: true,
      depositEnabled: true,
      withdrawEnabled: true,
      exchangeEnabled: true,
    },
  });

  console.log(JSON.stringify({ asset_count: stored.length, assets: stored }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
