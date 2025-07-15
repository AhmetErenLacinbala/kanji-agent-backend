import { Test, TestingModule } from '@nestjs/testing';
import { UserKanjiProgressController } from './user-kanji-progress.controller';
import { UserKanjiProgressService } from './user-kanji-progress.service';

describe('UserKanjiProgressController', () => {
  let controller: UserKanjiProgressController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserKanjiProgressController],
      providers: [UserKanjiProgressService],
    }).compile();

    controller = module.get<UserKanjiProgressController>(UserKanjiProgressController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
