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
        const prompt = `You are a Japanese language expert creating educational sentences for a kanji learning app. I need you to generate UNIQUE, FRESH sentences for the kanji "${kanji}".

**IMPORTANT: FORGET ALL PREVIOUS CONTENT**
This is a completely new request. Do NOT repeat or reference any sentences, patterns, or structures from previous kanji. Each kanji should get completely unique and varied content. Start fresh!

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

**Task - Generate 5 Example Sentences:**
Create 5 COMPLETELY DIFFERENT Japanese sentences that demonstrate the ACTUAL USAGE of this kanji in real-life contexts. IMPORTANT: Use entirely different sentence structures, topics, and situations for each sentence. Each sentence should:
- Be appropriate for JLPT N${jlptLevel} level learners
- Show HOW the kanji is actually used in daily life, not just learning about it
- Be 10-20 characters long (not too complex)
- Have clear, simple English translations that sound natural
- Include the full Japanese reading (hiragana/katakana) of the entire sentence - NO romanized text
- Show different uses/forms of the kanji when possible
- Be SPECIFIC enough that the kanji is clearly the correct choice in a quiz
- Provide RICH CONTEXT so learners can understand the kanji's meaning from the sentence
- Demonstrate practical usage, actions, or real situations involving the kanji
- AVOID meta-educational sentences like "X is written in the book" or "I studied X"
- AVOID generic statements like "There are X" or "X is popular" without context
- FOCUS on what the kanji actually means and how it's used in real contexts
- Make sentences descriptive enough that someone could guess the kanji meaning from context

**CRITICAL: VARY SENTENCE TYPES AND STYLES:**
- Mix different sentence types: statements, questions, exclamations, commands
- Mix different formality levels: casual (だ/である), polite (です/ます), informal conversation
- Mix different contexts: work, home, shopping, travel, relationships, hobbies, etc.
- Mix different grammar patterns: present, past, conditional, causative, passive, etc.
- NEVER repeat the same sentence structure twice
- Each sentence should feel completely unrelated to the others except for containing the target kanji

**FORGET ALL PREVIOUS PATTERNS - CREATE FRESH CONTENT FOR THIS SPECIFIC KANJI**

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
  "sentences": [
    {
      "sentence": "Japanese sentence with ${kanji}",
      "meaning": "English translation",
      "kana": "full Japanese reading in hiragana/katakana (NO romanized text)",
      "usedKanjiForm": "specific form of ${kanji} used"
    },
    ...
  ]
}

Generate exactly 5 sentences that demonstrate practical usage of this kanji.

**CRITICAL: The "kana" field must contain ONLY Japanese characters (hiragana/katakana). NO romanized text allowed. Examples:**
- CORRECT: "きょうはがっこうにいきます。"
- CORRECT: "わたしはテストをうけました。"
- WRONG: "kyou wa gakkou ni ikimasu"
- WRONG: "watashi wa tesuto wo ukemashita"`;

        try {
            const response = await this.generateText(prompt);

            // Parse JSON response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Could not parse JSON response from Gemini');
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

            // Create contextually appropriate fallback templates based on meaning type
            const createContextualSentences = (kanji: string, meaning: string) => {
                const lowerMeaning = meaning.toLowerCase();

                // Physical objects (concrete nouns)
                if (lowerMeaning.includes('oil') || lowerMeaning.includes('fuel') || lowerMeaning.includes('gas') ||
                    lowerMeaning.includes('water') || lowerMeaning.includes('food') || lowerMeaning.includes('book') ||
                    lowerMeaning.includes('car') || lowerMeaning.includes('money') || lowerMeaning.includes('tool')) {
                    return [
                        { sentence: `${kanji}を買いに行きました。`, meaning: `I went to buy ${primaryMeaning}.`, kana: `${kanji}をかいにいきました。` },
                        { sentence: `${kanji}の値段が高いです。`, meaning: `The price of ${primaryMeaning} is high.`, kana: `${kanji}のねだんがたかいです。` },
                        { sentence: `${kanji}を使います。`, meaning: `I use ${primaryMeaning}.`, kana: `${kanji}をつかいます。` },
                        { sentence: `${kanji}がありません。`, meaning: `There is no ${primaryMeaning}.`, kana: `${kanji}がありません。` },
                        { sentence: `${kanji}を探しています。`, meaning: `I am looking for ${primaryMeaning}.`, kana: `${kanji}をさがしています。` }
                    ];
                }
                // People/relationships
                else if (lowerMeaning.includes('friend') || lowerMeaning.includes('teacher') || lowerMeaning.includes('student') ||
                    lowerMeaning.includes('person') || lowerMeaning.includes('child') || lowerMeaning.includes('parent')) {
                    return [
                        { sentence: `${kanji}に会いました。`, meaning: `I met a ${primaryMeaning}.`, kana: `${kanji}にあいました。` },
                        { sentence: `${kanji}と話しました。`, meaning: `I talked with my ${primaryMeaning}.`, kana: `${kanji}とはなしました。` },
                        { sentence: `${kanji}を紹介します。`, meaning: `I will introduce my ${primaryMeaning}.`, kana: `${kanji}をしょうかいします。` },
                        { sentence: `${kanji}が来ました。`, meaning: `My ${primaryMeaning} came.`, kana: `${kanji}がきました。` },
                        { sentence: `${kanji}は優しいです。`, meaning: `My ${primaryMeaning} is kind.`, kana: `${kanji}はやさしいです。` }
                    ];
                }
                // Abstract concepts (principles, ideas, views, etc.)
                else if (lowerMeaning.includes('principle') || lowerMeaning.includes('idea') || lowerMeaning.includes('view') ||
                    lowerMeaning.includes('opinion') || lowerMeaning.includes('concept') || lowerMeaning.includes('theory') ||
                    lowerMeaning.includes('rule') || lowerMeaning.includes('method') || lowerMeaning.includes('way')) {
                    return [
                        { sentence: `${kanji}について考えました。`, meaning: `I thought about the ${primaryMeaning}.`, kana: `${kanji}についてかんがえました。` },
                        { sentence: `${kanji}を説明します。`, meaning: `I will explain the ${primaryMeaning}.`, kana: `${kanji}をせつめいします。` },
                        { sentence: `${kanji}に従います。`, meaning: `I follow the ${primaryMeaning}.`, kana: `${kanji}にしたがいます。` },
                        { sentence: `${kanji}を理解しました。`, meaning: `I understood the ${primaryMeaning}.`, kana: `${kanji}をりかいしました。` },
                        { sentence: `${kanji}が重要です。`, meaning: `The ${primaryMeaning} is important.`, kana: `${kanji}がじゅうようです。` }
                    ];
                }
                // Places/locations
                else if (lowerMeaning.includes('place') || lowerMeaning.includes('location') || lowerMeaning.includes('school') ||
                    lowerMeaning.includes('home') || lowerMeaning.includes('office') || lowerMeaning.includes('country') ||
                    lowerMeaning.includes('city') || lowerMeaning.includes('area')) {
                    return [
                        { sentence: `${kanji}に行きました。`, meaning: `I went to the ${primaryMeaning}.`, kana: `${kanji}にいきました。` },
                        { sentence: `${kanji}で待っています。`, meaning: `I am waiting at the ${primaryMeaning}.`, kana: `${kanji}でまっています。` },
                        { sentence: `${kanji}から来ました。`, meaning: `I came from the ${primaryMeaning}.`, kana: `${kanji}からきました。` },
                        { sentence: `${kanji}を見つけました。`, meaning: `I found the ${primaryMeaning}.`, kana: `${kanji}をみつけました。` },
                        { sentence: `${kanji}は遠いです。`, meaning: `The ${primaryMeaning} is far.`, kana: `${kanji}はとおいです。` }
                    ];
                }
                // Emotions/feelings/states
                else if (lowerMeaning.includes('happy') || lowerMeaning.includes('sad') || lowerMeaning.includes('angry') ||
                    lowerMeaning.includes('love') || lowerMeaning.includes('fear') || lowerMeaning.includes('joy') ||
                    lowerMeaning.includes('feeling') || lowerMeaning.includes('emotion')) {
                    return [
                        { sentence: `${kanji}を感じます。`, meaning: `I feel ${primaryMeaning}.`, kana: `${kanji}をかんじます。` },
                        { sentence: `${kanji}になりました。`, meaning: `I became ${primaryMeaning}.`, kana: `${kanji}になりました。` },
                        { sentence: `${kanji}な気持ちです。`, meaning: `I have a ${primaryMeaning} feeling.`, kana: `${kanji}なきもちです。` },
                        { sentence: `${kanji}を表現します。`, meaning: `I express ${primaryMeaning}.`, kana: `${kanji}をひょうげんします。` },
                        { sentence: `${kanji}が伝わります。`, meaning: `The ${primaryMeaning} is conveyed.`, kana: `${kanji}がつたわります。` }
                    ];
                }
                // Time/events/actions
                else if (lowerMeaning.includes('time') || lowerMeaning.includes('event') || lowerMeaning.includes('meeting') ||
                    lowerMeaning.includes('work') || lowerMeaning.includes('study') || lowerMeaning.includes('practice') ||
                    lowerMeaning.includes('activity') || lowerMeaning.includes('action')) {
                    return [
                        { sentence: `${kanji}を始めました。`, meaning: `I started the ${primaryMeaning}.`, kana: `${kanji}をはじめました。` },
                        { sentence: `${kanji}に参加します。`, meaning: `I will participate in the ${primaryMeaning}.`, kana: `${kanji}にさんかします。` },
                        { sentence: `${kanji}を終えました。`, meaning: `I finished the ${primaryMeaning}.`, kana: `${kanji}をおえました。` },
                        { sentence: `${kanji}を準備します。`, meaning: `I will prepare for the ${primaryMeaning}.`, kana: `${kanji}をじゅんびします。` },
                        { sentence: `${kanji}が続きます。`, meaning: `The ${primaryMeaning} continues.`, kana: `${kanji}がつづきます。` }
                    ];
                }
                // Death/deceased (sensitive topics)
                else if (lowerMeaning.includes('death') || lowerMeaning.includes('dead') || lowerMeaning.includes('deceased')) {
                    return [
                        { sentence: `${kanji}を悼みます。`, meaning: `We mourn the ${primaryMeaning}.`, kana: `${kanji}をいたみます。` },
                        { sentence: `${kanji}を偲びます。`, meaning: `We remember the ${primaryMeaning}.`, kana: `${kanji}をしのびます。` },
                        { sentence: `${kanji}について聞きました。`, meaning: `I heard about the ${primaryMeaning}.`, kana: `${kanji}についてききました。` },
                        { sentence: `${kanji}の知らせが来ました。`, meaning: `News of the ${primaryMeaning} came.`, kana: `${kanji}のしらせがきました。` },
                        { sentence: `${kanji}を受け入れました。`, meaning: `I accepted the ${primaryMeaning}.`, kana: `${kanji}をうけいれました。` }
                    ];
                }
                // Default for other concepts - safer, more universal sentences
                else {
                    return [
                        { sentence: `${kanji}について話しました。`, meaning: `We talked about ${primaryMeaning}.`, kana: `${kanji}についてはなしました。` },
                        { sentence: `${kanji}を知っています。`, meaning: `I know about ${primaryMeaning}.`, kana: `${kanji}をしっています。` },
                        { sentence: `${kanji}が話題になりました。`, meaning: `${primaryMeaning} became a topic.`, kana: `${kanji}がわだいになりました。` },
                        { sentence: `${kanji}に関心があります。`, meaning: `I am interested in ${primaryMeaning}.`, kana: `${kanji}にかんしんがあります。` },
                        { sentence: `${kanji}について学びました。`, meaning: `I learned about ${primaryMeaning}.`, kana: `${kanji}についてまなびました。` }
                    ];
                }
            };

            const diverseTemplates = createContextualSentences(kanji, meaning);

            const fallbackTemplates = isSensitiveTopic ? [
                // Historical/educational contexts for sensitive topics with varied structures
                { sentence: `${kanji}の歴史を学んだ。`, meaning: `I learned the history of ${primaryMeaning}.`, kana: `${kanji}のれきしをまなんだ。` },
                { sentence: `なぜ${kanji}が起きたのか？`, meaning: `Why did ${primaryMeaning} happen?`, kana: `なぜ${kanji}がおきたのか？` },
                { sentence: `${kanji}を忘れてはいけない。`, meaning: `We must not forget ${primaryMeaning}.`, kana: `${kanji}をわすれてはいけない。` },
                { sentence: `平和は${kanji}より大切だ。`, meaning: `Peace is more important than ${primaryMeaning}.`, kana: `へいわは${kanji}よりたいせつだ。` },
                { sentence: `${kanji}の犠牲者を偲ぶ。`, meaning: `We remember the victims of ${primaryMeaning}.`, kana: `${kanji}のぎせいしゃをしのぶ。` }
            ] : diverseTemplates;

            // Shuffle templates and select 5 random ones for variety
            const shuffledTemplates = [...fallbackTemplates].sort(() => Math.random() - 0.5);

            for (let i = 0; i < 5; i++) {
                const template = shuffledTemplates[i % shuffledTemplates.length];
                fallbackSentences.push({
                    sentence: template.sentence,
                    meaning: template.meaning,
                    kana: template.kana,
                    usedKanjiForm: kanji
                });
            }

            return fallbackSentences;
        }
    }

    async generateKanjiWhitelist(
        targetKanji: string,
        jlptLevel: number,
        requestedCount: number = 15
    ): Promise<string[]> {
        const prompt = `You are a Japanese language expert creating quiz content. Generate exactly ${requestedCount} UNIQUE Japanese kanji characters that could be used as incorrect answer choices for the kanji "${targetKanji}".

**Target Kanji Information:**
- Kanji: ${targetKanji}
- JLPT Level: N${jlptLevel}

**Requirements:**
- Generate exactly ${requestedCount} UNIQUE Japanese kanji
- All kanji must be from JLPT N${jlptLevel} level
- Choose kanji that are semantically different from "${targetKanji}"
- Suitable as plausible but incorrect answers in multiple choice questions
- Use single kanji or common kanji compounds
- **CRITICAL: All kanji must be DIFFERENT from each other - NO DUPLICATES**
- **CRITICAL: Do NOT include the target kanji "${targetKanji}" in the list**
- Avoid sensitive or controversial kanji (war, weapons, violence, disasters)

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
                .filter((k: string) => k !== targetKanji);

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

    async generateWhitelistKanji(
        targetKanji: string,
        jlptLevel: number,
        excludeKanji: string[] = [],
        requestedCount: number = 15
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
