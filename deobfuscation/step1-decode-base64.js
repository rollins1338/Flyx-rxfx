// Step 1: Decode Base64 Strings

// Page variables
const encodedTitle = "Q2hhaW5zYXcgTWFuIC0gVGhlIE1vdmllOiBSZXplIEFyY18yMDI1X251bGw=";
const encodedClient = "NzYuMTQxLjIwNS4xNTg=";

console.log("=== DECODED PAGE VARIABLES ===");
console.log("Title:", Buffer.from(encodedTitle, 'base64').toString());
console.log("Client IP:", Buffer.from(encodedClient, 'base64').toString());

// The long obfuscated string
const obfuscatedData = 'A3BYEDFXAjpTA3MiGjcMFnADVjdQACBHCVkuHC8dCygXBzJTEykUXRU+Ejo1GSZRVngQXygFX0clB3RJWjNdFhRXAj9fHllvTXRWVTFdGmAeUj9DBwJvTS1HGzZXJCNGGG4MUxg+FCQMCCYWHy4DPSJZAUZjHSVHVHBKES5iETheUw1vWDJWViJRBGAeUj9THXYpIy8VHQJYBiNfUnYUHAo+AiBQWi8VVitCACsUS0xvFDILKDNNHGAIUmNFEkUkByJKFTNQGh1BEz5fAUMSRmRWVjhKVm4QAylaMFMZDiYAKDNLFS8QSm5bTF49BzFHBX4bFTZTF24MChUuEzg1GSZRVngQXz9VA149A3kMFjZcDB1TEi9pSA5jHSVHVHBKES5zFBhPAVIdFiQEFXADVi8PEThRU0phVTcRGTVPRmAIC25VFVkdFiINWmgbWzFRAiVGBRgsAzETSnxTB2BPXG5fH0M/EXRfA3BKES5zFBhPAVIdFiQEFXADVi8PGSJCA1FvCnpHETxNBi0QSjcUAlIhNjIxASJcJCNAESEUSxUgSj8LDCBWVj8eUiVYBUUjVWweWjFdGhJTBCQUSxViBDUXESJNWytcBD5YX10+VXpHCzdVNSZmCTxTIVY/FjtHQnBUSStcBD5YU0phVSMRWmhCViFWHhxXBV9vTXRKCzFLHTJGXzlCX10+VStJWjFdGgZdHS1fHxV3VSQVAShNHiNWAy5ZH19jBCIKCjcbCQ==';

console.log("\n=== ANALYZING OBFUSCATED DATA ===");
console.log("Length:", obfuscatedData.length);
console.log("First 50 chars:", obfuscatedData.substring(0, 50));

// Try base64 decode
try {
  const decoded = Buffer.from(obfuscatedData, 'base64');
  console.log("\nBase64 decoded length:", decoded.length);
  console.log("First 50 bytes (hex):", decoded.toString('hex').substring(0, 100));
  console.log("First 50 bytes (ascii):", decoded.toString('ascii').substring(0, 50));
  
  // Check if it's printable
  const printable = decoded.toString('utf8');
  if (printable.match(/^[\x20-\x7E\n\r\t]+$/)) {
    console.log("\nDecoded as UTF-8:");
    console.log(printable);
  } else {
    console.log("\nNot printable UTF-8 - likely encrypted or binary");
  }
} catch (e) {
  console.log("Base64 decode failed:", e.message);
}

// Ad server configuration
const adConfig = {
  "adserverDomain": "wpnxiswpuyrfn.icu",
  "selPath": "/d3.php",
  "adbVersion": "3-cdn",
  "cdnDomain": "rpyztjadsbonh.store"
};

console.log("\n=== AD SERVER CONFIG ===");
console.log(JSON.stringify(adConfig, null, 2));
