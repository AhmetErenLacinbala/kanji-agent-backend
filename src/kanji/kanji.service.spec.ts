import { Test, TestingModule } from '@nestjs/testing';
import { KanjiService } from './kanji.service';

describe('KanjiService', () => {
  let service: KanjiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KanjiService],
    }).compile();

    service = module.get<KanjiService>(KanjiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
