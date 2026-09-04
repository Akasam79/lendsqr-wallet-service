import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user.enums';
import { RolesGuard } from './roles.guard';

function contextFor(user: Pick<User, 'role'>): ExecutionContext {
  return {
    getHandler: () => contextFor,
    getClass: () => RolesGuard,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  beforeEach(() => {
    jest.mocked(reflector.getAllAndOverride).mockReturnValue([UserRole.ADMIN]);
  });

  it('allows a user with the required role', () => {
    expect(guard.canActivate(contextFor({ role: UserRole.ADMIN }))).toBe(true);
  });

  it('rejects a user without the required role', () => {
    expect(() =>
      guard.canActivate(contextFor({ role: UserRole.CUSTOMER })),
    ).toThrow(ForbiddenException);
  });
});
