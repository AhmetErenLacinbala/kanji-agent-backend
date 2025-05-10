import { ApiProperty } from "@nestjs/swagger";

export class CreateKanjiDto {
    @ApiProperty({ example: '雨', description: 'The kanji character' })
    kanji: string

    @ApiProperty({ example: 'rain', description: 'The meaning in English' })
    meaning: string

    @ApiProperty({
        type: [String],
        example: ['あめ'],
        description: 'List of kana readings',
    })
    kana: string[]

    @ApiProperty({ example: 0, description: 'Initial kanji point (for progress)' })
    kanjiPoint: number

    @ApiProperty({ example: 5, description: 'JLPT level (1 to 5)' })
    jlptLevel: number
    exampleSentence: {
        sentence: string;
        meaning: string;
        kana: string;
        counter?: number;
    }[];
}
