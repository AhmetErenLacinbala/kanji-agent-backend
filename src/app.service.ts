import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private config: ConfigService) { }

  getHello(): string {
    const secret = this.config.get<string>('JWT_SECRET');
    console.log('JWT_SECRET:', secret); // optional debug
    return 'Hello World!';
  }
}
