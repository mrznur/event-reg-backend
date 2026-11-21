import { randomInt } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hashPassword, verifyPassword } from '../common/password';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../generated/prisma/enums';
import type { SessionUser } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/reset-password.dto';

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  verified: true,
} as const;

const CODE_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  // ── Signup: create unverified user, send code ──────────────────────────────

  async signup(dto: SignupDto, role: Role = Role.ORGANIZER) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, verified: true },
    });

    if (existing?.verified) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await hashPassword(dto.password);
    const code = this.generateCode();

    if (existing && !existing.verified) {
      // Re-signup before verifying — update the record and resend.
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          passwordHash,
          verificationCode: code,
          verificationCodeExpiresAt: this.codeExpiry(),
          lastResendAt: new Date(),
        },
      });
    } else {
      await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          role,
          verified: false,
          verificationCode: code,
          verificationCodeExpiresAt: this.codeExpiry(),
          lastResendAt: new Date(),
        },
      });
    }

    await this.mail.sendVerificationCode({
      to: dto.email,
      name: dto.name,
      code,
    });

    return { ok: true };
  }

  // ── Verify: check code, mark verified, return session ─────────────────────

  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new NotFoundException('No pending signup found. Please sign up again.');
    }

    if (user.verified) {
      throw new ConflictException('Email is already verified');
    }

    if (!user.verificationCode || !user.verificationCodeExpiresAt) {
      throw new BadRequestException('No verification code found. Please sign up again.');
    }

    if (user.verificationCodeExpiresAt <= new Date()) {
      throw new BadRequestException('Your verification code has expired.');
    }

    if (user.verificationCode !== dto.code) {
      throw new BadRequestException('Invalid code.');
    }

    const verified = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verified: true,
        verificationCode: null,
        verificationCodeExpiresAt: null,
      },
      select: publicUserSelect,
    });

    return {
      user: verified,
      token: await this.signToken(verified.id, verified.role),
    };
  }

  // ── Resend: generate new code, enforce cooldown ───────────────────────────

  async resendCode(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        name: true,
        email: true,
        verified: true,
        lastResendAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('No pending signup found. Please sign up again.');
    }

    if (user.verified) {
      throw new ConflictException('Email is already verified');
    }

    // Rate-limit: 1 resend per 30 seconds.
    if (user.lastResendAt) {
      const secondsSinceLast =
        (Date.now() - user.lastResendAt.getTime()) / 1000;
      if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
        const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLast);
        throw new BadRequestException(
          `Please wait ${wait} second${wait === 1 ? '' : 's'} before requesting a new code.`,
        );
      }
    }

    const code = this.generateCode();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verificationCode: code,
        verificationCodeExpiresAt: this.codeExpiry(),
        lastResendAt: new Date(),
      },
    });

    await this.mail.sendVerificationCode({
      to: user.email,
      name: user.name,
      code,
    });

    return { ok: true };
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      await hashPassword(dto.password);
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await verifyPassword(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.verified) {
      throw new ForbiddenException('Please verify your email first.');
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token: await this.signToken(user.id, user.role),
    };
  }

  // ── Me ─────────────────────────────────────────────────────────────────────

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: publicUserSelect,
    });

    if (!user || !user.verified) {
      throw new UnauthorizedException('Not authenticated');
    }

    return { user };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private signToken(sub: string, role: SessionUser['role']): Promise<string> {
    return this.jwt.signAsync({ sub, role });
  }

  private codeExpiry(): Date {
    return new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);
  }

  private generateCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  // ── Forgot password: send reset code ──────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, name: true, email: true, verified: true },
    });

    if (!user) throw new NotFoundException('No account found with that email.');
    if (!user.verified) throw new BadRequestException('Please verify your email first.');

    const code = this.generateCode();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetCode: code,
        passwordResetExpiresAt: this.codeExpiry(),
      },
    });

    await this.mail.sendPasswordResetCode({
      to: user.email,
      name: user.name,
      code,
    });

    return { ok: true };
  }

  // ── Reset password: verify code, update password ───────────────────────────

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        passwordResetCode: true,
        passwordResetExpiresAt: true,
      },
    });

    if (!user) throw new NotFoundException('No account found with that email.');

    if (!user.passwordResetCode || !user.passwordResetExpiresAt) {
      throw new BadRequestException('No password reset was requested.');
    }

    if (user.passwordResetExpiresAt <= new Date()) {
      throw new BadRequestException('Your reset code has expired.');
    }

    if (user.passwordResetCode !== dto.code) {
      throw new BadRequestException('Invalid code.');
    }

    const passwordHash = await hashPassword(dto.newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetCode: null,
        passwordResetExpiresAt: null,
      },
    });

    return { ok: true };
  }
}
