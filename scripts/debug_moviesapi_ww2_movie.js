const https = require('https');

const tmdbId = '550'; // Fight Club
const url = `https://ww2.moviesapi.to/movie/${tmdbId}`;

const options = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://moviesapi.club/'
    }
};

console.log(`Fetching ${url}...`);

https.get(url, options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);

    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log(`Data length: ${data.length}`);
        if (res.statusCode === 200) {
            console.log("Preview:", data.substring(0, 200));
            // Check if it's a valid player page
            if (data.includes('vidframe') || data.includes('Clappr')) {
                console.log("Looks like a valid player page!");
            }
        }
    });

}).on('error', (err) => {
    console.error('Error:', err.message);
});
