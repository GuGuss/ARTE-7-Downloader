// ==UserScript==
// @name        Arte+7 Downloader
// @namespace   GuGuss
// @description Display direct links to MP4 videos of Arte+7 programs
// @include     http://*.arte.tv/*
// @version     2.1.1
// @updateURL   https://github.com/GuGuss/ARTE-7-Playground/blob/master/arte-downloader.user.js
// @grant       GM_xmlhttpRequest
// @icon        https://icons.duckduckgo.com/ip2/www.arte.tv.ico
// ==/UserScript==

// Set this to 1 to enable console logs.
var debug_mode = 1;
if (!debug_mode) {
    console.log('GM debug mode disabled');
    console.log = function () { };
}
else {
    console.log('GM debug mode enabled');
}

var playerJson = null;
var videoPlayerURL = "arte_vp_url";
var videoPlayerLiveURL = "arte_vp_live-url";
var isLiveStreaming = true;

var qualityCode = {
    'Low': 'HQ',
    'Standard': 'EQ',
    'High': 'SQ'
};

var languages = {
    // 'versionCode'    : 'language'
    'VO-STF': 'Original subtitled in french',
    'VA-STA': 'German subtitled',
    'VF-STF': 'French subtitled',
    'VOF': 'Original in french',
    'VOA': 'Original in german',
    'VOF-STF': 'Original french subtitled',
    'VOF-STA': 'Original french subtitled',
    'VF': 'French',
    'VA': 'German',
    'VOA-STA': 'Original german subtitled',
    'VOA-STF': 'Original german subtitled in french',
    'VOF-STMF': 'Original french for deaf',
    'VOA-STMA': 'Original german for deaf',
    'VFAUD': 'French with audio description',
    'VAAUD': 'German with audio description'
};

var availableLanguages = Object.assign({}, languages); // Clone object
for (l in availableLanguages) {
    availableLanguages[l] = 0;
}

function addLanguage(language) {
    if (availableLanguages[language] === 0) {
        availableLanguages[language] = languages[language];
        console.log("- " + availableLanguages[language]);
    }
}

function preParsePlayerJson() {
    if (playerJson) {
        var videos = Object.keys(playerJson["videoJsonPlayer"]["VSR"]);
        var nbVideos = videos.length;
        var nbHTTP = 0;
        var nbRTMP = 0;
        var nbHLS = 0;

        console.log("\nLanguages found:");

        // Loop through all videos URLs.
        for (var key in videos) {

            // Check if video format is "HBBTV".
            if (playerJson["videoJsonPlayer"]["VSR"][videos[key]]["videoFormat"] === "HBBTV"
                || playerJson["videoJsonPlayer"]["VSR"][videos[key]]["videoFormat"] === "RMP4"
                || playerJson["videoJsonPlayer"]["VSR"][videos[key]]["videoFormat"] === "M3U8") {

                // Add the language
                addLanguage(playerJson["videoJsonPlayer"]["VSR"][videos[key]]["versionCode"]);
                //console.log(playerJson["videoJsonPlayer"]["VSR"][videos[key]]["versionCode"]) // find new lang tags

                // Log stats
                if (playerJson["videoJsonPlayer"]["VSR"][videos[key]]["videoFormat"] === "HBBTV") {
                    nbHTTP++;
                } else if (playerJson["videoJsonPlayer"]["VSR"][videos[key]]["videoFormat"] === "M3U8") {
                    nbHLS++;
                } else {
                    nbRTMP++;
                }
            }
        }

        console.log("\n" + nbVideos + " versions found:\n- " + nbHTTP + " HTTP videos\n- " + nbRTMP + " RTMP streams\n- " + nbHLS + " HLS streams.");
    }
}

function createButton(quality, language) {
    var button = document.createElement('a');
    var videoName = getVideoName(quality);
    var videoUrl = getVideoUrl(qualityCode[quality], language);
    if (videoUrl.substring(0, 6) === "rtmp://") {
        button.innerHTML = "<a href='https://en.wikipedia.org/wiki/Real_Time_Messaging_Protocol'>RTMP stream</a> (copy/paste <a href='https://www.videolan.org/vlc/'>into VLC</a>) <span class='icomoon-angle-down force-icomoon-font'></span>";
    }
    else if (videoUrl.substring(videoUrl.length - 6, videoUrl.length - 1) === ".m3u8") {
        button.innerHTML = "<a href='https://en.wikipedia.org/wiki/HTTP_Live_Streaming'>HLS stream</a> (copy/paste <a href='https://www.videolan.org/vlc/'>into VLC</a>) <span class='icomoon-angle-down force-icomoon-font'></span>";
    }
    else {
        button.innerHTML = "<strong>" + quality + "</strong> Quality MP4 <span class='icomoon-angle-down force-icomoon-font'></span>";
    }
    button.setAttribute('id', 'btnDownload' + qualityCode[quality]); // to refer later in select changes
    button.setAttribute('href', videoUrl);
    button.setAttribute('target', '_blank');
    button.setAttribute('download', videoName);
    button.setAttribute('class', 'btn btn-default');
    button.setAttribute('style', 'text-align: center; display: table-cell;');

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

    // Associate onchange event with function (bypass for GM)
    languageComboBox.onchange = function () {
        var newLanguage = languageComboBox.options[languageComboBox.selectedIndex].value;
        console.log("\nLanguage changed to " + newLanguage);
        for (key in qualityCode) {
            var btn = document.getElementById('btnDownload' + qualityCode[key]);
            var url = getVideoUrl(qualityCode[key], newLanguage);
            btn.setAttribute('href', url);
        }
    };

    languageComboBox.setAttribute("id", "languageComboBox");

    for (l in availableLanguages) {
        if (availableLanguages[l] !== 0) {
            languageComboBox.innerHTML += "<option value='" + l + "'>" + availableLanguages[l] + "</option>";
        }
    }
    languageComboBox.setAttribute('class', 'btn btn-default');
    languageComboBox.setAttribute('style', 'width:97%');

    return languageComboBox;
}

function createButtons(videoElement) {
    // container
    var parent = videoElement.parentNode.parentNode;
    var container = document.createElement('div');
    parent.appendChild(container);
    container.setAttribute('style', 'display: table; width: 100%;');

    // language combobox
    var languageComboBox = createLanguageComboBox()
    container.appendChild(languageComboBox);
    var selectedLanguage = languageComboBox.options[languageComboBox.selectedIndex].value;

    // download buttons
    container.appendChild(createButtonMetadata(videoElement)); // @TODO display instead of download
    container.appendChild(createButton('Low', selectedLanguage));
    container.appendChild(createButton('Standard', selectedLanguage));
    container.appendChild(createButton('High', selectedLanguage));

    // credit
    var credit = document.createElement('div');
    credit.setAttribute('style', 'width: 100%; text-align: center; font-size: 0.8em; padding: 3px; background-image:url("data:image/gif;base64,R0lGODlhAwADAIAAAMhFJuFdPiH5BAAAAAAALAAAAAADAAMAAAIERB5mBQA7")');
    credit.innerHTML = 'Arte+7 Downloader v.' + GM_info.script.version
                    + ' built by and for the community with love'
                    + '<br /><a href="https://github.com/GuGuss/ARTE-7-Downloader">Contribute Here.</a>';
    parent.appendChild(credit);
}

function parsePlayerJson(playerUrl, videoElement) {
    console.log('Json video player URL: ' + playerUrl);
    GM_xmlhttpRequest({
        method: "GET",
        url: playerUrl,
        onload: function (response) {
            playerJson = JSON.parse(response.responseText);
            preParsePlayerJson();
            createButtons(videoElement);
        }
    });
}

// Decorates a video with download buttons
function decorateVideo(videoElement) {

    // Get player URL
    var playerUrl = videoElement.getAttribute(videoPlayerURL);

    // If no URL found, try livestream tag
    if (playerUrl === undefined || playerUrl === null) {
        playerUrl = videoElement.getAttribute(videoPlayerLiveURL);
        console.log("Livestream URL: " + playerUrl);
    }

    // Check if player URL points to a JSON
    if (playerUrl.substring(playerUrl.length - 6, playerUrl.length - 1) === ".json") {
        parsePlayerJson(playerUrl, videoElement);
    } else {

        // Find the player JSON in the URL
        GM_xmlhttpRequest(
            {
                method: "GET",
                url: playerUrl,
                onload: function (response) {

                    // Look for player URL inside the livestream player URL
                    var json = JSON.parse(response.responseText);
                    playerUrl = json["videoJsonPlayer"]["videoPlayerUrl"];

                    // not found ? Look for playlist file inside the livestream player
                    if (playerUrl === undefined) {
                        console.log("Video player URL not available. Fetching livestream player URL");
                        parsePlayerJson(livePlayerUrl, videoElement);
                        console.log(getVideoUrl('High'));
                    } else {
                        parsePlayerJson(playerUrl, videoElement);
                    }

                }
            }
        );
    }
};

/*
 * Parse the content of the JSON file and extract the video name.
 */
function getVideoName(quality) {
    var name;
    if (isLiveStreaming) {
        name = (playerJson['videoJsonPlayer']['VTI']);
    } else {
        name = (playerJson['videoJsonPlayer']['VST']['VNA']);
    }
    name = name.split('_').join(' ');
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
    console.log("\n... Looking for a " + quality + " quality track in " + language)

    // Get videos object
    var videos = Object.keys(playerJson["videoJsonPlayer"]["VSR"]);

    // Loop through all videos URLs.
    for (var key in videos) {

        // Check if video format is "HBBTV" (HTTP).
        if (playerJson["videoJsonPlayer"]["VSR"][videos[key]]["videoFormat"] === "HBBTV") {

            // Check language
            if (playerJson["videoJsonPlayer"]["VSR"][videos[key]]["versionCode"] === language) {

                // Get the video URL using the requested quality.
                if (playerJson["videoJsonPlayer"]["VSR"][videos[key]]["VQU"] === quality) {
                    var url = playerJson["videoJsonPlayer"]["VSR"][videos[key]]["url"];
                    console.log("Found a " + quality + " quality MP4 in " + language + ": " + url);
                    return (url);
                }
            }
        }
    }

    // Check otherwise if video format is a playlist
    if (playerJson["videoJsonPlayer"]["VSR"][videos[key]]["videoFormat"] === "RMP4") {
        // Get playlist URL
        var url = playerJson["videoJsonPlayer"]["VSR"][videos[key]]["streamer"] + playerJson["videoJsonPlayer"]["VSR"][videos[key]]["url"];
        console.log("Found a stream: " + url);
        return (url);
    }

    return 'video-not-found';
}



/*
 * main: script entry
 */
var videoPlayerElement = document.querySelector("div[" + videoPlayerLiveURL + "]");

// If it is not a livestream
if (videoPlayerElement === null) {
    isLiveStreaming = false;
    videoPlayerElement = document.querySelector("div[" + videoPlayerURL + "]");
}

decorateVideo(videoPlayerElement);