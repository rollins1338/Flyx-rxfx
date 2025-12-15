/**
 * SmashyStream Token Generation - Reverse Engineering v3
 */

const fs = require('fs');

// Constants from the bundle
const f = [0, 1, 8, 255, "length", "undefined", 63, 6, "fromCodePoint", 7, 12, "push", 91, 8191, 88, 13, 14, 127, 128, 134, 132];

// Charsets
const CHARSET_1 = 'neIHlhigVfNbPdxA9{"a8wR]zWX@UZst26.7MYuo_j,pBTyS$JqCK^4O;}FG3Dv*+mcEQk=r0&[1!#5()~%?<:/`|>L';
const CHARSET_2 = 'A8CglIhpEO7,xSXz#Ji;dw~>n4DB(Y=3H_WUG$[5%/?a<K]V}F^o6vNf&PkqM|u0Tj@me1ZRQLc+)rt!sby:2`{".9*';
const CHARSET_3 = 'TW<fiVG8j&o/d"hq*,NepsH>2Zut?}a5QSM^Fmk!X_|RE@D0KP%L]7rU(nlY9gOI:+x)CB`;[z1b#JwAc~y={.64$v3';

function utf8Decode(bytes) {
  const result = [];
  for (let i = 0; i < bytes.length;) {
    let byte = bytes[i++];
    let codePoint;
    if (byte <= 127) codePoint = byte;
    else if (byte <= 223) codePoint = (byte & 31) << 6 | bytes[i++] & 63;
    else if (byte <= 239) codePoint = (byte & 15) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63;
    else codePoint = (byte & 7) << 18 | (bytes[i++] & 63) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63;
    result.push(String.fromCodePoint(codePoint));
  }
  return result.join('');
}

function decode91(input, charset) {
  const str = "" + (input || "");
  const bytes = [];
  let P = 0, M = 0, T = -1;
  for (let H = 0; H < str.length; H++) {
    const V = charset.indexOf(str[H]);
    if (V !== -1) {
      if (T < 0) T = V;
      else {
        T += V * 91;
        P |= T << M;
        M += (T & 8191) > 88 ? 13 : 14;
        do { bytes.push(P & 255); P >>= 8; M -= 8; } while (M > 7);
        T = -1;
      }
    }
  }
  if (T > -1) bytes.push((P | T << M) & 255);
  return utf8Decode(bytes);
}

// Key encoded strings
const keyStrings = {
  126: 'mWvk!Lmy.%fae>kA37k"t:$1{:RRM|pJ9e16(MQ"z%3OgY*',
  127: '+b$hl(Pyr4"9&|cUeWe$o="y>:v%WZM@_<e"opwF1%nC&P7',
  128: "P%@Jz}u",
  129: '`<8I"=~(E+e<^Y;JSL%MEn0Nb|9.kUhU4561&C95*9rK%Uby@`kHG=u',
  130: 'jtRv%:6n"Fg+k]u=W50sc%.nH;;a>Pz2`)&H`K8t4|)UAiP',
  131: "#RbLgD?0,75Q4YmWh<m%Te_96<XO7P1AZ/=oj>VFF<.*^Jiw<sy*",
  132: 'sz1W50)5zP+DEa@E2PB$z>W"dRhop=@+i7rL?MK6vM@',
  133: "Ai(*LLa@?79mRajEdxQxA(:L%FGn&0!Xr@pL3I3n,7Q`@BPbu7Mmn:@G",
  134: ":|=oKC95W.>C`Pdc!)q*y!oNS9<fkUP",
  135: '6PEWm<&O7<R"PbG=vt^W)`5AJzH?XG',
  136: "N05sKpzy(P4aq[NA25OH<Kd1)tn|}DrsJw,vd%_5#4VmGb%@`RV{O=u",
  137: "<RQ$Z]h:r|z,Gw7^!)|W1!zft<&71Jac2o}9pXg7D`O|NX",
  138: '6`lJtKu+~3jatj|c#R0Wbth"g}5]Q=@;v6r{Z88OO:wWf',
  139: ':HvlgD*=_4qoSnK3"5_6pYen/z;>5Fnc=oG',
  140: "/*vEy!T9.gaK#wxW",
  141: "Aowo,@0)pP1,2IjEC!2moof}dReQ+pq2W`nsW8:6g7",
  142: '8|h}b8Q2P7,5NUV=^o"H'
};

console.log('=== DECODING KEY STRINGS ===\n');

for (const [idx, encoded] of Object.entries(keyStrings)) {
  console.log(`[${idx}]:`);
  console.log(`  CHARSET_1: "${decode91(encoded, CHARSET_1)}"`);
  console.log(`  CHARSET_2: "${decode91(encoded, CHARSET_2)}"`);
  console.log(`  CHARSET_3: "${decode91(encoded, CHARSET_3)}"`);
  console.log('');
}

console.log('\n=== ANALYSIS ===');
console.log('f[17] = 127, f[18] = 128, f[19] = 132, f[20] = 134');
