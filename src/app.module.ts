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



@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: `.env.${process.env.NODE_ENV || 'dev'}`, }), KanjiModule, SentenceModule, AuthModule],
  controllers: [AppController, SentenceController, AuthController],
  providers: [AppService, PrismaService, AuthService],
})
export class AppModule { }
