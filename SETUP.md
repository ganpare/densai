# 電子債権問い合わせ対応報告書システム - Docker セットアップ手順

## 概要

このシステムは日本の金融機関向けの電子債権問い合わせ対応報告書管理システムです。Docker環境での運用を想定し、ユーザー名/パスワード認証とPostgreSQLデータベースを使用します。

## システム要件

- Docker Desktop（Windows/Mac/Linux）
- Docker Compose v2.0以上
- Git

## 1. Docker環境の準備

### Docker Desktopのインストール

- **Windows**: [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
- **macOS**: [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)
- **Linux**: [Docker Engine](https://docs.docker.com/engine/install/)

### インストール確認

```bash
docker --version
docker-compose --version
```

## 2. プロジェクトのクローン

```bash
# プロジェクトをクローン
git clone <repository-url>
cd <project-directory>
```

## 3. 環境変数の設定

```bash
# .envファイルの作成
cat > .env << EOF
SESSION_SECRET=your-super-secret-session-key-here
NODE_ENV=production
EOF
```

### 環境設定の説明

- **SESSION_SECRET**: セッション管理用の秘密鍵（必須）
- **NODE_ENV**: 実行モード（`development` または `production`）

**重要**: 
- `your-super-secret-session-key-here` の部分を安全なランダム文字列に変更してください
- `NODE_ENV=development` にすると開発モード（ホットリロード有効）
- `NODE_ENV=production` にすると本番モード（最適化された静的ファイル配信）

### 推奨セッション鍵生成方法

```bash
# Linux/macOS
openssl rand -base64 32

# Windows PowerShell
[System.Web.Security.Membership]::GeneratePassword(32, 0)
```

## 4. アプリケーションの起動

### 簡単起動（推奨）

```bash
# 1つのコマンドで完全起動
docker-compose up -d --build
```

このコマンドで以下が自動実行されます：
- PostgreSQLコンテナの起動
- アプリケーションコンテナのビルド・起動
- データベーススキーマの自動作成
- デフォルトデータの自動挿入

### 起動確認

```bash
# コンテナ状態確認
docker-compose ps

# アプリケーションログ確認
docker-compose logs -f app
```

### アクセス

アプリケーションは `http://localhost:5000` でアクセス可能になります。

## 新しい環境でのセットアップ手順（まとめ）

新しい端末で以下の手順で簡単に起動できます：

```bash
# 1. プロジェクトをクローン
git clone <repository-url>
cd <project-directory>

# 2. 環境変数を設定
cat > .env << EOF
SESSION_SECRET=your-super-secret-session-key-here
NODE_ENV=production
EOF

# 3. 起動（これだけで完了！）
docker-compose up -d --build
```

起動後、ブラウザで `http://localhost:5000` にアクセスし、以下のユーザーでログインできます：

- **tanaka** / password123（作成者）
- **suzuki** / password123（承認者）  
- **tamura** / password123（管理者）

## 5. 初期ユーザー

システムには以下のデフォルトユーザーが自動的に作成されます：

| ユーザー名 | パスワード | 役割 | 承認レベル |
|-----------|-----------|------|-----------|
| tanaka | password123 | creator | 1 |
| sato | password123 | creator | 1 |
| suzuki | password123 | approver | 2 |
| takahashi | password123 | approver | 3 |
| tamura | password123 | admin | 5 |

### 新規ユーザーの追加

管理者権限でログイン後、「ユーザー管理」画面から新規ユーザーを追加できます。

## 6. システムの使用方法

### 基本的なワークフロー

1. **報告書作成** - 作成者が新規報告書を作成
2. **承認申請** - 作成者が承認者に申請を提出
3. **承認処理** - 承認者が報告書を承認または差し戻し
4. **PDF出力** - 承認済み報告書のPDF生成
5. **印刷** - 金庫連携プリンターでの印刷

### 役割と権限

- **作成者（Creator）**: 報告書の作成・編集
- **承認者（Approver）**: 報告書の承認・差し戻し
- **管理者（Admin）**: 全ての機能 + ユーザー管理

## 7. トラブルシューティング

### ポート競合エラー

```bash
# ポート5000が使用中の場合（Windows）
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# ポート5000が使用中の場合（Linux/macOS）
sudo lsof -i :5000
sudo kill -9 <PID>
```

### コンテナ起動エラー

```bash
# コンテナ状態確認
docker-compose ps

# アプリケーションログ確認
docker-compose logs app

# データベースログ確認
docker-compose logs postgres

# 完全リセット（データも削除）
docker-compose down -v
docker-compose up -d --build
```

### データベース接続エラー

```bash
# PostgreSQLコンテナの状態確認
docker-compose exec postgres pg_isready -U postgres

# データベース接続テスト
docker-compose exec postgres psql -U postgres -d bond_inquiry_db -c "SELECT 1;"
```

### ビルドエラー

```bash
# イメージの再ビルド（キャッシュなし）
docker-compose build --no-cache
docker-compose up -d
```

## 8. 本番環境での運用

### 環境変数の設定

```bash
# .envファイルを本番用に設定
cat > .env << EOF
SESSION_SECRET=your-production-secret-key-here
NODE_ENV=production
EOF
```

**重要**: 本番環境では必ず強固なセッション鍵を設定してください。

### Docker Composeでの本番運用

```bash
# 本番環境での起動
docker-compose up -d --build

# 自動再起動設定（docker-compose.ymlに既に設定済み）
# restart: unless-stopped
```

### システムサービス化（systemd）

```bash
# サービスファイルの作成
sudo nano /etc/systemd/system/densai-system.service
```

```ini
[Unit]
Description=Densai Electronic Bond Report System
After=network.target docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/path/to/your/project
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

```bash
# サービスの有効化と起動
sudo systemctl enable densai-system
sudo systemctl start densai-system
sudo systemctl status densai-system
```

## 9. バックアップとメンテナンス

### データベースバックアップ

```bash
# PostgreSQLデータベースのバックアップ
docker-compose exec postgres pg_dump -U postgres bond_inquiry_db > backup/database_$(date +%Y%m%d_%H%M%S).sql

# バックアップからの復元
docker-compose exec -T postgres psql -U postgres bond_inquiry_db < backup/database_YYYYMMDD_HHMMSS.sql
```

### ログ監視

```bash
# アプリケーションログの確認
docker-compose logs -f app

# データベースログの確認
docker-compose logs -f postgres
```

### コンテナ管理

```bash
# コンテナの停止
docker-compose down

# データも含めて完全削除
docker-compose down -v

# イメージの更新
docker-compose pull
docker-compose up -d --build
```

## サポート

システムに関する質問や問題がある場合は、開発チームまでお問い合わせください。

## ライセンス

このソフトウェアは金融機関向けの内部システムとして開発されています。