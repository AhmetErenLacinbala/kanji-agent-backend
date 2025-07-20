import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class AddKanjiDto {
    @ApiProperty({
        description: 'Number of random kanji to add to the deck',
        minimum: 1,
        maximum: 50,
        default: 5,
        required: false
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'Count must be an integer' })
    @Min(1, { message: 'Count must be at least 1' })
    @Max(50, { message: 'Count cannot exceed 50 kanji at once' })
    count?: number = 5;
}
