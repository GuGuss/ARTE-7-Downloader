// ==UserScript==
// @name        Arte+7 Downloader
// @namespace   GuGuss
// @description Download videos or get stream link of ARTE programs in the selected language.
// @include     http://*.arte.tv/*
// @version     2.3.4
// @updateURL   https://github.com/GuGuss/ARTE-7-Playground/blob/master/arte-downloader.user.js
// @grant       GM_xmlhttpRequest
// @icon        https://icons.duckduckgo.com/ip2/www.arte.tv.ico
// ==/UserScript==

/*
    Works for: 
    - Arte live: http://www.arte.tv/guide/fr/direct
    - Arte +7: http://www.arte.tv/guide/fr/057458-000/albert-einstein-portrait-d-un-rebelle
    - Arte info: http://info.arte.tv/fr/videos?id=71611
    - Arte info royale slider: http://info.arte.tv/fr/letat-durgence-un-patriot-act-la-francaise
    - Arte future: http://future.arte.tv/fr/ilesdufutur/les-iles-du-futur-la-serie-documentaire
    - Arte future embedded : http://future.arte.tv/fr/polar-sea-360deg-les-episodes
    - Arte creative: http://creative.arte.tv/fr/episode/bonjour-afghanistan
    - Arte concert: http://concert.arte.tv/fr/documentaire-dans-le-ventre-de-lorgue-de-notre-dame
    - Arte cinema: http://cinema.arte.tv/fr/program/jude
    - Arte cinema embedded: http://cinema.arte.tv/fr/article/tirez-la-langue-mademoiselle-daxelle-ropert-re-voir-pendant-7-jours

    @TODO
    - Arte Tracks: http://tracks.arte.tv/fr/mickey-mouse-tmr-en-remix-3d
    - Arte Concert tape stop loading : http://concert.arte.tv/fr/tape-etienne-daho
    - 360: http://future.arte.tv/fr/5-metres (powered by http://deep-inc.com/)
        > player.html
        > scenes/scene1.xml
        > videourl="../video/video.mp4"
    - Arte info journal tiles: http://info.arte.tv/fr/emissions/arte-journal
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

// TODO: struct array instead of this garbage
// eg.: player[i].nbHTTP
var playerJson;
var nbVideos;
var nbHTTP;
var nbRTMP;
var nbHLS;
var availableLanguages;
var players = []; // players.push({});

var videoPlayer = {
    '+7': 'arte_vp_url',
    'live': 'arte_vp_live-url',
    'generic': 'data-url',
    'teaser': 'data-teaser-url',
    'container': 'media_embed'
};

var qualityCode = {
    '720p (2200 kbps)': 'SQ',
    '406p (1500 kbps)': 'EQ',
    '406p (800 kbps)': 'HQ',
    '216p (300 kbps)': 'MQ'
};

// Reference languages object
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
    'VF-STMF': 'French dubbed for hearing impaired',
    'VA-STMA': 'German dubbed for hearing impaired',
    'VFAUD': 'French with audio description',
    'VAAUD': 'German with audio description'
};

function addLanguage(videoElementIndex, language) {
    if (availableLanguages[videoElementIndex][language] === 0) {
        availableLanguages[videoElementIndex][language] = languages[language];
    }
}

function preParsePlayerJson(videoElementIndex) {
    if (playerJson[videoElementIndex]) {
        var videos = Object.keys(playerJson[videoElementIndex]["videoJsonPlayer"]["VSR"]);
        var video = null;
        nbVideos[videoElementIndex] = videos.length;

        // Loop through all videos URLs.
        for (var key in videos) {
            video = playerJson[videoElementIndex]["videoJsonPlayer"]["VSR"][videos[key]];

            // Check if video format or media type
            if (video["videoFormat"] === "HBBTV" || video["mediaType"] === "mp4") {
                nbHTTP[videoElementIndex]++;
                //console.log(nbHTTP[videoElementIndex]);
            }
            else if (video["videoFormat"] === "RMP4") {
                nbRTMP[videoElementIndex]++;
            }
            else if (video["videoFormat"] === "M3U8" || video["mediaType"] === "hls") {
                nbHLS[videoElementIndex]++;
            }

            // Add the language
            addLanguage(videoElementIndex, video["versionCode"]);
            //console.log(video["versionCode"]) // find new lang tags
        }

        console.log("\n====================================\n              player #" + videoElementIndex + "\n====================================\n> "
            + nbVideos[videoElementIndex] + " formats:\n- "
            + nbHTTP[videoElementIndex] + " HTTP videos,\n- "
            + nbRTMP[videoElementIndex] + " RTMP streams,\n- "
            + nbHLS[videoElementIndex] + " HLS streams.");
        console.log("> Languages:");
        for (l in availableLanguages[videoElementIndex]) {
            if (availableLanguages[videoElementIndex][l] !== 0) {
                console.log("- " + availableLanguages[videoElementIndex][l]);
            }
        }
    }
}

function createButtonDownload(videoElementIndex, language, quality) {
    var button = document.createElement('a');
    var videoUrl;
    for (q in qualityCode) {
        videoUrl = getVideoUrl(videoElementIndex, qualityCode[q], language);
        if (videoUrl !== null) {
            quality = q;
            break;
        }
    }

    // Failed to find any video feed
    if (videoUrl === null) {
        console.log("Could not find video feed");
        return null;
    }

    // Check if video exists
    if (videoUrl === null) {
        // Don't create button
        return null;
    }

    // Check RTMP stream
    if (nbRTMP[videoElementIndex] > 0 && videoUrl.substring(0, 7) === "rtmp://") { // because ends with .mp4 like HTTP
        button.innerHTML = "Open <a style='text-decoration: underline;' href='https://www.videolan.org/vlc/'>VLC</a> > CTRL+R > Network > Copy this link > <strong>Convert/Save video.</strong> <span class='icomoon-angle-down force-icomoon-font'></span>";
    }

        // Check HTTP
    else if (nbHTTP[videoElementIndex] > 0 && videoUrl.substring(videoUrl.length - 4, videoUrl.length) === ".mp4") {
        button.innerHTML = "<strong>Download video </strong><span class='icomoon-angle-down force-icomoon-font'></span>";
    }

        // Check HLS stream : should not happen
    else if (nbHLS[videoElementIndex] > 0 && videoUrl.substring(videoUrl.length - 5, videoUrl.length === ".m3u8")) {
        button.innerHTML = quality + "<a href='https://en.wikipedia.org/wiki/HTTP_Live_Streaming'> HLS master stream</a> (copy/paste into Apple Quicktime or <a href='https://www.videolan.org/vlc/'>into VLC</a>) <span class='icomoon-angle-down force-icomoon-font'></span>";
    }

        // Unknown URL format : should not happen
    else {
        console.log('Unknown URL format');
        return null;
    }

    button.setAttribute('id', 'btnDownload' + videoElementIndex); // to refer later in select changes
    button.setAttribute('href', videoUrl);
    button.setAttribute('target', '_blank');
    button.setAttribute('download', getVideoName(videoElementIndex, quality));

    // Keeping uniform style
    button.setAttribute('class', 'btn btn-default');
    button.setAttribute('style', 'margin-left:10px; text-align: center; color:rgb(40, 40, 40); background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px; font-weight: 400;');
    return button;
}

function createButtonMetadata(videoElementIndex, element) {
    var button = document.createElement('a');

    // Keeping uniform style
    button.setAttribute('class', 'btn btn-default');
    button.setAttribute('style', 'margin-left:10px; text-align: center; color:rgb(40, 40, 40);  background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px; font-weight: 400;');
    button.innerHTML = "Download description <span class='icomoon-angle-down force-icomoon-font'></span>";

    var metadata = playerJson[videoElementIndex]['videoJsonPlayer']['V7T'] + '\n\n' + playerJson[videoElementIndex]['videoJsonPlayer']['VDE'] + '\n\n' + playerJson[videoElementIndex]['videoJsonPlayer']['VTA'];

    // Properly encode to Base 64.
    var encodedData = window.btoa(unescape(encodeURIComponent(metadata)));

    // The href will output a text file. 
    // For a CSV file, that would be: data:application/octet-stream,field1%2Cfield2%0Afoo%2Cbar%0Agoo%2Cgai%0A
    button.setAttribute('href', 'data:application/octet-stream;charset=utf-8;base64,' + encodedData);
    button.setAttribute('target', '_blank');
    button.setAttribute('download', 'metadata.txt');

    return button;
}

function getComboboxSelectedValue(combobox) {
    var cb = document.getElementById(combobox);
    return cb[cb.selectedIndex].value;
}

function createLanguageComboBox(videoElementIndex) {
    var languageComboBox = document.createElement('select');
    languageComboBox.setAttribute('id', 'cbLanguage' + videoElementIndex);

    // Associate onchange event with function (bypass for GM)
    languageComboBox.onchange = function () {
        var selectedLanguage = languageComboBox.options[languageComboBox.selectedIndex].value;
        console.log("\n> Language changed to " + selectedLanguage);
        var btn = document.getElementById('btnDownload' + videoElementIndex);
        var selectedQuality = getComboboxSelectedValue('cbQuality' + videoElementIndex);
        var url = getVideoUrl(videoElementIndex, qualityCode[selectedQuality], selectedLanguage);
        btn.setAttribute('href', url);
    };

    // Fill options
    for (l in availableLanguages[videoElementIndex]) {
        if (availableLanguages[videoElementIndex][l] !== 0) {
            languageComboBox.innerHTML += "<option value='" + l + "'>" + availableLanguages[videoElementIndex][l] + "</option>";
        }
    }

    // Keeping uniform style
    languageComboBox.setAttribute('class', 'btn btn-default');
    languageComboBox.setAttribute('style', 'color:rgb(40, 40, 40); background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px; font-weight: 400;');

    return languageComboBox;
}

function createQualityComboBox(videoElementIndex) {
    var qualityComboBox = document.createElement('select');
    qualityComboBox.setAttribute('id', 'cbQuality' + videoElementIndex);

    // Associate onchange event with function (bypass for GM)
    qualityComboBox.onchange = function () {
        var selectedQuality = qualityComboBox.options[qualityComboBox.selectedIndex].value;
        console.log("\n> Quality changed to " + selectedQuality);
        var btn = document.getElementById('btnDownload' + videoElementIndex);
        var selectedLanguage = getComboboxSelectedValue('cbLanguage' + videoElementIndex);
        var url = getVideoUrl(videoElementIndex, qualityCode[selectedQuality], selectedLanguage);
        btn.setAttribute('href', url);
    };

    // Fill options
    for (q in qualityCode) {
        qualityComboBox.innerHTML += "<option value='" + q + "'>" + q + "</option>";
    }

    // Keeping uniform style
    qualityComboBox.setAttribute('class', 'btn btn-default');
    qualityComboBox.setAttribute('style', 'margin-left:10px; color:rgb(40, 40, 40); background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px; font-weight: 400;');

    return qualityComboBox;
}

function stringStartsWith(string, prefix) {
    return string.slice(0, prefix.length) == prefix;
}

function createButtons(videoElement, videoElementIndex) {
    console.log("> Adding buttons");

    var parent;

    // Look for the parent to attach to
    if (videoElement.nodeName === "IFRAME") { // iframe
        console.log("iframe");
        parent = videoElement.parentNode;
    }
    else if (videoElement.getAttribute('class') === 'rsContent') { // slider
        console.log("royal slider");
        parent = videoElement.parentNode.parentNode.parentNode.parentNode.parentNode.parentNode.parentNode;
    }
    else {
        // regular player
        parent = videoElement.parentNode.parentNode;

        // overlayed player
        if (stringStartsWith(location.href, "http://cinema.arte")   // Arte Cinema
            || (parent.getAttribute('id') === "embed_widget"))        // Arte media embedded
        {
            // Get parent to avoid being overlayed
            parent = parent.parentNode;
        }
    }

    // container
    // Append a <div> to the player
    var container = document.createElement('div');
    parent.appendChild(container);
    container.setAttribute('id', 'ArteDownloader-v' + GM_info.script.version)
    container.setAttribute('style', 'display: table; width: 100%; background-color: rgb(230, 230, 230);');

    // Create language combobox
    var languageComboBox = createLanguageComboBox(videoElementIndex)
    container.appendChild(languageComboBox);
    var selectedLanguage;

    // Check if there are languages available to select
    if (languageComboBox.options.length > 0) {
        selectedLanguage = languageComboBox.options[languageComboBox.selectedIndex].value;
    }

    // Create quality combobox
    var qualityComboBox = createQualityComboBox(videoElementIndex)
    container.appendChild(qualityComboBox);
    var selectedQuality;

    // Check if there are quality available to select
    if (qualityComboBox.options.length > 0) {
        selectedQuality = qualityComboBox.options[qualityComboBox.selectedIndex].value;
    }

    // Create download button
    var btnDownload = createButtonDownload(videoElementIndex, selectedLanguage, selectedQuality)
    if (btnDownload !== null) {
        container.appendChild(btnDownload);
    }

    // Create metadata button
    container.appendChild(createButtonMetadata(videoElementIndex, videoElement)); // @TODO display instead of download

    // credit
    var credit = document.createElement('div');
    credit.setAttribute('style', 'width: 100%; text-align: center; line-height: 20px; font-size: 11.2px; color: rgb(255, 255, 255); font-family: ProximaNova, Arial, Helvetica, sans-serif; padding: 3px; background-image:url("data:image/gif;base64,R0lGODlhAwADAIAAAMhFJuFdPiH5BAAAAAAALAAAAAADAAMAAAIERB5mBQA7")');
    credit.innerHTML = 'Arte Downloader v.' + GM_info.script.version
                    + ' built by and for the community with love'
                    + '<br /><a style=\'color: #020202;\' href="https://github.com/GuGuss/ARTE-7-Downloader">Contribute Here.</a>';
    parent.appendChild(credit);
}

function parsePlayerJson(playerUrl, videoElement, videoElementIndex) {
    console.log('- #' + videoElementIndex + ' player JSON: ' + playerUrl);
    GM_xmlhttpRequest({
        method: "GET",
        url: playerUrl,
        onload: function (response) {
            playerJson[videoElementIndex] = JSON.parse(response.responseText);
            preParsePlayerJson(videoElementIndex);
            createButtons(videoElement, videoElementIndex);
        }
    });
}


function getVideoName(videoElementIndex, quality) {
    var name;
    name = (playerJson[videoElementIndex]['videoJsonPlayer']['VTI']);
    if (name === null) {
        name = (playerJson[videoElementIndex]['videoJsonPlayer']['VST']['VNA']);
    }
    name = name.split('_').join(' ');
    return '[' + quality.toUpperCase() + '] ' + name.charAt(0).toUpperCase() + name.slice(1) + '.mp4';
}

function getVideoUrl(videoElementIndex, quality, language) {
    console.log("> #" + videoElementIndex + " player looking for a " + quality + " quality track in " + language)

    // Get videos object
    var videos = Object.keys(playerJson[videoElementIndex]["videoJsonPlayer"]["VSR"]);

    // Check if there are HTTP videos
    if (nbHTTP[videoElementIndex] > 0) {

        // Loop through all videos URLs.
        for (var key in videos) {
            var video = playerJson[videoElementIndex]["videoJsonPlayer"]["VSR"][videos[key]];

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
    if (nbRTMP[videoElementIndex] > 0) {
        for (var key in videos) {
            var video = playerJson[videoElementIndex]["videoJsonPlayer"]["VSR"][videos[key]];
            if (video["videoFormat"] === "RMP4" && (video["VQU"] === quality || video["quality"] === quality)) {
                var url = video["streamer"] + video["url"];
                console.log("Found a " + quality + "RTMP stream: " + url);
                return (url);
            }
        }
    }

    // Search HLS streams (should not at that point, but we never know)
    if (nbHLS[videoElementIndex] > 0) {
        for (var key in videos) {
            var video = playerJson[videoElementIndex]["videoJsonPlayer"]["VSR"][videos[key]];
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

// Decorates a video with download buttons by parsing the player JSON
function decorateVideo(videoElement, videoElementIndex) {

    // Get player URL
    var playerUrl = videoElement.getAttribute(videoPlayer['+7']);

    // If no URL found, try livestream tag
    if (playerUrl === null) {
        playerUrl = videoElement.getAttribute(videoPlayer['live']);

        // Generic tag
        if (playerUrl === null) {
            playerUrl = videoElement.getAttribute(videoPlayer['generic']);

            // Teaser tag
            if (playerUrl === null) {
                playerUrl = videoElement.getAttribute(videoPlayer['teaser']);
            }
        }
    }

    // iframe embedded media
    if (playerUrl === null) {
        playerUrl = unescape(videoElement.getAttribute('src'));
        playerUrl = playerUrl.split('json_url=')[1];
        parsePlayerJson(playerUrl, videoElement, videoElementIndex);
    }

        // Check if player URL points to a JSON
    else if (playerUrl.substring(playerUrl.length - 6, playerUrl.length - 1) === ".json") {
        parsePlayerJson(playerUrl, videoElement, videoElementIndex);
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
                    }
                    parsePlayerJson(playerUrl, videoElement, videoElementIndex);
                    s
                }
            }
        );
    }
};



/*
 * main: script entry
 */
main();

function main() {
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

                // Check media_embed on Cinema: http://cinema.arte.tv/fr/article/tirez-la-langue-mademoiselle-daxelle-ropert-re-voir-pendant-7-jours
                if (videoPlayerElements.length === 0) {
                    videoPlayerElements = document.querySelectorAll("div." + videoPlayer['container'] + " iframe");
                }
            }
        }
    }

    var nbVideoPlayers = videoPlayerElements.length
    console.log("Found " + nbVideoPlayers + " video players");

    // Initialize players info arrays
    playerJson = new Array(nbVideoPlayers);
    nbVideos = new Array(nbVideoPlayers);
    nbHTTP = new Array(nbVideoPlayers);
    nbRTMP = new Array(nbVideoPlayers);
    nbHLS = new Array(nbVideoPlayers);
    availableLanguages = new Array(nbVideoPlayers);
    for (i = 0; i < nbVideoPlayers; i++) {
        playerJson[i] = 0;
        nbVideos[i] = 0;
        nbHTTP[i] = 0;
        nbRTMP[i] = 0;
        nbHLS[i] = 0;

        // Clone from base object
        availableLanguages[i] = Object.assign({}, languages);

        // Resets
        for (l in availableLanguages[i]) {
            availableLanguages[i][l] = 0;
        }
    }

    // Inject buttons in the video's face
    for (var i = 0; i < nbVideoPlayers; i++) {
        decorateVideo(videoPlayerElements[i], i);
    }
}