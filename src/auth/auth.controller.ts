import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
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

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, token } = await this.auth.signup(dto);
    this.setSessionCookie(res, token);
    return { user };
  }

  @Post('login')
  @HttpCode(200)
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

  private setSessionCookie(res: Response, token: string) {
    res.cookie(AUTH_COOKIE_NAME, token, {
      ...sessionCookieOptions(),
      maxAge: SESSION_MAX_AGE_SECONDS * 1000,
    });
  }
}
