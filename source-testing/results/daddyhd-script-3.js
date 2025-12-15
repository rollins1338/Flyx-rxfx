(function(){
			try {
				var key = 'site-theme';
				// 1) read saved theme
				var theme = localStorage.getItem(key);
				// 2) if no saved theme, fall back to OS preference
				if (theme !== 'dark' && theme !== 'light') {
				if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
					theme = 'dark';
				} else {
					theme = 'light';
				}
				}
				// 3) set attribute on root immediately to avoid paint flash
				document.documentElement.setAttribute('data-theme', theme);
				// 4) temporarily disable transitions until theme is set
				document.documentElement.classList.add('no-theme-transition');
			} catch(e) {
				// ignore
			}
			})();