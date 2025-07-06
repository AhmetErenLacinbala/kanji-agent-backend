import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateKanjiDto } from './dto/create-kanji.dto';

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
                whitelist: dto.whitelist || [],
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
                exampleSentences: {
                    where: {
                        whitelist: {
                            isEmpty: false
                        }
                    }
                }
            },
        });
    }

    getTest(query: string) {
        return query;
    }
}
