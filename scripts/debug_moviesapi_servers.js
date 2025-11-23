const crypto = require('crypto');
const https = require('https');

// Encryption Logic (Same as before)
function evpBytesToKey(password, salt, keyLen, ivLen) {
    const passwordBuffer = Buffer.from(password, 'utf8');
    const saltBuffer = Buffer.from(salt, 'binary');

    let digests = [];
    let genLen = 0;
    let lastDigest = Buffer.alloc(0);

    while (genLen < keyLen + ivLen) {
        const hash = crypto.createHash('md5');
        hash.update(lastDigest);
        hash.update(passwordBuffer);
        hash.update(saltBuffer);
        const digest = hash.digest();
        digests.push(digest);
        lastDigest = Buffer.from(digest);
        genLen += digest.length;
    }

    const combined = Buffer.concat(digests);
    const key = combined.slice(0, keyLen);
    const iv = combined.slice(keyLen, keyLen + ivLen);
    return { key, iv };
}

function encrypt(text, password) {
    const salt = crypto.randomBytes(8);
    const { key, iv } = evpBytesToKey(password, salt.toString('binary'), 32, 16);

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const saltedPrefix = Buffer.from('Salted__', 'utf8');
    const finalBuffer = Buffer.concat([saltedPrefix, salt, Buffer.from(encrypted, 'base64')]);
    return finalBuffer.toString('base64');
}

// Config
const SCRAPIFY_URL = "https://ww2.moviesapi.to/api/scrapify";
const ENCRYPTION_KEY = "moviesapi-secure-encryption-key-2024-v1";
const PLAYER_API_KEY = "moviesapi-player-auth-key-2024-secure";

const tmdbId = '1396'; // Breaking Bad
const season = 2;
const episode = 10;
const type = 'tv';

async function fetchServer(srvId) {
    return new Promise((resolve) => {
        // Construct Payload
        const payloadObj = {
            source: "sflix2",
            type: type,
            id: tmdbId,
            srv: srvId.toString(),
            season: season,
            episode: episode
        };

        const encryptedPayload = encrypt(JSON.stringify(payloadObj), ENCRYPTION_KEY);
        const postData = JSON.stringify({ payload: encryptedPayload });

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-player-key': PLAYER_API_KEY,
                'Referer': `https://ww2.moviesapi.to/tv/${tmdbId}/${season}/${episode}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        };

        const req = https.request(`${SCRAPIFY_URL}/v1/fetch`, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.sources && json.sources.length > 0) {
                        resolve({ srv: srvId, sources: json.sources });
                    } else if (json.url) {
                        resolve({ srv: srvId, url: json.url });
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    resolve(null);
                }
            });
        });

        req.on('error', () => resolve(null));
        req.write(postData);
        req.end();
    });
}

async function checkAllServers() {
    console.log("Checking servers 0-10...");
    const results = [];

    // Check servers 0 to 10
    for (let i = 0; i <= 10; i++) {
        console.log(`Checking server ${i}...`);
        const result = await fetchServer(i);
        if (result) {
            console.log(`Found source on server ${i}:`, JSON.stringify(result, null, 2));
            results.push(result);
        }
    }

    console.log("--- Summary ---");
    console.log(`Found ${results.length} servers with sources.`);
}

checkAllServers();
