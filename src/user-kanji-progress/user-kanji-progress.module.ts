import { Module } from '@nestjs/common';
import { UserKanjiProgressService } from './user-kanji-progress.service';
import { UserKanjiProgressController } from './user-kanji-progress.controller';

@Module({
  providers: [UserKanjiProgressService],
  controllers: [UserKanjiProgressController]
})
export class UserKanjiProgressModule { }
