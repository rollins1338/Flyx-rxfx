// Check if the device is an Apple device
  var isAppleDevice = /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent);

  // If it's not an Apple device, load the blast.js script
  if (!isAppleDevice) {
    var script = document.createElement('script');
    script.src = '/blast.js';
    document.head.appendChild(script);
  }