import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator'

export class RegisterDto {
    @IsNotEmpty()
    @IsEmail()
    @ApiProperty()
    email: string

    @MinLength(6)
    @IsNotEmpty()
    @ApiProperty()
    password: string
}