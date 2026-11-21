import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/auth.current-user.decorator';
import type { SessionUser } from '../auth/auth.types';
import { Role } from '../generated/prisma/enums';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AuthGuard, RoleGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // ── Users ─────────────────────────────────────────────────────────────────

  // GET /api/admin/users
  @Get('users')
  listUsers() {
    return this.admin.listUsers();
  }

  // DELETE /api/admin/users/:id
  @Delete('users/:id')
  @HttpCode(200)
  deleteUser(@Param('id') id: string, @CurrentUser() caller: SessionUser) {
    return this.admin.deleteUser(id, caller);
  }

  // ── Events ────────────────────────────────────────────────────────────────

  // GET /api/admin/events
  @Get('events')
  listEvents() {
    return this.admin.listAllEvents();
  }

  // PATCH /api/admin/events/:id/cancel
  @Patch('events/:id/cancel')
  cancelEvent(@Param('id') id: string) {
    return this.admin.cancelEvent(id);
  }
}
