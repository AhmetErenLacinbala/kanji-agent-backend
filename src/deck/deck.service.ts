import { Injectable } from '@nestjs/common';
import { CreateDeckDto } from './dto/create-deck.dto/create-deck.dto';
import { PrismaService } from 'src/prisma/prisma.service';

import Kuroshiro from "kuroshiro";
import * as KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji";
import * as kuromoji from "kuromoji";





@Injectable()
export class DeckService {
    kuroshiro: Kuroshiro;
    tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures>;
    constructor(private prisma: PrismaService) { }

    async onModuleInit() {
        this.kuroshiro = new Kuroshiro();
        await this.kuroshiro.init(new KuromojiAnalyzer());

        this.tokenizer = await new Promise((resolve, reject) => {
            kuromoji.builder({ dicPath: "node_modules/kuromoji/dict" }).build((err, tokenizer) => {
                if (err) return reject(err);
                resolve(tokenizer);
            });
        });

        console.log('kuroshiro and kuromoji initialized');
    }


    async convertToHiragana(text: string) {
        const tokens = this.tokenizer.tokenize(text);

        const tokenData = tokens.map(t => ({
            surface: t.surface_form,
            kana: this.katakanaToHiragana(t.reading) || t.surface_form,
            pos: t.pos
        }));

        return tokenData;
    }


    katakanaToHiragana(str: string): string {
        return str.replace(/[\u30a1-\u30f6]/g, ch =>
            String.fromCharCode(ch.charCodeAt(0) - 0x60)
        );
    }

    async createDeck(dto: CreateDeckDto, addRandomKanji: boolean = true, isAnonymous: boolean = true, userId?: string) {
        const createdDeck = await this.prisma.deck.create({
            data: {
                name: dto.name || "My Deck",
                isAuto: dto.isAuto ?? true,
                userId: userId || dto.userId,
                ownerId: userId || dto.ownerId,
                editbyUser: dto.editbyUser ?? true,
                isAnonymous: isAnonymous,
            }
        });

        if (addRandomKanji) {
            await this.addRandomKanjiToDeck(createdDeck.id, 5);
        }

        return this.getDeckById(createdDeck.id, isAnonymous, userId);
    }



    async addRandomKanjiToDeck(deckId: string, count: number = 5) {
        const existingDeckKanji = await this.prisma.deckKanji.findMany({
            where: { deckId },
            select: { kanjiId: true }
        });

        const existingKanjiIds = existingDeckKanji.map(dk => dk.kanjiId);
        let kanjiToAdd: any[] = [];
        let remainingCount = count;

        // Try each JLPT level: N5 (5) → N4 (4) → N3 (3) → N2 (2) → N1 (1)
        for (let jlptLevel = 5; jlptLevel >= 1 && remainingCount > 0; jlptLevel--) {
            const levelKanji = await this.prisma.kanji.findMany({
                where: { jlptLevel }
            });

            const selectedKanjiIds = kanjiToAdd.map(k => k.id);
            const availableKanji = levelKanji.filter(kanji =>
                !existingKanjiIds.includes(kanji.id) &&
                !selectedKanjiIds.includes(kanji.id)
            );

            if (availableKanji.length > 0) {
                const kanjiFromThisLevel = this.getRandomElements(
                    availableKanji,
                    Math.min(remainingCount, availableKanji.length)
                );

                kanjiToAdd.push(...kanjiFromThisLevel);
                remainingCount -= kanjiFromThisLevel.length;
            }
        }

        if (kanjiToAdd.length === 0) {
            return { message: 'No new kanji available to add to deck' };
        }

        const deckKanjiPromises = kanjiToAdd.map(kanji =>
            this.prisma.deckKanji.create({
                data: {
                    deckId,
                    kanjiId: kanji.id
                }
            })
        );

        await Promise.all(deckKanjiPromises);

        // Group by JLPT level for response
        const kanjiByLevel = kanjiToAdd.reduce((acc, kanji) => {
            const level = `N${kanji.jlptLevel}`;
            if (!acc[level]) acc[level] = [];
            acc[level].push({ id: kanji.id, kanji: kanji.kanji, meaning: kanji.meaning });
            return acc;
        }, {});

        return {
            message: `Added ${kanjiToAdd.length} kanji to deck`,
            totalAdded: kanjiToAdd.length,
            kanjiByLevel,
            addedKanji: kanjiToAdd.map(k => ({
                id: k.id,
                kanji: k.kanji,
                meaning: k.meaning,
                jlptLevel: k.jlptLevel
            }))
        };
    }

    private getRandomElements<T>(array: T[], count: number): T[] {
        const shuffled = [...array].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    async getDeckById(id: string, isAnonymous: boolean = false, userId?: string) {
        if (isAnonymous) {
            return this.prisma.deck.findUnique({
                where: {
                    id,
                    isAnonymous: true
                },
                include: {
                    kanjis: {
                        include: {
                            kanji: true
                        }
                    }
                }
            });
        }

        // For registered users, validate ownership
        const whereClause: any = { id };
        if (userId) {
            whereClause.OR = [
                { ownerId: userId },
                { userId: userId }
            ];
        }

        return this.prisma.deck.findUnique({
            where: whereClause,
            include: {
                kanjis: {
                    include: {
                        kanji: true
                    }
                }
            }
        });
    }

    async getDeckForFlashcards(id: string, isAnonymous = false, userId?: string) {
        let deck;

        if (isAnonymous) {
            deck = await this.prisma.deck.findUnique({
                where: { id, isAnonymous: true },
                include: {
                    kanjis: {
                        include: {
                            kanji: {
                                include: { exampleSentences: { take: 1 } }
                            }
                        }
                    }
                }
            });
        } else {
            const whereClause: any = { id };
            if (userId) {
                whereClause.OR = [
                    { ownerId: userId },
                    { userId: userId }
                ];
            }

            deck = await this.prisma.deck.findUnique({
                where: whereClause,
                include: {
                    kanjis: {
                        include: {
                            kanji: {
                                include: { exampleSentences: { take: 1 } }
                            }
                        }
                    }
                }
            });
        }

        for (const deckKanji of deck.kanjis) {
            const kanji = deckKanji.kanji;

            for (const sentence of kanji.exampleSentences) {
                if (!sentence.tokenized || sentence.tokenized.length === 0) {
                    const tokenized = await this.convertToHiragana(sentence.sentence);

                    await this.prisma.sentence.update({
                        where: { id: sentence.id },
                        data: { tokenized }
                    });

                    sentence.tokenized = tokenized;
                }
            }
        }

        return deck;
    }


    async getUsedDecks(userId: string) {
        const decks = await this.prisma.deck.findMany({
            where: { userId },
        })
        return decks;
    }


    async getOwnedDecks(ownerId: string) {
        const decks = await this.prisma.deck.findMany({
            where: { ownerId },
        })
        return decks;
    }
}
