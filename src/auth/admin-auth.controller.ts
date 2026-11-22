import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Post,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  AUTH_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieOptions,
} from './auth.constants';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Role } from '../generated/prisma/enums';

/**
 * Secret admin login endpoint.
 * The route path is set at startup from ADMIN_LOGIN_PATH in .env.
 * It is never documented, never in the README, and not visible in source.
 * Example: if ADMIN_LOGIN_PATH=sys/console/access, the route is POST /api/sys/console/access
 */
@Controller(process.env.ADMIN_LOGIN_PATH ?? 'sys/panel')
export class AdminAuthController {
  constructor(private readonly auth: AuthService) {}

  @Post()
  @HttpCode(200)
  @Throttle({ global: { ttl: 60_000, limit: 5 } })
  async adminLogin(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto);

    // Silently reject non-admin accounts — same 401 as wrong password.
    if (result.user.role !== Role.ADMIN) {
      throw new Error('Invalid email or password');
    }

    res.cookie(AUTH_COOKIE_NAME, result.token, {
      ...sessionCookieOptions(),
      maxAge: SESSION_MAX_AGE_SECONDS * 1000,
    });

    return { user: result.user };
  }
}
