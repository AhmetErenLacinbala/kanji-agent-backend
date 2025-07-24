import { Body, Controller, Get, Post, Param } from '@nestjs/common';
import { ApiBody, ApiTags, ApiParam } from '@nestjs/swagger';
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

    @Get('question/:id')
    @ApiParam({
        name: 'id',
        required: true,
        type: String,
        description: 'Sentence ID to get question details for testing broken questions'
    })
    getQuestion(@Param('id') id: string) {
        return this.sentenceService.getQuestionById(id);
    }

    @Post()
    @ApiBody({ type: CreateSentenceDto })
    //@ApiConsumes('application/x-www-form-urlencoded')
    create(@Body() dto: CreateSentenceDto) {
        console.log("dto", dto);
        return this.sentenceService.createSentence(dto);
    }


}
