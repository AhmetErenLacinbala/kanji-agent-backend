import { Test, TestingModule } from '@nestjs/testing';
import { DeckKanjiController } from './deck-kanji.controller';

describe('DeckKanjiController', () => {
  let controller: DeckKanjiController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeckKanjiController],
    }).compile();

    controller = module.get<DeckKanjiController>(DeckKanjiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
