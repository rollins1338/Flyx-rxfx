/**
 * CORRECT PRORCP DECODER
 * The alphabet from fromCharCode is used for character substitution
 */

function decodeProRCP(encodedContent) {
  console.log('🔓 Decoding ProRCP content...');
  console.log('Input length:', encodedContent.length);
  
  // The custom alphabet from fromCharCode interception
  const customAlphabet = "ABCDEFGHIJKLMabcdefghijklmNOPQRSTUVWXYZnopqrstuvwxyz";
  const standardAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  
  // Step 1: Character substitution (reverse the custom mapping)
  let substituted = '';
  for (let i = 0; i < encodedContent.length; i++) {
    const char = encodedContent[i];
    const index = customAlphabet.indexOf(char);
    if (index !== -1) {
      substituted += standardAlphabet[index];
    } else {
      substituted += char;
    }
  }
  
  console.log('✅ After substitution length:', substituted.length);
  console.log('   Sample:', substituted.substring(0, 100));
  
  // Step 2: Base64 decode
  try {
    const decoded = Buffer.from(substituted, 'base64').toString('utf8');
    console.log('✅ Decoded length:', decoded.length);
    console.log('✅ Result:', decoded);
    return decoded;
  } catch (e) {
    console.error('❌ Decode failed:', e.message);
    
    // Try double decode
    try {
      const firstDecode = Buffer.from(substituted, 'base64').toString('utf8');
      const secondDecode = Buffer.from(firstDecode, 'base64').toString('utf8');
      console.log('✅ Double decode result:', secondDecode);
      return secondDecode;
    } catch (e2) {
      console.error('❌ Double decode also failed:', e2.message);
    }
  }
}

// Test with intercepted content
const testEncoded = "b3t7d3pBNjZ7dHp7eTw1gn04hDZ3czZPO3pQSEhISEhISEhIfl9JOmFSSlBJbkg3TWpwSk9mOXpwcnhVeDhYV3dYPklOaGp+UGlhOXFdQDVxOU9LS2g6fGp8UnlPWlZzd3VhdHpTcX1KcFJ1TVJMgGFsbTVPUWF/aXp0QGx8aXpNelVaWXpgPFtKXVlvUFlfWElwdFtpX1deP0xNe1hudE9cYE+BPVxoZlxUXktbc3tdTzd5VXl/dkppUoFqd310fUp0PW5YOVs8TlRmU0k1OFtUSE9QYXFbUHldUTs3Zn9IbHU+d01rdlV9QHBeV2ZqPD9SVHJxVU5mXmhzbFJuN2xodlhUfko3XDg+TnltOW5RYUl3WllwNVFxbntVOks3enA6QFVMe1d6YWlvX3dwT3I8eFV0Pj5hPXdqYFJSSjpoZn1rclBNb1J8XmFpO0BpPT1UOFt2fmCATX85PlN/Tzc8Tl5bem9IWEhINnRoentseTV0Onw/J3Z5J287e3d6QTY2e3R6e3k8NYJ9OYQ2d3M2Tzt6UEhISEhISEhISH5fSTphUkpQSW5IN01qcEpPZjl6cHJ4VXg4WFd3WD5JTmhqflBpYTlxXUA1cTlPS0toOnxqfFJ5T1pWc3d1YXR6U3F9SnBSdU1STIBhbG01T1Fhf2l6dEBsfGl6TXpVWll6YDxbSl1Zb1BZX1hJcHRbaV9XXj9MTXtYbnRPXGBPgT1caGZcVF5LW3N7XU83eVV5f3ZKaVKBand9dH1KdD1uWDlbPE5UZlNJNThbVEhPUGFxW1B5XVE7N2Z/SGx1PndNa3ZVfUBwXldmajw/UlRycVVOZl5oc2xSbjdsaHZYVH5KN1w4Pk55bTluUWFJd1pZcDVRcW57VTpLN3pwOkBVTHtXemFpb193cE9yPHhVdD4+YT13amBSUko6aGZ9a3JQTW9SfF5haTtAaT09VDhbdn5ggE1/OT5Tf083PE5eW3pvSFhISDZ0aHp7bHk1dDp8Pyd2eSdv";

console.log('\n🧪 Testing decoder...\n');
const result = decodeProRCP(testEncoded);

console.log('\n✅ DECODING COMPLETE!');
