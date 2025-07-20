import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsArray, IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { KanjiProgressItem } from './update-kanji-progress.dto';

export class StudyCompleteDto {
    @IsNotEmpty()
    @IsArray()
    @ApiProperty({
        description: 'Array of kanji progress updates from the study session',
        type: [KanjiProgressItem]
    })
    progressUpdates: KanjiProgressItem[];

    @IsOptional()
    @IsBoolean()
    @ApiProperty({
        description: 'Whether to add new kanji to the deck',
        default: false,
        required: false
    })
    addNewKanji?: boolean = false;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(20)
    @ApiProperty({
        description: 'Number of new kanji to add (if addNewKanji is true)',
        minimum: 1,
        maximum: 20,
        default: 5,
        required: false
    })
    newKanjiCount?: number = 5;

    @IsOptional()
    @IsBoolean()
    @ApiProperty({
        description: 'Automatically determine whether to add new kanji based on user progress',
        default: true,
        required: false
    })
    autoAddBasedOnProgress?: boolean = true;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(50)
    @ApiProperty({
        description: 'Minimum interval (days) required to consider a kanji "mastered" for auto-add logic',
        default: 7,
        required: false
    })
    masteryThresholdDays?: number = 7;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(50)
    @ApiProperty({
        description: 'Minimum number of mastered kanji required before auto-adding new ones',
        default: 5,
        required: false
    })
    masteryCountThreshold?: number = 5;
} 