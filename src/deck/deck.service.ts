import { Injectable } from '@nestjs/common';
import { CreateDeckDto } from './dto/create-deck.dto/create-deck.dto';
import { UpdateKanjiProgressDto, KanjiProgressItem } from './dto/update-kanji-progress.dto';
import { StudyCompleteDto } from './dto/study-complete.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DeckService {
    constructor(private prisma: PrismaService) { }

    // Development mode for testing - converts days to minutes
    private readonly DEV_MODE = process.env.NODE_ENV === 'development' || process.env.SPACED_REPETITION_DEV_MODE === 'true';
    private readonly DEV_TIME_MULTIPLIER = parseInt(process.env.DEV_TIME_MULTIPLIER || '60');


    private getTimeMultiplier(): number {
        return this.DEV_MODE ? this.DEV_TIME_MULTIPLIER : 24 * 60;
    }


    private calculateNextReviewDate(intervalInDays: number): Date {
        const now = new Date();
        const multiplier = this.getTimeMultiplier();
        return new Date(now.getTime() + intervalInDays * multiplier * 60 * 1000);
    }

    async createDeck(dto: CreateDeckDto, addRandomKanji: boolean = true, userId: string) {
        const createdDeck = await this.prisma.deck.create({
            data: {
                name: dto.name || "My Deck",
                isAuto: dto.isAuto ?? true,
                userId: userId,
                ownerId: userId,
                editbyUser: dto.editbyUser ?? true,
                isAnonymous: false,
            }
        });

        if (addRandomKanji) {
            await this.addRandomKanjiToDeck(createdDeck.id, 10, userId); // Increased from 3 to 10
        }

        return this.getDeckById(createdDeck.id, userId);
    }



    async addRandomKanjiToDeck(deckId: string, count: number = 10, userId?: string) {

        if (count < 0 || count > 50) {
            throw new Error('Count must be between 1 and 50');
        }

        const existingDeckKanji = await this.prisma.deckKanji.findMany({
            where: { deckId },
            select: { kanjiId: true }
        });

        const currentDeckSize = existingDeckKanji.length;
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
            return {
                success: false,
                currentSize: currentDeckSize
            };
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


        if (userId) {
            const now = new Date();
            const initialInterval = 1;
            const nextReviewAt = now;

            const progressPromises = kanjiToAdd.map(async (kanji) => {
                // Check if progress record already exists
                const existingProgress = await this.prisma.userKanjiProgress.findFirst({
                    where: {
                        userId,
                        kanjiId: kanji.id
                    }
                });

                // Only create if doesn't exist
                if (!existingProgress) {
                    return this.prisma.userKanjiProgress.create({
                        data: {
                            userId,
                            kanjiId: kanji.id,
                            interval: initialInterval,
                            nextReviewAt,
                            lastReviewedAt: now,
                            consecutiveCorrect: 0,
                            wrongCount: 0,
                            rightCount: 0,
                        }
                    });
                }
                return existingProgress;
            });

            await Promise.all(progressPromises);
        }


        const kanjiByLevel = kanjiToAdd.reduce((acc, kanji) => {
            const level = `N${kanji.jlptLevel}`;
            if (!acc[level]) acc[level] = [];
            acc[level].push({ id: kanji.id, kanji: kanji.kanji, meaning: kanji.meaning });
            return acc;
        }, {});

        return {
            success: true,
            totalAdded: kanjiToAdd.length,
            previousSize: currentDeckSize,
            newSize: currentDeckSize + kanjiToAdd.length,
            kanjiByLevel,
            addedKanji: kanjiToAdd.map(k => ({
                id: k.id,
                kanji: k.kanji,
                meaning: k.meaning,
                jlptLevel: k.jlptLevel
            })),
            progressInitialized: !!userId
        };
    }

    private getRandomElements<T>(array: T[], count: number): T[] {
        const shuffled = [...array].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    async getDeckById(id: string, userId?: string) {
        // Build where clause to check ownership
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

    async getDeckForFlashcards(id: string, userId?: string) {
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
                        kanji: {
                            include: {
                                exampleSentences: {
                                    take: 1
                                }
                            }
                        }
                    }
                }
            }
        });
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

    async updateKanjiProgress(deckId: string, userId: string, dto: UpdateKanjiProgressDto) {
        // Spaced repetition lookup table (days)
        const lookupTable = [1, 1, 2, 4, 7, 14, 30, 60, 90, 180, 365];

        const results: any[] = [];

        for (const progressUpdate of dto.progressUpdates) {
            const { kanjiId, isCorrect } = progressUpdate;

            let userProgress = await this.prisma.userKanjiProgress.findFirst({
                where: {
                    userId,
                    kanjiId,
                }
            });

            const now = new Date();

            if (!userProgress) {
                const initialInterval = lookupTable[0];
                const nextReviewAt = now;

                userProgress = await this.prisma.userKanjiProgress.create({
                    data: {
                        userId,
                        kanjiId,
                        interval: initialInterval,
                        nextReviewAt,
                        lastReviewedAt: now,
                        consecutiveCorrect: isCorrect ? 1 : 0,
                        wrongCount: isCorrect ? 0 : 1,
                        rightCount: isCorrect ? 1 : 0,
                    }
                });
            } else {

                let newConsecutiveCorrect = userProgress.consecutiveCorrect;
                let newInterval = userProgress.interval;
                let nextReviewAt: Date;

                if (isCorrect) {

                    const maxInterval = lookupTable[lookupTable.length - 1];

                    if (userProgress.interval >= maxInterval) {

                        newConsecutiveCorrect = userProgress.consecutiveCorrect + 1;
                        newInterval = 999999; // Special value indicating retirement


                        nextReviewAt = new Date('2099-12-31T23:59:59.000Z');

                        console.log(`🎉 Kanji ${kanjiId} has been RETIRED! User has mastered it completely.`);
                    } else {

                        newConsecutiveCorrect = userProgress.consecutiveCorrect + 1;
                        const intervalIndex = Math.min(newConsecutiveCorrect, lookupTable.length - 1);
                        newInterval = lookupTable[intervalIndex];
                        nextReviewAt = this.calculateNextReviewDate(newInterval);
                    }
                } else {

                    newConsecutiveCorrect = 0;
                    newInterval = lookupTable[0];
                    nextReviewAt = this.calculateNextReviewDate(newInterval);
                }

                userProgress = await this.prisma.userKanjiProgress.update({
                    where: { id: userProgress.id },
                    data: {
                        interval: newInterval,
                        nextReviewAt,
                        lastReviewedAt: now,
                        consecutiveCorrect: newConsecutiveCorrect,
                        wrongCount: isCorrect ? userProgress.wrongCount : userProgress.wrongCount + 1,
                        rightCount: isCorrect ? userProgress.rightCount + 1 : userProgress.rightCount,
                    }
                });
            }

            results.push({
                kanjiId,
                isCorrect,
                newInterval: userProgress.interval,
                nextReviewAt: userProgress.nextReviewAt,
                consecutiveCorrect: userProgress.consecutiveCorrect,
                totalCorrect: userProgress.rightCount,
                totalWrong: userProgress.wrongCount,
                isRetired: userProgress.interval >= 999999, // Indicates kanji is retired
                status: userProgress.interval >= 999999 ? 'MASTERED' : 'LEARNING'
            });
        }

        return {
            results,
            lookupTable,
        };
    }

    async getKanjiForReview(userId: string, deckId?: string) {
        const now = new Date();

        const whereClause: any = {
            userId,
            nextReviewAt: {
                lte: now
            },
            interval: {
                lt: 999999
            }
        };


        if (deckId) {
            whereClause.kanji = {
                deckKanjis: {
                    some: {
                        deckId
                    }
                }
            };
        }

        const kanjiForReview = await this.prisma.userKanjiProgress.findMany({
            where: whereClause,
            include: {
                kanji: {
                    include: {
                        exampleSentences: {
                            take: 1
                        }
                    }
                }
            },
            orderBy: {
                nextReviewAt: 'asc'
            }
        });

        return {
            kanjiForReview,
            totalDue: kanjiForReview.length
        };
    }

    async getMasteredKanji(userId: string, deckId?: string) {
        const whereClause: any = {
            userId,
            interval: {
                gte: 999999
            }
        };


        if (deckId) {
            whereClause.kanji = {
                deckKanjis: {
                    some: {
                        deckId
                    }
                }
            };
        }

        const masteredKanji = await this.prisma.userKanjiProgress.findMany({
            where: whereClause,
            include: {
                kanji: {
                    include: {
                        exampleSentences: {
                            take: 1
                        }
                    }
                }
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });

        return {
            masteredKanji,
            totalMastered: masteredKanji.length
        };
    }

    async getFlashcardsForReview(deckId: string, userId: string) {
        // Verify deck ownership
        const deck = await this.prisma.deck.findFirst({
            where: {
                id: deckId,
                OR: [
                    { ownerId: userId },
                    { userId: userId }
                ]
            }
        });

        if (!deck) {
            throw new Error('Deck not found or access denied');
        }

        // Debug: Check if deck has any kanji at all
        const deckKanjis = await this.prisma.deckKanji.findMany({
            where: { deckId },
            include: { kanji: true }
        });
        console.log(`DEBUG: Deck ${deckId} has ${deckKanjis.length} kanji`);


        const allProgressForDeck = await this.prisma.userKanjiProgress.findMany({
            where: {
                userId,
                kanji: {
                    deckKanjis: {
                        some: { deckId }
                    }
                }
            }
        });
        console.log(`DEBUG: Found ${allProgressForDeck.length} progress records for user ${userId} in deck ${deckId}`);

        // If no progress records exist, create them for all deck kanji
        if (allProgressForDeck.length === 0 && deckKanjis.length > 0) {
            console.log('DEBUG: No progress records found. Creating initial progress records...');

            const now = new Date();
            const initialInterval = 1;
            const nextReviewAt = now;

            const progressPromises = deckKanjis.map(deckKanji =>
                this.prisma.userKanjiProgress.create({
                    data: {
                        userId,
                        kanjiId: deckKanji.kanjiId,
                        interval: initialInterval,
                        nextReviewAt,
                        lastReviewedAt: now,
                        consecutiveCorrect: 0,
                        wrongCount: 0,
                        rightCount: 0,
                    }
                })
            );

            await Promise.all(progressPromises);
            console.log(`DEBUG: Created ${deckKanjis.length} progress records`);
        }


        const now = new Date();

        const kanjiForReview = await this.prisma.userKanjiProgress.findMany({
            where: {
                userId,
                nextReviewAt: {
                    lte: now
                },
                interval: {
                    lt: 999999  // Exclude retired kanji
                },
                kanji: {
                    deckKanjis: {
                        some: {
                            deckId
                        }
                    }
                }
            },
            include: {
                kanji: {
                    include: {
                        exampleSentences: {
                            take: 1
                        }
                    }
                }
            },
            orderBy: {
                nextReviewAt: 'asc'
            }
        });

        console.log(`DEBUG: Found ${kanjiForReview.length} kanji due for review`);


        if (kanjiForReview.length === 0) {
            return {
                id: deck.id,
                name: deck.name,
                kanjis: [],
                totalDue: 0,
                allReviewsComplete: true
            };
        }


        const formattedKanjis = kanjiForReview.map(progress => ({
            kanji: progress.kanji,
            progress: {
                interval: progress.interval,
                consecutiveCorrect: progress.consecutiveCorrect,
                nextReviewAt: progress.nextReviewAt,
                isOverdue: progress.nextReviewAt < now
            }
        }));

        return {
            id: deck.id,
            name: deck.name,
            kanjis: formattedKanjis,
            totalDue: kanjiForReview.length,
            allReviewsComplete: false
        };
    }

    async completeStudySession(deckId: string, userId: string, dto: StudyCompleteDto) {

        const progressResult = await this.updateKanjiProgress(deckId, userId, {
            progressUpdates: dto.progressUpdates
        });

        let addKanjiResult: any = null;
        let shouldAddKanji = false;


        if (dto.addNewKanji) {

            shouldAddKanji = true;
        } else if (dto.autoAddBasedOnProgress) {

            const masteryThreshold = dto.masteryThresholdDays || 7;
            const masteryCountThreshold = dto.masteryCountThreshold || 5;


            const existingProgress = await this.prisma.userKanjiProgress.findMany({
                where: {
                    userId,
                    kanji: {
                        deckKanjis: {
                            some: {
                                deckId
                            }
                        }
                    }
                }
            });

            const masteredKanji = existingProgress.filter(p => p.interval >= masteryThreshold);

            if (masteredKanji.length >= masteryCountThreshold) {
                shouldAddKanji = true;
            }
        }


        if (shouldAddKanji) {
            const newKanjiCount = dto.newKanjiCount || 5;
            try {
                addKanjiResult = await this.addRandomKanjiToDeck(deckId, newKanjiCount, userId);
            } catch (error) {
                console.error('Failed to add new kanji:', error);
                addKanjiResult = {
                    success: false,
                    error: error.message
                };
            }
        }


        const reviewStatus = await this.getKanjiForReview(userId, deckId);


        return {
            studySessionComplete: true,
            progressUpdate: {
                ...progressResult,
                studiedCount: dto.progressUpdates.length,
                correctAnswers: dto.progressUpdates.filter(p => p.isCorrect).length,
                wrongAnswers: dto.progressUpdates.filter(p => !p.isCorrect).length,
                accuracyRate: Math.round((dto.progressUpdates.filter(p => p.isCorrect).length / dto.progressUpdates.length) * 100)
            },
            kanjiAddition: addKanjiResult ? {
                ...addKanjiResult,
                wasRequested: !!dto.addNewKanji,
                wasAutomatic: !!dto.autoAddBasedOnProgress && !dto.addNewKanji
            } : {
                success: false,
                wasRequested: false,
                wasAutomatic: false
            },
            nextReview: {
                ...reviewStatus,
                deckSpecific: true
            }
        };
    }


    async resetKanjiProgress(userId: string, kanjiId: string) {
        return this.prisma.userKanjiProgress.updateMany({
            where: { userId, kanjiId },
            data: {
                interval: 1,
                nextReviewAt: new Date(),
                consecutiveCorrect: 0,
                wrongCount: 0,
                rightCount: 0,
                lastReviewedAt: new Date()
            }
        });
    }

    async setKanjiReviewTime(userId: string, kanjiId: string, minutesFromNow: number = 0) {
        const nextReviewAt = new Date(Date.now() + minutesFromNow * 60 * 1000);
        return this.prisma.userKanjiProgress.updateMany({
            where: { userId, kanjiId },
            data: { nextReviewAt }
        });
    }

    async setAllKanjiForImmediateReview(userId: string, deckId?: string) {
        const whereClause: any = { userId };

        if (deckId) {
            whereClause.kanji = {
                deckKanjis: {
                    some: { deckId }
                }
            };
        }

        return this.prisma.userKanjiProgress.updateMany({
            where: whereClause,
            data: { nextReviewAt: new Date() }
        });
    }

    async simulateKanjiProgression(userId: string, kanjiId: string, correctAnswers: number) {
        const lookupTable = [1, 1, 2, 4, 7, 14, 30, 60, 90, 180, 365];
        const intervalIndex = Math.min(correctAnswers, lookupTable.length - 1);
        const interval = lookupTable[intervalIndex];

        return this.prisma.userKanjiProgress.updateMany({
            where: { userId, kanjiId },
            data: {
                interval,
                consecutiveCorrect: correctAnswers,
                rightCount: correctAnswers,
                nextReviewAt: this.calculateNextReviewDate(interval),
                lastReviewedAt: new Date()
            }
        });
    }


    getTestingInfo() {
        return {
            devMode: this.DEV_MODE,
            timeMultiplier: this.getTimeMultiplier(),
            timeUnit: this.DEV_MODE ? 'minutes' : 'minutes (24*60 for days)',
            intervals: this.DEV_MODE
                ? 'Intervals: 1min, 1min, 2min, 4min, 7min, 14min, 30min, 60min, 90min, 180min, 365min'
                : 'Intervals: 1day, 1day, 2days, 4days, 7days, 14days, 30days, 60days, 90days, 180days, 365days'
        };
    }

    // Diagnostic method to check deck status
    async getDeckDiagnostics(deckId: string, userId: string) {
        const deck = await this.prisma.deck.findFirst({
            where: {
                id: deckId,
                OR: [
                    { ownerId: userId },
                    { userId: userId }
                ]
            }
        });

        if (!deck) {
            throw new Error('Deck not found or access denied');
        }

        const totalKanji = await this.prisma.deckKanji.count({
            where: { deckId }
        });

        const progressRecords = await this.prisma.userKanjiProgress.findMany({
            where: {
                userId,
                kanji: {
                    deckKanjis: {
                        some: { deckId }
                    }
                }
            },
            include: {
                kanji: {
                    select: {
                        kanji: true,
                        meaning: true
                    }
                }
            }
        });

        const now = new Date();
        const dueForReview = progressRecords.filter(p => p.nextReviewAt <= now && p.interval < 999999);
        const mastered = progressRecords.filter(p => p.interval >= 999999);
        const learning = progressRecords.filter(p => p.interval < 999999 && p.nextReviewAt > now);

        return {
            deck: {
                id: deck.id,
                name: deck.name,
                totalKanji
            },
            progress: {
                total: progressRecords.length,
                dueForReview: dueForReview.length,
                learning: learning.length,
                mastered: mastered.length,
                missingProgress: totalKanji - progressRecords.length
            },
            dueKanji: dueForReview.map(p => ({
                kanji: p.kanji.kanji,
                meaning: p.kanji.meaning,
                interval: p.interval,
                consecutiveCorrect: p.consecutiveCorrect,
                nextReviewAt: p.nextReviewAt,
                overdueby: Math.floor((now.getTime() - p.nextReviewAt.getTime()) / (1000 * 60 * 60)), // hours overdue
                wrongCount: p.wrongCount,
                rightCount: p.rightCount
            }))
        };
    }

    // Method to ensure all deck kanji have progress records
    async ensureProgressRecords(deckId: string, userId: string) {
        const deckKanjis = await this.prisma.deckKanji.findMany({
            where: { deckId },
            include: { kanji: true }
        });

        const existingProgress = await this.prisma.userKanjiProgress.findMany({
            where: {
                userId,
                kanji: {
                    deckKanjis: {
                        some: { deckId }
                    }
                }
            }
        });

        const existingKanjiIds = existingProgress.map(p => p.kanjiId);
        const missingKanjiIds = deckKanjis
            .filter(dk => !existingKanjiIds.includes(dk.kanjiId))
            .map(dk => dk.kanjiId);

        if (missingKanjiIds.length > 0) {
            const now = new Date();
            const progressPromises = missingKanjiIds.map(kanjiId =>
                this.prisma.userKanjiProgress.create({
                    data: {
                        userId,
                        kanjiId,
                        interval: 1,
                        nextReviewAt: now,
                        lastReviewedAt: now,
                        consecutiveCorrect: 0,
                        wrongCount: 0,
                        rightCount: 0,
                    }
                })
            );

            await Promise.all(progressPromises);
            console.log(`Created ${missingKanjiIds.length} missing progress records for deck ${deckId}`);
        }

        return {
            totalKanji: deckKanjis.length,
            existingProgress: existingProgress.length,
            createdProgress: missingKanjiIds.length
        };
    }


}