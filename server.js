const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const PORT = 3000;

// Load .env file if it exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envLines = fs.readFileSync(envPath, 'utf-8').split('\n');
  envLines.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_API_KEY) {
  console.error('FATAL ERROR: DEEPSEEK_API_KEY not set.');
  console.error('Please set DEEPSEEK_API_KEY environment variable or create a .env file with:');
  console.error('DEEPSEEK_API_KEY=sk-7cc610a136f342b2ae5e68771acf27fa');
  process.exit(1);
}
const server = http.createServer((req, res) => {
  if (req.url === '/api/deepseek-proxy' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      console.log('[PROXY] Forwarding request...');
      const options = {
        hostname: 'api.deepseek.com',
        port: 443,
        path: '/v1/chat/completions',   // ← CORRECTED path
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
      };
      const proxyReq = https.request(options, (proxyRes) => {
        let responseBody = '';
        proxyRes.on('data', chunk => responseBody += chunk);
        proxyRes.on('end', () => {
          console.log(`[PROXY] DeepSeek responded with status ${proxyRes.statusCode}`);
          console.log('[PROXY] Response body:', responseBody.substring(0, 300)); // print first 300 chars
          // Forward the exact status and body to the frontend
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          res.end(responseBody);
        });
      });
      proxyReq.on('error', (error) => {
        console.error('[PROXY] Error:', error.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to reach AI service. Please check your internet connection and try again.' }));
      });
      proxyReq.write(body);
      proxyReq.end();
    });
  } else {
    // Serve static files
    const fs = require('fs');
    const path = require('path');
    let filePath = '.' + req.url;
    if (filePath === './') filePath = './index.html';
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
      '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpg',
    };
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    fs.readFile(filePath, (error, content) => {
      if (error) {
        res.writeHead(404);
        res.end('Not Found');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  }
});
server.listen(PORT, () => {
  console.log(`ZeroPen proxy running at http://localhost:${PORT}`);
});
