// Analyze how PlayerJS initializes and reads the file/m3u8 URL
const fs = require('fs');

const content = fs.readFileSync('playerjs-main.js', 'utf8');

console.log('=== ANALYZING PLAYERJS INITIALIZATION ===\n');

// 1. Look for pjsdiv references
console.log('1. PJSDIV REFERENCES:');
const pjsdivMatches = content.match(/.{0,200}pjsdiv.{0,200}/gi);
if (pjsdivMatches) {
  pjsdivMatches.slice(0, 5).forEach((m, i) => {
    console.log(`\n[${i + 1}] ${m}`);
  });
}

// 2. Look for how file parameter is read
console.log('\n\n2. FILE PARAMETER READING:');
const fileReadMatches = content.match(/.{0,150}(file|\.file\s*=|getAttribute\s*\(\s*["\']file).{0,150}/gi);
if (fileReadMatches) {
  fileReadMatches.slice(0, 10).forEach((m, i) => {
    console.log(`\n[${i + 1}] ${m}`);
  });
}

// 3. Look for div content reading
console.log('\n\n3. DIV CONTENT READING:');
const divContentMatches = content.match(/.{0,150}(innerHTML|textContent|innerText|nodeValue).{0,150}/gi);
if (divContentMatches) {
  divContentMatches.slice(0, 5).forEach((m, i) => {
    console.log(`\n[${i + 1}] ${m}`);
  });
}

// 4. Look for player initialization
console.log('\n\n4. PLAYER INITIALIZATION:');
const initMatches = content.match(/.{0,200}(new\s+Playerjs|Playerjs\s*\(|playerjs\s*=).{0,200}/gi);
if (initMatches) {
  initMatches.slice(0, 5).forEach((m, i) => {
    console.log(`\n[${i + 1}] ${m}`);
  });
}

// 5. Look for how the player finds its container
console.log('\n\n5. CONTAINER/DIV FINDING:');
const containerMatches = content.match(/.{0,150}(getElementById|querySelector|querySelectorAll).{0,150}/gi);
if (containerMatches) {
  containerMatches.slice(0, 10).forEach((m, i) => {
    console.log(`\n[${i + 1}] ${m}`);
  });
}

// 6. Look for data attribute reading
console.log('\n\n6. DATA ATTRIBUTE READING:');
const dataAttrMatches = content.match(/.{0,150}(data-|dataset|getAttribute).{0,150}/gi);
if (dataAttrMatches) {
  dataAttrMatches.slice(0, 10).forEach((m, i) => {
    console.log(`\n[${i + 1}] ${m}`);
  });
}

// 7. Look for specific patterns related to PRO.RCP
console.log('\n\n7. PRO.RCP SPECIFIC PATTERNS:');
const prorcpMatches = content.match(/.{0,200}(pro\.rcp|prorcp|rcp).{0,200}/gi);
if (prorcpMatches) {
  console.log(`Found ${prorcpMatches.length} matches`);
  prorcpMatches.slice(0, 5).forEach((m, i) => {
    console.log(`\n[${i + 1}] ${m}`);
  });
} else {
  console.log('No direct PRO.RCP references found');
}

console.log('\n\n=== ANALYSIS COMPLETE ===');
