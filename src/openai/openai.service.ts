import OpenAI from 'openai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

interface BatchRequest {
    custom_id: string;
    method: 'POST';
    url: '/v1/chat/completions';
    body: {
        model: string;
        messages: Array<{
            role: 'system' | 'user' | 'assistant';
            content: string;
        }>;
        temperature?: number;
        max_completion_tokens?: number;
    };
}

interface BatchResponse {
    id: string;
    custom_id: string;
    response: {
        status_code: number;
        body: {
            choices: Array<{
                message: {
                    content: string;
                };
            }>;
        };
    };
}

@Injectable()
export class OpenAIService {
    private readonly logger = new Logger(OpenAIService.name);
    private openai: OpenAI;
    private silentMode: boolean = false;
    private readonly defaultModel = 'gpt-4o-mini';

    constructor(private configService: ConfigService, silentMode: boolean = false) {
        this.silentMode = silentMode;
        const apiKey = this.configService.get<string>('OPENAI_API_KEY');

        if (!apiKey) {
            throw new Error('Missing OPENAI_API_KEY in environment variables');
        }

        this.openai = new OpenAI({
            apiKey: apiKey,
        });

        if (!this.silentMode) {
            this.logger.log('OpenAI service initialized successfully');
        }
    }

    // Centralized system messages
    private getKanjiSentenceSystemMessage(): string {
        return `You are a Japanese language expert creating educational sentences for a kanji learning app.

CONTENT GUIDELINES:
- For sensitive topics (war, weapons, violence): Use ONLY educational, historical, or academic contexts
- Be culturally sensitive - use respectful, educational language
- Never promote or glorify violence/war
- Focus on neutral, educational content

SENTENCE REQUIREMENTS:
- Create 5 COMPLETELY DIFFERENT sentences demonstrating ACTUAL USAGE in real-life contexts
- Be appropriate for the specified JLPT level
- Show HOW the kanji is used in daily life
- Be 10-20 characters long (not too complex)
- Provide RICH CONTEXT so learners understand the meaning from usage
- Be SPECIFIC enough for quiz comprehension

CRITICAL VARIETY REQUIREMENTS:
- Use different sentence types: statements, questions, exclamations, commands
- Mix formality levels: casual (だ/である), polite (です/ます), informal
- Mix contexts: work, home, shopping, travel, relationships, hobbies
- Mix grammar patterns: present, past, conditional, causative, passive
- NEVER repeat sentence structures
- Each sentence should feel completely unrelated except for the target kanji

OUTPUT FORMAT (JSON only):
{
  "sentences": [
    {
      "sentence": "Japanese sentence",
      "meaning": "Natural English translation", 
      "kana": "Full hiragana/katakana reading (NO romanized text)",
      "usedKanjiForm": "Specific kanji form used"
    }
  ]
}

CRITICAL: "kana" field must contain ONLY Japanese characters (hiragana/katakana).`;
    }

    private getKanjiWhitelistSystemMessage(): string {
        return `You are a Japanese language expert creating quiz content for multiple choice questions.

CRITICAL REQUIREMENT: Generate kanji from COMPLETELY DIFFERENT semantic fields to avoid confusion.

SEMANTIC SEPARATION RULES:
- If target is about BUSINESS/INDUSTRY → Use kanji about nature, food, body parts, colors, time
- If target is about NATURE → Use kanji about technology, business, emotions, family  
- If target is about FOOD → Use kanji about transportation, weather, education, sports
- If target is about EMOTIONS → Use kanji about objects, places, numbers, actions
- If target is about FAMILY → Use kanji about science, art, materials, directions

EXAMPLES OF GOOD SEPARATION:
- Target: 鉱業 (mining industry) → Good distractors: 桜 (cherry), 魚 (fish), 母 (mother), 赤 (red), 歌 (song)
- Target: 桜 (cherry) → Good distractors: 会社 (company), 電話 (phone), 勉強 (study), 運動 (exercise)

AVOID:
- Any kanji sharing semantic fields with the target
- Related concepts, synonyms, or associated ideas
- Same category vocabulary (if target is business term, avoid all business terms)
- Compound kanji containing target kanji characters

REQUIREMENTS:
- Generate UNIQUE Japanese kanji for incorrect answer choices  
- All kanji must be from the specified JLPT level
- Use single kanji or common kanji compounds
- Choose from COMPLETELY UNRELATED semantic fields
- Avoid sensitive/controversial kanji (war, weapons, violence)

CRITICAL RULES:
- All kanji must be DIFFERENT from each other - NO DUPLICATES
- Do NOT include the target kanji in the list
- Generate exactly the requested count
- Ensure MAXIMUM semantic distance from target

OUTPUT FORMAT (JSON only):
{
  "whitelist": ["kanji1", "kanji2", "kanji3", ...]
}`;
    }

    private getVocabularyFilterSystemMessage(): string {
        return `You are a language learning expert creating vocabulary exercises. Your task is to filter distractors to ensure only ONE answer is clearly correct.

FILTERING CRITERIA:

REMOVE distractors that:
- Could reasonably fit in the sentence context
- Are synonyms or near-synonyms of the correct answer
- Have overlapping meanings with the correct answer
- Would make the sentence grammatically and semantically acceptable
- Are in the same semantic category when context-sensitive

KEEP distractors that:
- Are valid vocabulary words but clearly wrong in this context
- Create obviously incorrect or nonsensical sentences
- Are from different semantic categories when appropriate
- Would be immediately recognizable as wrong to a language learner

PROCESS:
1. Test each distractor by mentally placing it in the sentence
2. Remove semantically similar options
3. Keep only clearly incorrect but plausible options
4. Be strict about semantic similarity for educational value

OUTPUT FORMAT (JSON only):
{
  "filteredDistractors": ["distractor1", "distractor2", ...],
  "removedDistractors": ["removed1", "removed2", ...],
  "reasoning": "Brief explanation of filtering decisions"
}`;
    }

    // Enhanced error handling
    private handleApiError(error: any, context: string): never {
        if (!this.silentMode) {
            this.logger.error(`Error in ${context}:`, error.message);
        }

        if (error.status === 401) {
            throw new Error('Invalid OpenAI API key');
        }

        if (error.status === 429) {
            throw new Error('OpenAI API rate limit exceeded');
        }

        if (error.status === 400 && error.message?.includes('Billing hard limit')) {
            throw new Error('OpenAI billing limit reached - please add payment method');
        }

        throw new Error(`Failed ${context}: ${error.message}`);
    }

    // Public methods to access system messages for batch processing
    public getSentenceSystemMessage(): string {
        return this.getKanjiSentenceSystemMessage();
    }

    public getWhitelistSystemMessage(): string {
        return this.getKanjiWhitelistSystemMessage();
    }

    async generateText(prompt: string, useModel: string = this.defaultModel, systemMessage?: string): Promise<string> {
        try {
            if (!prompt || prompt.trim().length === 0) {
                throw new Error('Prompt cannot be empty');
            }

            const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

            if (systemMessage) {
                messages.push({
                    role: 'system',
                    content: systemMessage
                });
            }

            messages.push({
                role: 'user',
                content: prompt
            });

            const requestParams: any = {
                model: useModel,
                messages: messages,
                max_completion_tokens: 1000,
            };

            // Only add temperature for models that support it (o1-mini doesn't support custom temperature)
            if (!useModel.startsWith('o1-')) {
                requestParams.temperature = 0.7;
            }

            const completion = await this.openai.chat.completions.create(requestParams);

            const text = completion.choices[0]?.message?.content;

            if (!text) {
                throw new Error('No response generated from OpenAI');
            }

            return text;
        } catch (error) {
            this.handleApiError(error, 'text generation');
        }
    }

    // Create batch file for processing many requests at once
    async createBatchFile(
        requests: Array<{
            custom_id: string;
            prompt: string;
            model?: string;
            systemMessage?: string;
        }>,
        filePath: string
    ): Promise<string> {
        const batchRequests: BatchRequest[] = requests.map(req => {
            const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

            if (req.systemMessage) {
                messages.push({
                    role: 'system',
                    content: req.systemMessage
                });
            }

            messages.push({
                role: 'user',
                content: req.prompt
            });

            const requestBody: any = {
                model: req.model || this.defaultModel,
                messages: messages,
                max_completion_tokens: 1000,
            };

            // Only add temperature for models that support it (o1-mini doesn't support custom temperature)
            if (!(req.model || this.defaultModel).startsWith('o1-')) {
                requestBody.temperature = 0.7;
            }

            return {
                custom_id: req.custom_id,
                method: 'POST',
                url: '/v1/chat/completions',
                body: requestBody
            };
        });

        // Write JSONL format (one JSON object per line)
        const jsonlContent = batchRequests
            .map(req => JSON.stringify(req))
            .join('\n');

        fs.writeFileSync(filePath, jsonlContent);

        if (!this.silentMode) {
            this.logger.log(`Created batch file with ${batchRequests.length} requests: ${filePath}`);
        }

        return filePath;
    }

    // Submit batch job to OpenAI
    async submitBatchJob(batchFilePath: string, description?: string): Promise<string> {
        try {
            // Upload the batch file
            const fileUpload = await this.openai.files.create({
                file: fs.createReadStream(batchFilePath),
                purpose: 'batch',
            });

            if (!this.silentMode) {
                this.logger.log(`Uploaded batch file: ${fileUpload.id}`);
            }

            // Create the batch job
            const batch = await this.openai.batches.create({
                input_file_id: fileUpload.id,
                endpoint: '/v1/chat/completions',
                completion_window: '24h',
                metadata: {
                    description: description || 'Kanji content generation batch'
                }
            });

            if (!this.silentMode) {
                this.logger.log(`Submitted batch job: ${batch.id}`);
            }

            return batch.id;
        } catch (error) {
            this.logger.error('Error submitting batch job:', error.message);
            throw new Error(`Failed to submit batch job: ${error.message}`);
        }
    }

    // Check batch job status
    async getBatchStatus(batchId: string): Promise<{
        status: string;
        completed_at?: number;
        output_file_id?: string;
        error_file_id?: string;
        request_counts?: {
            total: number;
            completed: number;
            failed: number;
        };
    }> {
        try {
            const batch = await this.openai.batches.retrieve(batchId);

            return {
                status: batch.status,
                completed_at: batch.completed_at,
                output_file_id: batch.output_file_id,
                error_file_id: batch.error_file_id,
                request_counts: batch.request_counts,
            };
        } catch (error) {
            this.logger.error('Error getting batch status:', error.message);
            throw new Error(`Failed to get batch status: ${error.message}`);
        }
    }

    // Download and process batch results
    async processBatchResults(outputFileId: string, outputPath: string): Promise<BatchResponse[]> {
        try {
            // Download the result file
            const fileContent = await this.openai.files.content(outputFileId);
            const arrayBuffer = await fileContent.arrayBuffer();
            const fileData = Buffer.from(arrayBuffer).toString();

            // Save raw results
            fs.writeFileSync(outputPath, fileData);

            // Parse JSONL results
            const results: BatchResponse[] = fileData
                .split('\n')
                .filter(line => line.trim())
                .map(line => JSON.parse(line));

            if (!this.silentMode) {
                this.logger.log(`Processed ${results.length} batch results`);
            }

            return results;
        } catch (error) {
            this.logger.error('Error processing batch results:', error.message);
            throw new Error(`Failed to process batch results: ${error.message}`);
        }
    }

    async generateKanjiSentences(
        kanji: string,
        meaning: string,
        kanaReadings: string[],
        jlptLevel: number
    ): Promise<Array<{
        sentence: string;
        meaning: string;
        kana: string;
        usedKanjiForm: string;
    }>> {
        const prompt = `Generate 5 unique example sentences for:
- Kanji: ${kanji}
- Meaning: ${meaning}
- Readings: ${kanaReadings.join(', ')}
- JLPT Level: N${jlptLevel}`;

        try {
            const response = await this.generateText(prompt, this.defaultModel, this.getKanjiSentenceSystemMessage());

            // Parse JSON response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Could not parse JSON response from OpenAI');
            }

            const parsed = JSON.parse(jsonMatch[0]);

            // Validate response structure
            if (!parsed.sentences || !Array.isArray(parsed.sentences)) {
                throw new Error('Invalid response format: missing sentences array');
            }

            // Validate each sentence has required fields
            for (const sentence of parsed.sentences) {
                if (!sentence.sentence || !sentence.meaning || !sentence.kana || !sentence.usedKanjiForm) {
                    throw new Error('Invalid sentence format: missing required fields');
                }
            }

            // Ensure we have the right number of items
            if (parsed.sentences.length !== 5) {
                if (!this.silentMode) {
                    this.logger.warn(`Expected 5 sentences, got ${parsed.sentences.length} for kanji ${kanji}`);
                }
            }

            return parsed.sentences;

        } catch (error) {
            this.handleApiError(error, `sentence generation for kanji ${kanji}`);
        }
    }

    async generateKanjiWhitelist(
        targetKanji: string,
        jlptLevel: number,
        requestedCount: number = 15
    ): Promise<string[]> {
        const prompt = `Generate ${requestedCount} unique kanji for quiz distractors:
- Target Kanji: ${targetKanji}
- JLPT Level: N${jlptLevel}
- Count needed: ${requestedCount}`;

        try {
            const response = await this.generateText(prompt, this.defaultModel, this.getKanjiWhitelistSystemMessage());

            // Parse JSON response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Could not parse JSON response from OpenAI');
            }

            const parsed = JSON.parse(jsonMatch[0]) as { whitelist: unknown[] };

            if (!parsed.whitelist || !Array.isArray(parsed.whitelist)) {
                throw new Error('Invalid response format: missing whitelist array');
            }

            // Ensure all items are strings and remove duplicates
            const stringKanji = parsed.whitelist.filter((k): k is string => typeof k === 'string');
            const uniqueKanji = [...new Set(stringKanji)]
                .filter((k: string) => k !== targetKanji);

            if (!this.silentMode) {
                this.logger.log(`Generated ${parsed.whitelist.length} kanji, ${uniqueKanji.length} unique after filtering`);
            }

            return uniqueKanji.slice(0, requestedCount); // Ensure exact count

        } catch (error) {
            this.handleApiError(error, `whitelist generation for kanji ${targetKanji}`);
        }
    }

    async filterVocabularyDistractors(
        sentence: string,
        correctAnswer: string,
        distractors: string[],
        language: string = 'English'
    ): Promise<{
        filteredDistractors: string[];
        removedDistractors: string[];
        reasoning: string;
    }> {
        const prompt = `Filter these distractors for vocabulary exercise:
- Language: ${language}
- Sentence: "${sentence}"
- Correct Answer: "${correctAnswer}"
- Potential Distractors: [${distractors.map(d => `"${d}"`).join(', ')}]`;

        try {
            const response = await this.generateText(prompt, this.defaultModel, this.getVocabularyFilterSystemMessage());

            // Parse JSON response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Could not parse JSON response from OpenAI');
            }

            const parsed = JSON.parse(jsonMatch[0]);

            // Validate response structure
            if (!parsed.filteredDistractors || !Array.isArray(parsed.filteredDistractors)) {
                throw new Error('Invalid response format: missing filteredDistractors array');
            }

            if (!parsed.removedDistractors || !Array.isArray(parsed.removedDistractors)) {
                throw new Error('Invalid response format: missing removedDistractors array');
            }

            if (!parsed.reasoning || typeof parsed.reasoning !== 'string') {
                throw new Error('Invalid response format: missing reasoning string');
            }

            // Ensure all original distractors are accounted for
            const allProcessed = [...parsed.filteredDistractors, ...parsed.removedDistractors];
            const missingDistractors = distractors.filter(d => !allProcessed.includes(d));

            if (missingDistractors.length > 0) {
                if (!this.silentMode) {
                    this.logger.warn(`Some distractors were not processed: ${missingDistractors.join(', ')}`);
                }
                // Add missing distractors to filtered list as a fallback
                parsed.filteredDistractors.push(...missingDistractors);
            }

            return {
                filteredDistractors: parsed.filteredDistractors,
                removedDistractors: parsed.removedDistractors,
                reasoning: parsed.reasoning
            };

        } catch (error) {
            if (!this.silentMode) {
                this.logger.warn('Vocabulary filtering failed, returning all distractors:', error.message);
            }

            // Graceful fallback: return all distractors if processing fails
            return {
                filteredDistractors: distractors,
                removedDistractors: [],
                reasoning: `Error occurred during analysis: ${error.message}. All distractors returned as-is for safety.`
            };
        }
    }
}