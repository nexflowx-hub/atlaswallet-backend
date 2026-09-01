import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { AccountsService } from './accounts.service';

@Controller('v1')
@UseGuards(SupabaseAuthGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('me')
  async me(@CurrentAuthUser() authUser: AuthenticatedUser) {
    return this.accountsService.getMe(authUser);
  }

  @Post('account/bootstrap')
  @HttpCode(HttpStatus.OK)
  async bootstrap(
    @CurrentAuthUser() authUser: AuthenticatedUser,
    @Req() request: any,
  ) {
    const requestIdHeader = request.headers?.['x-request-id'];
    const userAgentHeader = request.headers?.['user-agent'];

    return this.accountsService.bootstrap(authUser, {
      requestId:
        typeof requestIdHeader === 'string' ? requestIdHeader.slice(0, 128) : undefined,
      userAgent:
        typeof userAgentHeader === 'string' ? userAgentHeader.slice(0, 512) : undefined,
    });
  }

  @Get('wallets')
  async wallets(@CurrentAuthUser() authUser: AuthenticatedUser) {
    return this.accountsService.getWallets(authUser);
  }

  @Get('wallets/:walletId')
  async wallet(
    @CurrentAuthUser() authUser: AuthenticatedUser,
    @Param('walletId', new ParseUUIDPipe({ version: '4' })) walletId: string,
  ) {
    return this.accountsService.getWallet(authUser, walletId);
  }
}
