export class CreateKanjiDto {
    kanji: string;
    meaning: string;
    kana: string[];
    kanjiPoint: number;
    jlptLevel: number;
    exampleSentence: {
        sentence: string;
        meaning: string;
        kana: string;
        counter?: number;
    }[];
}
