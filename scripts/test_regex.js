const fs = require('fs');

const html = fs.readFileSync('debug_moviesapi_response.html', 'utf8');
const regex = /<iframe[^>]+src=["']([^"']+)["']/;
const match = html.match(regex);

if (match) {
    console.log("Match found:", match[1]);
} else {
    console.log("No match found.");
}
