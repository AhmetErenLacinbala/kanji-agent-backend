import { Module } from '@nestjs/common';
import { DeckKanjiService } from './deck-kanji.service';
import { DeckKanjiController } from './deck-kanji.controller';

@Module({
  providers: [DeckKanjiService],
  controllers: [DeckKanjiController]
})
export class DeckKanjiModule {}
