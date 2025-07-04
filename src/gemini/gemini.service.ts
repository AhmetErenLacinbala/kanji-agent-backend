import { GoogleGenerativeAI } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GeminiService {
    private readonly logger = new Logger(GeminiService.name);
    private genAI: GoogleGenerativeAI;
    private silentMode: boolean = false;

    constructor(private configService: ConfigService, silentMode: boolean = false) {
        this.silentMode = silentMode;
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');

        if (!apiKey) {
            throw new Error('Missing GEMINI_API_KEY in environment variables');
        }

        this.genAI = new GoogleGenerativeAI(apiKey);
        if (!this.silentMode) {
            this.logger.log('Gemini AI service initialized successfully');
        }
    }

    async generateText(prompt: string): Promise<string> {
        try {
            if (!prompt || prompt.trim().length === 0) {
                throw new Error('Prompt cannot be empty');
            }

            const model = this.genAI.getGenerativeModel({
                model: 'gemini-1.5-flash',
                generationConfig: {
                    temperature: 0.7,
                    topP: 0.8,
                    topK: 40,
                    maxOutputTokens: 1000,
                }
            });

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            if (!text) {
                throw new Error('No response generated from Gemini');
            }

            return text;
        } catch (error) {
            if (!this.silentMode) {
                this.logger.error('Error generating text with Gemini:', error.message);
            }

            if (error.message?.includes('API_KEY_INVALID')) {
                throw new Error('Invalid Gemini API key');
            }

            if (error.message?.includes('QUOTA_EXCEEDED')) {
                throw new Error('Gemini API quota exceeded');
            }

            throw new Error(`Failed to generate text: ${error.message}`);
        }
    }

    async generateKanjiExplanation(kanji: string): Promise<string> {
        const prompt = `Explain the Japanese kanji "${kanji}" in detail. Include:
        1. The meaning and etymology
        2. Common readings (on'yomi and kun'yomi)
        3. 2-3 example words using this kanji
        4. Memory tips or mnemonics
        
        Keep the explanation concise but informative, suitable for a Japanese learner.`;

        return this.generateText(prompt);
    }

    async generateSentenceExplanation(sentence: string): Promise<string> {
        const prompt = `Analyze this Japanese sentence: "${sentence}"
        
        Please provide:
        1. Grammar breakdown
        2. Vocabulary explanation
        3. Cultural context if relevant
        4. English translation
        
        Format the response clearly for a Japanese language learner.`;

        return this.generateText(prompt);
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
        const prompt = `You are a language learning expert helping to create vocabulary exercises. I need you to analyze a sentence with a missing word and filter out distractors that are too semantically similar to the correct answer.

**Task**: Filter distractors to ensure only ONE answer is clearly correct.

**Context:**
- Language: ${language}
- Sentence: "${sentence}"
- Correct Answer: "${correctAnswer}"
- Potential Distractors: [${distractors.map(d => `"${d}"`).join(', ')}]

**Instructions:**
1. Test each distractor by mentally placing it in the sentence
2. Remove distractors that could logically fit or make grammatical sense
3. Remove distractors that are semantically too close to the correct answer
4. Keep only distractors that are clearly wrong in this context
5. Ensure the remaining distractors are plausible vocabulary words but obviously incorrect for this sentence

**Criteria for REMOVAL (distractors to filter out):**
- Could reasonably fit in the sentence context
- Are synonyms or near-synonyms of the correct answer
- Have overlapping meanings with the correct answer
- Would make the sentence grammatically and semantically acceptable
- Are in the same semantic category (colors, emotions, sizes, etc.) when context-sensitive

**Criteria for KEEPING (good distractors):**
- Are valid vocabulary words but clearly wrong in this context
- Create obviously incorrect or nonsensical sentences
- Are from different semantic categories when appropriate
- Would be immediately recognizable as wrong to a language learner

**Output Format (JSON only, no explanations outside JSON):**
{
  "filteredDistractors": ["distractor1", "distractor2", ...],
  "removedDistractors": ["removed1", "removed2", ...],
  "reasoning": "Brief explanation of filtering decisions and why certain distractors were removed vs kept"
}

Analyze carefully and be strict about semantic similarity to ensure educational value.`;

        try {
            const response = await this.generateText(prompt);

            // Parse JSON response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Could not parse JSON response from Gemini');
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
                this.logger.error('Error filtering vocabulary distractors:', error.message);
            }

            // Fallback: return all distractors if parsing fails
            return {
                filteredDistractors: distractors,
                removedDistractors: [],
                reasoning: `Error occurred during analysis: ${error.message}. All distractors returned as-is for safety.`
            };
        }
    }

    async generateKanjiQuestionsAndWhitelist(
        kanji: string,
        meaning: string,
        kanaReadings: string[],
        jlptLevel: number
    ): Promise<{
        whitelist: string[];
        sentences: Array<{
            sentence: string;
            meaning: string;
            kana: string;
            usedKanjiForm: string;
        }>;
    }> {
        const prompt = `You are a Japanese language expert creating educational content for a kanji learning app. I need you to generate content for the kanji "${kanji}".

**Kanji Information:**
- Kanji: ${kanji}
- Meaning: ${meaning}
- Readings: ${kanaReadings.join(', ')}
- JLPT Level: N${jlptLevel}

**IMPORTANT CONTENT GUIDELINES:**
- For sensitive topics (war, weapons, violence, disasters): Use ONLY educational, historical, or academic contexts
- For controversial topics: Focus on learning, studying, or historical understanding
- Be culturally sensitive, especially regarding Japanese history - use respectful, educational language
- Never promote, glorify, or make positive statements about war, violence, or weapons
- Use contexts like: studying history, reading about past events, learning in school, academic research
- Focus on neutral, educational, learning-oriented content

**Task 1 - Generate Whitelist (30 UNIQUE Japanese kanji):**
Create a whitelist of exactly 30 UNIQUE Japanese kanji that could be used as incorrect answer choices in multiple-choice questions. These should be:
- Japanese kanji characters (NOT English words)
- From the same JLPT level (N${jlptLevel}) as the target kanji
- Related to similar semantic fields but clearly different meanings
- Common kanji that students at this level would know
- Plausible but clearly wrong options for quiz questions
- Single kanji characters or common kanji compounds
- **CRITICAL: All 30 kanji must be DIFFERENT from each other - NO DUPLICATES**
- **CRITICAL: Do NOT include the target kanji "${kanji}" in the whitelist**
- Avoid sensitive or controversial kanji (war, weapons, violence, disasters)

**Task 2 - Generate 5 Example Sentences:**
Create 5 Japanese sentences that demonstrate the ACTUAL USAGE of this kanji in real-life contexts. Each sentence should:
- Be appropriate for JLPT N${jlptLevel} level learners
- Show HOW the kanji is actually used in daily life, not just learning about it
- Be 10-20 characters long (not too complex)
- Have clear, simple English translations that sound natural
- Include the romanized reading (kana) of the entire sentence
- Show different uses/forms of the kanji when possible
- Be SPECIFIC enough that the kanji is clearly the correct choice in a quiz
- Provide RICH CONTEXT so learners can understand the kanji's meaning from the sentence
- Demonstrate practical usage, actions, or real situations involving the kanji
- AVOID meta-educational sentences like "X is written in the book" or "I studied X"
- AVOID generic statements like "There are X" or "X is popular" without context
- FOCUS on what the kanji actually means and how it's used in real contexts
- Make sentences descriptive enough that someone could guess the kanji meaning from context

**IMPORTANT FOR ENGLISH TRANSLATIONS:**
If the kanji has multiple meanings (e.g., "limit, restriction"), choose the MOST APPROPRIATE single meaning for each sentence context and use it naturally in English. Do NOT use the full meaning string literally.
- Example: For 限定 (limit, restriction):
  - Good: "This is a limited edition item" (using "limited")
  - Good: "There are restrictions on entry" (using "restrictions")  
  - BAD: "This is a limit, restriction edition item"

**CONTEXT EXAMPLES:**
- If kanji means "intelligence" → BAD: "There are intelligences" GOOD: "Artificial intelligence is advancing" or "This test measures intelligence"
- If kanji means "oil" → BAD: "Oil is popular" GOOD: "Crude oil prices are rising" or "I use oil for cooking"
- If kanji means "friend" → BAD: "There are friends" GOOD: "I went to the movies with my friend" or "Making friends is important"
- If kanji means "limit/restriction" → BAD: "There are limits" GOOD: "This sale is limited to members only" or "Speed limit is 50 km/h"

CREATE SENTENCES THAT PROVIDE ENOUGH CONTEXT FOR QUIZ COMPREHENSION - learners should understand what the kanji means from how it's used in the sentence.

**Output Format (JSON only, no explanations outside JSON):**
{
  "whitelist": ["kanji1", "kanji2", "kanji3", ...],
  "sentences": [
    {
      "sentence": "Japanese sentence with ${kanji}",
      "meaning": "English translation",
      "kana": "romanized reading of entire sentence",
      "usedKanjiForm": "specific form of ${kanji} used"
    },
    ...
  ]
}

Generate exactly 5 sentences and exactly 15 UNIQUE Japanese kanji for the whitelist. Ensure all whitelist kanji are from JLPT N${jlptLevel} level and are all different from each other.`;

        try {
            const response = await this.generateText(prompt);

            // Parse JSON response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Could not parse JSON response from Gemini');
            }

            const parsed = JSON.parse(jsonMatch[0]);

            // Validate response structure
            if (!parsed.whitelist || !Array.isArray(parsed.whitelist)) {
                throw new Error('Invalid response format: missing whitelist array');
            }

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
            if (parsed.sentences.length !== 10) {
                if (!this.silentMode) {
                    this.logger.warn(`Expected 10 sentences, got ${parsed.sentences.length} for kanji ${kanji}`);
                }
            }

            if (parsed.whitelist.length !== 15) {
                if (!this.silentMode) {
                    this.logger.warn(`Expected 15 whitelist kanji, got ${parsed.whitelist.length} for kanji ${kanji}`);
                }
            }

            return {
                whitelist: parsed.whitelist,
                sentences: parsed.sentences
            };

        } catch (error) {
            if (!this.silentMode) {
                this.logger.error(`Error generating content for kanji ${kanji}:`, error.message);
            }

            // Fallback: return content with 10 natural sentences
            const fallbackSentences: Array<{
                sentence: string;
                meaning: string;
                kana: string;
                usedKanjiForm: string;
            }> = [];

            // Create appropriate fallback sentences based on content sensitivity
            const sensitiveTopics = ['戦争', '爆弾', '核', '武器', '原爆', '殺', '死', '暴力', '軍'];
            const isSensitiveTopic = sensitiveTopics.some(topic =>
                kanji.includes(topic) || meaning.toLowerCase().includes('war') ||
                meaning.toLowerCase().includes('bomb') || meaning.toLowerCase().includes('weapon') ||
                meaning.toLowerCase().includes('nuclear') || meaning.toLowerCase().includes('violence') ||
                meaning.toLowerCase().includes('military') || meaning.toLowerCase().includes('death')
            );

            // Parse multiple meanings and choose appropriate ones for different contexts
            const meanings = meaning.includes(',') ? meaning.split(',').map(m => m.trim()) : [meaning];
            const primaryMeaning = meanings[0]; // Use first meaning as primary
            const alternativeMeaning = meanings.length > 1 ? meanings[1] : primaryMeaning;

            const fallbackTemplates = isSensitiveTopic ? [
                // Historical/educational contexts for sensitive topics
                { sentence: `${kanji}は歴史を変えました。`, meaning: `${primaryMeaning} changed history.`, kana: `${kanji} wa rekishi wo kaemashita` },
                { sentence: `過去に${kanji}がありました。`, meaning: `There was ${primaryMeaning} in the past.`, kana: `kako ni ${kanji} ga arimashita` },
                { sentence: `${kanji}の影響は大きかった。`, meaning: `The impact of ${primaryMeaning} was great.`, kana: `${kanji} no eikyou wa ookikatta` },
                { sentence: `人々は${kanji}を恐れました。`, meaning: `People feared ${primaryMeaning}.`, kana: `hitobito wa ${kanji} wo osore mashita` },
                { sentence: `${kanji}により多くの人が苦しみました。`, meaning: `Many people suffered due to ${primaryMeaning}.`, kana: `${kanji} ni yori ooku no hito ga kurushimashita` },
                { sentence: `世界は${kanji}のない平和を望んでいます。`, meaning: `The world hopes for peace without ${primaryMeaning}.`, kana: `sekai wa ${kanji} no nai heiwa wo nozonde imasu` },
                { sentence: `${kanji}は人類の教訓です。`, meaning: `${primaryMeaning} is a lesson for humanity.`, kana: `${kanji} wa jinrui no kyoukun desu` },
                { sentence: `今は${kanji}について考える時です。`, meaning: `Now is the time to think about ${primaryMeaning}.`, kana: `ima wa ${kanji} ni tsuite kangaeru toki desu` },
                { sentence: `${kanji}を防ぐ努力をしています。`, meaning: `We are making efforts to prevent ${primaryMeaning}.`, kana: `${kanji} wo fusegu doryoku wo shite imasu` },
                { sentence: `平和のために${kanji}を学びます。`, meaning: `We learn about ${primaryMeaning} for peace.`, kana: `heiwa no tame ni ${kanji} wo manabimasu` }
            ] : [
                // Contextual usage templates that demonstrate actual meaning and usage
                { sentence: `この商品は${kanji}版です。`, meaning: `This product is a ${primaryMeaning}ed edition.`, kana: `kono shouhin wa ${kanji} ban desu` },
                { sentence: `${kanji}を使って作業します。`, meaning: `I work using ${primaryMeaning}.`, kana: `${kanji} wo tsukatte sagyou shimasu` },
                { sentence: `${kanji}の専門家に相談しました。`, meaning: `I consulted a ${primaryMeaning} expert.`, kana: `${kanji} no senmonka ni soudan shimashita` },
                { sentence: `最新の${kanji}技術です。`, meaning: `This is the latest ${primaryMeaning} technology.`, kana: `saishin no ${kanji} gijutsu desu` },
                { sentence: `${kanji}の効果を実感しました。`, meaning: `I experienced the effects of ${primaryMeaning}.`, kana: `${kanji} no kouka wo jitukan shimashita` },
                { sentence: `会社で${kanji}を管理しています。`, meaning: `I manage ${alternativeMeaning} at the company.`, kana: `kaisha de ${kanji} wo kanri shite imasu` },
                { sentence: `${kanji}に関する法律があります。`, meaning: `There are laws regarding ${alternativeMeaning}.`, kana: `${kanji} ni kansuru houritsu ga arimasu` },
                { sentence: `この地域は${kanji}が厳しいです。`, meaning: `This area has strict ${alternativeMeaning}.`, kana: `kono chiiki wa ${kanji} ga kibishii desu` },
                { sentence: `${kanji}を測定する機器です。`, meaning: `This is equipment for measuring ${primaryMeaning}.`, kana: `${kanji} wo sokutei suru kiki desu` },
                { sentence: `${kanji}の改善に取り組んでいます。`, meaning: `We are working on improving ${primaryMeaning}.`, kana: `${kanji} no kaizen ni torikunde imasu` }
            ];

            for (let i = 0; i < 10; i++) {
                const template = fallbackTemplates[i];
                fallbackSentences.push({
                    sentence: template.sentence,
                    meaning: template.meaning,
                    kana: template.kana,
                    usedKanjiForm: kanji
                });
            }

            return {
                whitelist: [kanji], // Fallback to the kanji itself
                sentences: fallbackSentences
            };
        }
    }

    async generateWhitelistKanji(
        targetKanji: string,
        jlptLevel: number,
        excludeKanji: string[] = [],
        requestedCount: number = 30
    ): Promise<string[]> {
        const excludeList = excludeKanji.length > 0 ? excludeKanji.join(', ') : 'none';

        const prompt = `You are a Japanese language expert. Generate exactly ${requestedCount} UNIQUE Japanese kanji characters for a vocabulary quiz.

**Requirements:**
- Target kanji: ${targetKanji}
- JLPT Level: N${jlptLevel}
- Generate exactly ${requestedCount} UNIQUE kanji
- All kanji must be from JLPT N${jlptLevel} level
- Exclude these kanji: ${excludeList}
- Use single kanji or common kanji compounds
- Choose kanji that are semantically different from "${targetKanji}"
- Suitable as incorrect answers in multiple choice questions
- **CRITICAL: All kanji must be DIFFERENT from each other - NO DUPLICATES**
- **CRITICAL: Do NOT include any excluded kanji or the target kanji**

**Output Format (JSON only):**
{
  "whitelist": ["kanji1", "kanji2", "kanji3", ...]
}

Generate exactly ${requestedCount} UNIQUE kanji from JLPT N${jlptLevel} level. Ensure all kanji are different from each other.`;

        try {
            const response = await this.generateText(prompt);

            // Parse JSON response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Could not parse JSON response from Gemini');
            }

            const parsed = JSON.parse(jsonMatch[0]) as { whitelist: unknown[] };

            if (!parsed.whitelist || !Array.isArray(parsed.whitelist)) {
                throw new Error('Invalid response format: missing whitelist array');
            }

            // Ensure all items are strings and remove duplicates
            const stringKanji = parsed.whitelist.filter((k): k is string => typeof k === 'string');
            const uniqueKanji = [...new Set(stringKanji)]
                .filter((k: string) => !excludeKanji.includes(k) && k !== targetKanji);

            if (!this.silentMode) {
                this.logger.log(`Generated ${parsed.whitelist.length} kanji, ${uniqueKanji.length} unique after filtering`);
            }

            return uniqueKanji.slice(0, requestedCount); // Ensure exact count

        } catch (error) {
            if (!this.silentMode) {
                this.logger.error(`Error generating whitelist kanji:`, error.message);
            }
            return [targetKanji]; // Fallback
        }
    }
}
