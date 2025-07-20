// src/auth/auth.controller.ts
import { Body, Controller, Post, Headers, UnauthorizedException } from '@nestjs/common'
import { RegisterDto } from './dto/register.dto'
import { GuestLoginDto } from './dto/guest-login.dto'

import { AuthService } from './auth.service'
import { ApiBody, ApiBearerAuth } from '@nestjs/swagger'
import { LoginDto } from './dto/login.dto'

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('register')
    @ApiBody({ type: RegisterDto })
    register(
        @Body() dto: RegisterDto,
        @Headers('authorization') authHeader?: string
    ) {
        return this.authService.register(dto, authHeader)
    }

    @Post('login')
    @ApiBody({ type: LoginDto })
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto)
    }

    @Post('guest')
    @ApiBody({ type: GuestLoginDto })
    createGuest(@Body() dto: GuestLoginDto) {
        return this.authService.createGuest(dto)
    }


}
