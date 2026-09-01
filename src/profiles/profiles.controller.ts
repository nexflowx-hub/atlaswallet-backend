import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { UpdateSelfDeclaredProfileDto } from './dto/update-self-declared-profile.dto';
import { ProfilesService } from './profiles.service';

@Controller('v1/profile')
@UseGuards(SupabaseAuthGuard)
export class ProfilesController {
  constructor(
    private readonly profilesService: ProfilesService,
  ) {}

  @Get()
  async profile(
    @CurrentAuthUser() authUser: AuthenticatedUser,
  ) {
    return this.profilesService.getProfile(authUser);
  }

  @Patch()
  async updateProfile(
    @CurrentAuthUser() authUser: AuthenticatedUser,
    @Body() dto: UpdateSelfDeclaredProfileDto,
    @Req() request: any,
  ) {
    const requestIdHeader =
      request.headers?.['x-request-id'];

    const userAgentHeader =
      request.headers?.['user-agent'];

    return this.profilesService.updateProfile(
      authUser,
      dto,
      {
        requestId:
          typeof requestIdHeader === 'string'
            ? requestIdHeader.slice(0, 128)
            : undefined,
        userAgent:
          typeof userAgentHeader === 'string'
            ? userAgentHeader.slice(0, 512)
            : undefined,
      },
    );
  }
}
