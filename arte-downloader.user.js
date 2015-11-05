// ==UserScript==
// @name        Arte+7 Downloader
// @namespace   GuGuss
// @description Display direct links to MP4 videos of Arte+7 programs
// @include     http://*.arte.tv/*
// @version     2.0.0
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

var qualityCode = {
    'Low': 'HQ',
    'Standard': 'EQ',
    'High': 'SQ'
};

var languages = {
    // 'versionCode' : 'language'
    'VO-STF': 'Original (subtitled in french)',
    'VA-STA': 'German subtitled',
    'VF-STF': 'French subtitled',
    'VOF': 'French',
    'VOA': 'German',
    'VOF-STMF': 'Sourds et malentendants'
};

var availableLanguages = Object.assign({}, languages); // Clone object
for (l in availableLanguages) {
    availableLanguages[l] = 0;
}

function addLanguage(language) {
    if (availableLanguages[language] === 0) {
        availableLanguages[language] = languages[language];
        console.log("- language found: " + availableLanguages[language]);
    }
}

function preParsePlayerJson() {
    if (playerJson) {
        var videos = Object.keys(playerJson["videoJsonPlayer"]["VSR"]);
        var numberOfVideos = videos.length;
        console.log(numberOfVideos + " versions of the video have been found.");

        // Loop through all videos URLs.
        for (var key in videos) {

            // Check if video format is "HBBTV".
            if (playerJson["videoJsonPlayer"]["VSR"][videos[key]]["videoFormat"] === "HBBTV") {

                // Add the language
                addLanguage(playerJson["videoJsonPlayer"]["VSR"][videos[key]]["versionCode"]);
            }
        }
    }
}

function createButton(quality, language, text) {
    var button = document.createElement('a');
    button.setAttribute('class', 'btn btn-default');
    button.setAttribute('style', 'text-align: center; display: table-cell;');
    button.innerHTML = "<strong>" + quality + " (" + language + ") </strong> Quality <span class='icomoon-angle-down force-icomoon-font'></span>";
    if (text !== undefined) {
        button.innerHTML = text;
    }

    var videoName = getVideoName(quality);
    var videoUrl = getVideoUrl(quality, language);
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

function createLanguageComboBox() {
    var languageComboBox = document.createElement('select');
    languageComboBox.setAttribute("id", "languageComboBox");
    for (l in availableLanguages) {
        if (availableLanguages[l] !== 0) {
            languageComboBox.innerHTML += "<option value='" + l + "' selected>" + availableLanguages[l] + "</option>";
        }
    }
    languageComboBox.setAttribute('class', 'btn btn-default');
    languageComboBox.setAttribute('style', 'width:97%');

    return languageComboBox;
}

function createButtons(videoElement) {
    preParsePlayerJson();

    var parent = videoElement.parentNode.parentNode;
    var container = document.createElement('div');
    container.setAttribute('style', 'display: table; width: 100%;');
    parent.appendChild(container);

    container.appendChild(createLanguageComboBox());
    var languageComboBox = document.getElementById("languageComboBox");
    var selectedLanguage = languageComboBox.options[languageComboBox.selectedIndex].value;

    if (bLive) {
        container.appendChild(createButton('High', selectedLanguage, "RPM4 playlist (copy/paste into VLC) <span class='icomoon-angle-down force-icomoon-font'></span>"));
    } else {
        container.appendChild(createButton('Low', selectedLanguage));
        container.appendChild(createButton('Standard', selectedLanguage));
        container.appendChild(createButton('High', selectedLanguage));
        //container.appendChild(createButtonMetadata(videoElement)); // @TODO display instead of download
    }

    var credit = document.createElement('div');
    credit.setAttribute('style', 'width: 100%; text-align: center; font-size: 0.8em; padding: 3px; background-image:url("data:image/gif;base64,R0lGODlhAwADAIAAAMhFJuFdPiH5BAAAAAAALAAAAAADAAMAAAIERB5mBQA7")');
    credit.innerHTML = 'Arte+7 Downloader v.' + GM_info.script.version
                    + ' built by and for the community with love'
                    + '<br /><a href="https://github.com/GuGuss/ARTE-7-Downloader">Contribute Here.</a>';
    parent.appendChild(credit);
}

function getPlayerJson(playerUrl, videoElement) {
    console.log('Json video player URL: ' + playerUrl);
    GM_xmlhttpRequest({
        method: "GET",
        url: playerUrl,
        onload: function (response) {
            playerJson = JSON.parse(response.responseText);
            createButtons(videoElement);
        }
    });
}

// Decorates a video with download buttons
function decorateVideo(videoElement) {

    // if it's a stream, get the video player URL through the stream Json
    if (bLive === true) {
        console.log("Livestream URL: " + videoElement.getAttribute(videoPlayerLiveURL));
        var livePlayerUrl = videoElement.getAttribute(videoPlayerLiveURL);
        GM_xmlhttpRequest(
            {
                method: "GET",
                url: videoElement.getAttribute(videoPlayerLiveURL),
                onload: function (response) {
                    // Look for player URL inside the livestream player URL
                    var json = JSON.parse(response.responseText);
                    var playerUrl = json["videoJsonPlayer"]["videoPlayerUrl"];

                    // if not player URL: look for playlist file inside the livestream player
                    if (playerUrl === undefined) {
                        console.log("Video player URL not available. Fetching livestream player URL");
                        getPlayerJson(livePlayerUrl, videoElement);
                        console.log(getVideoUrl('High'));
                    } else {
                        getPlayerJson(playerUrl, videoElement);
                    }

                }
            }
        );
    } else { // otherwise get directly
        var playerUrl = videoElement.getAttribute(videoPlayerURL);
        getPlayerJson(playerUrl, videoElement);
    }
};

/*
 * Parse the content of the JSON file and extract the video name.
 */
function getVideoName(quality) {
    var name;
    if (bLive) {
        name = (playerJson['videoJsonPlayer']['VTI']);
    } else {
        name = (playerJson['videoJsonPlayer']['VST']['VNA']).split('_').join(' ');
    }
    return '[' + quality.toUpperCase() + '] ' + name.charAt(0).toUpperCase() + name.slice(1) + '.mp4';
}

/*
 * Parse the content of the JSON file and extract the metadata informations.
 */
function getMetadata() {
    return playerJson['videoJsonPlayer']['V7T'] + '\n\n' + playerJson['videoJsonPlayer']['VDE'] + '\n\n' + playerJson['videoJsonPlayer']['VTA'];
}

/*
 * Parse the content of the JSON file and extract the MP4 videos URLs in the required language.
 * @TODO : parse once the .json
 */
function getVideoUrl(quality, language) {

    // Get videos object
    var videos = Object.keys(playerJson["videoJsonPlayer"]["VSR"]);

    // Loop through all videos URLs.
    for (var key in videos) {

        // Check if video format is "HBBTV".
        if (playerJson["videoJsonPlayer"]["VSR"][videos[key]]["videoFormat"] === "HBBTV") {

            // Check language
            if (playerJson["videoJsonPlayer"]["VSR"][videos[key]]["versionCode"] === language) {

                // Get the video URL using the requested quality.
                if (playerJson["videoJsonPlayer"]["VSR"][videos[key]]["VQU"] === qualityCode[quality]) {
                    var url = playerJson["videoJsonPlayer"]["VSR"][videos[key]]["url"];
                    console.log(qualityCode[quality] + " MP4 URL : " + url);
                    return (url);
                }
            }
        }

        // Check otherwise if video format is a playlist
        /*else if (playerJson["videoJsonPlayer"]["VSR"][videos[key]]["videoFormat"] === "RMP4") {
            // Get playlist URL
            var url = playerJson["videoJsonPlayer"]["VSR"][videos[key]]["streamer"] + playerJson["videoJsonPlayer"]["VSR"][videos[key]]["url"];
            console.log("playlist URL : " + url);
            return (url);
        }*/
    }
    return 'video-not-found';
}



/*
 * main: script entry
 */
var videoPlayerElement = document.querySelector("div[" + videoPlayerLiveURL + "]");

// If it is not a livestream
if (videoPlayerElement === null) {
    bLive = false;
    videoPlayerElement = document.querySelector("div[" + videoPlayerURL + "]");
}

decorateVideo(videoPlayerElement);