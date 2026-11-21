import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { UserAuthController } from './user-auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { RoleGuard } from './role.guard';
import { SESSION_MAX_AGE_SECONDS } from './auth.constants';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: SESSION_MAX_AGE_SECONDS },
      }),
    }),
  ],
  controllers: [AuthController, UserAuthController],
  providers: [AuthService, AuthGuard, RoleGuard],
  exports: [AuthGuard, JwtModule, RoleGuard],
})
export class AuthModule {}
