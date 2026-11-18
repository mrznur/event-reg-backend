import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { EventsModule } from './events/events.module';
import { StatsModule } from './stats/stats.module';
import { RegistrationsModule } from './registrations/registrations.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    EventsModule,
    StatsModule,
    RegistrationsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
