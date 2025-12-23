/**
 * CF Header Removal Test
 * 
 * Testing EVERY possible way to remove/hide CF-Worker headers from a Cloudflare Worker
 * 
 * Headers CF adds automatically:
 * - CF-Worker: <worker-name>
 * - CF-Connecting-IP
 * - CDN-Loop
 * - CF-EW-Via
 * - CF-Ray
 * - CF-Visitor
 */

const TEST_URL = 'https://p.10014.workers.dev/hls/LTIwMjUtMDEtMDEgMDA6MDA6MDA/master.m3u8';
const HTTPBIN_URL = 'https://httpbin.org/headers';

// We'll deploy a test worker that tries different approaches
// and reports what headers actually arrive at the destination

const workerCode = `
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const approach = url.searchParams.get('approach') || 'basic';
    const targetUrl = url.searchParams.get('target') || 'https://httpbin.org/headers';
    
    const results = {};
    
    // Base headers we want to send
    const baseHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*',
      'Referer': 'https://111movies.com/',
    };
    
    try {
      switch (approach) {
        case 'basic':
          // Approach 1: Basic fetch
          results.approach = 'Basic fetch with Headers object';
          const res1 = await fetch(targetUrl, { headers: new Headers(baseHeaders) });
          results.response = await res1.json();
          break;
          
        case 'request':
          // Approach 2: Request object
          results.approach = 'Request object';
          const req2 = new Request(targetUrl, {
            method: 'GET',
            headers: baseHeaders,
          });
          const res2 = await fetch(req2);
          results.response = await res2.json();
          break;
          
        case 'delete-headers':
          // Approach 3: Try to explicitly delete CF headers
          results.approach = 'Delete CF headers from Request';
          const headers3 = new Headers(baseHeaders);
          // Try to delete CF headers (won't work but let's see)
          headers3.delete('CF-Worker');
          headers3.delete('CF-Connecting-IP');
          headers3.delete('CDN-Loop');
          headers3.delete('CF-Ray');
          headers3.delete('CF-Visitor');
          headers3.delete('CF-EW-Via');
          const res3 = await fetch(targetUrl, { headers: headers3 });
          results.response = await res3.json();
          break;
          
        case 'override-headers':
          // Approach 4: Try to override CF headers with empty values
          results.approach = 'Override CF headers with empty strings';
          const headers4 = new Headers(baseHeaders);
          headers4.set('CF-Worker', '');
          headers4.set('CF-Connecting-IP', '');
          headers4.set('CDN-Loop', '');
          const res4 = await fetch(targetUrl, { headers: headers4 });
          results.response = await res4.json();
          break;
          
        case 'fake-headers':
          // Approach 5: Try to set fake CF headers
          results.approach = 'Set fake CF headers';
          const headers5 = new Headers(baseHeaders);
          headers5.set('CF-Worker', 'fake');
          headers5.set('CF-Connecting-IP', '1.2.3.4');
          const res5 = await fetch(targetUrl, { headers: headers5 });
          results.response = await res5.json();
          break;
          
        case 'cf-options':
          // Approach 6: Use cf options to modify behavior
          results.approach = 'CF fetch options';
          const res6 = await fetch(targetUrl, {
            headers: baseHeaders,
            cf: {
              // Try various cf options
              cacheTtl: 0,
              cacheEverything: false,
              scrapeShield: false,
              apps: false,
              minify: false,
              mirage: false,
              polish: 'off',
            },
          });
          results.response = await res6.json();
          break;
          
        case 'redirect':
          // Approach 7: Use redirect: manual
          results.approach = 'Redirect manual mode';
          const res7 = await fetch(targetUrl, {
            headers: baseHeaders,
            redirect: 'manual',
          });
          if (res7.status === 200) {
            results.response = await res7.json();
          } else {
            results.status = res7.status;
            results.headers = Object.fromEntries(res7.headers);
          }
          break;
          
        case 'websocket':
          // Approach 8: WebSocket upgrade (different code path?)
          results.approach = 'WebSocket upgrade attempt';
          results.note = 'WebSockets still go through CF network';
          break;
          
        case 'service-binding':
          // Approach 9: Service binding (Worker-to-Worker)
          results.approach = 'Service binding';
          results.note = 'Service bindings are internal CF calls, still add headers';
          break;
          
        case 'durable-object':
          // Approach 10: Durable Object fetch
          results.approach = 'Durable Object';
          results.note = 'DO fetches still go through CF network';
          break;
          
        case 'tcp-socket':
          // Approach 11: TCP Socket (connect API)
          results.approach = 'TCP Socket (connect API)';
          try {
            // Parse target URL
            const targetParsed = new URL(targetUrl);
            const socket = connect({
              hostname: targetParsed.hostname,
              port: targetParsed.port || (targetParsed.protocol === 'https:' ? 443 : 80),
            }, { secureTransport: targetParsed.protocol === 'https:' ? 'on' : 'off' });
            
            const writer = socket.writable.getWriter();
            const httpRequest = [
              \`GET \${targetParsed.pathname}\${targetParsed.search} HTTP/1.1\`,
              \`Host: \${targetParsed.hostname}\`,
              'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
              'Accept: */*',
              'Referer: https://111movies.com/',
              'Connection: close',
              '',
              '',
            ].join('\\r\\n');
            
            await writer.write(new TextEncoder().encode(httpRequest));
            await writer.close();
            
            const reader = socket.readable.getReader();
            let responseData = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              responseData += new TextDecoder().decode(value);
              if (responseData.length > 2000) break;
            }
            
            results.rawResponse = responseData.substring(0, 1000);
          } catch (e) {
            results.error = e.message;
            results.note = 'TCP sockets may not be available or still route through CF';
          }
          break;
          
        case 'all':
          // Run all approaches and compare
          results.approach = 'All approaches comparison';
          results.tests = {};
          
          for (const a of ['basic', 'request', 'delete-headers', 'override-headers', 'fake-headers', 'cf-options', 'redirect']) {
            try {
              const testUrl = new URL(request.url);
              testUrl.searchParams.set('approach', a);
              testUrl.searchParams.set('target', 'https://httpbin.org/headers');
              const testRes = await fetch(testUrl);
              const testData = await testRes.json();
              results.tests[a] = {
                cfHeaders: Object.keys(testData.response?.headers || {})
                  .filter(k => k.toLowerCase().startsWith('cf-') || k.toLowerCase().includes('cdn-loop'))
              };
            } catch (e) {
              results.tests[a] = { error: e.message };
            }
          }
          break;
          
        default:
          results.error = 'Unknown approach';
      }
      
      // Extract CF headers from response
      if (results.response?.headers) {
        results.cfHeadersReceived = Object.entries(results.response.headers)
          .filter(([k]) => k.toLowerCase().startsWith('cf-') || k.toLowerCase().includes('cdn-loop') || k.toLowerCase().includes('cloudflare'))
          .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
      }
      
    } catch (error) {
      results.error = error.message;
      results.stack = error.stack;
    }
    
    return new Response(JSON.stringify(results, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
`;

console.log('='.repeat(80));
console.log('CF HEADER REMOVAL TEST');
console.log('='.repeat(80));
console.log('');
console.log('This worker code tests every possible approach to remove CF headers.');
console.log('Deploy this to a test worker and hit each endpoint.');
console.log('');
console.log('APPROACHES TO TEST:');
console.log('1. basic - Basic fetch with Headers object');
console.log('2. request - Request object');
console.log('3. delete-headers - Try to delete CF headers');
console.log('4. override-headers - Override CF headers with empty strings');
console.log('5. fake-headers - Set fake CF header values');
console.log('6. cf-options - Use cf fetch options');
console.log('7. redirect - Redirect manual mode');
console.log('8. tcp-socket - Raw TCP socket (connect API)');
console.log('9. all - Run all and compare');
console.log('');
console.log('WORKER CODE:');
console.log('-'.repeat(80));
console.log(workerCode);
