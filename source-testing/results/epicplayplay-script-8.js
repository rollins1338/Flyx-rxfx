setInterval("vwu()", 300000);
    function vwu(){
        if(document.images){
            document.images['viewers'].src = 'http://whos.amung.us/cwidget/1fkcex8f0d/000000ffffff.png' + Date.parse(new Date().toString());
        }
    }