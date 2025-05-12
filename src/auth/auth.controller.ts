// src/auth/auth.controller.ts
import { Body, Controller, Post } from '@nestjs/common'
import { RegisterDto } from './dto/register.dto'
import { AuthService } from './auth.service'
import { ApiBody } from '@nestjs/swagger'
import { LoginDto } from './dto/login.dto'

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('register')
    @ApiBody({ type: RegisterDto })
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto)
    }

    @Post('login')
    @ApiBody({ type: LoginDto })
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto)
    }
}
