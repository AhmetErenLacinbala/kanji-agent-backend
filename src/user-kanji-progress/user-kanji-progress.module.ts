import { Module } from '@nestjs/common';
import { UserKanjiProgressService } from './user-kanji-progress.service';
import { UserKanjiProgressController } from './user-kanji-progress.controller';

@Module({
  controllers: [UserKanjiProgressController],
  providers: [UserKanjiProgressService],
})
export class UserKanjiProgressModule {}
