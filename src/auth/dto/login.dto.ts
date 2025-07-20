import { ApiProperty } from "@nestjs/swagger"
import { IsNotEmpty } from 'class-validator'

export class LoginDto {
    @IsNotEmpty()
    @ApiProperty({
        description: 'Username or email address',
        example: 'ahmeteren or ahmeteren@example.com'
    })
    identifier: string

    @IsNotEmpty()
    @ApiProperty()
    password: string
}

export class GuestLoginDto {
    @ApiProperty()
    guestId: string
}
