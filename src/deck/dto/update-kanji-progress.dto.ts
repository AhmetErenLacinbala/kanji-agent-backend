import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsArray, IsBoolean, IsString } from 'class-validator';

export class KanjiProgressItem {
    @IsNotEmpty()
    @IsString()
    @ApiProperty({
        description: 'Kanji ID'
    })
    kanjiId: string;

    @IsNotEmpty()
    @IsBoolean()
    @ApiProperty({
        description: 'Whether the answer was correct'
    })
    isCorrect: boolean;
}

export class UpdateKanjiProgressDto {
    @IsNotEmpty()
    @IsArray()
    @ApiProperty({
        description: 'Array of kanji progress updates',
        type: [KanjiProgressItem]
    })
    progressUpdates: KanjiProgressItem[];
} 