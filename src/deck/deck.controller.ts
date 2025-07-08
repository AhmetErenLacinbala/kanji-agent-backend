import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DeckService } from './deck.service';
import { CreateDeckDto } from './dto/create-deck.dto/create-deck.dto';

@ApiTags('Deck')
@Controller('deck')
export class DeckController {
    constructor(private readonly deckService: DeckService) { }

    @Post()
    @ApiBody({ type: CreateDeckDto })
    @ApiQuery({
        name: 'addRandomKanji',
        required: false,
        type: Boolean,
        description: 'Add 5 random kanji to deck - cascades through N5→N4→N3→N2→N1 (default: true)'
    })
    @ApiQuery({
        name: 'isAnonymous',
        required: false,
        type: Boolean,
        description: 'cookie stored deck'
    })
    @ApiQuery({
        name: 'userId',
        required: false,
        type: String,
        description: 'user id'
    })
    async createDeck(
        @Body() dto: CreateDeckDto,
        @Query('addRandomKanji') addRandomKanji?: string,
        @Query('isAnonymous') isAnonymous?: string,
        @Query('userId') userId?: string
    ) {
        const shouldAddKanji = addRandomKanji === undefined ||
            addRandomKanji === '' ||
            addRandomKanji.toLowerCase() === 'true';

        return this.deckService.createDeck(dto, shouldAddKanji, isAnonymous === 'true', userId);
    }

    @Get(':id')
    @ApiQuery({
        name: 'isAnonymous',
        required: false,
        type: Boolean,
        description: 'Is this an anonymous deck stored in cookies'
    })
    @ApiQuery({
        name: 'userId',
        required: false,
        type: String,
        description: 'User ID for registered user decks'
    })
    getDeckById(
        @Param('id') id: string,
        @Query('isAnonymous') isAnonymous?: string,
        @Query('userId') userId?: string
    ) {
        return this.deckService.getDeckById(id, isAnonymous === 'true', userId);
    }

    @Get(':id/flashcards')
    @ApiQuery({
        name: 'isAnonymous',
        required: false,
        type: Boolean,
        description: 'Is this an anonymous deck stored in cookies'
    })
    @ApiQuery({
        name: 'userId',
        required: false,
        type: String,
        description: 'User ID for registered user decks'
    })
    getDeckForFlashcards(
        @Param('id') id: string,
        @Query('isAnonymous') isAnonymous?: string,
        @Query('userId') userId?: string
    ) {
        return this.deckService.getDeckForFlashcards(id, isAnonymous === 'true', userId);
    }

    @Post(':id/add-random-kanji')
    @ApiQuery({
        name: 'count',
        required: false,
        type: Number,
        description: 'Number of random kanji to add (cascades through N5→N4→N3→N2→N1)'
    })
    async addRandomKanjiToDeck(
        @Param('id') deckId: string,
        @Query('count') count?: string
    ) {
        const kanjiCount = count ? parseInt(count, 10) : 5;
        return this.deckService.addRandomKanjiToDeck(deckId, kanjiCount);
    }
}
