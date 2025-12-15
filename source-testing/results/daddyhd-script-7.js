(function(){
				var root = document.documentElement;
				var key = 'chat-hidden';
				var apply = function(v){ if (v) root.classList.add('chat-hidden'); else root.classList.remove('chat-hidden'); };
				try { apply(localStorage.getItem(key) === '1'); } catch(e) {}

				document.addEventListener('DOMContentLoaded', function(){
					var btn = document.getElementById('toggleChatBtn');
					if (!btn) return;
					btn.addEventListener('click', function(){
						var hidden = !root.classList.contains('chat-hidden');
						apply(hidden);
						try { localStorage.setItem(key, hidden ? '1' : '0'); } catch(e) {}
					});

					var themeToggle = document.getElementById('themeToggle');
					var drawerThemeToggle = document.getElementById('drawerThemeToggle');
					var root = document.documentElement; 
					var themeKey = 'site-theme';
					var logoLight = "./assets/logos/logo.png";
					var logoDark = "./assets/logos/logo-dark.png";

					// Function to update all logos
					function updateLogos(theme) {
						var logos = document.querySelectorAll('.logo-theme');
						logos.forEach(function(logo) {
							logo.src = theme === 'dark' ? logoDark : logoLight;
						});
					}

					function applyTheme(theme) {
						root.setAttribute('data-theme', theme);
						updateLogos(theme);
					}

					function toggleTheme() {
						var currentTheme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
						var newTheme = currentTheme === 'dark' ? 'light' : 'dark';
						applyTheme(newTheme);
						try { localStorage.setItem(themeKey, newTheme); } catch(e) {}
					}

					// Restore saved theme on page load
					try {
						var savedTheme = localStorage.getItem(themeKey) || 'light';
						applyTheme(savedTheme);
					} catch(e) {
						applyTheme('light');
					}

					if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
					if (drawerThemeToggle) drawerThemeToggle.addEventListener('click', toggleTheme);
					if (drawerThemeToggle) {
						drawerThemeToggle.addEventListener('click', function() {
							toggleTheme();
							document.documentElement.classList.remove('drawer-open');
						});
					}

					var navBtn = document.getElementById('navToggle');
					var drawer = document.getElementById('drawer');
					if (navBtn && drawer) {
						navBtn.addEventListener('click', function(){
							document.documentElement.classList.toggle('drawer-open');
						});
						drawer.addEventListener('click', function(e){
							if (e.target.tagName === 'A') document.documentElement.classList.remove('drawer-open');
						});
					}

					var mobileChat = document.getElementById('mobileChatToggle');
					if (mobileChat) {
						mobileChat.addEventListener('click', function(){
							var isOpen = root.classList.contains('mobile-chat-open');
							if (isOpen) { root.classList.remove('mobile-chat-open'); }
							else { root.classList.add('mobile-chat-open'); }
						});
					}

					var sidebarClose = document.getElementById('sidebarClose');
					if (sidebarClose) {
						sidebarClose.addEventListener('click', function(){
							root.classList.remove('mobile-chat-open');
						});
					}

					var sidebar = document.querySelector('.sidebar');
					if (sidebar) {
						sidebar.addEventListener('click', function(e){
							if (e.target === sidebar) {
								root.classList.remove('mobile-chat-open');
							}
						});
					}

					var bottomMenu = document.getElementById('bottomNavMenu');
					if (bottomMenu && navBtn) {
						bottomMenu.addEventListener('click', function(){
							document.documentElement.classList.toggle('drawer-open');
						});
					}
				});
			})();

			function toggleSection(header) {
				var content = header.nextElementSibling;
				var chevron = header.querySelector('.chevron');
				var icon = chevron ? chevron.querySelector('i') : null;
				if (content.style.display === 'none') {
					content.style.display = 'block';
					header.classList.remove('collapsed');
					if (icon) { icon.classList.remove('fa-chevron-right'); icon.classList.add('fa-chevron-down'); }
					else if (chevron) { chevron.textContent = '▼'; }
					if (content && content.classList && content.classList.contains('js-remote-schedule') && typeof window.loadRemoteSchedule === 'function') {
						window.loadRemoteSchedule(content);
					}
				} else {
					content.style.display = 'none';
					header.classList.add('collapsed');
					if (icon) { icon.classList.remove('fa-chevron-down'); icon.classList.add('fa-chevron-right'); }
					else if (chevron) { chevron.textContent = '▶'; }
				}
			}