// ==UserScript==
// @name        Arte+7 Downloader
// @namespace   GuGuss
// @description Display direct links to MP4 videos of Arte+7 programs
// @include     http://*.arte.tv/*
// @version     1.7.1
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

var playerJson = null;
var videoPlayerURL = "arte_vp_url";
var videoPlayerLiveURL = "arte_vp_live-url";
var bLive = true;

var languageCode = { // aka. versionCode
    'VO-STF': 'Original (subtitled in french)',
    'VA-STA': 'German subtitled',
    'VF-STF': 'French subtitled',
    'VOF': 'French',
    'VOA': 'German',
    'VOF-STMF': 'Sourds et malentendants'
};

function createButton(quality, language) {
    var button = document.createElement('a');
    button.setAttribute('class', 'btn btn-default');
    button.setAttribute('style', 'text-align: center; display: table-cell;');
    button.innerHTML = "<strong>" + quality + "</strong> Quality <span class='icomoon-angle-down force-icomoon-font'></span>";

    var videoName = getVideoName(playerJson, quality);
    var videoUrl = getVideoUrl(playerJson, quality, language);
    button.setAttribute('download', videoName);
    button.setAttribute('href', videoUrl);
    button.setAttribute('target', '_blank');

    return button;
}

function createButtonMetadata(element) {
    var button = document.createElement('a');
    button.setAttribute('class', 'btn btn-default');
    button.setAttribute('style', 'text-align: center; display: table-cell;');
    button.innerHTML = "<strong>Metadata</strong> <span class='icomoon-angle-down force-icomoon-font'></span>";

    var metadata = getMetadata(playerJson);
    // Properly encode to Base 64.
    var encodedData = window.btoa(unescape(encodeURIComponent(metadata)));
    // The href will output a text file. 
    // For a CSV file, that would be: data:application/octet-stream,field1%2Cfield2%0Afoo%2Cbar%0Agoo%2Cgai%0A
    button.setAttribute('href', 'data:application/octet-stream;charset=utf-8;base64,' + encodedData);
    button.setAttribute('target', '_blank');

    return button;
}

function createButtons(container) {
    container.appendChild(createButton('High'));
    container.appendChild(createButton('Standard'));
    container.appendChild(createButton('Low'));
}

// Decorates videos with download buttons
var decorateVideo = function (element) {
    var container = document.createElement('div');
    container.setAttribute('style', 'display: table; width: 100%;');

    // Get the content of the JSON file.
    var playerUrl;

    // if it's a stream, get the video player
    if (bLive === true) {
        GM_xmlhttpRequest(
            {
                method: "GET",
                url: element.getAttribute(videoPlayerLiveURL),
                onload: function (response) {
                    var json = JSON.parse(response.responseText);
                    playerUrl = json["videoJsonPlayer"]["videoPlayerUrl"];
                    console.log("Json live video player URL: " + playerUrl);
                    GM_xmlhttpRequest({
                        method: "GET",
                        url: playerUrl,
                        onload: function (response) {
                            playerJson = JSON.parse(response.responseText); // Parse the JSON text into a JavaScript object
                            createButtons(container);
                        }
                    });
                }
            }
        );
    } else { // the player URL is the Json
        playerUrl = element.getAttribute(videoPlayerURL);
        console.log("Json video player URL: " + playerUrl);
        GM_xmlhttpRequest({
            method: "GET",
            url: playerUrl,
            onload: function (response) {
                playerJson = JSON.parse(response.responseText); // Parse the JSON text into a JavaScript object
                createButtons(container);
            }
        });
    }

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
    credit.innerHTML = 'Arte+7 Downloader v.' + GM_info.script.version
                    + ' built by and for the community with <strong><3</strong><br /><a href="https://github.com/GuGuss/ARTE-7-Downloader">Contribute Here.</a>';

    container.appendChild(languageRadioList);
    //container.appendChild(createButtonMetadata(element)); // @TODO display instead of download

    var parent = element.parentNode.parentNode;
    parent.appendChild(container);
    parent.appendChild(credit);
};

var videoPlayerElement = document.querySelector("div[" + videoPlayerLiveURL + "]");

// If it is not a livestream
if (videoPlayerElement == null) {
    bLive = false;
    videoPlayerElement = document.querySelector("div[" + videoPlayerURL + "]");
}

decorateVideo(videoPlayerElement);

/*
 * Parse the content of the JSON file and extract the video name.
 */
function getVideoName(json, quality) {
    var name = (json['videoJsonPlayer']['VST']['VNA']).split('_').join(' ');
    return '[' + quality.toUpperCase() + '] ' + name.charAt(0).toUpperCase() + name.slice(1) + '.mp4';;
}

/*
 * Parse the content of the JSON file and extract the metadata informations.
 */
function getMetadata(json) {
    var metadata = json['videoJsonPlayer']['V7T'] + '\n\n' + json['videoJsonPlayer']['VDE'] + '\n\n' + json['videoJsonPlayer']['VTA'];
    return metadata;
}

/*
 * Parse the content of the JSON file and extract the MP4 videos URLs in the required language.
 * @TODO : parse once the .json
 */
function getVideoUrl(json, quality, language) {
    if (json) {

        var qualityCode = {
            'Low': 'HQ',
            'Standard': 'EQ',
            'High': 'SQ'
        };

        var videos = Object.keys(json["videoJsonPlayer"]["VSR"]);
        var numberOfVideos = videos.length;
        console.log(numberOfVideos + " versions of the video have been found.");

        // Loop through all videos URLs.
        for (var key in videos) {

            // Check if video format is "HBBTV".
            if (json["videoJsonPlayer"]["VSR"][videos[key]]["videoFormat"] === "HBBTV") {
                //console.log(json["videoJsonPlayer"]["VSR"][videos[key]]["versionCode"]);

                // Get the original version (french dubbed)
                //if (json["videoJsonPlayer"]["VSR"][videos[key]]["versionCode"] === "VOF") {

                // Get the video URL using the requested quality.
                if (json["videoJsonPlayer"]["VSR"][videos[key]]["VQU"] === qualityCode[quality]) {
                    var url = json["videoJsonPlayer"]["VSR"][videos[key]]["url"];
                    console.log(qualityCode[quality] + " MP4 URL : " + url);
                    return (url);
                }
                //}
            }

                // otherwise check if video format is a playlist
            else if (json["videoJsonPlayer"]["VSR"][videos[key]]["videoFormat"] === "M3U8_HQ") {

                // Get playlist URL
                var url = json["videoJsonPlayer"]["VSR"][videos[key]]["url"];
                console.log("playlist URL : " + url);
                return (url);
            }
        }
        return 0;
    }
}
