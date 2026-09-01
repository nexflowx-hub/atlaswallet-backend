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

const pricingPlans = [
  { code: 'BLACK_30', label: 'Atlas Black 30', feeBasisPoints: 3000, sortOrder: 10, metadata: { tier: 'BLACK', verification: 'SELF_DECLARED' } },
  { code: 'BLACK_25', label: 'Atlas Black 25', feeBasisPoints: 2500, sortOrder: 20, metadata: { tier: 'BLACK' } },
  { code: 'BLACK_20', label: 'Atlas Black 20', feeBasisPoints: 2000, sortOrder: 30, metadata: { tier: 'BLACK' } },
  { code: 'WHITE_15', label: 'Atlas White 15', feeBasisPoints: 1500, sortOrder: 40, metadata: { tier: 'WHITE' } },
  { code: 'WHITE_10', label: 'Atlas White 10', feeBasisPoints: 1000, sortOrder: 50, metadata: { tier: 'WHITE' } },
  { code: 'WHITE_05', label: 'Atlas White 05', feeBasisPoints: 500, sortOrder: 60, metadata: { tier: 'WHITE' } },
];

const policyProfiles = [
  {
    code: 'BLACK_ENTRY_OPEN',
    label: 'Black Entry Open',
    operationalMode: 'OPEN',
    allowFiatDeposit: true,
    allowFiatWithdrawal: true,
    allowCryptoDeposit: true,
    allowCryptoWithdrawal: true,
    allowExchange: true,
    allowInternalTransfer: true,
    allowInvestment: false,
    metadata: {
      purpose: 'frictionless_entry',
      documents_required_at_entry: false,
      proof_required_at_entry: false,
    },
  },
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

  for (const plan of pricingPlans) {
    await prisma.pricingPlan.upsert({
      where: { code: plan.code },
      update: {
        label: plan.label,
        feeBasisPoints: plan.feeBasisPoints,
        active: true,
        sortOrder: plan.sortOrder,
        metadata: plan.metadata,
      },
      create: {
        ...plan,
        active: true,
      },
    });
  }

  for (const policy of policyProfiles) {
    await prisma.policyProfile.upsert({
      where: { code: policy.code },
      update: {
        label: policy.label,
        operationalMode: policy.operationalMode,
        allowFiatDeposit: policy.allowFiatDeposit,
        allowFiatWithdrawal: policy.allowFiatWithdrawal,
        allowCryptoDeposit: policy.allowCryptoDeposit,
        allowCryptoWithdrawal: policy.allowCryptoWithdrawal,
        allowExchange: policy.allowExchange,
        allowInternalTransfer: policy.allowInternalTransfer,
        allowInvestment: policy.allowInvestment,
        active: true,
        metadata: policy.metadata,
      },
      create: {
        ...policy,
        active: true,
      },
    });
  }

  const storedAssets = await prisma.asset.findMany({
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

  const storedPlans = await prisma.pricingPlan.findMany({
    orderBy: { sortOrder: 'asc' },
    select: {
      code: true,
      label: true,
      feeBasisPoints: true,
      active: true,
      sortOrder: true,
    },
  });

  const storedPolicies = await prisma.policyProfile.findMany({
    orderBy: { code: 'asc' },
    select: {
      code: true,
      label: true,
      operationalMode: true,
      allowFiatDeposit: true,
      allowFiatWithdrawal: true,
      allowCryptoDeposit: true,
      allowCryptoWithdrawal: true,
      allowExchange: true,
      allowInternalTransfer: true,
      allowInvestment: true,
      active: true,
    },
  });

  console.log(JSON.stringify({
    asset_count: storedAssets.length,
    assets: storedAssets,
    pricing_plan_count: storedPlans.length,
    pricing_plans: storedPlans,
    policy_profile_count: storedPolicies.length,
    policy_profiles: storedPolicies,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
