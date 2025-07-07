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
        const { from = 0, take = 10, jlptLevel } = query;

        const whereClause = jlptLevel && jlptLevel.length > 0
            ? { jlptLevel: { in: jlptLevel } }
            : {};

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
