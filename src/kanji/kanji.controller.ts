import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { KanjiService } from './kanji.service';
import { CreateKanjiDto } from './dto/create-kanji.dto';
import { GetKanjiQueryDto } from './dto/get-kanji-query.dto';
import { ApiBody, ApiConsumes, ApiQuery, ApiTags } from '@nestjs/swagger';


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

    @Get('paginated')
    @ApiQuery({ name: 'from', required: false, type: Number, description: 'Starting index for pagination' })
    @ApiQuery({ name: 'take', required: false, type: Number, description: 'Number of items to take' })
    @ApiQuery({ name: 'jlptLevel', required: false, type: [Number], description: 'JLPT levels to filter by (can be multiple)' })
    getKanjiPaginated(@Query() query: GetKanjiQueryDto) {
        return this.kanjiService.getKanjiWithPagination(query);
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
