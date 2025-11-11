import { Module ,Logger} from '@nestjs/common';
import { SnsService } from './sns.service';
import { SnsController } from './sns.controller';

@Module({
  providers: [SnsService,Logger],
  controllers: [SnsController]
})
export class SnsModule {}
