import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsInt, Min, IsArray } from 'class-validator';

export class GetKanjiQueryDto {
    @ApiPropertyOptional({
        example: 0,
        description: 'Starting index for pagination (skip)',
        minimum: 0
    })
    @IsOptional()
    @Transform(({ value }) => {
        if (value === undefined || value === null) return 0;
        return parseInt(value, 10);
    })
    @IsInt()
    @Min(0)
    from?: number = 0;

    @ApiPropertyOptional({
        example: 10,
        description: 'Number of items to take',
        minimum: 1
    })
    @IsOptional()
    @Transform(({ value }) => {
        if (value === undefined || value === null) return 10;
        return parseInt(value, 10);
    })
    @IsInt()
    @Min(1)
    take?: number = 10;

    @ApiPropertyOptional({
        example: [5, 4, 3],
        description: 'JLPT levels to filter by (1-5, where 5=N5, 4=N4, etc.). Can be single value or array',
        type: [Number]
    })
    @IsOptional()
    @Transform(({ value }) => {
        if (value === undefined || value === null) return undefined;

        // Handle single value
        if (!Array.isArray(value)) {
            const parsed = parseInt(value, 10);
            return isNaN(parsed) ? undefined : [parsed];
        }

        // Handle array of values
        const parsed = value.map(v => parseInt(v, 10)).filter(v => !isNaN(v));
        return parsed.length > 0 ? parsed : undefined;
    })
    @IsArray()
    jlptLevel?: number[];
} 