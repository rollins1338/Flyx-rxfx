
    
        var ds_langs = [];
        var ds_lang = false;
        var sub_shown_lang = "";
        
        
        
        
        var flnm = removeExtension(atob('RmlnaHQgQ2x1YiAoMTk5OSkgWzEwODBwXS9GaWdodC5DbHViLjEwdGguQW5uaXZlcnNhcnkuRWRpdGlvbi4xOTk5LjEwODBwLkJyUmlwLngyNjQuWUlGWS5tcDQ='));
        
        
        flnm = flnm.split("/");
        var flnm_data = [];
        for (const key in flnm) {
            flnm_data.push(tprs.parse(flnm[key]));
        }
        
        var pljs_sub_lang = localStorage.getItem("pljssubtitle");
        if(typeof pljs_sub_lang === 'string' || pljs_sub_lang instanceof String){
            for (let lang of sub_langs) {
                var tmp_lang_regexp = new RegExp(lang.LanguageName, "i");
                if(tmp_lang_regexp.test(pljs_sub_lang)){
                    ds_lang = lang;
                    break;
                }
            }
        }
    
    
        
    
                ds_lang = get_lang_from_iso639(JSON.parse('[]')[0]);
                
                
        
        var pass_path = "//tmstr5.cloudnestra.com/rt_ping.php";
        
        var ping_interval = false;
        
        
        var subs_shown = false;
        var the_subtitles = [];
        
        var default_subtitles = "";
          
                    default_subtitles = "[]";
                    
        
        
        
                var db_subs = [];
                
        
        var lc_on = IsLcOn();
        
        var current_sub_name = "cs_"+$("body").data("i");
        
        if($("body").data("s") && $("body").data("e")){
            current_sub_name += "_"+$("body").data("s")+"x"+$("body").data("e");
        }
        
        if(default_subtitles.length > 0){
            the_subtitles = default_subtitles.split(",");
            //player.api("subtitle",default_subtitles);
        }
        
        
        //var player = new Playerjs({id:"player_parent", cuid:"50627283dc40ce660f24a5e1454d9327",file:"", poster:"//image.tmdb.org/t/p/w780/5TiwfWEaPSwD20uwXjCTUqpQX70.jpg" , ready:"PlayerReady" , autoplay:1 , subtitle: default_subtitles});
                
                var player = new Playerjs({id:"player_parent", file: eSfH1IRMyL , cuid:"50627283dc40ce660f24a5e1454d9327",poster:"//image.tmdb.org/t/p/w780/5TiwfWEaPSwD20uwXjCTUqpQX70.jpg" , ready:"PlayerReady" , autoplay:1 , subtitle: default_subtitles , "default_quality":"max"});    
                
        
        if(player.api("subtitles").length > 1 && ds_lang){
            setStartSubtitle();
        }else if(player.api("subtitles").length === 1){
            player.api("subtitle" , player.api("subtitles").length-1);
        }
        
                
        
        
        if(lc_on){
            current_sub = localStorage.getItem(current_sub_name);
            if(typeof current_sub === 'string' && isJson(current_sub)){
                current_sub = JSON.parse(current_sub);
                if(current_sub.lang_short != sub_shown_lang){
                    addSubtitle(current_sub);
                }
            }
        }
        
        var video = $("#player_parent").find("video")[0];
    
    
        
                var watched = {
            value: 0,
            report: 0,
            interval: false ,
            duration: 0,
            set: function (value) {
                this.value = value;
                this.onChange();
            },
            onChange: function(){
                //console.log(this.value);
                //console.log(this.duration);
                if(this.duration > 0){
                    if(this.report < 5){
                        var limit = this.duration*0.05;
                        if(limit < 30){
                            limit = 30
                        }
                        if(this.value > limit){
                            this.report = 5;
                            $.get("/fsdD/OTU2Mjg5ZTYyNDY1ZTAyYzFlNGZmZDQyMjNlNGIyMjY6WVdWa2NWUkpSek5NWlVsTVRrdDVSbGw0U2pKRGIzSlRXa3MwUVdGa1JXUTFhMVl5ZG5Cd1RsbFNUeXR1VEhaS0syOVdiVVExWlVWYWVYbFpNRU5VV1hSMmREQXpZWEp2YTIxcFdYQktaRFJxUTJFNGIxSkZVMlpHZEhaMlNVVnZPVlZaTVhjM1J6Qk1jWFp2YXpJMGNWQTJiMjFYVW1kemRWSmpjVlZrVmxWcGVYYzRTVEp4Y0VjM1RHNVhSVTk1YVRVd1VUWXZPV0ZsYTNGdmRXdGpTazl4Y0ZONmFrTjVNV05MU0hOcFJYcFdSR2x6ZFZJckswVnBlakozT1ZOeGFHWTJlbHBUVjI5emRXUkpUVEZPVmtWTVEzSnhNbmhTYzBOaGQyZGphRWwzVjBGRVUwZHRlbTVQWVRGblZtRnJWRWxDY2pKak1FRmplRWxrYUZodWQxaFZaMUpTV25SYVUxaEJaMDFyTW1aT1lXZHVOMEpPTjJKdWNtcHVUVmxOUlRreVNVRTVWblpHTmsxbFdqbGhhMGwwWlROYWVITm1jRnBrTjBKUE9XdElaR2wzYUVsVWRtUk1Sa3RqY0V4T2VIcHJZbFJVTUd4UFEyOWllQzlyU1RCd1RXeHZkVWxwYWxWRllreEtTV2RCTVU5U2FHZzFlV0p2TDFOTWRVaEJVSGMyWlUxWE1HSlpkV2dyVVc5c2VFRmhSMmsyYm01U1drNWxjbEJJU2tObGFWVnFTbVo2ZVVsWVNsY3dlVTFHZVhwd1ltRm5NVlJXZDFWS1JFaHZkSEpEZEhWckt6QXhRVzFYV25CT2R6STVZMDV2YVRJNFYySTRSa3hVZVhGeWMxVnFSbEptVTBSaVRGYzRjMWxGVG5scFNURXJNVGc1WW1aS2JqRktTVzlrVTBwRFNVVlRZbTVoV2tNM1dHaEJUVXc1YkdZM1ZIaGlPWFEyZVhoVmNWUlBVRThyUVhKU2JITjFjRmRuVjJoUVlVcFlXR3hYV0RKaFpWQkhZalFyVkZOVWJHTXdhV2xaZW10bFkzbzRLMjl0ZERCWVkwaGplSFphUTNVME1GaDJSQzloUjFkbWVVbHJNak5DUkhkb1ZtSklVRmszYjIxV2FTdHlSbnBoUTNoRFNYWklSbnBuVUVkcldtVXJSRWMzVVZwemVsYzFhV2MzZHpKWGRqRjZOME5qWTBaSVdVVk1abTh5U1ZOcGFHSllUSE5CUnpCSVpuUkRjbE12TWtaRlkwTm5iMkZ6VmswdksxZG5aRGsyUzJGbmNXcGxlR2dyWmxwWU1HbFViSGxrWlU1NlFsUm5kMk5yYml0Qk9XRnBNbkJoWXpoa09XOHJSM0YyWTNCQk1rNUhUa3BxZUhCUlNWcFhkekJyYlhoWGRqTlJSVkkxVVdScVFXVTFWbXhyTkVSVFlVdDNRbXc0TW5KRVdIZ3pVVXhFVlZsUVNXTkZWVzFVYkRsNVMycDNjMlpYU2xka2VuTkljM1pGVkRWS1VFSnlhRTFUTURWd01tRmhlWEJhTkZrNUszZ3JTbFoyTTBkeFJGZHFUelZVUnpoWk1FbHJSVlV2YTNSNlZuRnpUR0pIUTJNME9FOTRZakl4U2xSUVRtTm1VbEJJVmxseU5rNWxZMGR3UmpreFZURlJaV2RoU1dsNFpIRTBlalI0TjA5UWVFRkplamRDT0RKSGNYcFNZWFZHYlRCSkx6bHFjaXQ1VWtaTGVGUmhaWFJ3VFZKR0syZExjVkl6U1VZNGNYSXJla1k1TDAxYVoySjRkVmhHTm1ONmJrVTJMMFpITmpOSE4yWktPRFJqTW0xb2FWWTJSVFkxV1RSSk5ERlJUR1JUYjIwemFVVXhWblpqWldSM1N6aGFVa00zTVVGYVYxVjZTbGRRWVVvNVYwWXZiamczUzA1MWVGbzViVk40VkZOcVdXcGtkRmc1YVdoNFlrTm1SR3MyYWpCTmFVUXliWEV4ZGpGRFozVkNjU3RVTkVoemNURm5jU3RyTHpoSGVEaGpkVkpvZEVWeVZUQm9jME13YjA5aWRsY3ZaVGxWT1daT05rdFNVMkpWTTBneGRtSjROVlJ5VG01NlRXaHdlVzQ1UnpKVk1WZFNWMWgzV0RKcVdtUXlNbmRtY0dKTlJHZEJPREZyUkE9PQ--");
                        }
                        /*
                        if(this.value > (this.duration*0.05)){
                            this.report = 5;
                            $.get("/vsdV/OTU2Mjg5ZTYyNDY1ZTAyYzFlNGZmZDQyMjNlNGIyMjY6WVdWa2NWUkpSek5NWlVsTVRrdDVSbGw0U2pKRGIzSlRXa3MwUVdGa1JXUTFhMVl5ZG5Cd1RsbFNUeXR1VEhaS0syOVdiVVExWlVWYWVYbFpNRU5VV1hSMmREQXpZWEp2YTIxcFdYQktaRFJxUTJFNGIxSkZVMlpHZEhaMlNVVnZPVlZaTVhjM1J6Qk1jWFp2YXpJMGNWQTJiMjFYVW1kemRWSmpjVlZrVmxWcGVYYzRTVEp4Y0VjM1RHNVhSVTk1YVRVd1VUWXZPV0ZsYTNGdmRXdGpTazl4Y0ZONmFrTjVNV05MU0hOcFJYcFdSR2x6ZFZJckswVnBlakozT1ZOeGFHWTJlbHBUVjI5emRXUkpUVEZPVmtWTVEzSnhNbmhTYzBOaGQyZGphRWwzVjBGRVUwZHRlbTVQWVRGblZtRnJWRWxDY2pKak1FRmplRWxrYUZodWQxaFZaMUpTV25SYVUxaEJaMDFyTW1aT1lXZHVOMEpPTjJKdWNtcHVUVmxOUlRreVNVRTVWblpHTmsxbFdqbGhhMGwwWlROYWVITm1jRnBrTjBKUE9XdElaR2wzYUVsVWRtUk1Sa3RqY0V4T2VIcHJZbFJVTUd4UFEyOWllQzlyU1RCd1RXeHZkVWxwYWxWRllreEtTV2RCTVU5U2FHZzFlV0p2TDFOTWRVaEJVSGMyWlUxWE1HSlpkV2dyVVc5c2VFRmhSMmsyYm01U1drNWxjbEJJU2tObGFWVnFTbVo2ZVVsWVNsY3dlVTFHZVhwd1ltRm5NVlJXZDFWS1JFaHZkSEpEZEhWckt6QXhRVzFYV25CT2R6STVZMDV2YVRJNFYySTRSa3hVZVhGeWMxVnFSbEptVTBSaVRGYzRjMWxGVG5scFNURXJNVGc1WW1aS2JqRktTVzlrVTBwRFNVVlRZbTVoV2tNM1dHaEJUVXc1YkdZM1ZIaGlPWFEyZVhoVmNWUlBVRThyUVhKU2JITjFjRmRuVjJoUVlVcFlXR3hYV0RKaFpWQkhZalFyVkZOVWJHTXdhV2xaZW10bFkzbzRLMjl0ZERCWVkwaGplSFphUTNVME1GaDJSQzloUjFkbWVVbHJNak5DUkhkb1ZtSklVRmszYjIxV2FTdHlSbnBoUTNoRFNYWklSbnBuVUVkcldtVXJSRWMzVVZwemVsYzFhV2MzZHpKWGRqRjZOME5qWTBaSVdVVk1abTh5U1ZOcGFHSllUSE5CUnpCSVpuUkRjbE12TWtaRlkwTm5iMkZ6VmswdksxZG5aRGsyUzJGbmNXcGxlR2dyWmxwWU1HbFViSGxrWlU1NlFsUm5kMk5yYml0Qk9XRnBNbkJoWXpoa09XOHJSM0YyWTNCQk1rNUhUa3BxZUhCUlNWcFhkekJyYlhoWGRqTlJSVkkxVVdScVFXVTFWbXhyTkVSVFlVdDNRbXc0TW5KRVdIZ3pVVXhFVlZsUVNXTkZWVzFVYkRsNVMycDNjMlpYU2xka2VuTkljM1pGVkRWS1VFSnlhRTFUTURWd01tRmhlWEJhTkZrNUszZ3JTbFoyTTBkeFJGZHFUelZVUnpoWk1FbHJSVlV2YTNSNlZuRnpUR0pIUTJNME9FOTRZakl4U2xSUVRtTm1VbEJJVmxseU5rNWxZMGR3UmpreFZURlJaV2RoU1dsNFpIRTBlalI0TjA5UWVFRkplamRDT0RKSGNYcFNZWFZHYlRCSkx6bHFjaXQ1VWtaTGVGUmhaWFJ3VFZKR0syZExjVkl6U1VZNGNYSXJla1k1TDAxYVoySjRkVmhHTm1ONmJrVTJMMFpITmpOSE4yWktPRFJqTW0xb2FWWTJSVFkxV1RSSk5ERlJUR1JUYjIwemFVVXhWblpqWldSM1N6aGFVa00zTVVGYVYxVjZTbGRRWVVvNVYwWXZiamczUzA1MWVGbzViVk40VkZOcVdXcGtkRmc1YVdoNFlrTm1SR3MyYWpCTmFVUXliWEV4ZGpGRFozVkNjU3RVTkVoemNURm5jU3RyTHpoSGVEaGpkVkpvZEVWeVZUQm9jME13YjA5aWRsY3ZaVGxWT1daT05rdFNVMkpWTTBneGRtSjROVlJ5VG01NlRXaHdlVzQ1UnpKVk1WZFNWMWgzV0RKcVdtUXlNbmRtY0dKTlJHZEJPREZyUkE9PQ--");
                        }
                        */
                    }
                    
                }
            },
            setDur: function(dur){
                this.duration = dur;
            }
        }
                
        function PlayerReady(){
            gen_subs_el();
            gen_reporting_el();
        }
    
    
            
        var pm_player_data = {type:"PLAYER_EVENT"};
        var pm_time_last_update = 0;
        var pm_time_last_update_use = false;
        
        pm_player_data.data = {
            imdbId: "tt0137523",
            tmdbId: 550,
            type: "movie",
            season: false,
            episode: false,
            currentTime: 0,
            duration: 0
        };
    
        function PlayerjsEvents(event,id,data){
            
            
            if(event=="play"){
                if(!ping_interval)
                    restart_ping_interval();
                
                pm_player_data.data.event = "play";
                window.parent.postMessage(pm_player_data , '*');
                //console.log(pm_player_data);
                
                if(!watched.interval){
                    watched.interval = setInterval(function(){
                        if(player.api("playing")){
                            watched.set(watched.value+1);
                            if(watched.value % 60 == 0){
                                //$.get("/watched");
                            }
                        }
                    },1000);
                }
            }
            
            if(event == "pause"){
                clearInterval(ping_interval);
                ping_interval = false;
                pm_player_data.data.event = "pause";
                window.parent.postMessage(pm_player_data , '*');
                //console.log(pm_player_data);
            }
            
            if(event == "time"){
                if((Date.now() - pm_time_last_update) > 5000){
                    pm_time_last_update = Date.now();
                    pm_player_data.data.event = "timeupdate";
                    pm_player_data.data.currentTime = parseInt(player.api("time"));
                    window.parent.postMessage(pm_player_data , '*');
                }
            }
            
            if(event == "end"){
                clearInterval(ping_interval);
                ping_interval = false;
                pm_player_data.data.event = "ended";
                pm_player_data.data.currentTime = parseInt(player.api("duration"));
                window.parent.postMessage(pm_player_data , '*');
                player.api("pause");
                //console.log(pm_player_data);
                
                            }
            
            if(event == "seek"){
                pm_player_data.data.event = "seeked";
                pm_player_data.data.currentTime = parseInt(player.api("time"));
                window.parent.postMessage(pm_player_data , '*');
                //console.log(pm_player_data);
            }
            
            
            if(event=="networkErrorHls"){
                data_parsed = JSON.parse(data);
                if(data_parsed.details == "fragLoadError" && data_parsed.fatal && watched.value < 60){
                    // checkAndLogUrlStatus();
                    // logToServerAndRedirect(pm_player_data);
                    // window.location.replace("https://cloudnestra.comOTU2Mjg5ZTYyNDY1ZTAyYzFlNGZmZDQyMjNlNGIyMjY6WVdWa2NWUkpSek5NWlVsTVRrdDVSbGw0U2pKRGIzSlRXa3MwUVdGa1JXUTFhMVl5ZG5Cd1RsbFNUeXR1VEhaS0syOVdiVVExWlVWYWVYbFpNRU5VV1hSMmREQXpZWEp2YTIxcFdYQktaRFJxUTJFNGIxSkZVMlpHZEhaMlNVVnZPVlZaTVhjM1J6Qk1jWFp2YXpJMGNWQTJiMjFYVW1kemRWSmpjVlZrVmxWcGVYYzRTVEp4Y0VjM1RHNVhSVTk1YVRVd1VUWXZPV0ZsYTNGdmRXdGpTazl4Y0ZONmFrTjVNV05MU0hOcFJYcFdSR2x6ZFZJckswVnBlakozT1ZOeGFHWTJlbHBUVjI5emRXUkpUVEZPVmtWTVEzSnhNbmhTYzBOaGQyZGphRWwzVjBGRVUwZHRlbTVQWVRGblZtRnJWRWxDY2pKak1FRmplRWxrYUZodWQxaFZaMUpTV25SYVUxaEJaMDFyTW1aT1lXZHVOMEpPTjJKdWNtcHVUVmxOUlRreVNVRTVWblpHTmsxbFdqbGhhMGwwWlROYWVITm1jRnBrTjBKUE9XdElaR2wzYUVsVWRtUk1Sa3RqY0V4T2VIcHJZbFJVTUd4UFEyOWllQzlyU1RCd1RXeHZkVWxwYWxWRllreEtTV2RCTVU5U2FHZzFlV0p2TDFOTWRVaEJVSGMyWlUxWE1HSlpkV2dyVVc5c2VFRmhSMmsyYm01U1drNWxjbEJJU2tObGFWVnFTbVo2ZVVsWVNsY3dlVTFHZVhwd1ltRm5NVlJXZDFWS1JFaHZkSEpEZEhWckt6QXhRVzFYV25CT2R6STVZMDV2YVRJNFYySTRSa3hVZVhGeWMxVnFSbEptVTBSaVRGYzRjMWxGVG5scFNURXJNVGc1WW1aS2JqRktTVzlrVTBwRFNVVlRZbTVoV2tNM1dHaEJUVXc1YkdZM1ZIaGlPWFEyZVhoVmNWUlBVRThyUVhKU2JITjFjRmRuVjJoUVlVcFlXR3hYV0RKaFpWQkhZalFyVkZOVWJHTXdhV2xaZW10bFkzbzRLMjl0ZERCWVkwaGplSFphUTNVME1GaDJSQzloUjFkbWVVbHJNak5DUkhkb1ZtSklVRmszYjIxV2FTdHlSbnBoUTNoRFNYWklSbnBuVUVkcldtVXJSRWMzVVZwemVsYzFhV2MzZHpKWGRqRjZOME5qWTBaSVdVVk1abTh5U1ZOcGFHSllUSE5CUnpCSVpuUkRjbE12TWtaRlkwTm5iMkZ6VmswdksxZG5aRGsyUzJGbmNXcGxlR2dyWmxwWU1HbFViSGxrWlU1NlFsUm5kMk5yYml0Qk9XRnBNbkJoWXpoa09XOHJSM0YyWTNCQk1rNUhUa3BxZUhCUlNWcFhkekJyYlhoWGRqTlJSVkkxVVdScVFXVTFWbXhyTkVSVFlVdDNRbXc0TW5KRVdIZ3pVVXhFVlZsUVNXTkZWVzFVYkRsNVMycDNjMlpYU2xka2VuTkljM1pGVkRWS1VFSnlhRTFUTURWd01tRmhlWEJhTkZrNUszZ3JTbFoyTTBkeFJGZHFUelZVUnpoWk1FbHJSVlV2YTNSNlZuRnpUR0pIUTJNME9FOTRZakl4U2xSUVRtTm1VbEJJVmxseU5rNWxZMGR3UmpreFZURlJaV2RoU1dsNFpIRTBlalI0TjA5UWVFRkplamRDT0RKSGNYcFNZWFZHYlRCSkx6bHFjaXQ1VWtaTGVGUmhaWFJ3VFZKR0syZExjVkl6U1VZNGNYSXJla1k1TDAxYVoySjRkVmhHTm1ONmJrVTJMMFpITmpOSE4yWktPRFJqTW0xb2FWWTJSVFkxV1RSSk5ERlJUR1JUYjIwemFVVXhWblpqWldSM1N6aGFVa00zTVVGYVYxVjZTbGRRWVVvNVYwWXZiamczUzA1MWVGbzViVk40VkZOcVdXcGtkRmc1YVdoNFlrTm1SR3MyYWpCTmFVUXliWEV4ZGpGRFozVkNjU3RVTkVoemNURm5jU3RyTHpoSGVEaGpkVkpvZEVWeVZUQm9jME13YjA5aWRsY3ZaVGxWT1daT05rdFNVMkpWTTBneGRtSjROVlJ5VG01NlRXaHdlVzQ1UnpKVk1WZFNWMWgzV0RKcVdtUXlNbmRtY0dKTlJHZEJPREZyUkE9PQ--");
                }
            }
            
            //if(event=="loaderror"){
                
                
                if(data == "manifestLoadError (networkError)" || data == "not found" || data == "Media failed to decode"){
                    //reloadWithPost({ fallback_url_path: ''});
                    // checkAndLogUrlStatus();
                    // logToServerAndRedirect(pm_player_data);
                    // window.location.replace("https://cloudnestra.comOTU2Mjg5ZTYyNDY1ZTAyYzFlNGZmZDQyMjNlNGIyMjY6WVdWa2NWUkpSek5NWlVsTVRrdDVSbGw0U2pKRGIzSlRXa3MwUVdGa1JXUTFhMVl5ZG5Cd1RsbFNUeXR1VEhaS0syOVdiVVExWlVWYWVYbFpNRU5VV1hSMmREQXpZWEp2YTIxcFdYQktaRFJxUTJFNGIxSkZVMlpHZEhaMlNVVnZPVlZaTVhjM1J6Qk1jWFp2YXpJMGNWQTJiMjFYVW1kemRWSmpjVlZrVmxWcGVYYzRTVEp4Y0VjM1RHNVhSVTk1YVRVd1VUWXZPV0ZsYTNGdmRXdGpTazl4Y0ZONmFrTjVNV05MU0hOcFJYcFdSR2x6ZFZJckswVnBlakozT1ZOeGFHWTJlbHBUVjI5emRXUkpUVEZPVmtWTVEzSnhNbmhTYzBOaGQyZGphRWwzVjBGRVUwZHRlbTVQWVRGblZtRnJWRWxDY2pKak1FRmplRWxrYUZodWQxaFZaMUpTV25SYVUxaEJaMDFyTW1aT1lXZHVOMEpPTjJKdWNtcHVUVmxOUlRreVNVRTVWblpHTmsxbFdqbGhhMGwwWlROYWVITm1jRnBrTjBKUE9XdElaR2wzYUVsVWRtUk1Sa3RqY0V4T2VIcHJZbFJVTUd4UFEyOWllQzlyU1RCd1RXeHZkVWxwYWxWRllreEtTV2RCTVU5U2FHZzFlV0p2TDFOTWRVaEJVSGMyWlUxWE1HSlpkV2dyVVc5c2VFRmhSMmsyYm01U1drNWxjbEJJU2tObGFWVnFTbVo2ZVVsWVNsY3dlVTFHZVhwd1ltRm5NVlJXZDFWS1JFaHZkSEpEZEhWckt6QXhRVzFYV25CT2R6STVZMDV2YVRJNFYySTRSa3hVZVhGeWMxVnFSbEptVTBSaVRGYzRjMWxGVG5scFNURXJNVGc1WW1aS2JqRktTVzlrVTBwRFNVVlRZbTVoV2tNM1dHaEJUVXc1YkdZM1ZIaGlPWFEyZVhoVmNWUlBVRThyUVhKU2JITjFjRmRuVjJoUVlVcFlXR3hYV0RKaFpWQkhZalFyVkZOVWJHTXdhV2xaZW10bFkzbzRLMjl0ZERCWVkwaGplSFphUTNVME1GaDJSQzloUjFkbWVVbHJNak5DUkhkb1ZtSklVRmszYjIxV2FTdHlSbnBoUTNoRFNYWklSbnBuVUVkcldtVXJSRWMzVVZwemVsYzFhV2MzZHpKWGRqRjZOME5qWTBaSVdVVk1abTh5U1ZOcGFHSllUSE5CUnpCSVpuUkRjbE12TWtaRlkwTm5iMkZ6VmswdksxZG5aRGsyUzJGbmNXcGxlR2dyWmxwWU1HbFViSGxrWlU1NlFsUm5kMk5yYml0Qk9XRnBNbkJoWXpoa09XOHJSM0YyWTNCQk1rNUhUa3BxZUhCUlNWcFhkekJyYlhoWGRqTlJSVkkxVVdScVFXVTFWbXhyTkVSVFlVdDNRbXc0TW5KRVdIZ3pVVXhFVlZsUVNXTkZWVzFVYkRsNVMycDNjMlpYU2xka2VuTkljM1pGVkRWS1VFSnlhRTFUTURWd01tRmhlWEJhTkZrNUszZ3JTbFoyTTBkeFJGZHFUelZVUnpoWk1FbHJSVlV2YTNSNlZuRnpUR0pIUTJNME9FOTRZakl4U2xSUVRtTm1VbEJJVmxseU5rNWxZMGR3UmpreFZURlJaV2RoU1dsNFpIRTBlalI0TjA5UWVFRkplamRDT0RKSGNYcFNZWFZHYlRCSkx6bHFjaXQ1VWtaTGVGUmhaWFJ3VFZKR0syZExjVkl6U1VZNGNYSXJla1k1TDAxYVoySjRkVmhHTm1ONmJrVTJMMFpITmpOSE4yWktPRFJqTW0xb2FWWTJSVFkxV1RSSk5ERlJUR1JUYjIwemFVVXhWblpqWldSM1N6aGFVa00zTVVGYVYxVjZTbGRRWVVvNVYwWXZiamczUzA1MWVGbzViVk40VkZOcVdXcGtkRmc1YVdoNFlrTm1SR3MyYWpCTmFVUXliWEV4ZGpGRFozVkNjU3RVTkVoemNURm5jU3RyTHpoSGVEaGpkVkpvZEVWeVZUQm9jME13YjA5aWRsY3ZaVGxWT1daT05rdFNVMkpWTTBneGRtSjROVlJ5VG01NlRXaHdlVzQ1UnpKVk1WZFNWMWgzV0RKcVdtUXlNbmRtY0dKTlJHZEJPREZyUkE9PQ--");
                }
            //}
            
            if(event=="duration"){
                if(watched.duration == 0){
                    watched.setDur(parseInt(player.api("duration")));
                    
                    pm_player_data.data.duration = parseInt(player.api("duration"));
                    pm_player_data.data.event = "timeupdate";
                    window.parent.postMessage(pm_player_data , '*');   
                }
            }
            
            if(event == "subtitle"){
                var sub_lang = get_lang_from_name(data);
                sub_shown_lang = sub_lang.ISO639;
            }
        }
        
        
        function openVidsrc(){
            var win = window.open('https://vidsrcme.ru/', '_blank');
            if (win) {
                //Browser has allowed it to be opened
                win.focus();
            }
        }
        
        
        
        
        window.addEventListener('message', message => {
            if (message.source == window) {
                return; // Skip message in this event listener
            }
            
            if(message.source == window.parent){
                if(isJson(message.data)){
                    message_data = JSON.parse(message.data);
                    if(message_data.player === true){
                        if(message_data.action == "play"){
                            player.api("play");
                        }
                        if(message_data.action == "pause"){
                            player.api("pause");
                        }
                        
                        if(message_data.action == "mute"){
                            player.api("mute");
                        }
                        
                        if(message_data.action == "unmute"){
                            player.api("unmute");
                        }
                        
                        if(message_data.action.includes("seek")){
                            var seek_match = message_data.action.match(/seek(\+|-)([0-9]+)/);
                            if(seek_match.length){
                                player.api("seek",seek_match[1]+seek_match[2])
                            }
                        }
                    }
                }
            }
        });
        
        
        
        function IsLcOn(){
            var is_on = false;
            try {
                localStorage.setItem('test_lc' , "1");
                if(localStorage.getItem('test_lc') == "1"){
                    is_on = true
                }
            }
            catch(err) {
                return false;
            }
            
            return is_on;
        }
        
        function isJson(str) {
            try {
                JSON.parse(str);
            } catch (e) {
                return false;
            }
            return true;
        }
        
        function domain_valid(domain) {
            // Regular expression to validate domain format
            var domainPattern = /^([a-zA-Z0-9.-]+)?[a-zA-Z0-9-]\.[a-zA-Z]{2,}(\.[a-zA-Z]{2,})?$/;

            return domainPattern.test(domain);
        }
        
        
        function reloadWithPost(data) {
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = window.location.href.split('?')[0];
            
            for (const key in data) {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = data[key];
                form.appendChild(input);
            }
            
            document.body.appendChild(form);
            form.submit();
        }
        
        
        // Function to check single URL and log status code
        function checkAndLogUrlStatus() {
            $.ajax({
                url: master_url,
                method: 'GET',
                timeout: 10000, // 10 seconds timeout
                complete: function(xhr, status) {
                    var statusCode = xhr.status;
                    var statusText = xhr.statusText;
                    
                    // Prepare log data
                    var logData = {
                        url: master_url,
                        status_code: statusCode,
                        status_text: statusText,
                        request_status: status, // "success", "error", "timeout"
                        timestamp: new Date().toISOString(),
                        user_agent: navigator.userAgent,
                        referrer: document.referrer
                    };
                    
                    console.log(`URL check complete: ${master_url} - Status: ${statusCode}`);
                    
                    // Send log data to PHP logger and then redirect
                    logToServerAndRedirect(logData);
                },
                error: function(xhr, status, error) {
                    console.error('URL check failed:', error);
                    
                    // Log the failure and redirect anyway
                    var logData = {
                        url: master_url,
                        status_code: 0,
                        status_text: 'Check Failed',
                        request_status: status,
                        timestamp: new Date().toISOString(),
                        user_agent: navigator.userAgent,
                        referrer: document.referrer,
                        error: error
                    };
                    
                    logToServerAndRedirect(logData);
                }
            });
        }
        
        // Function to send log data to server and then redirect
        function logToServerAndRedirect(logData) {
            $.ajax({
                url: '/http_check.php',
                method: 'POST',
                data: logData,
                success: function(response) {
                    console.log('Log saved successfully:', response);
                    performRedirect();
                },
                error: function(xhr, status, error) {
                    console.error('Failed to save log:', error);
                    // Still redirect even if logging fails
                    performRedirect();
                }
            });
        }
        
        // function to sent log data to server
        function logToServer(logData) {
            $.ajax({
                url: '/http_check.php',
                method: 'POST',
                data: logData,
                success: function(response) {
                    console.log('Log saved successfully:', response);
                },
                error: function(xhr, status, error) {
                    console.error('Failed to save log:', error);
                }
            });
        }
        
        // Perform the redirect
        function performRedirect() {
            window.location.replace(fallback_url);
        }
        
        
        // Observe all network requests
        const performanceObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.name.includes('.m3u8') && entry.name.includes('putgate')) {
                var new_pass_obj = new URL(entry.name);
                var old_pass_obj = new URL("https:"+pass_path);
                pass_path = pass_path.replace(old_pass_obj.hostname,new_pass_obj.hostname);
                restart_ping_interval();
            }
          });
        });
        
        // Start observing
        performanceObserver.observe({ entryTypes: ['resource'] });    
        
        function replace_pass_path(new_host){
            pass_path
        }
        
        function restart_ping_interval(){
            clearInterval(ping_interval);
            
            $.get(pass_path);
            
            ping_interval = setInterval(function(){ 
                $.get(pass_path, function(data, status){
                    //console.log(data);
                });
            }, 60000);
        }
        
        
    