import { PartialType } from "@nestjs/swagger";
import { CreateDeckKanjiDto } from "../create-deck-kanji.dto/create-deck-kanji.dto";

export class UpdateDeckKanjiDto extends PartialType(CreateDeckKanjiDto) { }
