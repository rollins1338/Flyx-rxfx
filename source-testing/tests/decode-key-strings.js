const CHARSET_1 = 'neIHlhigVfNbPdxA9{"a8wR]zWX@UZst26.7MYuo_j,pBTyS$JqCK^4O;}FG3Dv*+mcEQk=r0&[1!#5()~%?<:/`|>L';
const CHARSET_2 = 'A8CglIhpEO7,xSXz#Ji;dw~>n4DB(Y=3H_WUG$[5%/?a<K]V}F^o6vNf&PkqM|u0Tj@me1ZRQLc+)rt!sby:2`{".9*';

function utf8Decode(bytes) {
  const result = [];
  for (let i = 0; i < bytes.length;) {
    let byte = bytes[i++], codePoint;
    if (byte <= 127) codePoint = byte;
    else if (byte <= 223) codePoint = (byte & 31) << 6 | bytes[i++] & 63;
    else if (byte <= 239) codePoint = (byte & 15) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63;
    else codePoint = (byte & 7) << 18 | (bytes[i++] & 63) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63;
    result.push(String.fromCodePoint(codePoint));
  }
  return result.join('');
}

function decode91(input, charset) {
  const str = "" + (input || ""), bytes = [];
  let P = 0, M = 0, T = -1;
  for (let H = 0; H < str.length; H++) {
    const V = charset.indexOf(str[H]);
    if (V !== -1) {
      if (T < 0) T = V;
      else {
        T += V * 91; P |= T << M; M += (T & 8191) > 88 ? 13 : 14;
        do { bytes.push(P & 255); P >>= 8; M -= 8; } while (M > 7);
        T = -1;
      }
    }
  }
  if (T > -1) bytes.push((P | T << M) & 255);
  return utf8Decode(bytes);
}

// Test key strings
const tests = [
  ['132', 'sz1W50)5zP+DEa@E2PB$z>W"dRhop=@+i7rL?MK6vM@'],
  ['133', 'Ai(*LLa@?79mRajEdxQxA(:L%FGn&0!Xr@pL3I3n,7Q`@BPbu7Mmn:@G'],
  ['134', ':|=oKC95W.>C`Pdc!)q*y!oNS9<fkUP'],
  ['135', '6PEWm<&O7<R"PbG=vt^W)`5AJzH?XG'],
  ['136', 'N05sKpzy(P4aq[NA25OH<Kd1)tn|}DrsJw,vd%_5#4VmGb%@`RV{O=u'],
  ['137', '<RQ$Z]h:r|z,Gw7^!)|W1!zft<&71Jac2o}9pXg7D`O|NX'],
  ['138', '6`lJtKu+~3jatj|c#R0Wbth"g}5]Q=@;v6r{Z88OO:wWf']
];

for (const [idx, enc] of tests) {
  console.log(idx + ' C1: ' + decode91(enc, CHARSET_1));
  console.log(idx + ' C2: ' + decode91(enc, CHARSET_2));
}
