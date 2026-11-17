import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hashPassword, verifyPassword } from '../common/password';
import { PrismaService } from '../prisma/prisma.service';
import type { SessionUser } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await hashPassword(dto.password);

    try {
      // Signup always creates an ORGANIZER (the schema default).
      const user = await this.prisma.user.create({
        data: { name: dto.name, email: dto.email, passwordHash },
        select: publicUserSelect,
      });
      return { user, token: await this.signToken(user.id, user.role) };
    } catch (error) {
      // Two signups with the same email at the same instant: unique index wins.
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      // Do comparable work so response time does not reveal unknown emails.
      await hashPassword(dto.password);
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await verifyPassword(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
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

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: publicUserSelect,
    });
    if (!user) {
      throw new UnauthorizedException('Not authenticated');
    }
    return { user };
  }

  private signToken(sub: string, role: SessionUser['role']): Promise<string> {
    return this.jwt.signAsync({ sub, role });
  }
}
