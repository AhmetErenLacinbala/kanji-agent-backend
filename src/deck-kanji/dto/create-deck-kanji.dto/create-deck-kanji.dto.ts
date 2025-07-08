import { ApiProperty } from "@nestjs/swagger"
import { Deck, Kanji } from "@prisma/client"
import { IsNotEmpty } from "class-validator"

export class CreateDeckKanjiDto {
    @ApiProperty()
    @IsNotEmpty()
    id: String
    @IsNotEmpty()
    @ApiProperty()
    deckId: String
    @IsNotEmpty()
    @ApiProperty()
    kanjiId: String
    @IsNotEmpty()
    @ApiProperty()
    deck: Deck
    @IsNotEmpty()
    @ApiProperty()
    kanji: Kanji
}
