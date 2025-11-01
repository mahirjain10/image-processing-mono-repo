import { Module } from '@nestjs/common';
import { CronsService } from './crons.service';

@Module({
  providers: [CronsService]
})
export class CronsModule {}
