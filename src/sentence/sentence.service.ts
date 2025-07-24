import { Injectable } from '@nestjs/common';
import { CreateSentenceDto } from './dto/create-sentence.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SentenceService {
    constructor(private prisma: PrismaService) { }
    async createSentence(dto: CreateSentenceDto): Promise<any> {
        const createdSentence = await this.prisma.sentence.create({
            data: {
                sentence: dto.sentence,
                meaning: dto.meaning,
                kana: dto.kana,
                whitelist: dto.whitelist || [],
                usedKanjiForm: dto.usedKanjiForm,
                kanji: {
                    connect: { id: dto.kanjiId },
                },
                tokenized: dto.tokenized.map(word => ({
                    surface: word.surface,
                    kana: word.kana,
                    pos: word.pos,
                })),
            }
        })
        return this.getSentenceById(createdSentence.id);
    }

    async getSentenceById(id: string): Promise<any> {
        return this.prisma.sentence.findUnique({
            where: { id },
            include: {
                kanji: true,
            },
        })
    }

    async getQuestionById(id: string): Promise<any> {
        const sentence = await this.prisma.sentence.findUnique({
            where: { id },
            include: {
                kanji: {
                    include: {
                        exampleSentences: {
                            take: 5 // Show other example sentences for context
                        }
                    }
                },
            },
        });

        if (!sentence) {
            throw new Error('Sentence question not found');
        }

        // Format for testing purposes with detailed breakdown
        return {
            id: sentence.id,
            sentence: sentence.sentence,
            meaning: sentence.meaning,
            kana: sentence.kana,
            tokenized: sentence.tokenized,
            counter: sentence.counter,
            usedKanjiForm: sentence.usedKanjiForm,
            whitelist: sentence.whitelist,
            createdAt: sentence.createdAt,
            kanji: {
                id: sentence.kanji.id,
                kanji: sentence.kanji.kanji,
                meaning: sentence.kanji.meaning,
                kana: sentence.kanji.kana,
                jlptLevel: sentence.kanji.jlptLevel,
                totalExampleSentences: sentence.kanji.exampleSentences.length
            },
            testInfo: {
                hasTokenization: sentence.tokenized && sentence.tokenized.length > 0,
                tokenCount: sentence.tokenized ? sentence.tokenized.length : 0,
                hasWhitelist: sentence.whitelist && sentence.whitelist.length > 0,
                whitelistCount: sentence.whitelist ? sentence.whitelist.length : 0,
                hasUsedKanjiForm: !!sentence.usedKanjiForm,
                usageCounter: sentence.counter,
                isValid: !!(sentence.sentence && sentence.meaning && sentence.kana),
                potentialIssues: this.checkSentenceIssues(sentence)
            }
        };
    }

    private checkSentenceIssues(sentence: any): string[] {
        const issues: string[] = [];

        if (!sentence.sentence || sentence.sentence.trim().length === 0) {
            issues.push('Missing Japanese sentence');
        }

        if (!sentence.meaning || sentence.meaning.trim().length === 0) {
            issues.push('Missing English meaning');
        }

        if (!sentence.kana || sentence.kana.trim().length === 0) {
            issues.push('Missing kana reading');
        }

        if (!sentence.tokenized || sentence.tokenized.length === 0) {
            issues.push('Missing tokenization data');
        }

        if (!sentence.usedKanjiForm) {
            issues.push('Missing used kanji form reference');
        }

        if (sentence.counter === 0 || sentence.counter < 0) {
            issues.push('Low or invalid usage counter');
        }

        return issues;
    }
}
