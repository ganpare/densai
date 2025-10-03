# Docker環境でのデプロイ手順

このドキュメントでは、電子債権問い合わせ対応報告書システムをDocker環境でデプロイする手順を説明します。

## 目次
1. [前提条件](#前提条件)
2. [リポジトリのクローン](#リポジトリのクローン)
3. [データベースドライバーの変更](#データベースドライバーの変更)
4. [Docker環境の構築](#docker環境の構築)
5. [環境変数の設定](#環境変数の設定)
6. [アプリケーションの起動](#アプリケーションの起動)
7. [トラブルシューティング](#トラブルシューティング)

---

## 前提条件

以下のソフトウェアがインストールされている必要があります：

- Docker (v20.10以降推奨)
- Docker Compose (v2.0以降推奨)
- Git

---

## リポジトリのクローン

```bash
git clone <your-repository-url>
cd <project-directory>
```

---

## データベースドライバーの変更

このプロジェクトは現在、Neonのサーバーレスドライバーを使用していますが、Docker環境では標準のPostgreSQLドライバーに変更する必要があります。

### 1. パッケージの変更

```bash
# Neonドライバーを削除
npm uninstall @neondatabase/serverless

# 標準PostgreSQLドライバーをインストール
npm install pg
npm install --save-dev @types/pg
```

### 2. `server/db.ts` の変更

**変更前:**
```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from "@shared/schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

**変更後:**
```typescript
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
export const db = drizzle(pool, { schema });
```

---

## Docker環境の構築

### 1. Dockerファイルの作成

プロジェクトルートに `Dockerfile` を作成します：

```dockerfile
FROM node:20-alpine

WORKDIR /app

# 依存関係のインストール
COPY package*.json ./
RUN npm ci

# アプリケーションコードのコピー
COPY . .

# PDFファイル保存用ディレクトリの作成
RUN mkdir -p uploads/pdfs

# ビルド（必要に応じて）
# RUN npm run build

EXPOSE 5000

CMD ["npm", "run", "dev"]
```

### 2. Docker Compose設定の作成

プロジェクトルートに `docker-compose.yml` を作成します：

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: bond_inquiry_postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: bond_inquiry_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build: .
    container_name: bond_inquiry_app
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/bond_inquiry_db
      SESSION_SECRET: your-secure-session-secret-change-this
    ports:
      - "5000:5000"
    volumes:
      # PDFファイルの永続化
      - ./uploads:/app/uploads
      # 開発時のホットリロード用（本番環境では不要）
      - .:/app
      - /app/node_modules
    depends_on:
      postgres:
        condition: service_healthy
    command: npm run dev

volumes:
  postgres_data:
```

### 3. `.dockerignore` の作成

効率的なビルドのために `.dockerignore` を作成します：

```
node_modules
.git
.env
*.md
uploads/pdfs/*
!uploads/pdfs/.gitkeep
```

---

## 環境変数の設定

### 本番環境用 `.env` ファイル（オプション）

```env
# データベース接続
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/bond_inquiry_db

# セッション暗号化キー（必ず変更してください）
SESSION_SECRET=your-very-secure-random-secret-key-here

# アプリケーション設定
NODE_ENV=production
PORT=5000
```

**⚠️ 重要:** `SESSION_SECRET` は本番環境では必ず安全なランダム文字列に変更してください。

生成方法の例：
```bash
openssl rand -base64 32
```

---

## アプリケーションの起動

### 1. Dockerコンテナのビルドと起動

```bash
# コンテナをビルドして起動
docker-compose up -d --build

# ログの確認
docker-compose logs -f app
```

### 2. データベーススキーマの初期化

初回起動時、アプリケーションが自動的にデータベーススキーマを初期化し、デフォルトユーザーを作成します。

ログに以下のメッセージが表示されることを確認してください：
```
✅ Database schema initialized
✅ Default data inserted
```

### 3. アプリケーションへのアクセス

ブラウザで以下のURLにアクセスします：

```
http://localhost:5000
```

### デフォルトユーザー

| ユーザー名 | パスワード | 役割 |
|-----------|----------|------|
| tanaka | password123 | 作成者（creator） |
| sato | password123 | 作成者（creator） |
| suzuki | password123 | 承認者（approver） |
| takahashi | password123 | 承認者（approver） |
| tamura | password123 | 管理者（admin） |

**⚠️ 本番環境では必ずパスワードを変更してください。**

---

## PDFファイルの永続化

PDFファイルは `uploads/pdfs/` ディレクトリに保存されます。Docker Composeの設定により、このディレクトリはホストマシンにマウントされ、コンテナを再起動してもデータが保持されます。

### バックアップ

```bash
# PDFファイルのバックアップ
tar -czf pdf_backup_$(date +%Y%m%d).tar.gz uploads/pdfs/

# データベースのバックアップ
docker-compose exec postgres pg_dump -U postgres bond_inquiry_db > backup_$(date +%Y%m%d).sql
```

### 復元

```bash
# PDFファイルの復元
tar -xzf pdf_backup_YYYYMMDD.tar.gz

# データベースの復元
docker-compose exec -T postgres psql -U postgres bond_inquiry_db < backup_YYYYMMDD.sql
```

---

## コンテナの管理

### コンテナの停止

```bash
docker-compose down
```

### コンテナの停止とデータ削除

```bash
# ボリュームも含めて削除（データベースがリセットされます）
docker-compose down -v
```

### コンテナの再起動

```bash
docker-compose restart
```

### ログの確認

```bash
# すべてのログを表示
docker-compose logs

# アプリケーションのログのみ
docker-compose logs app

# リアルタイムでログを監視
docker-compose logs -f app
```

---

## トラブルシューティング

### データベース接続エラー

**症状:** アプリケーションが起動時にデータベースに接続できない

**解決策:**
```bash
# PostgreSQLコンテナのステータスを確認
docker-compose ps postgres

# PostgreSQLのログを確認
docker-compose logs postgres

# healthcheckが通るまで待つ（最大50秒）
docker-compose up -d
```

### ポート競合エラー

**症状:** `port is already allocated` エラー

**解決策:**
```bash
# ポート5000または5432を使用しているプロセスを確認
lsof -i :5000
lsof -i :5432

# docker-compose.ymlでポート番号を変更
# 例: "8080:5000" (ホスト側を8080に変更)
```

### パッケージインストールエラー

**症状:** npm installが失敗する

**解決策:**
```bash
# node_modulesを削除して再ビルド
rm -rf node_modules
docker-compose build --no-cache app
docker-compose up -d
```

### PDFが生成されない

**症状:** PDF生成ボタンをクリックしてもエラーが出る

**確認事項:**
1. uploadsディレクトリのパーミッション確認
   ```bash
   chmod -R 755 uploads
   ```
2. アプリケーションログを確認
   ```bash
   docker-compose logs app | grep -i pdf
   ```
3. 報告書が「承認済み」ステータスであることを確認

---

## セキュリティに関する注意事項

### 本番環境での推奨設定

1. **環境変数の管理**
   - `.env`ファイルをGitにコミットしない（`.gitignore`に追加）
   - Docker Secretsまたは環境変数管理サービスを使用

2. **パスワードの変更**
   - デフォルトユーザーのパスワードを必ず変更
   - データベースの認証情報を変更

3. **セッション秘密鍵**
   - `SESSION_SECRET`を強力なランダム値に設定

4. **ファイアウォール設定**
   - 必要なポートのみ公開
   - PostgreSQLポート（5432）は外部に公開しない

5. **SSL/TLS設定**
   - リバースプロキシ（Nginx、Caddy等）でHTTPS化

---

## 本番環境デプロイ例（Nginx + Let's Encrypt）

### Nginxを追加したDocker Compose設定

```yaml
version: '3.8'

services:
  postgres:
    # ... (上記と同じ)

  app:
    # ... (上記と同じ)
    # ポートを内部のみに変更
    expose:
      - "5000"
    # portsを削除

  nginx:
    image: nginx:alpine
    container_name: bond_inquiry_nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app

volumes:
  postgres_data:
```

### Nginx設定例 (`nginx.conf`)

```nginx
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:5000;
    }

    server {
        listen 80;
        server_name your-domain.com;

        # HTTPSへリダイレクト
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

---

## 開発環境での使用

開発時は以下のコマンドでホットリロードを有効にできます：

```yaml
# docker-compose.override.yml を作成
version: '3.8'

services:
  app:
    command: npm run dev
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      NODE_ENV: development
```

```bash
docker-compose up
```

---

## まとめ

このドキュメントに従ってデプロイすることで、以下が実現されます：

✅ PostgreSQLコンテナでの完全なデータ永続化  
✅ PDFファイルのローカルストレージ保存  
✅ コンテナ間のネットワーク分離  
✅ 簡単なスケーリングと管理  
✅ 本番環境への展開準備

何か問題が発生した場合は、トラブルシューティングセクションを参照するか、ログを確認してください。
