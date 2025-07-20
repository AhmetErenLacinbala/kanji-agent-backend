import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class UpgradeGuestDto {
    @IsNotEmpty()
    @IsEmail()
    @ApiProperty({
        description: 'Email address for the new account'
    })
    email: string;

    @MinLength(6)
    @IsNotEmpty()
    @ApiProperty({
        description: 'Password for the new account (minimum 6 characters)'
    })
    password: string;
} 