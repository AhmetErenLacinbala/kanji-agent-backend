import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { KanjiModule } from './kanji/kanji.module';
import { PrismaService } from './prisma/prisma.service';
import { SentenceModule } from './sentence/sentence.module';
import { SentencesController } from './sentences/sentences.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), KanjiModule, SentenceModule],
  controllers: [AppController, SentencesController],
  providers: [AppService, PrismaService],
})
export class AppModule { }
