import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { UserKanjiProgressService } from './user-kanji-progress.service';
import { CreateUserKanjiProgressDto } from './dto/create-user-kanji-progress.dto';
import { UpdateUserKanjiProgressDto } from './dto/update-user-kanji-progress.dto';

@Controller('user-kanji-progress')
export class UserKanjiProgressController {
  constructor(private readonly userKanjiProgressService: UserKanjiProgressService) {}

  @Post()
  create(@Body() createUserKanjiProgressDto: CreateUserKanjiProgressDto) {
    return this.userKanjiProgressService.create(createUserKanjiProgressDto);
  }

  @Get()
  findAll() {
    return this.userKanjiProgressService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userKanjiProgressService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserKanjiProgressDto: UpdateUserKanjiProgressDto) {
    return this.userKanjiProgressService.update(+id, updateUserKanjiProgressDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userKanjiProgressService.remove(+id);
  }
}
