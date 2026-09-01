import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import {
  AccountType,
  AuditActorType,
  IdentityLevel,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { UpdateSelfDeclaredProfileDto } from './dto/update-self-declared-profile.dto';

const REQUIRED_SELF_DECLARED_FIELDS = [
  'firstName',
  'lastName',
  'dateOfBirth',
  'nationalityCountryCode',
  'residenceCountryCode',
] as const;

export interface ProfileRequestContext {
  requestId?: string;
  userAgent?: string;
}

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(authUser: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { authUserId: authUser.id },
      include: {
        accounts: {
          where: { type: AccountType.INDIVIDUAL },
          orderBy: { createdAt: 'asc' },
          take: 1,
          include: {
            profile: true,
            pricingPlan: true,
          },
        },
      },
    });

    const account = user?.accounts[0];

    if (!account) {
      throw new ConflictException('ACCOUNT_NOT_PROVISIONED');
    }

    return this.serialize(account);
  }

  async updateProfile(
    authUser: AuthenticatedUser,
    dto: UpdateSelfDeclaredProfileDto,
    context: ProfileRequestContext = {},
  ) {
    const changedFields = Object.keys(dto);

    if (changedFields.length === 0) {
      throw new BadRequestException('PROFILE_UPDATE_EMPTY');
    }

    let birthDate: Date | undefined;

    if (dto.dateOfBirth) {
      birthDate = new Date(`${dto.dateOfBirth}T00:00:00.000Z`);

      if (
        Number.isNaN(birthDate.getTime()) ||
        birthDate.getTime() > Date.now()
      ) {
        throw new BadRequestException('INVALID_DATE_OF_BIRTH');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { authUserId: authUser.id },
        include: {
          accounts: {
            where: { type: AccountType.INDIVIDUAL },
            orderBy: { createdAt: 'asc' },
            take: 1,
            include: {
              profile: true,
              pricingPlan: true,
            },
          },
        },
      });

      const account = user?.accounts[0];

      if (!user || !account) {
        throw new ConflictException('ACCOUNT_NOT_PROVISIONED');
      }

      const profile = await tx.selfDeclaredProfile.upsert({
        where: {
          accountId: account.id,
        },
        create: {
          accountId: account.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          dateOfBirth: birthDate,
          nationalityCountryCode: dto.nationalityCountryCode,
          residenceCountryCode: dto.residenceCountryCode,
          phoneE164: dto.phoneE164,
        },
        update: {
          ...(dto.firstName !== undefined
            ? { firstName: dto.firstName }
            : {}),
          ...(dto.lastName !== undefined
            ? { lastName: dto.lastName }
            : {}),
          ...(dto.dateOfBirth !== undefined
            ? { dateOfBirth: birthDate }
            : {}),
          ...(dto.nationalityCountryCode !== undefined
            ? {
                nationalityCountryCode:
                  dto.nationalityCountryCode,
              }
            : {}),
          ...(dto.residenceCountryCode !== undefined
            ? {
                residenceCountryCode:
                  dto.residenceCountryCode,
              }
            : {}),
          ...(dto.phoneE164 !== undefined
            ? { phoneE164: dto.phoneE164 }
            : {}),
        },
      });

      const isComplete = REQUIRED_SELF_DECLARED_FIELDS.every(
        (field) => profile[field] !== null,
      );

      let finalProfile = profile;

      if (isComplete && !profile.completedAt) {
        finalProfile = await tx.selfDeclaredProfile.update({
          where: { id: profile.id },
          data: { completedAt: new Date() },
        });
      }

      let finalAccount = account;

      if (
        dto.residenceCountryCode &&
        account.countryCode !== dto.residenceCountryCode
      ) {
        finalAccount = await tx.account.update({
          where: { id: account.id },
          data: {
            countryCode: dto.residenceCountryCode,
          },
          include: {
            profile: true,
            pricingPlan: true,
          },
        });
      } else {
        finalAccount = {
          ...account,
          profile: finalProfile,
        };
      }

      const completion =
        this.calculateCompletion(finalProfile);

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.USER,
          actorUserId: user.id,
          action: 'SELF_DECLARED_PROFILE_UPDATED',
          resourceType: 'SELF_DECLARED_PROFILE',
          resourceId: finalProfile.id,
          metadata: {
            changedFields,
            completionPercent: completion.percent,
            complete: completion.complete,
            identityLevel: finalAccount.identityLevel,
            frictionlessEntry: true,
          },
          requestId: context.requestId,
          userAgent: context.userAgent,
        },
      });

      return this.serialize({
        ...finalAccount,
        profile: finalProfile,
      });
    });
  }

  private calculateCompletion(profile: any) {
    if (!profile) {
      return {
        percent: 0,
        complete: false,
        missingFields: [...REQUIRED_SELF_DECLARED_FIELDS],
      };
    }

    const missingFields =
      REQUIRED_SELF_DECLARED_FIELDS.filter(
        (field) => profile[field] === null,
      );

    const completed =
      REQUIRED_SELF_DECLARED_FIELDS.length -
      missingFields.length;

    return {
      percent: Math.round(
        (completed /
          REQUIRED_SELF_DECLARED_FIELDS.length) *
          100,
      ),
      complete: missingFields.length === 0,
      missingFields,
    };
  }

  private serialize(account: any) {
    const profile = account.profile ?? null;
    const completion = this.calculateCompletion(profile);

    return {
      accountId: account.id,
      source: 'SELF_DECLARED',
      verified: false,
      canSkip: true,
      identityLevel: account.identityLevel,
      kycStatus: account.kycStatus,
      pricingPlan: {
        code: account.pricingPlan.code,
        feePercent:
          account.pricingPlan.feeBasisPoints / 100,
      },
      completion,
      profile: profile
        ? {
            firstName: profile.firstName,
            lastName: profile.lastName,
            dateOfBirth: profile.dateOfBirth
              ? profile.dateOfBirth
                  .toISOString()
                  .slice(0, 10)
              : null,
            nationalityCountryCode:
              profile.nationalityCountryCode,
            residenceCountryCode:
              profile.residenceCountryCode,
            phoneE164: profile.phoneE164,
            completedAt: profile.completedAt,
            updatedAt: profile.updatedAt,
          }
        : null,
    };
  }
}
