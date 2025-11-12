import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma-client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly saltRounds = 10;
  private extendedClient: PrismaClient | null = null;

  constructor(private readonly configService: ConfigService) {
    console.log(configService.get<string>('db.url'));
    const databaseUrl = configService.get<string>('db.url');
    super({
      datasources: {
        db: { url: databaseUrl },
      },
    });
    this.logger.debug(`DB URL: ${databaseUrl}`);
    this.logger.log('PrismaService initialized.');
  }

  /**
   * Hash password safely, supports string and { set: string } updates
   */
  // private async hashPassword(
  //   password: string | Prisma.StringFieldUpdateOperationsInput,
  // ): Promise<string> {
  //   if (typeof password === 'string') {
  //     return await bcrypt.hash(password, this.saltRounds);
  //   }

  //   if (password && typeof password === 'object') {
  //     // Handle Prisma update object
  //     if ('set' in password && typeof password.set === 'string') {
  //       return await bcrypt.hash(password.set, this.saltRounds);
  //     }

  //     // Defensive check: password should never be numeric
  //     if (
  //       'increment' in password ||
  //       'decrement' in password ||
  //       'multiply' in password ||
  //       'divide' in password
  //     ) {
  //       throw new Error('Password field does not support numeric operations');
  //     }
  //   }

  //   throw new Error('Invalid password format for hashing');
  // }

  /** Connect and extend Prisma client with password middleware */
  async onModuleInit() {
    await this.$connect();

    //   this.extendedClient = this.$extends({
    //     query: {
    //       user: {
    //         async create({ args, query }) {
    //           if (args.data?.password) {
    //             args.data.password = await this.hashPassword(args.data.password);
    //             this.logger.debug('Password hashed for user creation');
    //           }
    //           return query(args);
    //         },
    //         async update({ args, query }) {
    //           if (args.data?.password) {
    //             args.data.password = await this.hashPassword(args.data.password);
    //             this.logger.debug('Password hashed for user update');
    //           }
    //           return query(args);
    //         },
    //         async upsert({ args, query }) {
    //           if (args.create?.password) {
    //             args.create.password = await this.hashPassword(
    //               args.create.password,
    //             );
    //             this.logger.debug('Password hashed for user upsert create');
    //           }
    //           if (args.update?.password) {
    //             args.update.password = await this.hashPassword(
    //               args.update.password,
    //             );
    //             this.logger.debug('Password hashed for user upsert update');
    //           }
    //           return query(args);
    //         },
    //       },
    //     },
    //   }) as this;

    //   this.logger.log('Connected to DB with password hashing middleware.');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from DB.');
  }

  /** Override user property to use extended client */
  // get user() {
  //   return this.extendedClient?.user ?? super.user;
  // }
}
