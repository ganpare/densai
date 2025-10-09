FROM node:20-alpine

WORKDIR /app

# 依存関係のインストール
COPY package*.json ./
RUN npm ci

# アプリケーションコードのコピー
COPY . .

# ビルド実行
RUN npm run build

# PDFファイル保存用ディレクトリの作成
RUN mkdir -p uploads/pdfs

# ポート公開
EXPOSE 5000

# アプリケーション起動
CMD ["npm", "start"]
