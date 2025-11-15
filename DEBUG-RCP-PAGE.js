const https = require('https');
const cheerio = require('cheerio');
const fs = require('fs');

const dataHash = 'YjMxZGY0YzQyYjRhNTI3ZjE0OTMwNTZjNmIwNTI1Yzk6VDNOTk9FUlBPR0ZSU1VKM09XaHVOeXRMTTNKT1NVbHFaMUJpUnpCcE5GWXlLM1pNVlV0a1VrVm5VVTVUZDFFemRrUnhabWQwU0dVNGFsWk5VVk56Y3pSTlMwcGtlSFJ5VW1sdFQzUTBRVVZ5VVhKV2RrdFFaMDR6TTJaU1ZITTRNRVpIV2tWUlppOW9PVm8wYzJWRGIwRk1kSFZQSzFGTE1tUnFValZwYmtOTWRWUkpkbTVoYVhsdVJFazFWekEzU1dsWU1scGFaMDFEWTNGMVRGaG1aMHhXVm10SFNVbG5UVkpuTVZkeU1rMXFWRWhxWWpreVRsVkNNMlYzWW1sSmFXUlhlWEZ1Wm5Sc09Yb3pMMlZHVEZGWWQxRnVUV1JKVmk5SU5ISjBiazVZU25kS2MwdHpXVTlZTWt0WFdXMURZMDltZFRsTlRrOU5ZMjB6WkVGQ2J6ZHlkRlJIUTBOd05rTlNLelZGV2pWV2VESTJhblJwWkROMEsyc3pkVWRPU1U5S1ltWnBjaXRhYTBremNEQkthRTUxZDJOME5HZzBPV1Y2TVRKaU1Va3ZMelJTUldkT1FtTTJMMnRLVTNoTVQzazBhbkJZU2tod1JFMWtMekpDV1drdlFTdFJSRzFXUTNGc1JURTFVVmx2YldFekswY3JhekptVDJnMVZEWXpPVkEzTDNoaVIydHRVMVZhTTNScWJUbEhRVXBJV2pKSVlrTjJXRlEzT0RSTmFUWXhabloxZGpWdldEUlRWazVWWnpZMVQydFdXbFUzTmpGSFJGWm5ha041TTBZemFrSlJWV1pvUlRWeGFscE5iaXR4UkhGTVRHOHdRMDV2TUU5WVYwWnBTMUJ1Y25KTVJUSnBSRGdyZFZSRU9VeENlR293VDJkaVdrTmhURk5IUjFwa09UWlJhV1pDWkUxMWMwbFRWMjVsU1d0M09WWkZNVFZpUzFKdlJFdFlaMlo1YmsxT2EzQm1kVVZVUlhCd2RIVk9SblpRY0V0QmNYUTBPVlJNVTNaTFZWaE9NWGxNV21zMlFYbGlRMkkxV1VKMVVIWkxaSGxqUm1Gbk9YTTVjRVZHTXpCSGIxZzRSbEJZZFRGc1owUXdaMWN3V25kTGRuRXlla2wzTkZJMGJIQnFOazVIYzFKWU1HSmFRMHBYZVd3NGFsSnBTR1ZqVkU5VFUzRnZNbGMxYTI5V05IbEJUV2hHZEdwT2FrNVpUbXRaVjB4WWIxSkNVQ3R5Wm0weVZtbEhORGx0T0hCMFlpdGtTWEZtVUVaSFExVnJiRlZ5YlZJMWMySm9WWGg1V25Cb2FqSjVZMDh4VkVOdVkwcERXRWRLU0VVNFYzWTRibmMxTkhseGQyVktaR3h6ZWpCRU5GRnhLM2gzWlhsVWIydFVVRTVYWVdGMlJVMUhLMnM1VjJReldtWk5ZMVpoUjJNcmFqQkRUbFUxZGpSUldteERRWEkzTmpCUllsbFJkbW8zZWpjeFdGUkxZelZrZURZcmMxUnNha014WW5KQ1N5ODNlVzl0ZUhGRU5ETkJabXBqWm01TFExaERhMUZ1YkV0b2FEaHZWekpLUkZKR1dWVnRURkZZVWxad1MwaElhR1pTWVdKeFIwSldUMlF5WVZJclpEY3lTa0UxYUV0T1Z6TklPV1ZLUlN0RVdGUlBPWFJ3YkZCeFEzVkhiRkUzYW5CMGJVdDZORU5HYzFoclRIcDZkVTlCT1dWQ1dESjJMM2R4YTJneWMycHpTM0JOYlRCMFVYbHRhSFZvYnpWTVdFOUtPSEZGVTA5aGVERnNkSE40ZFRoTU1ucG9jakYzVW0xU01tUmhNR2R4ZEZac05rMVhkbVo2TUM4eWNFRmhlVlZ0ZDBaWksxUkJURTFKTDJSa1ZTOWFjMlExYTBndmJuRTFjbFY0Y0dzMGMySTBiV3RuY0ZWWk0xRndTa1ZtTW04MVNXVllha3h0TkdGQk1VMUtSekprUmxGelJDOUNOWG9yYUc4dlIxVklhRzlFY0dsRVJHeFJjWEl5ZFc5clVUZHNjbUUwYkc0dmVXMDRUa2sxZUROR1pDdG9hbkYxTkVSRlFUMDk-';

const url = `https://cloudnestra.com/rcp/${dataHash}`;

https.get(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('HTML length:', data.length);
    
    fs.writeFileSync('rcp-page-debug.html', data);
    console.log('Saved to rcp-page-debug.html');
    
    const $ = cheerio.load(data);
    
    console.log('\nAll divs:');
    $('div').each((i, elem) => {
      const $elem = $(elem);
      const id = $elem.attr('id');
      const style = $elem.attr('style');
      const content = $elem.html();
      
      if (content && content.length > 100) {
        console.log(`\nDiv ${i}:`);
        console.log('  ID:', id || 'none');
        console.log('  Style:', style || 'none');
        console.log('  Content length:', content.length);
        console.log('  Content preview:', content.substring(0, 100));
      }
    });
  });
});
