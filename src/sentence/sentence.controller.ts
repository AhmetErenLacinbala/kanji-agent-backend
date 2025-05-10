import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { SentenceService } from './sentence.service';
import { CreateSentenceDto } from './dto/create-sentence.dto';

@ApiTags('Sentence')
@Controller('sentence')
export class SentenceController {
    constructor(private readonly sentenceService: SentenceService) { }

    @Get("/test")
    getTest() {
        return "test return";
    }

    @Post()
    @ApiBody({ type: CreateSentenceDto })
    //@ApiConsumes('application/x-www-form-urlencoded')
    create(@Body() dto: CreateSentenceDto) {
        console.log("dto", dto);
        return this.sentenceService.createSentence(dto);
    }


}
