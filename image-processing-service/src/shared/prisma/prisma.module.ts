import { DynamicModule, Module } from '@nestjs/common';

@Module({})
export class PrismaModule {
  static forRoot(): DynamicModule {
    return {
      module: PrismaModule,
    };
  }
}
