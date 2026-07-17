import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const token = req.headers['x-api-token'] as string | undefined;
    const secret = process.env.API_SECRET;

    if (!secret) {
      throw new UnauthorizedException(
        'Server misconfigured: API_SECRET not set',
      );
    }

    if (!token || token !== secret) {
      throw new UnauthorizedException('Invalid or missing x-api-token');
    }

    next();
  }
}
