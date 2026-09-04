import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/user.enums';

export const REQUIRED_ROLES = 'requiredRoles';
export const Roles = (...roles: UserRole[]) =>
  SetMetadata(REQUIRED_ROLES, roles);
