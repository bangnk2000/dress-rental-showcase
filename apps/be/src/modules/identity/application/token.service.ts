import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { StaffRole } from '../../../libs/authz/authz.types';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenPayload {
  sub: string;
  kind: 'refresh';
}

/** The single place access/refresh tokens are signed and refresh tokens verified. */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async issuePair(staffId: string, role: StaffRole): Promise<TokenPair> {
    const accessToken = await this.jwtService.signAsync(
      { sub: staffId, role },
      {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: this.config.getOrThrow<number>('JWT_ACCESS_TTL_SEC'),
      },
    );
    const refreshToken = await this.jwtService.signAsync(
      { sub: staffId, kind: 'refresh' } satisfies RefreshTokenPayload,
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.getOrThrow<number>('JWT_REFRESH_TTL_SEC'),
      },
    );
    return { accessToken, refreshToken };
  }

  /** Returns the staffId or null when the token is invalid/expired/not a refresh token. */
  async verifyRefreshToken(token: string): Promise<string | null> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      return payload.kind === 'refresh' ? payload.sub : null;
    } catch {
      return null;
    }
  }
}
