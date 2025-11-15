// Extract the PJSDIV logic from playerjs
const fs = require('fs');

const content = fs.readFileSync('playerjs-main.js', 'utf8');

console.log('=== EXTRACTING PJSDIV LOGIC ===\n');

// Search for FindPjsDiv function
console.log('1. FindPjsDiv FUNCTION:');
const findPjsDivMatches = content.match(/FindPjsDiv[^}]{0,500}/gi);
if (findPjsDivMatches) {
  findPjsDivMatches.forEach((m, i) => {
    console.log(`\n[Match ${i + 1}]`);
    console.log(m);
  });
}

// Search for how file is extracted from div
console.log('\n\n2. FILE EXTRACTION FROM DIV:');
const fileExtractMatches = content.match(/.{0,300}(pjsdiv|PJSDIV).{0,300}(file|innerHTML|textContent).{0,300}/gi);
if (fileExtractMatches) {
  fileExtractMatches.slice(0, 5).forEach((m, i) => {
    console.log(`\n[Match ${i + 1}]`);
    console.log(m);
  });
}

// Search for getElementById with pjsdiv
console.log('\n\n3. getElementById WITH PJSDIV:');
const getByIdMatches = content.match(/getElementById.{0,200}pjsdiv.{0,200}/gi);
if (getByIdMatches) {
  getByIdMatches.forEach((m, i) => {
    console.log(`\n[Match ${i + 1}]`);
    console.log(m);
  });
}

// Search for how the player reads configuration
console.log('\n\n4. PLAYER CONFIGURATION READING:');
const configMatches = content.match(/.{0,200}(config|options|settings).{0,100}(file|url|src).{0,200}/gi);
if (configMatches) {
  configMatches.slice(0, 10).forEach((m, i) => {
    console.log(`\n[Match ${i + 1}]`);
    console.log(m.substring(0, 400));
  });
}

// Look for the actual div content reading pattern
console.log('\n\n5. DIV CONTENT READING PATTERN:');
const divReadMatches = content.match(/.{0,150}(innerHTML|textContent|innerText).{0,150}(file|m3u8|url).{0,150}/gi);
if (divReadMatches) {
  divReadMatches.slice(0, 5).forEach((m, i) => {
    console.log(`\n[Match ${i + 1}]`);
    console.log(m);
  });
}

console.log('\n\n=== EXTRACTION COMPLETE ===');
