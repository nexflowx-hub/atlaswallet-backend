import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountType,
  AssetStatus,
  AssetType,
  AuditActorType,
  LedgerAccountType,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';

export interface BootstrapRequestContext {
  requestId?: string;
  userAgent?: string;
}

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(authUser: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { authUserId: authUser.id },
      include: {
        accounts: {
          where: { type: AccountType.INDIVIDUAL },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    const account = user?.accounts[0] ?? null;

    return {
      auth: {
        id: authUser.id,
        email: authUser.email,
      },
      provisioned: Boolean(user && account),
      user: user
        ? {
            id: user.id,
            email: user.email,
            status: user.status,
            createdAt: user.createdAt,
          }
        : null,
      account: account
        ? {
            id: account.id,
            type: account.type,
            status: account.status,
            kycStatus: account.kycStatus,
            countryCode: account.countryCode,
            baseCurrency: account.baseCurrency,
            createdAt: account.createdAt,
          }
        : null,
    };
  }

  async bootstrap(
    authUser: AuthenticatedUser,
    context: BootstrapRequestContext = {},
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const lockKey = `atlaswallet:bootstrap:${authUser.id}`;
        await tx.$queryRaw`
          WITH lock AS (
            SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
          )
          SELECT 1::int AS locked FROM lock
        `;

        let user = await tx.user.findUnique({
          where: { authUserId: authUser.id },
        });

        if (authUser.email) {
          const emailOwner = await tx.user.findUnique({
            where: { email: authUser.email },
          });

          if (emailOwner && emailOwner.authUserId !== authUser.id) {
            throw new ConflictException('EMAIL_ALREADY_LINKED');
          }
        }

        const userCreated = !user;

        if (!user) {
          user = await tx.user.create({
            data: {
              authUserId: authUser.id,
              email: authUser.email,
            },
          });
        } else if (authUser.email && user.email !== authUser.email) {
          user = await tx.user.update({
            where: { id: user.id },
            data: { email: authUser.email },
          });
        }

        let account = await tx.account.findFirst({
          where: {
            userId: user.id,
            type: AccountType.INDIVIDUAL,
          },
          orderBy: { createdAt: 'asc' },
        });

        const accountCreated = !account;

        if (!account) {
          account = await tx.account.create({
            data: {
              userId: user.id,
              type: AccountType.INDIVIDUAL,
              baseCurrency: 'BRL',
            },
          });
        }

        const assets = await tx.asset.findMany({
          where: {
            status: AssetStatus.ACTIVE,
            type: {
              in: [AssetType.FIAT, AssetType.CRYPTO],
            },
          },
          orderBy: { code: 'asc' },
        });

        const walletCreateResult = await tx.wallet.createMany({
          data: assets.map((asset) => ({
            accountId: account.id,
            assetId: asset.id,
          })),
          skipDuplicates: true,
        });

        const walletsCreated = walletCreateResult.count;

        const walletRows = await tx.wallet.findMany({
          where: {
            accountId: account.id,
            assetId: {
              in: assets.map((asset) => asset.id),
            },
          },
          select: {
            id: true,
            assetId: true,
          },
        });

        if (walletRows.length !== assets.length) {
          throw new Error(
            `WALLET_PROVISIONING_INCOMPLETE:${walletRows.length}/${assets.length}`,
          );
        }

        await tx.walletBalance.createMany({
          data: walletRows.map((wallet) => ({
            walletId: wallet.id,
          })),
          skipDuplicates: true,
        });

        const ledgerCodes = assets.map(
          (asset) => `CUSTOMER:${account.id}:${asset.code}`,
        );

        await tx.ledgerAccount.createMany({
          data: assets.map((asset) => ({
            code: `CUSTOMER:${account.id}:${asset.code}`,
            type: LedgerAccountType.CUSTOMER,
            ownerAccountId: account.id,
            assetId: asset.id,
            name: `Customer ${asset.code}`,
            active: true,
          })),
          skipDuplicates: true,
        });

        await tx.ledgerAccount.updateMany({
          where: {
            code: { in: ledgerCodes },
            ownerAccountId: account.id,
            type: LedgerAccountType.CUSTOMER,
          },
          data: { active: true },
        });

        const provisionedLedgerAccounts = await tx.ledgerAccount.count({
          where: {
            code: { in: ledgerCodes },
            ownerAccountId: account.id,
            type: LedgerAccountType.CUSTOMER,
          },
        });

        if (provisionedLedgerAccounts !== assets.length) {
          throw new Error(
            `LEDGER_ACCOUNT_PROVISIONING_INCOMPLETE:${provisionedLedgerAccounts}/${assets.length}`,
          );
        }

        await tx.auditLog.create({
          data: {
            actorType: AuditActorType.USER,
            actorUserId: user.id,
            action: 'ACCOUNT_BOOTSTRAP_EXECUTED',
            resourceType: 'ACCOUNT',
            resourceId: account.id,
            after: {
              accountId: account.id,
              accountType: account.type,
              accountStatus: account.status,
              kycStatus: account.kycStatus,
              baseCurrency: account.baseCurrency,
              monetaryAssets: assets.length,
            },
            metadata: {
              userCreated,
              accountCreated,
              walletsCreated,
            },
            requestId: context.requestId,
            userAgent: context.userAgent,
          },
        });

        const wallets = await tx.wallet.findMany({
          where: { accountId: account.id },
          include: {
            asset: true,
            balance: true,
          },
        });
        wallets.sort((a, b) => a.asset.code.localeCompare(b.asset.code));

        return {
          created: {
            user: userCreated,
            account: accountCreated,
            wallets: walletsCreated,
          },
          user: {
            id: user.id,
            authUserId: user.authUserId,
            email: user.email,
            status: user.status,
          },
          account: {
            id: account.id,
            type: account.type,
            status: account.status,
            kycStatus: account.kycStatus,
            countryCode: account.countryCode,
            baseCurrency: account.baseCurrency,
          },
          wallets: wallets.map((wallet) => this.serializeWallet(wallet)),
        };
      },
      {
        maxWait: 5000,
        timeout: 15000,
      },
    );
  }

  async getWallets(authUser: AuthenticatedUser) {
    const account = await this.requireIndividualAccount(authUser.id);

    const wallets = await this.prisma.wallet.findMany({
      where: { accountId: account.id },
      include: {
        asset: true,
        balance: true,
      },
    });
    wallets.sort((a, b) => a.asset.code.localeCompare(b.asset.code));

    return {
      accountId: account.id,
      baseCurrency: account.baseCurrency,
      wallets: wallets.map((wallet) => this.serializeWallet(wallet)),
    };
  }

  async getWallet(authUser: AuthenticatedUser, walletId: string) {
    const account = await this.requireIndividualAccount(authUser.id);

    const wallet = await this.prisma.wallet.findFirst({
      where: {
        id: walletId,
        accountId: account.id,
      },
      include: {
        asset: true,
        balance: true,
      },
    });

    if (!wallet) {
      throw new NotFoundException('WALLET_NOT_FOUND');
    }

    return this.serializeWallet(wallet);
  }

  private async requireIndividualAccount(authUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { authUserId },
      include: {
        accounts: {
          where: { type: AccountType.INDIVIDUAL },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    const account = user?.accounts[0];

    if (!account) {
      throw new ConflictException('ACCOUNT_NOT_PROVISIONED');
    }

    return account;
  }

  private serializeWallet(wallet: any) {
    return {
      id: wallet.id,
      status: wallet.status,
      asset: {
        id: wallet.asset.id,
        code: wallet.asset.code,
        symbol: wallet.asset.symbol,
        name: wallet.asset.name,
        type: wallet.asset.type,
        network: wallet.asset.network,
        decimals: wallet.asset.decimals,
        depositEnabled: wallet.asset.depositEnabled,
        withdrawEnabled: wallet.asset.withdrawEnabled,
        exchangeEnabled: wallet.asset.exchangeEnabled,
      },
      balance: {
        available: wallet.balance?.available?.toString() ?? '0',
        pending: wallet.balance?.pending?.toString() ?? '0',
        reserved: wallet.balance?.reserved?.toString() ?? '0',
        blocked: wallet.balance?.blocked?.toString() ?? '0',
      },
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }
}
