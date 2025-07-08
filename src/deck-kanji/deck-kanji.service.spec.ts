import { Test, TestingModule } from '@nestjs/testing';
import { DeckKanjiService } from './deck-kanji.service';

describe('DeckKanjiService', () => {
  let service: DeckKanjiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DeckKanjiService],
    }).compile();

    service = module.get<DeckKanjiService>(DeckKanjiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
