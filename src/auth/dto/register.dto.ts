import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsNotEmpty, MinLength, IsString, Matches } from 'class-validator'

export class RegisterDto {
    @IsNotEmpty()
    @IsEmail()
    @ApiProperty()
    email: string

    @IsNotEmpty()
    @IsString()
    @MinLength(3, { message: 'Username must be at least 3 characters long' })
    @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain letters, numbers, and underscores' })
    @ApiProperty()
    username: string

    @MinLength(6)
    @IsNotEmpty()
    @ApiProperty()
    password: string
}