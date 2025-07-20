import { Injectable } from '@nestjs/common';
import { CreateDeckDto } from './dto/create-deck.dto/create-deck.dto';
import { UpdateKanjiProgressDto, KanjiProgressItem } from './dto/update-kanji-progress.dto';
import { StudyCompleteDto } from './dto/study-complete.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DeckService {
    constructor(private prisma: PrismaService) { }

    async createDeck(dto: CreateDeckDto, addRandomKanji: boolean = true, userId: string) {
        const createdDeck = await this.prisma.deck.create({
            data: {
                name: dto.name || "My Deck",
                isAuto: dto.isAuto ?? true,
                userId: userId,
                ownerId: userId,
                editbyUser: dto.editbyUser ?? true,
                isAnonymous: false, // No longer needed - all users (including guests) are real users
            }
        });

        if (addRandomKanji) {
            await this.addRandomKanjiToDeck(createdDeck.id, 3, userId);
        }

        return this.getDeckById(createdDeck.id, userId);
    }



    async addRandomKanjiToDeck(deckId: string, count: number = 3, userId?: string) {
        // Security: Validate input parameters
        if (count < 1 || count > 50) {
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

        // Initialize UserKanjiProgress records for the new kanji if userId is provided
        if (userId) {
            const now = new Date();
            const initialInterval = 1; // Start with 1 day interval
            const nextReviewAt = now; // Make new kanji immediately available for review

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

        // Group by JLPT level for response
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

            // Find existing progress or create new one
            let userProgress = await this.prisma.userKanjiProgress.findFirst({
                where: {
                    userId,
                    kanjiId,
                }
            });

            const now = new Date();

            if (!userProgress) {
                // Create new progress record with initial values
                const initialInterval = lookupTable[0]; // 1 day
                const nextReviewAt = now; // Make immediately available for review

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
                // Update existing progress using spaced repetition algorithm
                let newConsecutiveCorrect = userProgress.consecutiveCorrect;
                let newInterval = userProgress.interval;
                let nextReviewAt: Date;

                if (isCorrect) {
                    // Check if kanji is already at maximum interval (365 days)
                    const maxInterval = lookupTable[lookupTable.length - 1]; // 365 days

                    if (userProgress.interval >= maxInterval) {
                        // User got it correct at 365-day level - RETIRE the kanji!
                        newConsecutiveCorrect = userProgress.consecutiveCorrect + 1;
                        newInterval = 999999; // Special value indicating retirement

                        // Set review date to far future (year 2099) - effectively never
                        nextReviewAt = new Date('2099-12-31T23:59:59.000Z');

                        console.log(`🎉 Kanji ${kanjiId} has been RETIRED! User has mastered it completely.`);
                    } else {
                        // Normal progression: move to next interval level
                        newConsecutiveCorrect = userProgress.consecutiveCorrect + 1;
                        const intervalIndex = Math.min(newConsecutiveCorrect, lookupTable.length - 1);
                        newInterval = lookupTable[intervalIndex];
                        nextReviewAt = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000);
                    }
                } else {
                    // Wrong answer: reset to beginning but keep some progress
                    newConsecutiveCorrect = 0;
                    newInterval = lookupTable[0]; // Reset to 1 day
                    nextReviewAt = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000);
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
                lt: 999999  // Exclude retired kanji (interval < 999999)
            }
        };

        // If deckId is provided, filter by kanji in that deck
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
                gte: 999999  // Only retired/mastered kanji
            }
        };

        // If deckId is provided, filter by kanji in that deck
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
                updatedAt: 'desc'  // Most recently mastered first
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

        // Debug: Check UserKanjiProgress records for this user/deck
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
            const nextReviewAt = now; // Make kanji immediately available for review

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

        // Get kanji due for review in this specific deck
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
                nextReviewAt: 'asc'  // Most overdue first
            }
        });

        console.log(`DEBUG: Found ${kanjiForReview.length} kanji due for review`);

        // If no kanji are due for review, return empty flashcards
        if (kanjiForReview.length === 0) {
            return {
                id: deck.id,
                name: deck.name,
                kanjis: [],
                totalDue: 0,
                allReviewsComplete: true
            };
        }

        // Format the response similar to getDeckForFlashcards
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
        // 1. Update kanji progress first
        const progressResult = await this.updateKanjiProgress(deckId, userId, {
            progressUpdates: dto.progressUpdates
        });

        let addKanjiResult: any = null;
        let shouldAddKanji = false;

        // 2. Determine if new kanji should be added
        if (dto.addNewKanji) {
            // Explicit request to add new kanji
            shouldAddKanji = true;
        } else if (dto.autoAddBasedOnProgress) {
            // Auto-add based on progress analysis
            const masteryThreshold = dto.masteryThresholdDays || 7;
            const masteryCountThreshold = dto.masteryCountThreshold || 5;

            // Check current mastery levels from existing progress
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

        // 3. Add new kanji if conditions are met
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

        // 4. Get updated review status
        const reviewStatus = await this.getKanjiForReview(userId, deckId);

        // 5. Return combined result
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


}