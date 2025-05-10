import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { KanjiService } from './kanji.service';
import { CreateKanjiDto } from './dto/create-kanji.dto';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';


@ApiTags('Kanji')
@Controller('kanji')
export class KanjiController {
    constructor(private readonly kanjiService: KanjiService) { }

    @Get("/test")
    getTest() {
        return "test return";
    }

    @Post()
    @ApiBody({ type: CreateKanjiDto })
    @ApiConsumes('application/x-www-form-urlencoded')
    create(@Body() dto: CreateKanjiDto) {
        console.log("dto", dto);
        return this.kanjiService.createKanji(dto);
    }

    @Get()
    getAll() {
        return this.kanjiService.getAllKanji();
    }

    @Get(':id')
    getOne(@Param('id') id: string) {
        return this.kanjiService.getKanjiById(id);
    }
    @Get('by/kanji/:kanji')
    getByKanji(@Param('kanji') kanji: string) {
        return this.kanjiService.getByKanjiString(kanji);
    }
}
