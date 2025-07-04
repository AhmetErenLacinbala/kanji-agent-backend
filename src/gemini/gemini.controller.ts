import { Controller, Get, Query, BadRequestException, InternalServerErrorException, Post, Body } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { ApiOperation, ApiQuery, ApiTags, ApiBody, ApiResponse } from '@nestjs/swagger';

class GenerateTextDto {
    prompt: string;
}

class KanjiExplanationDto {
    kanji: string;
}

class SentenceExplanationDto {
    sentence: string;
}

class FilterDistractorsDto {
    sentence: string;          // Sentence with blank: "The sunset is ____ in color"
    correctAnswer: string;     // The correct word: "beautiful"
    distractors: string[];     // Potential wrong options: ["red", "orange", "ugly", "green"]
    language?: string;         // Optional: language context (default: English)
}

@ApiTags('Gemini AI')
@Controller('gemini')
export class GeminiController {
    constructor(private readonly geminiService: GeminiService) { }

    @Get('generate')
    @ApiOperation({ summary: 'Generate text from Gemini AI model' })
    @ApiQuery({ name: 'prompt', required: true, description: 'Text prompt to send to Gemini' })
    @ApiResponse({ status: 200, description: 'Text generated successfully' })
    @ApiResponse({ status: 400, description: 'Invalid prompt' })
    @ApiResponse({ status: 500, description: 'Internal server error' })
    async generate(@Query('prompt') prompt: string) {
        if (!prompt || prompt.trim().length === 0) {
            throw new BadRequestException('Prompt is required and cannot be empty');
        }

        if (prompt.length > 5000) {
            throw new BadRequestException('Prompt is too long (max 5000 characters)');
        }

        try {
            const result = await this.geminiService.generateText(prompt);
            return {
                success: true,
                result,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            throw new InternalServerErrorException(error.message);
        }
    }

    @Post('kanji/explain')
    @ApiOperation({ summary: 'Get detailed explanation of a kanji character' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                kanji: { type: 'string', description: 'Single kanji character to explain' }
            },
            required: ['kanji']
        }
    })
    @ApiResponse({ status: 200, description: 'Kanji explanation generated successfully' })
    @ApiResponse({ status: 400, description: 'Invalid kanji input' })
    async explainKanji(@Body() body: KanjiExplanationDto) {
        const { kanji } = body;

        if (!kanji || kanji.trim().length === 0) {
            throw new BadRequestException('Kanji is required');
        }

        if (kanji.length !== 1) {
            throw new BadRequestException('Please provide a single kanji character');
        }

        try {
            const explanation = await this.geminiService.generateKanjiExplanation(kanji);
            return {
                success: true,
                kanji,
                explanation,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            throw new InternalServerErrorException(error.message);
        }
    }

    @Post('sentence/explain')
    @ApiOperation({ summary: 'Get detailed analysis of a Japanese sentence' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                sentence: { type: 'string', description: 'Japanese sentence to analyze' }
            },
            required: ['sentence']
        }
    })
    @ApiResponse({ status: 200, description: 'Sentence analysis generated successfully' })
    @ApiResponse({ status: 400, description: 'Invalid sentence input' })
    async explainSentence(@Body() body: SentenceExplanationDto) {
        const { sentence } = body;

        if (!sentence || sentence.trim().length === 0) {
            throw new BadRequestException('Sentence is required');
        }

        if (sentence.length > 1000) {
            throw new BadRequestException('Sentence is too long (max 1000 characters)');
        }

        try {
            const analysis = await this.geminiService.generateSentenceExplanation(sentence);
            return {
                success: true,
                sentence,
                analysis,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            throw new InternalServerErrorException(error.message);
        }
    }

    @Post('vocabulary/filter-distractors')
    @ApiOperation({
        summary: 'Filter vocabulary distractors that are too similar to the correct answer',
        description: 'Analyzes a sentence context and filters out distractors that are semantically too close to the correct answer, ensuring only one clearly correct option remains.'
    })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                sentence: {
                    type: 'string',
                    description: 'Sentence with blank (use ____ for the missing word)',
                    example: 'The sunset is ____ in color'
                },
                correctAnswer: {
                    type: 'string',
                    description: 'The correct word that fits in the blank',
                    example: 'beautiful'
                },
                distractors: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of potential wrong options to filter',
                    example: ['red', 'orange', 'ugly', 'green', 'bright']
                },
                language: {
                    type: 'string',
                    description: 'Language context (optional, defaults to English)',
                    example: 'English'
                }
            },
            required: ['sentence', 'correctAnswer', 'distractors']
        }
    })
    @ApiResponse({
        status: 200,
        description: 'Distractors filtered successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                sentence: { type: 'string' },
                correctAnswer: { type: 'string' },
                filteredDistractors: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Distractors that are clearly wrong and not semantically similar'
                },
                removedDistractors: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Distractors that were removed for being too similar'
                },
                reasoning: { type: 'string', description: 'Explanation of the filtering decisions' },
                timestamp: { type: 'string' }
            }
        }
    })
    @ApiResponse({ status: 400, description: 'Invalid input data' })
    async filterDistractors(@Body() body: FilterDistractorsDto) {
        const { sentence, correctAnswer, distractors, language } = body;

        // Validation
        if (!sentence || sentence.trim().length === 0) {
            throw new BadRequestException('Sentence is required');
        }

        if (!sentence.includes('____')) {
            throw new BadRequestException('Sentence must contain ____ to indicate the blank');
        }

        if (!correctAnswer || correctAnswer.trim().length === 0) {
            throw new BadRequestException('Correct answer is required');
        }

        if (!distractors || !Array.isArray(distractors) || distractors.length === 0) {
            throw new BadRequestException('Distractors array is required and must not be empty');
        }

        if (distractors.length > 20) {
            throw new BadRequestException('Too many distractors (max 20)');
        }

        // Check for duplicates
        const uniqueDistractors = [...new Set(distractors.filter(d => d && d.trim().length > 0))];
        if (uniqueDistractors.length !== distractors.length) {
            throw new BadRequestException('Distractors must be unique and non-empty');
        }

        try {
            const result = await this.geminiService.filterVocabularyDistractors(
                sentence.trim(),
                correctAnswer.trim(),
                uniqueDistractors,
                language || 'English'
            );

            return {
                success: true,
                sentence: sentence.trim(),
                correctAnswer: correctAnswer.trim(),
                ...result,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            throw new InternalServerErrorException(error.message);
        }
    }
}
