/**
 * Execute the decoder script in a sandboxed environment
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function main() {
  // Fetch embed
  const embedRes = await fetch('https://vidsrc-embed.ru/embed/movie/1228246', {
    headers: { 'User-Agent': UA }
  });
  const embedHtml = await embedRes.text();
  
  const rcpMatch = embedHtml.match(/cloudnestra\.com\/rcp\/([^"']+)/i);
  if (!rcpMatch) { console.log('No RCP'); return; }
  
  // Fetch RCP
  const rcpRes = await fetch('https://cloudnestra.com/rcp/' + rcpMatch[1], {
    headers: { 'User-Agent': UA, 'Referer': 'https://vidsrc-embed.ru/' }
  });
  const rcpHtml = await rcpRes.text();
  
  const prorcpMatch = rcpHtml.match(/\/prorcp\/([A-Za-z0-9+\/=_:-]+)/i);
  if (!prorcpMatch) { console.log('No ProRCP'); return; }
  
  // Fetch ProRCP
  const prorcpRes = await fetch('https://cloudnestra.com/prorcp/' + prorcpMatch[1], {
    headers: { 'User-Agent': UA, 'Referer': 'https://cloudnestra.com/' }
  });
  const prorcpHtml = await prorcpRes.text();
  
  // Get div content
  const divMatch = prorcpHtml.match(/<div id="([A-Za-z0-9]+)" style="display:none;">([^<]+)<\/div>/);
  if (!divMatch) { console.log('No div'); return; }
  
  const divId = divMatch[1];
  const encodedContent = divMatch[2];
  
  console.log('Div ID:', divId);
  console.log('Content length:', encodedContent.length);
  console.log('Content preview:', encodedContent.substring(0, 80));
  
  // Get decoder script
  const scriptMatch = prorcpHtml.match(/sV05kUlNvOdOxvtC\/([a-f0-9]+)\.js/);
  if (!scriptMatch) { console.log('No script'); return; }
  
  // Fetch decoder script
  const scriptRes = await fetch('https://cloudnestra.com/sV05kUlNvOdOxvtC/' + scriptMatch[1] + '.js', {
    headers: { 'User-Agent': UA, 'Referer': 'https://cloudnestra.com/' }
  });
  const decoderScript = await scriptRes.text();
  
  console.log('\nScript length:', decoderScript.length);
  
  // Create a mock window and document
  const mockWindow: Record<string, unknown> = {};
  const mockDocument = {
    getElementById: (id: string) => {
      console.log(`[MOCK] getElementById called with: ${id}`);
      if (id === divId) {
        return { innerHTML: encodedContent };
      }
      return null;
    },
    querySelector: (selector: string) => {
      console.log(`[MOCK] querySelector called with: ${selector}`);
      return null;
    }
  };
  
  // Custom atob that logs
  const customAtob = (str: string) => {
    console.log(`[MOCK] atob called with ${str.length} chars`);
    return Buffer.from(str, 'base64').toString('binary');
  };
  
  // Custom btoa that logs
  const customBtoa = (str: string) => {
    console.log(`[MOCK] btoa called with ${str.length} chars`);
    return Buffer.from(str, 'binary').toString('base64');
  };
  
  console.log('\n=== EXECUTING DECODER ===');
  
  try {
    // Create a function from the script
    const decoderFn = new Function(
      'window',
      'document',
      'atob',
      'btoa',
      decoderScript
    );
    
    // Execute it
    decoderFn(mockWindow, mockDocument, customAtob, customBtoa);
    
    console.log('\n=== CHECKING RESULTS ===');
    console.log('Window keys:', Object.keys(mockWindow));
    
    // Check if the div ID is in window
    if (mockWindow[divId]) {
      console.log(`\n*** SUCCESS! window.${divId} = ***`);
      const result = mockWindow[divId] as string;
      console.log(result.substring(0, 300));
      
      // Extract URLs
      const urls = result.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/g) || [];
      console.log(`\nFound ${urls.length} m3u8 URLs`);
      urls.slice(0, 3).forEach((url, i) => console.log(`${i + 1}. ${url.substring(0, 100)}`));
    } else {
      // Check all window properties for URLs
      for (const key of Object.keys(mockWindow)) {
        const value = mockWindow[key];
        if (typeof value === 'string' && value.includes('https://')) {
          console.log(`\nFound URL in window.${key}:`);
          console.log(value.substring(0, 200));
        }
      }
    }
  } catch (error) {
    console.error('Decoder execution failed:', error);
  }
}

main().catch(console.error);
