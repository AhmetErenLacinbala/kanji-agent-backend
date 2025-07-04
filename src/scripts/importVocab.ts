import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

const prisma = new PrismaClient()

// Function to properly parse CSV line considering quoted values
function parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
        const char = line[i]

        if (char === '"') {
            inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim())
            current = ''
        } else {
            current += char
        }
    }

    // Add the last field
    result.push(current.trim())

    return result
}

async function importCSV() {
    const filePath = path.resolve(__dirname, '../../jlpt_vocab.csv')

    const fileStream = fs.createReadStream(filePath, 'utf8')
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    })

    let lineCount = 0
    let successCount = 0
    let errorCount = 0
    let isFirstLine = true

    for await (const line of rl) {
        lineCount++

        // Skip header row
        if (isFirstLine) {
            isFirstLine = false
            continue
        }

        // Skip empty lines
        if (!line.trim()) {
            continue
        }

        const fields = parseCSVLine(line)
        const [kanji, kana, meaning, jlptStr] = fields

        if (!kanji || !kana || !meaning || !jlptStr) {
            console.warn(`Skipping invalid row ${lineCount}:`, line)
            errorCount++
            continue
        }

        // Parse JLPT level more safely
        const jlptLevel = parseInt(jlptStr.replace(/^N/, '').trim())
        if (isNaN(jlptLevel) || jlptLevel < 1 || jlptLevel > 5) {
            console.warn(`Invalid JLPT level "${jlptStr}" at line ${lineCount}:`, line)
            errorCount++
            continue
        }

        try {
            await prisma.kanji.create({
                data: {
                    kanji: kanji.trim(),
                    kana: [kana.trim()],
                    meaning: meaning.trim(),
                    jlptLevel,
                    kanjiPoint: 0,
                },
            })
            successCount++
        } catch (error) {
            console.error(`Error inserting ${kanji} at line ${lineCount}:`, error.message)
            errorCount++
        }
    }

    console.log(`\nImport completed:`)
    console.log(`Total lines processed: ${lineCount}`)
    console.log(`Successfully imported: ${successCount}`)
    console.log(`Errors: ${errorCount}`)

    await prisma.$disconnect()
}

importCSV()
