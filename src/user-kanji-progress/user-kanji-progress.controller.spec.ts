import { Test, TestingModule } from '@nestjs/testing';
import { UserKanjiProgressController } from './user-kanji-progress.controller';

describe('UserKanjiProgressController', () => {
  let controller: UserKanjiProgressController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserKanjiProgressController],
    }).compile();

    controller = module.get<UserKanjiProgressController>(UserKanjiProgressController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
