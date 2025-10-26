import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma-client';

export const hashPasswordMiddleware = async (params, next) => {
  if (
    params.model === 'User' &&
    (params.action === 'create' || params.action === 'update')
  ) {
    const userData = params.args.data;

    if (userData.password && !userData.password.startsWith('$2b$')) {
      const salt = await bcrypt.genSalt(10);
      userData.password = await bcrypt.hash(userData.password, salt);
    }
  }

  return next(params);
};
