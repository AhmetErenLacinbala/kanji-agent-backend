import { Module } from '@nestjs/common';
import { DeckService } from './deck.service';
import { DeckController } from './deck.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { DeckOwnershipGuard } from './guards/deck-ownership.guard';

@Module({
  providers: [DeckService, DeckOwnershipGuard],
  controllers: [DeckController],
  imports: [PrismaModule, AuthModule],
})
export class DeckModule {


}
