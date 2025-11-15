const https = require('https');
const fs = require('fs');

async function downloadPlayerjs() {
  console.log('Downloading Playerjs script...\n');
  
  const url = 'https://cloudnestra.com/pjs/pjs_main_drv_cast.061125.js';
  
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Referer': 'https://cloudnestra.com/',
      }
    }, res => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
        process.stdout.write('.');
      });
      
      res.on('end', () => {
        console.log('\n\nDownload complete!');
        console.log('Size:', data.length, 'bytes');
        
        // Save to file
        fs.writeFileSync('playerjs-main.js', data);
        console.log('Saved to playerjs-main.js');
        
        // Search for decoder-related code
        console.log('\n=== Searching for decoder patterns ===\n');
        
        // Look for character replacement patterns
        const patterns = [
          { name: 'Replace g', regex: /replace\(['"\/]g['"\/]/gi },
          { name: 'Replace :', regex: /replace\(['"]:/gi },
          { name: 'fromCharCode', regex: /fromCharCode/gi },
          { name: 'charCodeAt', regex: /charCodeAt/gi },
          { name: 'parseInt 16', regex: /parseInt.*16/gi },
          { name: 'toString 16', regex: /toString\(16\)/gi },
          { name: 'split join', regex: /split\([^)]+\)\.join\([^)]+\)/gi },
        ];
        
        for (const pattern of patterns) {
          const matches = [...data.matchAll(pattern.regex)];
          if (matches.length > 0) {
            console.log(`${pattern.name}: ${matches.length} matches`);
            
            // Show first few matches with context
            matches.slice(0, 3).forEach((m, i) => {
              const start = Math.max(0, m.index - 80);
              const end = Math.min(data.length, m.index + m[0].length + 80);
              const context = data.substring(start, end).replace(/\n/g, ' ');
              console.log(`  ${i + 1}. ...${context}...`);
            });
            console.log('');
          }
        }
        
        // Look for functions that might decode the file parameter
        console.log('\n=== Searching for file parameter processing ===\n');
        
        const filePatterns = [
          /file\s*[:=]\s*([^,;}\]]+)/gi,
          /this\.file\s*=\s*([^;]+)/gi,
          /\.file\s*=\s*([^;]+)/gi,
        ];
        
        for (const pattern of filePatterns) {
          const matches = [...data.matchAll(pattern)];
          if (matches.length > 0) {
            console.log(`File assignment: ${matches.length} matches`);
            matches.slice(0, 5).forEach((m, i) => {
              console.log(`  ${i + 1}. ${m[0]}`);
            });
            console.log('');
          }
        }
        
        resolve(data);
      });
    }).on('error', reject);
  });
}

downloadPlayerjs().catch(console.error);
