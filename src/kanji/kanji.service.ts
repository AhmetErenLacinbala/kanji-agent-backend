import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateKanjiDto } from './dto/create-kanji.dto';
import { GetKanjiQueryDto } from './dto/get-kanji-query.dto';

@Injectable()
export class KanjiService {
    constructor(private prisma: PrismaService) { }

    async createKanji(dto: CreateKanjiDto) {
        const createdKanji = await this.prisma.kanji.create({
            data: {
                kanji: dto.kanji,
                meaning: dto.meaning,
                kana: dto.kana,
                kanjiPoint: dto.kanjiPoint,
                jlptLevel: dto.jlptLevel,

            },
        });

        return this.getKanjiById(createdKanji.id);
    }

    async getAllKanji() {
        return this.prisma.kanji.findMany({
            include: {
                exampleSentences: true,
            },
        });
    }

    async getKanjiById(id: string) {
        return this.prisma.kanji.findUnique({
            where: { id },
            include: {
                exampleSentences: true,
            },
        });
    }

    async getQuestionById(id: string) {
        const kanji = await this.prisma.kanji.findUnique({
            where: { id },
            include: {
                exampleSentences: {
                    orderBy: {
                        counter: 'desc'
                    }
                },
            },
        });

        if (!kanji) {
            throw new Error('Kanji question not found');
        }

        // Format for testing purposes
        return {
            id: kanji.id,
            kanji: kanji.kanji,
            meaning: kanji.meaning,
            kana: kanji.kana,
            jlptLevel: kanji.jlptLevel,
            kanjiPoint: kanji.kanjiPoint,
            exampleSentences: kanji.exampleSentences.map(sentence => ({
                id: sentence.id,
                sentence: sentence.sentence,
                meaning: sentence.meaning,
                kana: sentence.kana,
                tokenized: sentence.tokenized,
                counter: sentence.counter,
                usedKanjiForm: sentence.usedKanjiForm,
                whitelist: sentence.whitelist
            })),
            testInfo: {
                totalSentences: kanji.exampleSentences.length,
                hasValidSentences: kanji.exampleSentences.length > 0,
                sentenceCounters: kanji.exampleSentences.map(s => s.counter),
                createdAt: kanji.createdAt,
                updatedAt: kanji.updatedAt
            }
        };
    }
    async getByKanjiString(kanji: string) {
        return this.prisma.kanji.findMany({
            where: { kanji },
            include: { exampleSentences: true },
        });
    }

    async getKanjiByJlptLevel(jlptLevel: number) {
        return this.prisma.kanji.findMany({
            where: { jlptLevel },
            include: {
                exampleSentences: true
            },
        });
    }

    async getKanjiWithPagination(query: GetKanjiQueryDto) {
        const { from = 0, take = 10, jlptLevel, query: searchQuery } = query;

        let whereClause: any = {};

        // Add JLPT level filtering
        if (jlptLevel && jlptLevel.length > 0) {
            whereClause.jlptLevel = { in: jlptLevel };
        }

        // Add search functionality
        if (searchQuery && searchQuery.trim()) {
            const searchTerm = searchQuery.trim();
            whereClause.OR = [
                { kanji: { contains: searchTerm, mode: 'insensitive' } },
                { meaning: { contains: searchTerm, mode: 'insensitive' } },
                { kana: { has: searchTerm } }
            ];
        }

        const [kanji, total] = await Promise.all([
            this.prisma.kanji.findMany({
                where: whereClause,
                skip: from,
                take: take,
                include: {
                    exampleSentences: true,
                },
                orderBy: {
                    createdAt: 'desc'
                }
            }),
            this.prisma.kanji.count({
                where: whereClause,
            })
        ]);

        return {
            data: kanji,
            pagination: {
                from,
                take,
                total,
                hasMore: from + take < total
            }
        };
    }

    getTest(query: string) {
        return query;
    }
}
