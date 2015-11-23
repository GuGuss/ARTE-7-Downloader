// ==UserScript==
// @name        Arte+7 Downloader
// @namespace   GuGuss
// @description Download videos or get stream link of ARTE programs in the selected language.
// @include     http://*.arte.tv/*
// @version     2.2.1
// @updateURL   https://github.com/GuGuss/ARTE-7-Playground/blob/master/arte-downloader.user.js
// @grant       GM_xmlhttpRequest
// @icon        https://icons.duckduckgo.com/ip2/www.arte.tv.ico
// ==/UserScript==

/*
    @TODO
    - change language with multiple videos: http://future.arte.tv/fr/les-iles-du-futur-la-serie-documentaire
    - Arte future overlay: http://future.arte.tv/fr/polar-sea-360deg-les-episodes
    - Arte cinema overlay: http://cinema.arte.tv/fr/program/jude
    - Arte creative double decoration: http://creative.arte.tv/fr/episode/bonjour-afghanistan
    - Arte info triple decoration: http://info.arte.tv/fr/videos?id=71611
    - Arte info journal overlay: http://info.arte.tv/fr/emissions/arte-journal
*/

// Set this to 1 to enable console logs.
var debug_mode = 1;
if (!debug_mode) {
    console.log('GM debug mode disabled');
    console.log = function () { };
}
else {
    console.log('GM debug mode enabled');
}

var videoPlayer = {
    '+7': 'arte_vp_url',
    'live': 'arte_vp_live-url',
    'generic': 'data-url',
    'teaser': 'data-teaser-url'
};
var playerJson = null;
var nbVideos = 0;
var nbHTTP = 0;
var nbRTMP = 0;
var nbHLS = 0;

var qualityCode = {
    'Low': 'HQ',
    'Standard': 'EQ',
    'High': 'SQ'
};

var languages = {
    // 'versionCode'    : 'language'
    'VO': 'Original',
    'VO-STF': 'Original subtitled in french',
    'VA-STA': 'German dubbed subtitled',
    'VF-STF': 'French dubbed subtitled',
    'VOF': 'Original in french',
    'VOA': 'Original in german',
    'VOF-STF': 'Original in french subtitled',
    'VOF-STA': 'Original in french subtitled in german',
    'VF': 'French dubbed',
    'VA': 'German dubbed',
    'VOA-STA': 'Original in german subtitled',
    'VOA-STF': 'Original in german subtitled in french',
    'VOF-STMF': 'Original in french for hearing impaired',
    'VOA-STMA': 'Original in german for hearing impaired',
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
    }
}

function preParsePlayerJson() {
    if (playerJson) {
        var videos = Object.keys(playerJson["videoJsonPlayer"]["VSR"]);
        var video = null;
        nbVideos = videos.length;

        // Loop through all videos URLs.
        for (var key in videos) {
            video = playerJson["videoJsonPlayer"]["VSR"][videos[key]];

            // Check if video format or media type
            if (video["videoFormat"] === "HBBTV" || video["mediaType"] === "mp4") {
                nbHTTP++;
            }
            else if (video["videoFormat"] === "RMP4") {
                nbRTMP++;
            }
            else if (video["videoFormat"] === "M3U8" || video["mediaType"] === "hls") {
                nbHLS++;
            }

            // Add the language
            addLanguage(video["versionCode"]);
            //console.log(video["versionCode"]) // find new lang tags
        }

        console.log("\n" + nbVideos + " versions found:\n- " + nbHTTP + " HTTP videos\n- " + nbRTMP + " RTMP streams\n- " + nbHLS + " HLS streams.");
        console.log("Languages found:");
        for (l in availableLanguages) {
            if (availableLanguages[l] !== 0) {
                console.log("- " + availableLanguages[l]);
            }
        }
    }
}

function createButton(quality, language) {
    var button = document.createElement('a');
    var videoUrl = getVideoUrl(qualityCode[quality], language);

    // Check if video exists
    if (videoUrl === null) {
        // Don't create button
        return null;
    }

    // Check RTMP stream
    if (nbRTMP > 0 && videoUrl.substring(0, 7) === "rtmp://") { // because ends with .mp4 like HTTP
        button.innerHTML = quality + " Quality <a href='https://en.wikipedia.org/wiki/Real_Time_Messaging_Protocol'>RTMP stream</a> (copy/paste this link into<a href='https://www.videolan.org/vlc/'> VLC</a>) <span class='icomoon-angle-down force-icomoon-font'></span>";
    }

        // Check HTTP
    else if (nbHTTP > 0 && videoUrl.substring(videoUrl.length - 4, videoUrl.length) === ".mp4") {
        button.innerHTML = "<strong>" + quality + "</strong> Quality MP4 <span class='icomoon-angle-down force-icomoon-font'></span>";
    }

        // Check HLS stream : should not happen
    else if (nbHLS > 0 && videoUrl.substring(videoUrl.length - 5, videoUrl.length === ".m3u8")) {
        button.innerHTML = quality + "<a href='https://en.wikipedia.org/wiki/HTTP_Live_Streaming'> HLS master stream</a> (copy/paste into Apple Quicktime or <a href='https://www.videolan.org/vlc/'>into VLC</a>) <span class='icomoon-angle-down force-icomoon-font'></span>";
    }

        // Unknown URL format : should not happen
    else {
        console.log('Unknown URL format');
        return null;
    }

    button.setAttribute('id', 'btnDownload' + qualityCode[quality]); // to refer later in select changes
    button.setAttribute('href', videoUrl);
    button.setAttribute('target', '_blank');
    button.setAttribute('download', getVideoName(quality));
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
    button.setAttribute('download', 'metadata.txt');

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
    var selectedLanguage;

    // Check if there are languages available to select
    if (languageComboBox.options.length > 0) {
        selectedLanguage = languageComboBox.options[languageComboBox.selectedIndex].value;
    }

    // download buttons
    container.appendChild(createButtonMetadata(videoElement)); // @TODO display instead of download

    var tempButton = createButton('Low', selectedLanguage)
    if (tempButton !== null) {
        container.appendChild(tempButton);
    }
    tempButton = createButton('Standard', selectedLanguage);
    if (tempButton !== null) {
        container.appendChild(tempButton);
    }
    tempButton = createButton('High', selectedLanguage);
    if (tempButton !== null) {
        container.appendChild(tempButton);
    }

    // credit
    var credit = document.createElement('div');
    credit.setAttribute('style', 'width: 100%; text-align: center; font-size: 0.8em; padding: 3px; background-image:url("data:image/gif;base64,R0lGODlhAwADAIAAAMhFJuFdPiH5BAAAAAAALAAAAAADAAMAAAIERB5mBQA7")');
    credit.innerHTML = 'Arte Downloader v.' + GM_info.script.version
                    + ' built by and for the community with love'
                    + '<br /><a href="https://github.com/GuGuss/ARTE-7-Downloader">Contribute Here.</a>';
    parent.appendChild(credit);
}

function parsePlayerJson(playerUrl, videoElement) {
    console.log('Video player json: ' + playerUrl);
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
    var playerUrl = videoElement.getAttribute(videoPlayer['+7']);
    // If no URL found, try livestream tag
    if (playerUrl === null) {
        playerUrl = videoElement.getAttribute(videoPlayer['live']);

        // Generic tag
        if (playerUrl === null) {
            playerUrl = videoElement.getAttribute(videoPlayer['generic']);
            if (playerUrl === null) {
                playerUrl = videoElement.getAttribute(videoPlayer['teaser']);
                parsePlayerJson(playerUrl, videoElement);
            }
            parsePlayerJson(playerUrl, videoElement);
        }
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
                        playerUrl = videoElement.getAttribute(videoPlayer['live']);
                        parsePlayerJson(playerUrl, videoElement);
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
    name = (playerJson['videoJsonPlayer']['VTI']);
    if (name === null) {
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
    console.log("... Looking for a " + quality + " quality track in " + language)

    // Get videos object
    var videos = Object.keys(playerJson["videoJsonPlayer"]["VSR"]);

    // Check if there are HTTP videos
    if (nbHTTP > 0) {

        // Loop through all videos URLs.
        for (var key in videos) {
            var video = playerJson["videoJsonPlayer"]["VSR"][videos[key]];

            // Check if video format is "HBBTV" (HTTP).
            if (video["videoFormat"] === "HBBTV" || video["mediaType"] === "mp4") {

                // Check language
                if (video["versionCode"] === language) {

                    // Get the video URL using the requested quality.
                    if (video["VQU"] === quality || video["quality"] === quality) {
                        var url = video["url"];
                        console.log("Found a " + quality + " quality MP4 in " + language + ": " + url);
                        return (url);
                    }
                }
            }
        }
    }

    // Search RTMP streams
    if (nbRTMP > 0) {
        for (var key in videos) {
            var video = playerJson["videoJsonPlayer"]["VSR"][videos[key]];
            if (video["videoFormat"] === "RMP4" && (video["VQU"] === quality || video["quality"] === quality)) {
                var url = video["streamer"] + video["url"];
                console.log("Found a RTMP stream: " + url);
                return (url);
            }
        }
    }

    // Search HLS streams (should not at that point, but we never know)
    if (nbHLS > 0) {
        for (var key in videos) {
            var video = playerJson["videoJsonPlayer"]["VSR"][videos[key]];
            if ((video["videoFormat"] === "M3U8" || video["mediaType"] === "hls") && (video["VQU"] === quality || video["quality"] === quality)) {
                var url = video["url"];
                console.log("Found a HLS stream: " + url);
                return (url);
            }
        }
    }

    // No video feed
    console.log("...not found.")
    return null;
}

/*
 * main: script entry
 */
var videoPlayerElements = document.querySelectorAll("div[" + videoPlayer['live'] + "]");

// Check if not a livestream
if (videoPlayerElements.length === 0) {
    videoPlayerElements = document.querySelectorAll("div[" + videoPlayer['+7'] + "]");

    // Check Creative 
    if (videoPlayerElements.length === 0) {
        videoPlayerElements = document.querySelectorAll("div[" + videoPlayer['generic'] + "]");

        // Check info
        if (videoPlayerElements.length === 0) {
            videoPlayerElements = document.querySelectorAll("div[" + videoPlayer['teaser'] + "]");

        }
    }
}

console.log("Found " + videoPlayerElements.length + " video players");

// Inject buttons in the video's face
for (var i = 0; i < videoPlayerElements.length; i++) {
    decorateVideo(videoPlayerElements[i]);
}