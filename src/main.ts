
//brew services start mongodb-community@7.0
//mongod --replSet rs0 --dbpath /usr/local/var/mongodb
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // ✅ Enable CORS for Vite frontend
  app.enableCors({
    origin: 'http://localhost:5173',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  })

  // ✅ Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('Kanji Agent API')
    .setDescription('API documentation for your Japanese learning backend')
    .setVersion('1.0')
    .addBearerAuth() // Optional: only if you use JWT
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api', app, document)

  // ✅ Start server
  await app.listen(process.env.PORT ?? 3000)
}
bootstrap()
