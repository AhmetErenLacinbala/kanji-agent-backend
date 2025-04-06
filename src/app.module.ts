import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { KanjiModule } from './kanji/kanji.module';
import { PrismaService } from './prisma/prisma.service';
import { SentenceModule } from './sentence/sentence.module';
import { SentenceController } from './sentence/sentence.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), KanjiModule, SentenceModule],
  controllers: [AppController, SentenceController],
  providers: [AppService, PrismaService],
})
export class AppModule { }
