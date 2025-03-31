import { Module } from '@nestjs/common';
import { SentenceService } from './sentence.service';
import { SentenceController } from './sentence.controller';

@Module({
  providers: [SentenceService],
  controllers: [SentenceController]
})
export class SentenceModule {}
