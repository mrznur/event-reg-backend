import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  AUTH_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieOptions,
} from './auth.constants';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import type { SessionUser } from './auth.types';
import { CurrentUser } from './auth.current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Step 1 — creates unverified user, sends 6-digit code, no cookie set.
  @Post('register')
  @Throttle({ global: { ttl: 60_000, limit: 5 } })
  signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto);
  }

  // Step 2 — verifies code, marks user verified, sets session cookie.
  @Post('verify')
  @HttpCode(200)
  @Throttle({ global: { ttl: 60_000, limit: 10 } })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, token } = await this.auth.verifyEmail(dto);
    this.setSessionCookie(res, token);
    return { user };
  }

  // Resend verification code (rate-limited to 1 per 30 seconds).
  @Post('resend')
  @HttpCode(200)
  resend(@Body('email') email: string) {
    return this.auth.resendCode(email);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ global: { ttl: 60_000, limit: 10 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, token } = await this.auth.login(dto);
    this.setSessionCookie(res, token);
    return { user };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE_NAME, sessionCookieOptions());
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: SessionUser) {
    return this.auth.me(user.sub);
  }

  // POST /api/auth/forgot-password
  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ global: { ttl: 60_000, limit: 5 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  // POST /api/auth/reset-password
  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ global: { ttl: 60_000, limit: 5 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  private setSessionCookie(res: Response, token: string) {
    res.cookie(AUTH_COOKIE_NAME, token, {
      ...sessionCookieOptions(),
      maxAge: SESSION_MAX_AGE_SECONDS * 1000,
    });
  }
}
