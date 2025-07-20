// src/auth/auth.service.ts
import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common'
import { RegisterDto } from './dto/register.dto'
import { GuestLoginDto } from './dto/guest-login.dto'

import * as bcrypt from 'bcrypt'
import { PrismaService } from '../prisma/prisma.service'
import { JwtService } from '@nestjs/jwt'
import { LoginDto } from './dto/login.dto'

@Injectable()
export class AuthService {
    constructor(private prisma: PrismaService, private jwtService: JwtService,) { }

    async register(dto: RegisterDto, authHeader?: string) {
        // Check if user is providing a guest token to convert
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.split(' ')[1]
                const decoded = this.jwtService.verify(token)
                const guestUser = await this.prisma.user.findUnique({
                    where: { id: decoded.sub },
                })

                if (guestUser && guestUser.isGuest) {
                    // Convert guest user to registered user
                    const existingEmail = await this.prisma.user.findUnique({
                        where: { email: dto.email },
                    })

                    if (existingEmail && existingEmail.id !== guestUser.id) {
                        throw new ConflictException('Email already in use by another account')
                    }

                    const existingUsername = await this.prisma.user.findUnique({
                        where: { username: dto.username },
                    })

                    if (existingUsername && existingUsername.id !== guestUser.id) {
                        throw new ConflictException('Username already in use by another account')
                    }

                    const hashedPassword = await bcrypt.hash(dto.password, 10)

                    const updatedUser = await this.prisma.user.update({
                        where: { id: guestUser.id },
                        data: {
                            email: dto.email,
                            username: dto.username,
                            password: hashedPassword,
                            isGuest: false,
                        },
                    })

                    const payload = { sub: updatedUser.id, email: updatedUser.email, isGuest: false }
                    const newToken = this.jwtService.sign(payload)

                    return {
                        accessToken: newToken,
                        userId: updatedUser.id,
                        email: updatedUser.email,
                        isGuest: false,
                        message: 'Guest account successfully converted to registered account! All your data is preserved.',
                    }
                }
            } catch (error) {
                // If token is invalid, treat as new registration
                console.log('Invalid guest token provided, creating new user')
            }
        }

        // Regular new user registration
        const existingEmail = await this.prisma.user.findUnique({
            where: { email: dto.email },
        })
        if (existingEmail) throw new ConflictException('Email already in use')

        const existingUsername = await this.prisma.user.findUnique({
            where: { username: dto.username },
        })
        if (existingUsername) throw new ConflictException('Username already in use')

        const hashed = await bcrypt.hash(dto.password, 10)

        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                username: dto.username,
                password: hashed,
                isGuest: false,
            },
        })

        const payload = { sub: user.id, email: user.email, username: user.username, isGuest: false }
        const token = this.jwtService.sign(payload)

        return {
            accessToken: token,
            userId: user.id,
            email: user.email,
            username: user.username,
            isGuest: false,
            message: 'User created successfully'
        }
    }

    async login(dto: LoginDto) {
        // Check if identifier is an email (contains @) or username
        const isEmail = dto.identifier.includes('@');

        const user = await this.prisma.user.findFirst({
            where: isEmail
                ? { email: dto.identifier }
                : { username: dto.identifier }
        });

        if (!user || !(await bcrypt.compare(dto.password, user.password))) {
            throw new UnauthorizedException('Invalid credentials')
        }

        const payload = {
            sub: user.id,
            email: user.email,
            username: user.username,
            isGuest: user.isGuest
        }

        const token = this.jwtService.sign(payload)

        return {
            accessToken: token,
            userId: user.id,
            email: user.email,
            username: user.username,
            isGuest: user.isGuest,
        }
    }

    async createGuest(dto: GuestLoginDto) {
        // Create a guest user with no email/password
        const guestUser = await this.prisma.user.create({
            data: {
                email: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@temp.local`,
                password: '', // No password for guests
                isGuest: true,
            },
        })

        const payload = {
            sub: guestUser.id,
            email: guestUser.email,
            isGuest: true,
            deviceId: dto.deviceId
        }

        const token = this.jwtService.sign(payload, { expiresIn: '30d' }) // Longer expiry for guests

        return {
            accessToken: token,
            userId: guestUser.id,
            email: guestUser.email,
            isGuest: true,
            message: 'Guest user created successfully. You can upgrade to a full account anytime.',
        }
    }



    async verifyToken(token: string) {
        try {
            const decoded = this.jwtService.verify(token)
            const user = await this.prisma.user.findUnique({
                where: { id: decoded.sub },
                select: { id: true, email: true, isGuest: true }
            })
            return user
        } catch (error) {
            throw new UnauthorizedException('Invalid or expired token')
        }
    }
}
