import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ESモジュールで __dirname の代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * テンプレートHTMLにデータを埋め込む（{{key}} 置換）
 */
export function fillTemplate(template: string, data: Record<string, string | number | undefined | null>) {
  return template.replace(/{{(\w+)}}/g, (_, key) => (data[key] ?? '')); 
}

/**
 * HTML→PDF変換し、指定パスに保存
 */
export async function htmlToPdfFile(html: string, outPath: string) {
  console.log('[htmlToPdfFile] Starting PDF generation...');
  console.log('[htmlToPdfFile] Output path:', outPath);
  
  const browser = await puppeteer.launch({ 
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
    headless: true
  });
  
  console.log('[htmlToPdfFile] Browser launched');
  
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  
  console.log('[htmlToPdfFile] HTML content set');
  
  await page.pdf({ 
    path: outPath, 
    format: 'A4', 
    printBackground: true, 
    margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } 
  });
  
  console.log('[htmlToPdfFile] PDF file written');
  
  await browser.close();
  console.log('[htmlToPdfFile] Browser closed. PDF generation complete!');
}

/**
 * テンプレートファイルを読み込み、データを埋め込んでPDF化し保存
 */
export async function generateReportPdf(data: Record<string, string | number | undefined | null>, outFile: string) {
  const templatePath = path.join(__dirname, 'templates', 'report-pdf.html');
  const template = await fs.readFile(templatePath, 'utf8');
  const html = fillTemplate(template, data);
  await htmlToPdfFile(html, outFile);
}
