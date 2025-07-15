import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { KanjiModule } from './kanji/kanji.module';
import { PrismaService } from './prisma/prisma.service';
import { SentenceModule } from './sentence/sentence.module';
import { SentenceController } from './sentence/sentence.controller';
import { AuthModule } from './auth/auth.module';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { DeckModule } from './deck/deck.module';
import { UserKanjiProgressModule } from './user-kanji-progress/user-kanji-progress.module';
import { DeckKanjiModule } from './deck-kanji/deck-kanji.module';



@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: `.env.${process.env.NODE_ENV || 'dev'}`, }), KanjiModule, SentenceModule, AuthModule, DeckModule, UserKanjiProgressModule, DeckKanjiModule],
  controllers: [AppController, SentenceController, AuthController],
  providers: [AppService, PrismaService, AuthService],
})
export class AppModule { }
