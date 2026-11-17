import type { Request } from 'express';
import type { Role } from '../generated/prisma/client';

export interface SessionUser {
  sub: string;
  role: Role;
}

export type AuthenticatedRequest = Request & { user?: SessionUser };
