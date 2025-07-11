// src/main.ts
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { ValidationPipe } from '@nestjs/common'
import { config as dotenvConfig } from 'dotenv'

// 👇 Load env file dynamically based on NODE_ENV
dotenvConfig({ path: `.env.${process.env.NODE_ENV || 'dev'}` })

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Enable global validation with transformation
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
    whitelist: true,
    forbidNonWhitelisted: false,
  }))

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  })

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Kanji Agent API')
    .setDescription('API documentation for your Japanese learning backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api', app, document)

  const port = process.env.PORT || 3000
  await app.listen(port)
  console.log(`🚀 App running on http://localhost:${port}`)
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('DB:', process.env.DATABASE_URL?.slice(0, 50));
  console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY?.slice(0, 50));
}
bootstrap()
