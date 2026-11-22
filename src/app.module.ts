import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { EventsModule } from './events/events.module';
import { StatsModule } from './stats/stats.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { UploadsModule } from './uploads/uploads.module';
import { GalleryModule } from './gallery/gallery.module';
import { MailModule } from './mail/mail.module';
import { OrganizerModule } from './organizer/organizer.module';
import { AdminModule } from './admin/admin.module';
import { TicketsModule } from './tickets/tickets.module';
import { ContactModule } from './contact/contact.module';
import { AboutModule } from './about/about.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // ── Rate limiting ────────────────────────────────────────────────────────
    // Global default: 60 requests per minute per IP.
    // Sensitive endpoints override this with @Throttle() decorators.
    ThrottlerModule.forRoot([
      { name: 'global', ttl: 60_000, limit: 60 },
    ]),

    PrismaModule,
    AuthModule,
    EventsModule,
    StatsModule,
    RegistrationsModule,
    UploadsModule,
    GalleryModule,
    MailModule,
    OrganizerModule,
    AdminModule,
    TicketsModule,
    ContactModule,
    AboutModule,
  ],
  controllers: [AppController],
  providers: [
    // Apply rate limiting globally to every route.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
