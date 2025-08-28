# 電子債権問い合わせ対応報告書システム - Windows セットアップ手順

## 概要

このシステムは日本の金融機関向けの電子債権問い合わせ対応報告書管理システムです。オフライン環境での運用を想定し、ユーザー名/パスワード認証とSQLiteデータベースを使用します。

## システム要件

- Windows 10/11
- Node.js 18以上
- npm
- Git for Windows
- PowerShell または Command Prompt

## 1. 必要なソフトウェアのインストール

### Node.js のインストール

1. [Node.js公式サイト](https://nodejs.org/)にアクセス
2. **LTS版（推奨版）** をダウンロード
3. インストーラーを実行し、デフォルト設定でインストール
4. インストール完了後、PowerShellまたはコマンドプロンプトで確認：

```powershell
node --version
npm --version
```

### Git for Windows のインストール

1. [Git for Windows](https://gitforwindows.org/)にアクセス
2. 最新版をダウンロードしてインストール
3. インストール時は以下を推奨：
   - **Git Bash** を含める
   - **デフォルトエディター**: Visual Studio Code（インストール済みの場合）
   - **改行文字の変換**: "Checkout Windows-style, commit Unix-style line endings"

### Visual Studio Code（推奨）

1. [VS Code公式サイト](https://code.visualstudio.com/)からダウンロード
2. インストール時に「PATHに追加」をチェック

## 2. プロジェクトのセットアップ

### プロジェクトのクローン

PowerShellまたはコマンドプロンプトを開き：

```powershell
# プロジェクトをクローン
git clone <repository-url>
cd <project-directory>
```

### 依存関係のインストール

```powershell
# npm依存関係のインストール
npm install
```

## 3. 環境変数の設定

### .envファイルの作成

プロジェクトのルートディレクトリに`.env`ファイルを作成：

```powershell
# PowerShellの場合
New-Item -Path ".env" -ItemType File
notepad .env
```

```cmd
REM コマンドプロンプトの場合
type nul > .env
notepad .env
```

### 環境変数の設定内容

`.env`ファイルに以下を記述：

```env
# セッション秘密鍵（ランダムな文字列を設定）
SESSION_SECRET=your-super-secret-session-key-here

# データベース設定（SQLite使用）
DATABASE_URL=file:./database.sqlite

# 開発環境設定
NODE_ENV=development
```

## 4. データベースの初期化

```powershell
# データベースマイグレーション
npm run db:push

# 初期データの投入（オプション）
npm run db:seed
```

## 5. 開発サーバーの起動

```powershell
# 開発サーバー起動
npm run dev
```

成功すると以下のメッセージが表示されます：
```
[express] serving on port 5000
```

ブラウザで `http://localhost:5000` にアクセスしてください。

## 6. 初期ユーザーでのログイン

### デフォルトユーザー

| ユーザー名 | パスワード | 役割 | 承認レベル |
|-----------|-----------|------|-----------|
| tanaka | password123 | creator | 1 |
| sato | password123 | approver | 2 |
| suzuki | password123 | approver | 3 |
| takahashi | password123 | admin | 4 |
| tamura | password123 | admin | 5 |

## 7. Windows特有の設定

### ファイアウォール設定

初回起動時にWindowsファイアウォールの警告が表示される場合：

1. **プライベートネットワーク**にチェックを入れる
2. **パブリックネットワーク**はセキュリティ上チェックを外す
3. **アクセスを許可する**をクリック

### ウイルス対策ソフトの設定

Windows Defenderまたは他のウイルス対策ソフトで、プロジェクトフォルダを除外リストに追加することを推奨：

1. Windows Defenderの場合：
   - 設定 → 更新とセキュリティ → Windows セキュリティ
   - ウイルスと脅威の防止 → ウイルスと脅威の防止の設定
   - 除外の追加または削除 → 除外を追加
   - フォルダを選択してプロジェクトディレクトリを追加

### PowerShell実行ポリシー

スクリプトの実行が制限されている場合：

```powershell
# 管理者権限でPowerShellを開いて実行
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 8. トラブルシューティング

### ポート競合エラー

ポート5000が使用中の場合：

```powershell
# 使用中のプロセス確認
netstat -ano | findstr :5000

# プロセス終了（PIDを確認してから）
taskkill /PID <プロセスID> /F
```

### Node.jsモジュールエラー

```powershell
# node_modulesの削除と再インストール
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

### 文字化けの対応

PowerShellで日本語が文字化けする場合：

```powershell
# 文字エンコーディングをUTF-8に設定
chcp 65001
```

### Git関連のエラー

改行文字の問題が発生した場合：

```powershell
git config --global core.autocrlf true
git config --global core.safecrlf false
```

## 9. 本番環境での運用

### Windows Service化

Node.jsアプリをWindowsサービスとして運行するには、`node-windows`を使用：

```powershell
# グローバルインストール
npm install -g node-windows

# サービス作成用スクリプトの準備
# service-install.js を作成
```

`service-install.js`の内容：

```javascript
var Service = require('node-windows').Service;

var svc = new Service({
  name: 'Electronic Bond Report System',
  description: '電子債権問い合わせ対応報告書システム',
  script: 'C:\\path\\to\\your\\project\\server\\index.js',
  env: {
    name: "NODE_ENV",
    value: "production"
  }
});

svc.on('install', function(){
  svc.start();
});

svc.install();
```

### バックアップスクリプト（バッチファイル）

`backup.bat`を作成：

```batch
@echo off
set BACKUP_DIR=backup
set TIMESTAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%

if not exist %BACKUP_DIR% mkdir %BACKUP_DIR%
copy database.sqlite %BACKUP_DIR%\database_%TIMESTAMP%.sqlite

echo Backup completed: database_%TIMESTAMP%.sqlite
```

## 10. 開発環境の構築（開発者向け）

### 推奨エディター設定

Visual Studio Codeの推奨拡張機能：

- **TypeScript Hero**
- **ES7+ React/Redux/React-Native snippets**
- **Prettier - Code formatter**
- **ESLint**
- **Auto Rename Tag**

### デバッグ設定

`.vscode/launch.json`の作成：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Node.js",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/server/index.ts",
      "env": {
        "NODE_ENV": "development"
      },
      "runtimeArgs": ["--loader", "tsx/esm"],
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

## 11. システムの使用方法

### 基本的なワークフロー

1. **ログイン** - デフォルトユーザーでログイン
2. **報告書作成** - 「報告書作成」から新規作成
3. **承認申請** - 作成後に承認申請を提出
4. **承認処理** - 承認者権限で承認または差し戻し
5. **PDF出力** - 承認済み報告書のPDF生成
6. **設定管理** - ユーザー情報やシステム設定の変更

### アクセスURL

- メインシステム: `http://localhost:5000`
- 設定画面: `http://localhost:5000/settings`
- ユーザー管理: `http://localhost:5000/users` （管理者のみ）

## サポート

システムに関する質問や問題がある場合は、開発チームまでお問い合わせください。

## ライセンス

このソフトウェアは金融機関向けの内部システムとして開発されています。