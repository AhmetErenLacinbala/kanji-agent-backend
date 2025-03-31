import { Module } from '@nestjs/common';
import { KanjiService } from './kanji.service';
import { KanjiController } from './kanji.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  providers: [KanjiService],
  controllers: [KanjiController],
  imports: [PrismaModule]
})
export class KanjiModule { }
