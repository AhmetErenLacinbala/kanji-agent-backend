import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GeminiService } from './gemini.service';
import { GeminiController } from './gemini.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  providers: [GeminiService],
  controllers: [GeminiController],
  imports: [PrismaModule, ConfigModule],
  exports: [GeminiService],
})
export class GeminiModule { }
