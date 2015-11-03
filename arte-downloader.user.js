// ==UserScript==
// @name        Arte+7 Downloader
// @namespace   GuGuss
// @description Display direct links to MP4 videos of Arte+7 programs
// @include     http://*.arte.tv/*
// @version     1.6.0
// @updateURL   https://github.com/GuGuss/ARTE-7-Playground/blob/master/arte-downloader.user.js
// @grant       GM_xmlhttpRequest
// @icon        https://icons.duckduckgo.com/ip2/www.arte.tv.ico
// ==/UserScript==

// Set this to 1 to enable console logs.
var debug_mode = 1;
if (!debug_mode) {
    console.log('GM debug mode disabled');
    console.log = function () { };
} else {
    console.log('GM debug mode enabled');
}

// aka. versionCode
var languageCode = {
    'VO-STF': 'Original (subtitled in french)',
    'VA-STA': 'German subtitled',
    'VF-STF': 'French subtitled',
    'VOF': 'French',
    'VOA': 'German',
    'VOF-STMF': 'Sourds et malentendants'
};

var addButtons = function (element) {
    var languageRadioList = document.createElement('select');
    languageRadioList.innerHTML = "<option value='VO-STF' selected>" + languageCode['VO-STF'] + "</option>"
                                + "<option value='VA-STA'>" + languageCode['VA-STA'] + "</option>"
                                + "<option value='VF-STF'>" + languageCode['VF-STF'] + "</option>"
                                + "<option value='VOF'>" + languageCode['VOF'] + "</option>"
                                + "<option value='VOA'>" + languageCode['VOA'] + "</option>"
                                + "<option value='VOF-STMF'>" + languageCode['VOF-STMF'] + "</option>";
    languageRadioList.setAttribute('class', 'btn btn-default');
    languageRadioList.setAttribute('style', 'width:98%');

    var credit = document.createElement('div');
    credit.setAttribute('style', 'width: 100%; text-align: center; font-size: 0.8em; padding: 3px;');
    credit.innerHTML = 'Arte+7 Downloader v.' + GM_info.script.version + ' built by and for the community with <strong><3</strong><br /><a href="https://github.com/GuGuss/ARTE-7-Downloader">Contribute Here.</a>';

    var container = document.createElement('div');
    container.setAttribute('style', 'display: table; width: 100%;');
    //container.appendChild(languageRadioList);
    container.appendChild(createButton(element, 'High'));
    container.appendChild(createButton(element, 'Standard'));
    container.appendChild(createButton(element, 'Low'));
    container.appendChild(createButtonMetadata(element)); // @TODO display instead of download

    var parent = element.parentNode.parentNode;
    parent.appendChild(container);
    parent.appendChild(credit);
};

// Decorates videos with download buttons
var video_elements = document.querySelectorAll("div[arte_vp_url]");
for (var i = 0; i < video_elements.length; i++) {
    addButtons(video_elements[i]);
}

function createButton(element, quality, language) {

    var button = document.createElement('a');
    button.setAttribute('class', 'btn btn-default');
    button.setAttribute('style', 'text-align: center; display: table-cell;');
    button.innerHTML = "<strong>" + quality + "</strong> Quality <span class='icomoon-angle-down force-icomoon-font'></span>";

    // Get the content of the JSON file.
    var jsonUrl = getJsonUrl(element);
    console.log(jsonUrl);
    GM_xmlhttpRequest({
        method: "GET",
        url: jsonUrl,
        onload: function (response) {
            var video_name = getVideoName(response, quality);
            var video_url = getVideoUrl(response, quality, language);
            button.setAttribute('download', video_name);
            button.setAttribute('href', video_url);
            button.setAttribute('target', '_blank');
        }
    });

    return button;
}


function createButtonMetadata(element) {

    var button = document.createElement('a');
    button.setAttribute('class', 'btn btn-default');
    button.setAttribute('style', 'text-align: center; display: table-cell;');
    button.innerHTML = "<strong>Metadata</strong> <span class='icomoon-angle-down force-icomoon-font'></span>";

    // Get the content of the JSON file.
    var jsonUrl = getJsonUrl(element);
    //console.log(jsonUrl);
    GM_xmlhttpRequest({
        method: "GET",
        url: jsonUrl,
        onload: function (response) {
            var metadata = getMetadata(response);
            // Properly encode to Base 64.
            var encodedData = window.btoa(unescape(encodeURIComponent(metadata)));
            // The href will output a text file. 
            // For a CSV file, that would be: data:application/octet-stream,field1%2Cfield2%0Afoo%2Cbar%0Agoo%2Cgai%0A
            button.setAttribute('href', 'data:application/octet-stream;charset=utf-8;base64,' + encodedData);
            button.setAttribute('target', '_blank');
        }
    });
    return button;
}

/*
 * Run an X-Path query to retrieve the URL of the JSON file which contains the MP4 video URLs.
 */
function getJsonUrl(element) {

    // Get the value of the "arte_vp_url" attribute which contains the player URL.
    var playerUrl = element.getAttribute("arte_vp_url");

    return playerUrl;
}

/*
 * Parse the content of the JSON file and extract the video name.
 */
function getVideoName(response, quality) {
    var json = JSON.parse(response.responseText);
    var name = (json['videoJsonPlayer']['VST']['VNA']).split('_').join(' ');
    return '[' + quality.toUpperCase() + '] ' + name.charAt(0).toUpperCase() + name.slice(1) + '.mp4';;
}

/*
 * Parse the content of the JSON file and extract the metadata informations.
 */
function getMetadata(response) {
    var json = JSON.parse(response.responseText);
    //console.log(json['videoJsonPlayer']);
    var metadata = json['videoJsonPlayer']['V7T'] + '\n\n' + json['videoJsonPlayer']['VDE'] + '\n\n' + json['videoJsonPlayer']['VTA'];
    return metadata;
}

/*
 * Parse the content of the JSON file and extract the MP4 videos URLs in the required language.
 * @TODO : parse once the .json
 */
function getVideoUrl(response, quality, language) {
    if (response) {

        var qualityCode = {
            'Low': 'HQ',
            'Standard': 'EQ',
            'High': 'SQ'
        };

        // Parse the JSON text into a JavaScript object.
        var json = JSON.parse(response.responseText);
        var videos = Object.keys(json["videoJsonPlayer"]["VSR"]);
        var numberOfVideos = videos.length;
        console.log(numberOfVideos + " videos found.");

        // Loop through all videos URLs.
        for (var key in videos) {

            // Get the videos where video format is "HBBTV".
            if (json["videoJsonPlayer"]["VSR"][videos[key]]["videoFormat"] === "HBBTV") {
                console.log(json["videoJsonPlayer"]["VSR"][videos[key]]["versionCode"]);

                // Get the original version (french dubbed)
                if (json["videoJsonPlayer"]["VSR"][videos[key]]["versionCode"] === "VO-STF") {

                    // Get the video URL using the requested quality.
                    if (json["videoJsonPlayer"]["VSR"][videos[key]]["VQU"] === qualityCode[quality]) {
                        var url = json["videoJsonPlayer"]["VSR"][videos[key]]["url"];
                        console.log(qualityCode[quality] + " MP4 URL : " + url);
                        return (url);
                    }
                }
            }
        }
        return 0;
    }
}
