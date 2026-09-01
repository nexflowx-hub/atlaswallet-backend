import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedUser } from './auth.types';

interface SupabaseUserResponse {
  id?: string;
  email?: string | null;
}

@Injectable()
export class AuthService {
  private readonly supabaseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.supabaseUrl = (this.config.get<string>('SUPABASE_URL') ?? '').replace(/\/+$/, '');
    this.apiKey =
      this.config.get<string>('SUPABASE_PUBLISHABLE_KEY') ??
      this.config.get<string>('SUPABASE_ANON_KEY') ??
      '';
  }

  async verifyAccessToken(accessToken: string): Promise<AuthenticatedUser> {
    if (!this.supabaseUrl || !this.apiKey) {
      throw new ServiceUnavailableException('AUTH_CONFIGURATION_MISSING');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let response: Response;

    try {
      response = await fetch(`${this.supabaseUrl}/auth/v1/user`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: this.apiKey,
        },
        signal: controller.signal,
      });
    } catch {
      throw new ServiceUnavailableException('AUTH_PROVIDER_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 401 || response.status === 403) {
      throw new UnauthorizedException('INVALID_ACCESS_TOKEN');
    }

    if (!response.ok) {
      throw new ServiceUnavailableException('AUTH_PROVIDER_ERROR');
    }

    const payload = (await response.json()) as SupabaseUserResponse;

    if (!payload.id) {
      throw new UnauthorizedException('INVALID_AUTH_USER');
    }

    return {
      id: payload.id,
      email: payload.email ?? null,
    };
  }
}
