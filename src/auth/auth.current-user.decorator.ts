import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, SessionUser } from './auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionUser | undefined => {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return req.user;
  },
);
