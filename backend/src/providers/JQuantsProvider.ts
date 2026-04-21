import type { DataProvider, StockInfo, StatementRaw, PriceRaw } from './DataProvider.js';
import { config } from '../lib/config.js';

/**
 * J-Quants API client (skeleton).
 *
 * 実装は後回し。config.jquants.mail / password が空の間は
 * どのメソッドも NOT_IMPLEMENTED エラーを投げる。
 *
 * ユーザーが https://jpx-jquants.com/ で Free tier 登録後、
 * .env に認証情報を設定 → このクラスの各メソッドを実装 →
 * DATA_PROVIDER=jquants に切替で稼働する想定。
 *
 * エンドポイント（実装時の参考）:
 *   POST /v1/token/auth_user       {mailaddress, password} → refreshToken
 *   POST /v1/token/auth_refresh    refreshToken → idToken (2h)
 *   GET  /v1/listed/info           ?date=YYYYMMDD
 *   GET  /v1/fins/statements       ?code=XXXX or ?date=YYYYMMDD
 *   GET  /v1/prices/daily_quotes   ?code=XXXX or ?date=YYYYMMDD
 */
export class JQuantsProvider implements DataProvider {
  readonly name = 'jquants';

  private ensureCredentials(): void {
    if (!config.jquants.mail || !config.jquants.password) {
      throw new Error(
        'J-Quants credentials not set. Register at https://jpx-jquants.com/ and set JQUANTS_MAIL_ADDRESS and JQUANTS_PASSWORD in .env'
      );
    }
  }

  async listStocks(): Promise<StockInfo[]> {
    this.ensureCredentials();
    throw new Error('NOT_IMPLEMENTED: Phase 1b で実装予定');
  }

  async fetchStatements(_code: string): Promise<StatementRaw[]> {
    this.ensureCredentials();
    throw new Error('NOT_IMPLEMENTED: Phase 1b で実装予定');
  }

  async fetchPrices(_code: string): Promise<PriceRaw[]> {
    this.ensureCredentials();
    throw new Error('NOT_IMPLEMENTED: Phase 1b で実装予定');
  }
}
