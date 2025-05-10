import { Module } from '@nestjs/common';
import { SentenceService } from './sentence.service';
import { SentenceController } from './sentence.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  providers: [SentenceService],
  controllers: [SentenceController],
  imports: [PrismaModule],
  exports: [SentenceService],
})
export class SentenceModule { }
