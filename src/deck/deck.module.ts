import { Module } from '@nestjs/common';
import { DeckService } from './deck.service';
import { DeckController } from './deck.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  providers: [DeckService],
  controllers: [DeckController],
  imports: [PrismaModule],
})
export class DeckModule {


}
