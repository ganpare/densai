# 電子債権問い合わせ対応報告書システム - セットアップガイド

## 概要

このリポジトリは日本の金融機関向けの電子債権問い合わせ対応報告書管理システムです。Express と React を使ったフルスタック構成で、SQLite データベースにデータを保存します。本書では開発環境のセットアップと Docker コンテナでの実行方法を説明します。

---

## 必要要件

- Node.js 20 以上
- npm 10 以上
- Git
- （任意）Docker 24 以上

> **補足:** WSL2 上でも同じ手順で動作します。以前の WSL 専用手順は本ガイドに統合しました。

---

## ローカル開発環境の準備

### 1. リポジトリの取得

```bash
git clone <repository-url>
cd <repository-directory>
```

### 2. 依存パッケージのインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env` ファイルは必須ではありませんが、セッション情報の暗号化に `SESSION_SECRET` を設定することを推奨します。

```bash
cp .env.example .env   # ファイルが存在する場合
# もしくは新規で作成
```

推奨値:

```env
SESSION_SECRET=任意の長いランダム文字列
PORT=5000
```

`.env` を使用しない場合は、直接環境変数をエクスポートしてください。

### 4. データベース

アプリケーション起動時に `database.sqlite` が存在しない場合は自動で生成され、初期ユーザーが投入されます。追加のマイグレーションコマンドは不要です。

### 5. 開発サーバーの起動

```bash
npm run dev
```

開発サーバーは `http://localhost:5000` で API とフロントエンドを同時に提供します。Vite のホットリロードが有効です。

### 6. プロダクションビルド

```bash
npm run build
npm start
```

`npm start` はビルド済み成果物 (`dist/index.js`) を使ってアプリケーションを `PORT` で公開します。

---

## Docker での実行

Docker を使うと Node.js をローカルにインストールせずにアプリケーションを起動できます。

### 1. イメージのビルド

```bash
docker build -t densai-app .
```

### 2. コンテナの起動

```bash
docker run --rm -p 5000:5000 \
  -e SESSION_SECRET="任意の長いランダム文字列" \
  -e PORT=5000 \
  -e HOST=0.0.0.0 \
  densai-app
```

ブラウザから `http://localhost:5000` にアクセスするとアプリケーションを利用できます。

#### データ永続化

SQLite ファイルをホストに永続化したい場合はボリュームをマウントしてください。

```bash
docker run --rm -p 5000:5000 \
  -v $(pwd)/data:/app/data \
  -e DATABASE_URL="file:./data/database.sqlite" \
  -e SESSION_SECRET="任意の長いランダム文字列" \
  -e HOST=0.0.0.0 \
  densai-app
```

コンテナ内の `DATABASE_URL` を上記のように変更すると、`/app/data` 以下に SQLite ファイルが作成されます。

---

## 初期ユーザー

デフォルトで以下のユーザーが用意されています。

| ユーザー名 | パスワード | 役割 |
|------------|------------|------|
| tanaka     | password123 | handler |
| sato       | password123 | handler |
| suzuki     | password123 | approver |
| takahashi  | password123 | handler / approver |
| tamura     | password123 | admin |

---

## トラブルシューティング

| 症状 | 対処方法 |
|------|----------|
| ポート `5000` が使用中 | `lsof -i :5000` でプロセスを特定し、終了させる |
| `better-sqlite3` のビルドに失敗 | `npm install --build-from-source better-sqlite3` を実行する |
| Docker コンテナにアクセスできない | `docker run` 時に `-p 5000:5000` を指定し、`HOST=0.0.0.0` が設定されていることを確認する |

---

## ライセンスと問い合わせ

本システムは金融機関向けの内部業務支援ツールとして提供されています。問題が発生した場合は開発チームへお問い合わせください。
