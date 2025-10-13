FROM node:20-alpine

WORKDIR /app

# puppeteer用の依存関係と日本語フォントをインストール
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-cjk

# puppeteerがインストール済みのChromiumを使用するように設定
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

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
