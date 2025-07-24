import { Body, Controller, Get, Param, Post, Query, UseGuards, Headers, UnauthorizedException, Patch } from '@nestjs/common';
import { ApiBody, ApiQuery, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { DeckService } from './deck.service';
import { CreateDeckDto } from './dto/create-deck.dto/create-deck.dto';
import { AddKanjiDto } from './dto/add-kanji.dto';
import { UpdateKanjiProgressDto } from './dto/update-kanji-progress.dto';
import { StudyCompleteDto } from './dto/study-complete.dto';
import { DeckOwnershipGuard } from './guards/deck-ownership.guard';
import { JwtService } from '@nestjs/jwt';

@ApiTags('Deck')
@Controller('deck')
export class DeckController {
    constructor(
        private readonly deckService: DeckService,
        private readonly jwtService: JwtService
    ) { }

    private getUserIdFromToken(authHeader: string): string {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Authentication token required')
        }

        try {
            const token = authHeader.split(' ')[1]
            const decoded = this.jwtService.verify(token)
            return decoded.sub || decoded.userId
        } catch (error) {
            throw new UnauthorizedException('Invalid or expired token')
        }
    }

    @Post()
    @ApiBearerAuth()
    @ApiBody({ type: CreateDeckDto })
    @ApiQuery({
        name: 'addRandomKanji',
        required: false,
        type: Boolean,
        description: 'Add 5 random kanji to deck - cascades through N5→N4→N3→N2→N1 (default: true)'
    })
    async createDeck(
        @Headers('authorization') authHeader: string,
        @Body() dto: CreateDeckDto,
        @Query('addRandomKanji') addRandomKanji?: string
    ) {
        const userId = this.getUserIdFromToken(authHeader);
        const shouldAddKanji = addRandomKanji === undefined ||
            addRandomKanji === '' ||
            addRandomKanji.toLowerCase() === 'true';

        return this.deckService.createDeck(dto, shouldAddKanji, userId);
    }

    @Get(':id')
    @ApiBearerAuth()
    getDeckById(
        @Headers('authorization') authHeader: string,
        @Param('id') id: string
    ) {
        const userId = this.getUserIdFromToken(authHeader);
        return this.deckService.getDeckById(id, userId);
    }

    @Get(':id/flashcards')
    @ApiBearerAuth()
    async getDeckForFlashcards(
        @Headers('authorization') authHeader: string,
        @Param('id') id: string
    ) {
        const userId = this.getUserIdFromToken(authHeader);
        return this.deckService.getFlashcardsForReview(id, userId);
    }

    @Post(':id/add-random-kanji')
    @UseGuards(DeckOwnershipGuard)
    @Throttle({ default: { limit: 5, ttl: 300000 } }) // 5 requests per 5 minutes for adding kanji
    @ApiBearerAuth()
    @ApiBody({ type: AddKanjiDto })
    async addRandomKanjiToDeck(
        @Headers('authorization') authHeader: string,
        @Param('id') deckId: string,
        @Body() dto: AddKanjiDto
    ) {
        const userId = this.getUserIdFromToken(authHeader);
        return this.deckService.addRandomKanjiToDeck(deckId, dto.count || 5, userId);
    }

    @Post(':id/update-progress')
    @UseGuards(DeckOwnershipGuard)
    @Throttle({ default: { limit: 20, ttl: 300000 } }) // 20 progress updates per 5 minutes
    @ApiBearerAuth()
    @ApiBody({ type: UpdateKanjiProgressDto })
    async updateKanjiProgress(
        @Headers('authorization') authHeader: string,
        @Param('id') deckId: string,
        @Body() dto: UpdateKanjiProgressDto
    ) {
        const userId = this.getUserIdFromToken(authHeader);
        return this.deckService.updateKanjiProgress(deckId, userId, dto);
    }

    @Get(':id/review')
    @ApiBearerAuth()
    @ApiQuery({
        name: 'deckId',
        required: false,
        type: String,
        description: 'Optional deck ID to filter kanji for review'
    })
    async getKanjiForReview(
        @Headers('authorization') authHeader: string,
        @Param('id') deckId: string
    ) {
        const userId = this.getUserIdFromToken(authHeader);
        return this.deckService.getKanjiForReview(userId, deckId);
    }

    @Get('user/review')
    @ApiBearerAuth()
    async getAllKanjiForReview(
        @Headers('authorization') authHeader: string
    ) {
        const userId = this.getUserIdFromToken(authHeader);
        return this.deckService.getKanjiForReview(userId);
    }

    @Get(':id/mastered')
    @ApiBearerAuth()
    async getMasteredKanji(
        @Headers('authorization') authHeader: string,
        @Param('id') deckId: string
    ) {
        const userId = this.getUserIdFromToken(authHeader);
        return this.deckService.getMasteredKanji(userId, deckId);
    }

    @Get('user/mastered')
    @ApiBearerAuth()
    async getAllMasteredKanji(
        @Headers('authorization') authHeader: string
    ) {
        const userId = this.getUserIdFromToken(authHeader);
        return this.deckService.getMasteredKanji(userId);
    }

    @Get('user/decks')
    @ApiBearerAuth()
    async getUserDecks(
        @Headers('authorization') authHeader: string
    ) {
        const userId = this.getUserIdFromToken(authHeader);
        return this.deckService.getUsedDecks(userId);
    }

    @Post(':id/study-complete')
    @UseGuards(DeckOwnershipGuard)
    @Throttle({ default: { limit: 10, ttl: 300000 } }) // 10 study sessions per 5 minutes
    @ApiBearerAuth()
    @ApiBody({ type: StudyCompleteDto })
    async completeStudySession(
        @Headers('authorization') authHeader: string,
        @Param('id') deckId: string,
        @Body() dto: StudyCompleteDto
    ) {
        const userId = this.getUserIdFromToken(authHeader);
        return this.deckService.completeStudySession(deckId, userId, dto);
    }

    // ==== TESTING ENDPOINTS (Development only) ====

    @Get('testing/info')
    async getTestingInfo() {

        if (process.env.NODE_ENV === 'production' && process.env.SPACED_REPETITION_DEV_MODE !== 'true') {
            throw new UnauthorizedException('Testing endpoints only available in development mode');
        }
        return this.deckService.getTestingInfo();
    }

    @Patch('testing/kanji/:kanjiId/reset')
    @ApiBearerAuth()
    async resetKanjiProgress(
        @Headers('authorization') authHeader: string,
        @Param('kanjiId') kanjiId: string
    ) {
        if (process.env.NODE_ENV === 'production' && process.env.SPACED_REPETITION_DEV_MODE !== 'true') {
            throw new UnauthorizedException('Testing endpoints only available in development mode');
        }
        const userId = this.getUserIdFromToken(authHeader);
        return this.deckService.resetKanjiProgress(userId, kanjiId);
    }

    @Patch('testing/kanji/:kanjiId/schedule')
    @ApiBearerAuth()
    @ApiQuery({
        name: 'minutes',
        required: false,
        type: Number,
        description: 'Minutes from now to schedule review (default: 0 for immediate)'
    })
    async setKanjiReviewTime(
        @Headers('authorization') authHeader: string,
        @Param('kanjiId') kanjiId: string,
        @Query('minutes') minutes?: string
    ) {
        if (process.env.NODE_ENV === 'production' && process.env.SPACED_REPETITION_DEV_MODE !== 'true') {
            throw new UnauthorizedException('Testing endpoints only available in development mode');
        }
        const userId = this.getUserIdFromToken(authHeader);
        const minutesFromNow = minutes ? parseInt(minutes) : 0;
        return this.deckService.setKanjiReviewTime(userId, kanjiId, minutesFromNow);
    }

    @Patch('testing/deck/:deckId/schedule-all')
    @ApiBearerAuth()
    async setAllKanjiForImmediateReview(
        @Headers('authorization') authHeader: string,
        @Param('deckId') deckId: string
    ) {
        if (process.env.NODE_ENV === 'production' && process.env.SPACED_REPETITION_DEV_MODE !== 'true') {
            throw new UnauthorizedException('Testing endpoints only available in development mode');
        }
        const userId = this.getUserIdFromToken(authHeader);
        return this.deckService.setAllKanjiForImmediateReview(userId, deckId);
    }

    @Patch('testing/kanji/:kanjiId/simulate')
    @ApiBearerAuth()
    @ApiQuery({
        name: 'correctAnswers',
        required: true,
        type: Number,
        description: 'Number of consecutive correct answers to simulate (0-11)'
    })
    async simulateKanjiProgression(
        @Headers('authorization') authHeader: string,
        @Param('kanjiId') kanjiId: string,
        @Query('correctAnswers') correctAnswers: string
    ) {
        if (process.env.NODE_ENV === 'production' && process.env.SPACED_REPETITION_DEV_MODE !== 'true') {
            throw new UnauthorizedException('Testing endpoints only available in development mode');
        }
        const userId = this.getUserIdFromToken(authHeader);
        const answers = parseInt(correctAnswers);
        if (answers < 0 || answers > 11) {
            throw new UnauthorizedException('correctAnswers must be between 0 and 11');
        }
        return this.deckService.simulateKanjiProgression(userId, kanjiId, answers);
    }

    @Get('testing/deck/:deckId/diagnostics')
    @ApiBearerAuth()
    async getDeckDiagnostics(
        @Headers('authorization') authHeader: string,
        @Param('deckId') deckId: string
    ) {
        if (process.env.NODE_ENV === 'production' && process.env.SPACED_REPETITION_DEV_MODE !== 'true') {
            throw new UnauthorizedException('Testing endpoints only available in development mode');
        }
        const userId = this.getUserIdFromToken(authHeader);
        return this.deckService.getDeckDiagnostics(deckId, userId);
    }

    @Post('testing/deck/:deckId/ensure-progress')
    @ApiBearerAuth()
    async ensureProgressRecords(
        @Headers('authorization') authHeader: string,
        @Param('deckId') deckId: string
    ) {
        if (process.env.NODE_ENV === 'production' && process.env.SPACED_REPETITION_DEV_MODE !== 'true') {
            throw new UnauthorizedException('Testing endpoints only available in development mode');
        }
        const userId = this.getUserIdFromToken(authHeader);
        return this.deckService.ensureProgressRecords(deckId, userId);
    }
}
