import { PrismaService } from '@shared/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { CreateUser,  } from '@auth/interface/user';
import { AcceptableField } from './types/types';
import { User } from '@shared/prisma/generated/client';

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
  updateRateLimits = async (email:string,field :AcceptableField,updatedRateLimit) => {
    await this.prismaService.user.update({where:{email,},data:{[field]:updatedRateLimit}})
  }
  createUser = async (createUser: CreateUser): Promise<User> => {
    const user = await this.prismaService.user.create({
      data: createUser,
    });
    this.logger.log('User : ', user);
    return user;
  };
}
