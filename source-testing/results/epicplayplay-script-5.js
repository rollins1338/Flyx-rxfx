document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
    if ((e.ctrlKey && ['s','u','c'].includes(e.key.toLowerCase())) || e.key === 'F12') {
        e.preventDefault();
    }
});