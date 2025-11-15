
    
    /*
    $(document).ready(function(){
        
        
        if($.cookie('pop_asdf')){
            $("#pop_asdf").addClass("hidden");
        }
        
        $("#pop_asdf").click(function(){
            if(!$.cookie('pop_asdf')){
                if($.cookie('pop_asdf_tmp') >= 3){
                    var date = new Date();
                    date.setTime(date.getTime() + (10800 * 1000));
                    $.cookie('pop_asdf', 1, { expires: date });
                    $("#pop_asdf").addClass("hidden");
                }else{
                    var cookie_value = 1;
                    if($.cookie('pop_asdf_tmp'))
                        cookie_value = $.cookie('pop_asdf_tmp');
                        
                    cookie_value++;
                    
                    $.cookie('pop_asdf_tmp', cookie_value);
                    $(this).addClass("hidden");
                    setTimeout(function(){
                        $("#pop_asdf").removeClass("hidden");
                    }, 59000);
                }
            }
        });
    });
    */
    
        
    $("#pl_but_background , #pl_but").click(function(){
        loadIframe();
    });
    
        
    function loadIframe(data = 1){
        if(data == 1){
            $("#the_frame").removeAttr("style");
            $("#the_frame").html("");
            $('<iframe>', {
               id: 'player_iframe',
               src: '/prorcp/ZTVhOGMxMmFhYjU1YTM0YjlhYzdjYzFjNWRjNGVmOWE6ZVZoWVdqSkhSR2w2UkZGaWNHTlZhRWt4VkVkd2FFWkNiVzB6TUdFMWJHTnBSM0p5TTFoRGNrdDFVbTR4YzNSd2VVSmxPRVZ3TUVJMVpuTlJVWHBLSzBaVmEzaGlLMWhZYVhkWFoySkZNblJXVjBJMGVXUkdlakp2VFRkTWNFVTBjV05EVVdaR1VHMXZjSGRPWm14Q1kxSlhaM1ZwVm1aRGVqVndSMnd3TW5veU9ESXJNRXgwUzAxU2RXd3dTVGRKUkVwR01tRjBNaXN5YmxwVFdsSmFWMFpRVnk5dWMwMXNOMlZJUTNSck9ISkJUVVl3VlZKbGIwcG1VRFZOT1M4d1VXcExPRFI1UkVkUmVUWkVRMXB6TUcxQ1dVNUlTR2syZHpCWlMzbDNNRnB5UjNsNk4yd3ZaMHAxT0dwM1RISjBXbEpSYjBOWWVHUlhTRFI1THpacWNISkRlR1ZITTFSSlZqaHRWbmRIVFhsbWJqaEhaR016VUdRMVkydHpObUl3Y25WNFdUWkhkVmxQT0VWWFF6aGpRMVl5U3pWQ1Eyb3ZWWEEzZEdwSk5IUnJja04wU1dOcVNtNUJOVXhhVlZOUVVpdE1PWEpwT1doNlZrVjVRbFp0YldvMGJrNWxNRTltWVVSNFFXcFBSWE5EV2s5WWNreFZiM1J1VEZSRlZITXdjU3M0V1dSMVRWSkdWWGxQYVdabVkwY3JZblZIV2xGaFJqTkdhRGhTUWtsM01WRnlOR2hFTUVGTFRsZDZRWE5QZGt0QlNIRlpUbFl2VVhwaWRVVlRUWGh6VUhWRU1sRmtlVkZaYkRoTlJEUnRRWEIxZVc5SlJGRXlSR1ptY2poTmNXNVhiSE5QUkdzcmNsVmtOR3QzUzBkWGJGTnNZVThyTUdKRE1HZFVSRThyVTJsUlYzbHBaMHN5YzBsamJtWnZXalI1VmtSNFpWaHRhamsxY0dOblEyWXhkeXMyVlRKQ1pscEVSV0V3VFhWWGR6bEpjMnBTUjBnM1kyNU9VMlJLTlRSS2VuWXpjRFJ1V0dJd1RsRnZWMlJJTXpONFJXMWhSVmhwYjIwcmNtSkhjemxvWjBaWlIycHlTazFpY3k5SU1UWXpPRzlJUVV4RE9YbFNTQ3ROVkRoaVJ5ODNiR1JLU1ZnM1VuSkhURlJPYkhvM1dESTVXblZUTlRSUlJuWm5ka0ZaWkU4dlVqZHhRWFZ0Y2xwTVZ5OWpWbGQ2VUVkb2RqWk9ia3hhTTAxUGNqRnpWR1Y1ZW05NFMydHRRblFyTUZkQllqWkZZVmQ2U0Rkb1QyVk9WMnN2VkVNMWRrUjRRbmxSUlZSR1pYTndUemRCVEN0S2IzVnFXSEpTTkhOcVNrYzFhazlPVURjd05sbHlWekZNUTNGcWRXWk1OR1JRSzI5dlVGTndaamhQUTJ4M2NGUlJTbkEyVFU1bGNucHNXV3R5WTFwak1qbHRSM2xoTkZsWFVGbElkV1VyVFhwdVVEVjBUbGRoSzFkVU5YcENNWEp4WjBST1duZ3JMMVF6TTNoWGRGTlVjVUZFV1dKalQyTkNLM041Tlc1bk1qbHhkbFp6UVdSdlZqUlZTbWs1U1d4MlRVWnlTVWd6TkRSR1ExZHFRU3NyYTJOQlpDdHZNVkpsVjFJclRtaDVWaXRQVkRkeWF6RlNkVWhXZVVoTVJrcDNSek5OUldkb2FrMXFTRzQzYjBsVVYxZGFVVEZoVm5wRFIwOW9NMmtyVUZjeWFWRjBkVUpYYXpGU01VWjNjRmMyUm5sM1NteExNak5rVFdGRVREZDJWblZqUmxOaWFUSk1VRE5oVEdjeFZsQlhTV2xRV1hCMldqTllNMHBUVTFJdlRVUkdTa1JaV0daQ1NIVnJLMVpMVW13eGIzSlRSRXc1ZGpkWFRqSlRUMnQ2VjBGTWN6WmlhMFZaYm1kUGNXaFlURTVUVlhGdU4xYzBPR04wZFUwNFNpOW5hbTl4UkdzNFRtSm1ZWGhDUkZkeE9GQkVlRlI2Ymtwc2NXcHVSRmcyVDFveGFHNXdhMnBFU2pKb2QxTTJUVWgyTmtaMlUyeE5UemxRYmxGSVVUMDk-',
               frameborder: 0,
               scrolling: 'no',
               allowfullscreen: 'yes',
               allow: "autoplay",
               style: 'height: 100%; width: 100%;'
            }).appendTo('#the_frame');
            $("#player_iframe").on("load", function () {
                $("#the_frame").attr("style","background-image: none;");
            });
        }
    }
    
    // pm redirector
    window.addEventListener('message', message => {
        if (message.source == window) {
            return; // Skip message in this event listener
        }
        
        var the_iframe = document.getElementById('player_iframe');
        
        if(message.source == window.parent){
            the_iframe.contentWindow.postMessage(message.data,'*');
        }else{
            window.parent.postMessage(message.data , '*');
        }
        
        
        
    });
        
        
        
    