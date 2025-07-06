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
                whitelist: dto.whitelist,
                usedKanjiForm: dto.usedKanjiForm,
                kanji: {
                    connect: { id: dto.kanjiId },
                },
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
}
