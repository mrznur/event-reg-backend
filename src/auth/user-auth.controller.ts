import { Body, Controller, Post } from '@nestjs/common';
import { Role } from '../generated/prisma/enums';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';

/**
 * Attendee auth — only signup differs (sets role ATTENDEE).
 * Login, verify, me, logout, and resend all use the shared /api/auth/* endpoints.
 */
@Controller('user/auth')
export class UserAuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto, Role.ATTENDEE);
  }
}
