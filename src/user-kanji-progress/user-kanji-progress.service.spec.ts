import { Test, TestingModule } from '@nestjs/testing';
import { UserKanjiProgressService } from './user-kanji-progress.service';

describe('UserKanjiProgressService', () => {
  let service: UserKanjiProgressService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserKanjiProgressService],
    }).compile();

    service = module.get<UserKanjiProgressService>(UserKanjiProgressService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
