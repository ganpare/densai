# 電子債権問い合わせ対応報告書システム - WSL セットアップ手順

## 概要

このシステムは日本の金融機関向けの電子債権問い合わせ対応報告書管理システムです。オフライン環境での運用を想定し、ユーザー名/パスワード認証とSQLiteデータベースを使用します。

## システム要件

- Windows 10/11 with WSL2
- Node.js 18以上
- npm
- Git

## 1. WSL環境の準備

### WSL2のインストール（未インストールの場合）

```powershell
# PowerShellを管理者権限で実行
wsl --install
```

### Ubuntu 22.04 LTSの使用を推奨

```powershell
wsl --install -d Ubuntu-22.04
```

## 2. 必要なソフトウェアのインストール

### Node.js 20のインストール

```bash
# NodeSourceリポジトリの追加
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Node.jsのインストール
sudo apt-get install -y nodejs

# バージョン確認
node --version
npm --version
```

### Gitのインストール

```bash
sudo apt-get update
sudo apt-get install git
```

## 3. プロジェクトのクローン

```bash
# プロジェクトをクローン
git clone <repository-url>
cd <project-directory>
```

## 4. 依存関係のインストール

```bash
# npm依存関係のインストール
npm install
```

## 5. 環境変数の設定

```bash
# .envファイルの作成
cp .env.example .env

# 必要に応じて.envファイルを編集
nano .env
```

### 必要な環境変数

```env
# セッション秘密鍵（ランダムな文字列を設定）
SESSION_SECRET=your-super-secret-session-key-here

# データベース設定（SQLite使用）
DATABASE_URL=file:./database.sqlite

# 開発環境設定
NODE_ENV=development
```

## 6. データベースの初期化

```bash
# データベースマイグレーション
npm run db:push

# 初期データの投入（オプション）
npm run db:seed
```

## 7. 開発サーバーの起動

```bash
# 開発サーバー起動
npm run dev
```

アプリケーションは `http://localhost:5000` でアクセス可能になります。

## 8. 初期ユーザーの作成

### デフォルトユーザー

システムには以下のデフォルトユーザーが用意されています：

| ユーザー名 | パスワード | 役割 | 承認レベル |
|-----------|-----------|------|-----------|
| tanaka | password123 | creator | 1 |
| sato | password123 | approver | 2 |
| suzuki | password123 | approver | 3 |
| takahashi | password123 | admin | 4 |
| tamura | password123 | admin | 5 |

### 新規ユーザーの追加

管理者権限でログイン後、「ユーザー管理」画面から新規ユーザーを追加できます。

## 9. システムの使用方法

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

## 10. トラブルシューティング

### ポート競合エラー

```bash
# ポート5000が使用中の場合
sudo lsof -i :5000
sudo kill -9 <PID>
```

### データベース接続エラー

```bash
# データベースファイルの権限確認
ls -la database.sqlite

# 権限修正
chmod 644 database.sqlite
```

### Node.jsモジュールエラー

```bash
# node_modulesの再インストール
rm -rf node_modules
rm package-lock.json
npm install
```

## 11. 本番環境での運用

### 環境変数の設定

```env
NODE_ENV=production
SESSION_SECRET=production-secret-key
DATABASE_URL=file:./production.sqlite
```

### プロダクションビルド

```bash
# プロダクション用ビルド
npm run build

# プロダクションサーバー起動
npm start
```

### システムサービス化（systemd）

```bash
# サービスファイルの作成
sudo nano /etc/systemd/system/bond-report-system.service
```

```ini
[Unit]
Description=Electronic Bond Report System
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/your/project
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# サービスの有効化と起動
sudo systemctl enable bond-report-system
sudo systemctl start bond-report-system
sudo systemctl status bond-report-system
```

## 12. バックアップとメンテナンス

### データベースバックアップ

```bash
# SQLiteデータベースのバックアップ
cp database.sqlite backup/database_$(date +%Y%m%d_%H%M%S).sqlite
```

### ログ監視

```bash
# アプリケーションログの確認
sudo journalctl -u bond-report-system -f
```

## サポート

システムに関する質問や問題がある場合は、開発チームまでお問い合わせください。

## ライセンス

このソフトウェアは金融機関向けの内部システムとして開発されています。