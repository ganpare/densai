// Test PDF generation directly
const path = require('path');

async function test() {
  try {
    console.log('[Test] Starting PDF generation test...');
    
    // Import htmlToPdfFile from pdfUtils
    const { htmlToPdfFile } = require('./dist/pdfUtils.js');
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: sans-serif; padding: 20px; }
    h1 { color: #333; }
  </style>
</head>
<body>
  <h1>Test PDF</h1>
  <p>This is a test PDF generated at ${new Date().toISOString()}</p>
</body>
</html>
    `;
    
    const outPath = path.join(__dirname, 'uploads', 'pdfs', 'test.pdf');
    console.log('[Test] Output path:', outPath);
    
    await htmlToPdfFile(html, outPath);
    console.log('[Test] PDF generated successfully!');
    
  } catch (error) {
    console.error('[Test] Error:', error);
    process.exit(1);
  }
}

test();
