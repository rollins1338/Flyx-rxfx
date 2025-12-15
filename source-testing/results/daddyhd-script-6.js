(function(){
	function loadChat(){
		var mount = document.getElementById('chatangoMount');
		if (!mount || mount.dataset.loaded === '1') return;
		var s = document.createElement('script');
		s.id = 'cid0020000364017904827';
		s.setAttribute('data-cfasync','false');
		s.async = true;
		s.src = '//st.chatango.com/js/gz/emb.js';
		s.style.cssText = 'width: 100%;height: 100%;';
		// Config payload as the script text content
		var cfg = document.createTextNode('{"handle":"daddylivehd","arch":"js","styles":{"b":100,"c":"000000","d":"000000","l":"FFFFFF","l":"606060","m":"FFFFFF","p":"11","r":100,"t":0}}');		s.appendChild(cfg);
		mount.appendChild(s);
		mount.dataset.loaded = '1';
	}
	// Load after all page resources are fully loaded
	if (document.readyState === 'complete') {
		loadChat();
	} else {
		window.addEventListener('load', loadChat);
	}
})();