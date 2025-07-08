import { Test, TestingModule } from '@nestjs/testing';
import { DeckService } from './deck.service';

describe('DeckService', () => {
  let service: DeckService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DeckService],
    }).compile();

    service = module.get<DeckService>(DeckService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
