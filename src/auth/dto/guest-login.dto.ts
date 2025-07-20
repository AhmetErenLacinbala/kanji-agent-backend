import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GuestLoginDto {
    @ApiProperty({
        description: 'Optional device identifier for guest user (for analytics)',
        required: false
    })
    @IsOptional()
    @IsString()
    deviceId?: string;
} 