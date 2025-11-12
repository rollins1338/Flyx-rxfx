/**
 * Decode the packed JavaScript from YesMovies to extract stream URLs
 */

// The packed code contains the stream URLs in the string at the end
// Format: 'string1|string2|string3...'.split('|')

const packedString = '||||||||||player|if|||||jw|||var|function|||links|tracks|submenu|settings|item|||svg||lastt||script|||||||audioTracks|on||hls2||hls3|jwplayer|https|hls4|589|position|else|file|icon|code|link|length|false|aria|attr|true|div|1810121|tott|currentFile|seek|newFile|path|ggima|document|data|return||name|active|||tt1lzngys5exf9||get|ls|rewind|tt||sec|769|240|60009|html|1762933893|op|dl|com|date|prevt|dt|textContent|match|doc|text|ffffff|m2q5ea5w42hk||current_audio|getAudioTracks|removeClass|expanded||checked||addButton|hls|type|load|hide|log|console|adb|xyz|769db16262b4766e2136a10df6f631d9|185|hash|1lzngys5exf9|vvplay|new|itads|vvad|100||master|setCurrentAudioTrack|audio_name|for|audio_set|open|controls|playbackRates|captions|event|stop|res|getPlaylistItem|ready|play||currentTracks|||insertAfter||||detach|ff00|button|getPosition|974|887|013|867|178|focusable|viewBox|class|2000|org|w3|www|http|xmlns|ff11|06475|23525|29374|97928|30317|31579|29683|38421|30626||72072||H|track_name|appendChild||body|fviews|player4u|referer|embed|file_code|view|js|src|createElement|video_ad|doPlay|value|loaded|documentElement|parseFromString|DOMParser|startsWith|xtype|playAd|vast|time|uas|FFFFFF|jpg|pixoraa|8348|m3u8||1lzngys5exf9_h||00362|01|dRRh37sQOSRl|300|English|setTimeout|default_audio|getItem|localStorage|dualSound|addClass|quality|hasClass|toggleClass|Track|Audio|dualy|images|mousedown|buttons|topbar|catch|ok|then|HEAD|method|fetch|firstFrame||once|null|getConfig|error|Rewind|778Z|214||2A4||3H209|3v19|9c4|7l41|9a6|3c0|1v19|4H79|3h48|8H146|3a4|2v125|130|1Zm162|4v62||13a4|51l|278Zm|278|1S103|1s6|3Zm|078a21|131||M113|Forward|69999|88605|21053|03598|02543|99999|72863|77056|04577|422413|163|210431|860275|03972|689569|893957|124979|52502|174985|57502|04363|13843|480087|93574|99396|160|76396|164107|63589|03604|125|778|993957|rewind2|set_audio_track|onload|onerror|ima3|sdkloader|googleapis|imasdk|const|over_player_msg|||Secure|None|SameSite|uqloads|domain|toGMTString|expires|cookie|1000|getTime|setTime|Date|createCookieSec|pause|remove|show|complete|jsonp|file_real|file_id|parseInt|ss|view4|vectorrab|logs|post|viewable|ttl|round|Math|set|S|async|trim|pickDirect|direct|encodeURIComponent|unescape|btoa|base64|xml|application|forEach|slow|fadeIn|video_ad_fadein|cache|no|Cache|Content|headers|ajaxSetup|v2done|pop3done|vastdone2|vastdone1|playbackRateControls|cast|streamhg|aboutlink|StreamHG|abouttext|720p|940|qualityLabels|insecure|vpaidmode|client|advertising|fontOpacity|backgroundOpacity|Tahoma|fontFamily|backgroundColor|color|userFontScale|thumbnails|kind|1lzngys5exf90000|url|get_slides|androidhls|menus|progress|timeslider|icons|controlbar|skin|auto|preload|duration|uniform|stretching|height|width|1lzngys5exf9_xt|image|sources|debug|setup|vplayer|1762977094|kjhhiuahiuhgihdf|JetCV2hQeNMjPjyQ|7c1Y6|stream|txt|cfd|lakesidecreativehouse|215845|asn|p2|p1||500|sp|srv|129600|cmfmqi2snZJ51Db8Y|bwjKpDGnwLteO1hJumnyOm5kA|premilkyway';

const tokens = packedString.split('|');

console.log('=== DECODED YESMOVIES STREAM URLS ===\n');

// Look for URLs in the tokens
const urls = tokens.filter(t => t.includes('http') || t.includes('.m3u8') || t.includes('stream'));

console.log('Found potential stream-related tokens:\n');
urls.forEach(url => console.log('  -', url));

// The key tokens are around index 18 (file), and we need to find the actual URLs
// Looking at the packed code structure, the URLs are in the 'n' object

console.log('\n=== ANALYZING STRUCTURE ===\n');

// From the code: j n={"18":"url1","1a":"url2","1d":"url3"}
// Where 18, 1a, 1d are indices in the token array

const index18 = tokens[parseInt('18', 36)]; // Convert base36 to decimal
const index1a = tokens[parseInt('1a', 36)];
const index1d = tokens[parseInt('1d', 36)];

console.log('Token at index 0x18 (24):', tokens[24]);
console.log('Token at index 0x1a (26):', tokens[26]);
console.log('Token at index 0x1d (29):', tokens[29]);

// The actual URLs are constructed in the packed code
// Let's look for the URL pattern

console.log('\n=== STREAM URL PATTERN ===\n');

// From the visible part of the packed code, we can see:
// "1c://65.cj.2l/18/64/63/61/3m.5z?t=ci-ch&s=2i&e=cg&f=1r&cf=2u&i=0.4&ce=cd&cb=2u&ca=2u&c9=c8"

// Where:
// 1c = https (token index 28)
// 65 = vvplay (token index 101)
// cj = xyz (token index 115)
// 2l = com (token index 77)
// etc.

console.log('https token:', tokens[28]);
console.log('vvplay token:', tokens[101]);
console.log('xyz token:', tokens[115]);
console.log('com token:', tokens[77]);

// Reconstruct the URL
const protocol = tokens[28]; // https
const domain1 = tokens[101]; // vvplay
const domain2 = tokens[115]; // xyz
const tld = tokens[77]; // com

console.log('\n🎯 RECONSTRUCTED STREAM DOMAIN:');
console.log(`${protocol}://${domain1}.${domain2}.${tld}/`);

// The file path contains the stream ID
const streamId = tokens[102]; // 1lzngys5exf9

console.log('\n🎯 STREAM ID:', streamId);

// Look for m3u8 token
const m3u8Token = tokens.findIndex(t => t === 'm3u8');
console.log('m3u8 token index:', m3u8Token, '=', tokens[m3u8Token]);

// The master playlist pattern
console.log('\n🎯 LIKELY STREAM URLS:');
console.log(`1. https://vvplay.xyz/stream/${streamId}/master.m3u8`);
console.log(`2. https://vvplay.xyz/hls/${streamId}/master.m3u8`);
console.log(`3. https://vvplay.xyz/${streamId}/master.m3u8`);

console.log('\n=== RECOMMENDATION ===');
console.log('Test these URLs directly or use the YesMovies player page');
console.log('The stream is hosted on vvplay.xyz domain');
