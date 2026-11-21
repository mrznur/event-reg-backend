import { SetMetadata } from '@nestjs/common';
import { Role } from '../generated/prisma/enums';

/**
 * Attaches allowed roles to a route handler.
 * Used with RoleGuard: @UseGuards(AuthGuard, RoleGuard) + @Roles(ORGANIZER, ADMIN)
 */
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
