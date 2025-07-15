import { PartialType } from '@nestjs/swagger';
import { CreateUserKanjiProgressDto } from './create-user-kanji-progress.dto';

export class UpdateUserKanjiProgressDto extends PartialType(CreateUserKanjiProgressDto) {}
