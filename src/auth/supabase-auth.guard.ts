import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers?.authorization;

    if (typeof authorization !== 'string') {
      throw new UnauthorizedException('MISSING_BEARER_TOKEN');
    }

    const match = authorization.match(/^Bearer\s+(.+)$/i);

    if (!match?.[1]) {
      throw new UnauthorizedException('INVALID_AUTHORIZATION_HEADER');
    }

    request.authUser = await this.authService.verifyAccessToken(match[1].trim());
    return true;
  }
}
