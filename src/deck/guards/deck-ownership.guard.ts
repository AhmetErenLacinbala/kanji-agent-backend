import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    BadRequestException,
    UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class DeckOwnershipGuard implements CanActivate {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const deckId = request.params.id;
        const authHeader = request.headers.authorization;

        if (!deckId) {
            throw new BadRequestException('Deck ID is required');
        }

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Authentication token required');
        }

        const token = authHeader.split(' ')[1];
        let userId: string;

        try {
            const decoded = this.jwtService.verify(token);
            userId = decoded.sub || decoded.userId;
        } catch (error) {
            throw new UnauthorizedException('Invalid or expired token');
        }

        // Check if deck exists and user has access
        const deck = await this.prisma.deck.findUnique({
            where: { id: deckId },
            select: {
                id: true,
                userId: true,
                ownerId: true,
                isAnonymous: true
            }
        });

        if (!deck) {
            throw new ForbiddenException('Deck not found');
        }

        // Check if user owns or has access to the deck
        const hasAccess = deck.ownerId === userId || deck.userId === userId;

        if (!hasAccess) {
            throw new ForbiddenException('You do not have permission to modify this deck');
        }

        // Attach userId to request for use in controller
        request.userId = userId;
        return true;
    }
} 