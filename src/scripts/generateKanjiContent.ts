import { PrismaClient } from '@prisma/client';
import { OpenAIService } from '../openai/openai.service';
import { ConfigService } from '@nestjs/config';
import { config as dotenvConfig } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as cliProgress from 'cli-progress';

// Load environment variables
dotenvConfig({ path: `.env.${process.env.NODE_ENV || 'dev'}` });

const prisma = new PrismaClient();

// Initialize services
const configService = new ConfigService();
// Silent mode will be set after parsing command line args
let openaiService: OpenAIService;

// Progress tracking
const PROGRESS_FILE = path.join(__dirname, '../../kanji-generation-progress.json');

// Logging setup
const LOG_FILE = path.join(__dirname, '../../kanji-generation.log');
const LOG_STREAM = fs.createWriteStream(LOG_FILE, { flags: 'a' });

// Custom logger that writes to file
function logToFile(level: 'INFO' | 'ERROR' | 'WARN', message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = args.length > 0 ? `${message} ${args.join(' ')}` : message;
    const logEntry = `[${timestamp}] [${level}] ${formattedMessage}\n`;
    LOG_STREAM.write(logEntry);
}

// Replace console methods with file logging
function log(message: string, ...args: any[]): void {
    logToFile('INFO', message, ...args);
}

function logError(message: string, ...args: any[]): void {
    logToFile('ERROR', message, ...args);
}

function logWarn(message: string, ...args: any[]): void {
    logToFile('WARN', message, ...args);
}

// Clean up function for log stream
function closeLogStream(): void {
    LOG_STREAM.end();
}

// Process cleanup
process.on('exit', closeLogStream);
process.on('SIGINT', () => {
    closeLogStream();
    process.exit(0);
});
process.on('SIGTERM', () => {
    closeLogStream();
    process.exit(0);
});

interface ProgressData {
    lastProcessedId: string | null;
    totalKanjis: number;
    processedCount: number;
    successCount: number;
    errorCount: number;
    startedAt: string;
    lastUpdatedAt: string;
    errors: Array<{
        kanjiId: string;
        kanji: string;
        error: string;
        timestamp: string;
    }>;
}

// Progress tracking functions
function saveProgress(data: ProgressData): void {
    try {
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2));
        log('Progress saved successfully');
    } catch (error) {
        logError('⚠️  Failed to save progress:', error.message);
    }
}

function loadProgress(): ProgressData | null {
    try {
        if (fs.existsSync(PROGRESS_FILE)) {
            const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
            log('Progress file loaded successfully');
            return JSON.parse(data);
        }
    } catch (error) {
        logError('⚠️  Failed to load progress file:', error.message);
    }
    return null;
}

function clearProgress(): void {
    try {
        if (fs.existsSync(PROGRESS_FILE)) {
            fs.unlinkSync(PROGRESS_FILE);
            log('🗑️  Progress file cleared');
        }
    } catch (error) {
        logError('⚠️  Failed to clear progress file:', error.message);
    }
}

function initializeProgress(totalKanjis: number): ProgressData {
    const progress = {
        lastProcessedId: null,
        totalKanjis,
        processedCount: 0,
        successCount: 0,
        errorCount: 0,
        startedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        errors: []
    };
    log(`Progress initialized for ${totalKanjis} kanjis`);
    return progress;
}

function updateProgress(
    progress: ProgressData,
    kanjiId: string,
    success: boolean,
    errorMessage?: string,
    kanji?: string
): void {
    progress.lastProcessedId = kanjiId;
    progress.processedCount++;
    progress.lastUpdatedAt = new Date().toISOString();

    if (success) {
        progress.successCount++;
        log(`✅ Successfully processed kanji: ${kanji || kanjiId}`);
    } else {
        progress.errorCount++;
        if (errorMessage && kanji) {
            progress.errors.push({
                kanjiId,
                kanji,
                error: errorMessage,
                timestamp: new Date().toISOString()
            });
            logError(`❌ Error processing kanji ${kanji}: ${errorMessage}`);
        }
    }

    saveProgress(progress);
}

// Validation function for whitelist JLPT levels
async function validateAndFixWhitelist(
    initialWhitelist: string[],
    targetJlptLevel: number,
    targetKanji: string,
    maxRetries: number = 3
): Promise<string[]> {
    let validWhitelist: string[] = [];
    let invalidKanji: string[] = [];
    let retryCount = 0;

    log(`🔍 Checking JLPT levels for ${initialWhitelist.length} whitelist kanji...`);

    // Remove duplicates from initial whitelist
    const uniqueInitialWhitelist = [...new Set(initialWhitelist)];
    log(`🔧 Removed ${initialWhitelist.length - uniqueInitialWhitelist.length} duplicates from initial whitelist`);

    // Check each kanji in the database
    for (const whitelistKanji of uniqueInitialWhitelist) {
        if (whitelistKanji === targetKanji) {
            continue; // Skip the target kanji itself
        }

        const existingKanji = await prisma.kanji.findFirst({
            where: { kanji: whitelistKanji }
        });

        if (existingKanji && existingKanji.jlptLevel === targetJlptLevel) {
            // Double-check for duplicates before adding
            if (!validWhitelist.includes(whitelistKanji)) {
                validWhitelist.push(whitelistKanji);
            }
        } else {
            if (!invalidKanji.includes(whitelistKanji)) {
                invalidKanji.push(whitelistKanji);
                if (existingKanji) {
                    logWarn(`⚠️  ${whitelistKanji} is JLPT N${existingKanji.jlptLevel}, expected N${targetJlptLevel}`);
                } else {
                    logWarn(`⚠️  ${whitelistKanji} not found in database`);
                }
            }
        }
    }

    log(`✅ Found ${validWhitelist.length} valid unique kanji, ${invalidKanji.length} invalid`);

    // If we need more kanji and haven't exceeded retry limit
    while (validWhitelist.length < 15 && retryCount < maxRetries) {
        retryCount++;
        const needed = 15 - validWhitelist.length;
        log(`🔄 Retry ${retryCount}: Requesting ${needed} more unique kanji...`);

        const additionalKanji = await openaiService.generateKanjiWhitelist(
            targetKanji,
            targetJlptLevel,
            needed + 10 // Request more extras to account for duplicates
        );

        // Remove duplicates from AI response
        const uniqueAdditionalKanji = [...new Set(additionalKanji)];
        log(`🔧 AI returned ${additionalKanji.length} kanji, ${uniqueAdditionalKanji.length} unique`);

        // Validate the additional kanji
        for (const newKanji of uniqueAdditionalKanji) {
            if (validWhitelist.length >= 15) break;

            // Skip if already processed or is target kanji
            if (validWhitelist.includes(newKanji) || invalidKanji.includes(newKanji) || newKanji === targetKanji) {
                continue;
            }

            const existingKanji = await prisma.kanji.findFirst({
                where: { kanji: newKanji }
            });

            if (existingKanji && existingKanji.jlptLevel === targetJlptLevel) {
                validWhitelist.push(newKanji);
                log(`✅ Added valid kanji: ${newKanji} (${validWhitelist.length}/15)`);
            } else {
                invalidKanji.push(newKanji);
            }
        }

        // Add small delay between retries
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // If we still don't have enough, get random kanji from the same JLPT level from database
    if (validWhitelist.length < 15) {
        log(`🎲 Need ${15 - validWhitelist.length} more kanji, fetching from database...`);

        // Use random ordering to ensure each kanji gets a different whitelist
        const additionalKanjiFromDB = await prisma.kanji.findMany({
            where: {
                jlptLevel: targetJlptLevel,
                kanji: {
                    notIn: [...validWhitelist, ...invalidKanji, targetKanji]
                },
                isDeleted: { not: true }
            },
            take: (15 - validWhitelist.length) * 3, // Get more than needed for better randomization
            select: { kanji: true }
        });

        // Shuffle the results to ensure randomness for each kanji
        const shuffledKanji = additionalKanjiFromDB
            .map(value => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value);

        for (const dbKanji of shuffledKanji) {
            if (validWhitelist.length >= 15) break;
            if (!validWhitelist.includes(dbKanji.kanji)) {
                validWhitelist.push(dbKanji.kanji);
                log(`📚 Added from DB: ${dbKanji.kanji} (${validWhitelist.length}/15)`);
            }
        }
    }

    // Final fallback: if still not enough, use target kanji variants or duplicates as last resort
    if (validWhitelist.length < 15) {
        logWarn(`⚠️  Warning: Only found ${validWhitelist.length} unique kanji, padding with target kanji for remaining slots`);
        while (validWhitelist.length < 15) {
            validWhitelist.push(targetKanji);
        }
    }

    // Ensure exactly 15 kanji and remove any final duplicates
    const finalWhitelist = [...new Set(validWhitelist)];

    // If deduplication reduced the count, pad with target kanji
    while (finalWhitelist.length < 15) {
        finalWhitelist.push(targetKanji);
    }

    log(`🎯 Final whitelist: ${finalWhitelist.length} kanji (${[...new Set(finalWhitelist)].length} unique)`);

    return finalWhitelist.slice(0, 15);
}

// Add command line options
const args = process.argv.slice(2);
const shouldLimit = args.includes('--limit');
const limitCount = shouldLimit ? parseInt(args[args.indexOf('--limit') + 1]) || 5 : null;
const shouldResume = args.includes('--resume');
const shouldClear = args.includes('--clear');
const fromId = args.includes('--from-id') ? args[args.indexOf('--from-id') + 1] : null;
const silentMode = args.includes('--silent');

// Initialize OpenAIService with silent mode based on command line args
openaiService = new OpenAIService(configService, silentMode);

// Enhanced console logging that respects silent mode
function consoleLog(message: string): void {
    if (!silentMode) {
        console.log(message);
    }
    log(message);
}

function consoleError(message: string): void {
    if (!silentMode) {
        console.error(message);
    }
    logError(message);
}

// Console output for user (minimal)
console.log('🚀 Kanji Content Generation Started');
if (!silentMode) {
    console.log(`📝 Detailed logs are being written to: ${LOG_FILE}`);
}

if (shouldLimit && limitCount) {
    consoleLog(`⚠️  Running in test mode - processing only ${limitCount} kanjis`);
}

if (shouldResume) {
    consoleLog(`🔄 Resume mode activated`);
}

if (shouldClear) {
    consoleLog(`🗑️  Clear mode activated`);
}

if (fromId) {
    consoleLog(`🎯 Starting from specific kanji ID: ${fromId}`);
}

// Main function with progress tracking
async function generateKanjiContentWithTracking() {
    log('🚀 Starting kanji content generation with progress tracking...');

    // Handle clear command
    if (shouldClear) {
        clearProgress();
        if (args.length === 1) {
            const message = '✅ Progress cleared. Use --resume to resume or run without --clear to start fresh.';
            console.log(message);
            log(message);
            return;
        }
    }

    let progress: ProgressData | null = null;
    let startFromId: string | null = null;

    // Load existing progress if resuming
    if (shouldResume && !shouldClear) {
        progress = loadProgress();
        if (progress) {
            const progressInfo = `📁 Found existing progress: Total: ${progress.totalKanjis} | Processed: ${progress.processedCount} | Success: ${progress.successCount} | Errors: ${progress.errorCount}`;
            consoleLog(progressInfo);
            log(`🕐 Started: ${progress.startedAt}`);
            log(`🕐 Last updated: ${progress.lastUpdatedAt}`);
            if (progress.lastProcessedId) {
                log(`🎯 Last processed: ${progress.lastProcessedId}`);
                startFromId = progress.lastProcessedId;
            }

            if (progress.errors.length > 0) {
                log(`❌ Recent errors:`);
                progress.errors.slice(-3).forEach(error => {
                    log(`   ${error.kanji}: ${error.error}`);
                });
            }
        } else {
            consoleLog('📁 No progress file found, starting fresh...');
        }
    }

    // Use specific ID if provided
    if (fromId) {
        startFromId = fromId;
        progress = null; // Reset progress when starting from specific ID
    }

    try {
        // Build query for fetching kanjis
        const whereCondition: any = {
            isDeleted: { not: true }
        };

        // Add cursor for resuming
        if (startFromId) {
            whereCondition.id = { gt: startFromId };
        }

        // Fetch kanjis from database
        const kanjis = await prisma.kanji.findMany({
            where: whereCondition,
            orderBy: {
                createdAt: 'asc'
            },
            ...(limitCount && { take: limitCount })
        });

        // Initialize or update progress
        if (!progress) {
            const totalCount = await prisma.kanji.count({
                where: { isDeleted: { not: true } }
            });
            progress = initializeProgress(totalCount);
        }

        const processInfo = `📚 Found ${kanjis.length} kanjis to process${limitCount ? ` (limited to ${limitCount})` : ''}`;
        const overallInfo = `📊 Overall progress: ${progress.processedCount}/${progress.totalKanjis} (${Math.round(progress.processedCount / progress.totalKanjis * 100)}%)`;
        console.log(processInfo);
        console.log(overallInfo);
        log(processInfo);
        log(overallInfo);

        // Create progress bar
        const progressBar = new cliProgress.SingleBar({
            format: '🚀 Processing |{bar}| {percentage}% | {value}/{total} kanjis | Current: {currentKanji}',
            barCompleteChar: '█',
            barIncompleteChar: '░',
            hideCursor: true,
            clearOnComplete: false,
            stopOnComplete: true
        }, cliProgress.Presets.shades_classic);

        // Start the progress bar
        progressBar.start(kanjis.length, 0, {
            currentKanji: 'Starting...'
        });

        for (let i = 0; i < kanjis.length; i++) {
            const kanji = kanjis[i];
            const overallProgress = progress.processedCount + 1;

            // Update progress bar
            progressBar.update(i, {
                currentKanji: `${kanji.kanji} (${kanji.meaning})`
            });

            log(`\n[${overallProgress}/${progress.totalKanjis}] Processing kanji: ${kanji.kanji} (${kanji.meaning})`);
            log(`📍 Progress: ${Math.round(overallProgress / progress.totalKanjis * 100)}% | Local: [${i + 1}/${kanjis.length}]`);

            try {
                // Check if this kanji already has sentences
                const existingSentences = await prisma.sentence.count({
                    where: { kanjiId: kanji.id }
                });

                if (existingSentences > 0) {
                    log(`⏭️  Skipping ${kanji.kanji} - already has ${existingSentences} sentences`);
                    updateProgress(progress, kanji.id, true, undefined, kanji.kanji);
                    continue;
                }

                // Generate sentences using OpenAI
                log(`🤖 Generating sentences for ${kanji.kanji}...`);
                const generatedSentences = await openaiService.generateKanjiSentences(
                    kanji.kanji,
                    kanji.meaning,
                    kanji.kana,
                    kanji.jlptLevel
                );

                // Generate whitelist using OpenAI
                log(`🤖 Generating whitelist for ${kanji.kanji}...`);
                const generatedWhitelist = await openaiService.generateKanjiWhitelist(
                    kanji.kanji,
                    kanji.jlptLevel,
                    15
                );

                // Validate and fix whitelist JLPT levels
                log(`🔍 Validating whitelist JLPT levels...`);
                const validatedWhitelist = await validateAndFixWhitelist(
                    generatedWhitelist,
                    kanji.jlptLevel,
                    kanji.kanji
                );

                // Update kanji whitelist
                log(`📝 Updating whitelist (${validatedWhitelist.length} words)...`);
                await prisma.kanji.update({
                    where: { id: kanji.id },
                    data: {
                        whitelist: validatedWhitelist
                    }
                });

                // Create sentence records
                log(`📖 Creating ${generatedSentences.length} sentences...`);
                for (const sentenceData of generatedSentences) {
                    await prisma.sentence.create({
                        data: {
                            sentence: sentenceData.sentence,
                            meaning: sentenceData.meaning,
                            kana: sentenceData.kana,
                            counter: 0,
                            usedKanjiForm: sentenceData.usedKanjiForm,
                            kanjiId: kanji.id
                        }
                    });
                }

                updateProgress(progress, kanji.id, true, undefined, kanji.kanji);

                // Add a delay to avoid overwhelming the API
                await new Promise(resolve => setTimeout(resolve, 5000));

            } catch (error) {
                logError(`❌ Error processing ${kanji.kanji}:`, error.message);
                updateProgress(progress, kanji.id, false, error.message, kanji.kanji);

                // Continue with next kanji despite error
                continue;
            }
        }

        // Complete the progress bar
        progressBar.stop();

        const completionMessage = '\n🎉 Content generation completed!';
        const statsMessage = `📊 Final Statistics: ✅ Success: ${progress.successCount} | ❌ Errors: ${progress.errorCount} | 📈 Total: ${progress.processedCount}/${progress.totalKanjis} | 🎯 Completion: ${Math.round(progress.processedCount / progress.totalKanjis * 100)}%`;

        console.log(completionMessage);
        console.log(statsMessage);
        log(completionMessage);
        log(statsMessage);

        if (progress.errors.length > 0) {
            log(`\n❌ Error Summary:`);
            progress.errors.forEach(error => {
                log(`   ${error.kanji} (${error.kanjiId}): ${error.error}`);
            });
        }

        // Keep progress file for potential resume unless 100% complete
        if (progress.processedCount >= progress.totalKanjis) {
            const completeMessage = '🗑️  All kanjis processed successfully! Clearing progress file...';
            console.log(completeMessage);
            log(completeMessage);
            clearProgress();
        } else {
            const resumeMessage = `💾 Progress saved. Use 'npm run generate:kanji -- --resume' to continue.`;
            console.log(resumeMessage);
            log(resumeMessage);
        }

    } catch (error) {
        const fatalError = `💥 Fatal error: ${error.message}`;
        console.error(fatalError);
        logError(fatalError);
        if (progress) {
            const progressSaved = `💾 Progress saved at: ${progress.processedCount}/${progress.totalKanjis}`;
            console.log(progressSaved);
            log(progressSaved);
        }
    } finally {
        await prisma.$disconnect();
        const disconnectMessage = '🔌 Database connection closed';
        console.log(disconnectMessage);
        log(disconnectMessage);
        closeLogStream();
    }
}

// Run the script
generateKanjiContentWithTracking(); 