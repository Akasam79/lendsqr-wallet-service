import { UserRole } from '../users/user.enums';

export type JwtPayload = {
  sub: string;
  role: UserRole;
};
