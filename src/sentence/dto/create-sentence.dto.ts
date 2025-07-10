import { ApiProperty } from "@nestjs/swagger";

export class CreateSentenceDto {
    @ApiProperty()
    sentence: string;
    @ApiProperty()
    meaning: string;
    @ApiProperty()
    kana: string;
    @ApiProperty()
    usedKanjiForm?: string;
    @ApiProperty()
    kanjiId: string;
    @ApiProperty()
    whitelist: string[];
    @ApiProperty()
    tokenized: Word[];
}

export interface Word {
    surface: string;
    kana: string;
    pos: string;
}
