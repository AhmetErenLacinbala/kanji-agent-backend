import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { KanjiService } from './kanji.service';
import { CreateKanjiDto } from './dto/create-kanji.dto';

@Controller('kanji')
export class KanjiController {
    constructor(private readonly kanjiService: KanjiService) { }

    @Get("/test")
    getTest() {
        return "test return";
    }
    @Post()
    create(@Body() dto: CreateKanjiDto) {
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

}
