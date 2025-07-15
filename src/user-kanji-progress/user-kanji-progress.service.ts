import { Injectable } from '@nestjs/common';
import { CreateUserKanjiProgressDto } from './dto/create-user-kanji-progress.dto';
import { UpdateUserKanjiProgressDto } from './dto/update-user-kanji-progress.dto';

@Injectable()
export class UserKanjiProgressService {
  create(createUserKanjiProgressDto: CreateUserKanjiProgressDto) {
    return 'This action adds a new userKanjiProgress';
  }

  findAll() {
    return `This action returns all userKanjiProgress`;
  }

  findOne(id: number) {
    return `This action returns a #${id} userKanjiProgress`;
  }

  update(id: number, updateUserKanjiProgressDto: UpdateUserKanjiProgressDto) {
    return `This action updates a #${id} userKanjiProgress`;
  }

  remove(id: number) {
    return `This action removes a #${id} userKanjiProgress`;
  }
}
