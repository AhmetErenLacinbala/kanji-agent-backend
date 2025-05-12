// src/auth/auth.service.ts
import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common'
import { RegisterDto } from './dto/register.dto'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../prisma/prisma.service'
import { JwtService } from '@nestjs/jwt'
import { LoginDto } from './dto/login.dto'

@Injectable()
export class AuthService {
    constructor(private prisma: PrismaService, private jwtService: JwtService,) { }

    async register(dto: RegisterDto) {
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email },
        })
        if (existing) throw new ConflictException('Email already in use')

        const hashed = await bcrypt.hash(dto.password, 10)

        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                password: hashed,
            },
        })

        return { message: 'User created', userId: user.id }
    }

    async login(dto: LoginDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (!user || !(await bcrypt.compare(dto.password, user.password))) {
            throw new UnauthorizedException('Invalid credentials')
        }
        const payload = { sub: user.id, email: user.email }

        const token = this.jwtService.sign(payload)

        return {
            accessToken: token,
            userId: user.id,
            email: user.email,
        }
    }
}
