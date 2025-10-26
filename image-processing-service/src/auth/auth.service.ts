import { PrismaService } from '@shared/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { createUser, User } from './interface/user';

@Injectable()
export class AuthService {
  // Injecting the PrismaService here (PrismaService extended PrismaClient)
  private readonly logger = new Logger(AuthService.name);
  constructor(private readonly prismaService: PrismaService) {}
  findUserByEmail = async (email: string): Promise<User | null> => {
    const user = await this.prismaService.user.findUnique({
      where: {
        email,
      },
    });
    this.logger.log('User : ', user);
    return user;
  };
  createUser = async (createUser: createUser): Promise<User> => {
    const user = await this.prismaService.user.create({
      data: createUser,
    });
    this.logger.log('User : ', user);
    return user;
  };
}
