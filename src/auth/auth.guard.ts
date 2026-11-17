import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AUTH_COOKIE_NAME } from './auth.constants';
import type { AuthenticatedRequest, SessionUser } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token: unknown = req.cookies?.[AUTH_COOKIE_NAME];

    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException('Not authenticated');
    }

    try {
      const payload = await this.jwt.verifyAsync<SessionUser>(token);
      req.user = { sub: payload.sub, role: payload.role };
      return true;
    } catch {
      throw new UnauthorizedException('Not authenticated');
    }
  }
}
