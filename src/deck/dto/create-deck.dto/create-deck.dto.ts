import { DeckKanji, User } from "@prisma/client"

export class CreateDeckDto {
    name?: string
    isAuto?: boolean
    userId?: string
    ownerId?: string
    editbyUser?: boolean
    isAnonymous?: boolean
    kanjis?: string[]
}
