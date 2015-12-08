// ==UserScript==
// @name        Arte+7 Downloader
// @namespace   GuGuss
// @description Download videos or get stream link of ARTE programs in the selected language.
// @include     http://*.arte.tv/*
// @version     2.4
// @updateURL   https://github.com/GuGuss/ARTE-7-Playground/blob/master/arte-downloader.user.js
// @grant       GM_xmlhttpRequest
// @icon        https://icons.duckduckgo.com/ip2/www.arte.tv.ico
// ==/UserScript==

/*
    Works for: 
    - Arte live: http://www.arte.tv/guide/fr/direct
    - Arte +7: http://www.arte.tv/guide/fr/057458-000/albert-einstein-portrait-d-un-rebelle
    - Arte info: http://info.arte.tv/fr/videos?id=71611    
    - Arte info Story: http://www.arte.tv/sites/fr/story/reportage/areva-uramin-bombe-a-retardement-du-nucleaire-francais/#fitvid0
    - Arte info royal slider:
        > #1: http://info.arte.tv/fr/letat-durgence-un-patriot-act-la-francaise
        > #2: http://info.arte.tv/fr/interview-de-jerome-fritel
    - Arte future: http://future.arte.tv/fr/ilesdufutur/les-iles-du-futur-la-serie-documentaire
    - Arte future embedded : http://future.arte.tv/fr/polar-sea-360deg-les-episodes
    - Arte creative: http://creative.arte.tv/fr/episode/bonjour-afghanistan
    - Arte concert: http://concert.arte.tv/fr/documentaire-dans-le-ventre-de-lorgue-de-notre-dame
    - Arte cinema: http://cinema.arte.tv/fr/program/jude
    - Arte cinema embedded: http://cinema.arte.tv/fr/article/tirez-la-langue-mademoiselle-daxelle-ropert-re-voir-pendant-7-jours
    - Arte future 360: http://future.arte.tv/fr/5-metres-une-plongee-360deg-sur-votre-ordinateur (powered by http://deep-inc.com/)

    @TODO
    - Arte Tracks: http://tracks.arte.tv/fr/mickey-mouse-tmr-en-remix-3d
    - Arte Concert tape stop loading : http://concert.arte.tv/fr/tape-etienne-daho
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
var nbVideoPlayers;
var playerJson;
var nbVideos;
var nbHTTP;
var nbRTMP;
var nbHLS;
var availableLanguages;
var players = []; // players.push({});

var videoPlayerClass = {
    'live': 'arte_vp_live-url',
    '+7': 'arte_vp_url',
    'generic': 'data-url',
    'teaser': 'data-teaser-url'
};

var videoPlayerClassEmbedded = {
    'story': 'embed.embed--delay iframe',
    'embedded': 'media_embed iframe' // eg: http://cinema.arte.tv/fr/article/tirez-la-langue-mademoiselle-daxelle-ropert-re-voir-pendant-7-jours
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
    'VOF': 'Original in french',
    'VOA': 'Original in german',
    'VOF-STF': 'Original in french subtitled',
    'VOF-STA': 'Original in french subtitled in german',
    'VOF-STE[ANG]': 'Original in french subtitled in english',
    'VOF-STE[ESP]': 'Original in french subtitled in spanish',
    'VOA-STA': 'Original in german subtitled',
    'VOA-STF': 'Original in german subtitled in french',
    'VOF-STMF': 'Original in french for hearing impaired',
    'VOA-STMA': 'Original in german for hearing impaired',
    'VF': 'French dubbed',
    'VA': 'German dubbed',
    'VA-STA': 'German dubbed subtitled',
    'VF-STF': 'French dubbed subtitled',
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

        // Display preparse info
        console.log("\n====================================\n              player #" + videoElementIndex + "\n====================================\n> "
            + nbVideos[videoElementIndex] + " formats:\n    - "
            + nbHTTP[videoElementIndex] + " HTTP videos,\n    - "
            + nbRTMP[videoElementIndex] + " RTMP streams,\n    - "
            + nbHLS[videoElementIndex] + " HLS streams.");
        var languagesFound = "";
        for (l in availableLanguages[videoElementIndex]) {
            if (availableLanguages[videoElementIndex][l] !== 0) {
                languagesFound += "\n    - " + availableLanguages[videoElementIndex][l];
            }
        }
        console.log("> Languages:" + languagesFound);
    }
}

function createButtonDownload(videoElementIndex, language) {
    var button = document.createElement('a');
    var videoUrl;

    for (q in qualityCode) {
        videoUrl = getVideoUrl(videoElementIndex, qualityCode[q], language);
        if (videoUrl !== '') {
            quality = q;
            break;
        }
    }

    // Check if video exists
    if (videoUrl === null) {
        console.log("Could not find video feed");

        // Don't create button
        return null;
    }

    // Check RTMP stream
    if (nbRTMP[videoElementIndex] > 0 && videoUrl.substring(0, 7) === "rtmp://") { // check first because it ends with .mp4 like HTTP
        button.innerHTML = "Open <a style='text-decoration: underline;' href='https://www.videolan.org/vlc/'>VLC</a> > CTRL+R > Network > Copy this link > <strong>Convert/Save video.</strong> <span class='icomoon-angle-down force-icomoon-font'></span>";
    }

        // Check HTTP
    else if (nbHTTP[videoElementIndex] > 0 && videoUrl.substring(videoUrl.length - 4, videoUrl.length) === ".mp4") {
        button.innerHTML = "<strong>Download video </strong><span class='icomoon-angle-down force-icomoon-font'></span>";
    }

        // Check HLS stream : should not happen
    else if (nbHLS[videoElementIndex] > 0 && videoUrl.substring(videoUrl.length - 5, videoUrl.length === ".m3u8")) {
        button.innerHTML = "<a href='https://en.wikipedia.org/wiki/HTTP_Live_Streaming'> HLS master stream</a> (copy/paste into Apple Quicktime or <a href='https://www.videolan.org/vlc/'>into VLC</a>) <span class='icomoon-angle-down force-icomoon-font'></span>";
    }

        // Unknown URL format : should not happen
    else {
        console.log('Unknown URL format');
        return null;
    }

    button.setAttribute('id', 'btnDownload' + videoElementIndex); // to refer later in select changes
    button.setAttribute('href', videoUrl);
    button.setAttribute('target', '_blank');
    button.setAttribute('download', getVideoName(videoElementIndex) + ".mp4");

    // Keeping uniform style
    button.setAttribute('class', 'btn btn-default');
    button.setAttribute('style', 'margin-left:10px; text-align: center; padding-top: 9px; padding-bottom: 9px; padding-left: 12px; padding-right: 12px; color:rgb(40, 40, 40); background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px; font-weight: 400;');
    return button;
}

function createButtonMetadata(videoElementIndex) {
    var button = document.createElement('a');

    // Keeping uniform style
    button.setAttribute('class', 'btn btn-default');
    button.setAttribute('style', 'margin-left:10px; text-align: center; padding: 10px; color:rgb(40, 40, 40);  background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px;');
    button.innerHTML = "Download description <span class='icomoon-angle-down force-icomoon-font'></span>";

    var title = getVideoName(videoElementIndex);
    if (title === undefined) {
        return null;
    }
    var description_short = playerJson[videoElementIndex]['videoJsonPlayer']['V7T'];
    if (description_short === undefined) {
        return null;
    }
    var subtitle = playerJson[videoElementIndex]['videoJsonPlayer']['VSU'];
    if (subtitle === undefined) {
        return null;
    }
    var description = playerJson[videoElementIndex]['videoJsonPlayer']['VDE'];
    if (description === undefined) {
        return null;
    }
    var tags = playerJson[videoElementIndex]['videoJsonPlayer']['VTA'];
    if (tags === undefined) {
        return null;
    }
    var metadata = "[Title]\n" + title + "\n\n[Subtitle]\n" + subtitle + "\n\n[Description-short]\n" + description_short + "\n\n[Description]\n" + description + "\n\n[Tags]\n" + tags;

    // Properly encode to Base 64.
    var encodedData = window.btoa(unescape(encodeURIComponent(metadata)));

    // The href will output a text file. 
    // For a CSV file, that would be: data:application/octet-stream,field1%2Cfield2%0Afoo%2Cbar%0Agoo%2Cgai%0A
    button.setAttribute('href', 'data:application/octet-stream;charset=utf-8;base64,' + encodedData);
    button.setAttribute('download', getVideoName(videoElementIndex) + '.txt');

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
        if (url !== '') {
            btn.style.visibility = "visible";
            btn.setAttribute('href', url);
        } else {
            btn.style.visibility = "hidden";
        }
    };

    // Fill options
    for (l in availableLanguages[videoElementIndex]) {
        if (availableLanguages[videoElementIndex][l] !== 0) {
            languageComboBox.innerHTML += "<option value='" + l + "'>" + availableLanguages[videoElementIndex][l] + "</option>";
        }
    }

    // Keeping uniform style
    languageComboBox.setAttribute('class', 'btn btn-default');
    languageComboBox.setAttribute('style', 'padding: 6px; color:rgb(40, 40, 40); background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px; font-weight: 400;');

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
        if (url !== '') {
            btn.style.visibility = "visible";
            btn.setAttribute('href', url);
        } else {
            btn.style.visibility = "hidden";
        }
    };

    // Fill options
    for (q in qualityCode) {
        qualityComboBox.innerHTML += "<option value='" + q + "'>" + q + "</option>";
    }

    // Keeping uniform style
    qualityComboBox.setAttribute('class', 'btn btn-default');
    qualityComboBox.setAttribute('style', 'padding: 6px; margin-left:10px; color:rgb(40, 40, 40); background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px; font-weight: 400;');

    return qualityComboBox;
}

function stringStartsWith(string, prefix) {
    return string.slice(0, prefix.length) == prefix;
}

function createButtons(videoElement, videoElementIndex) {
    var parent;
    var bRoyalSlider = false;

    // Look for the parent to decorate
    parent = videoElement.parentNode;

    // iframe player
    if (videoElement.nodeName === "IFRAME") {
        console.log("> Decorating iFrame player");
    }

        // royal slider player
    else if (videoElement.getAttribute('class') === 'rsContent') {
        console.log("> Decorating RoyalSlider player");
        bRoyalSlider = true;

        // Get the parent with SliderTeaserView type
        while (parent.getAttribute('data-teaser-type') !== "SliderTeaserView") {
            parent = parent.parentNode;
        }
    }

        // overlayed player for Arte Cinema or media embedded
    else if (stringStartsWith(location.href, "http://cinema.arte")
        || (parent.parentNode.getAttribute('id') === "embed_widget")) {

        console.log("> Decorating overlayed Cinema player");
        parent = parent.parentNode.parentNode;
    }

        // regular player
    else {
        console.log("> Decorating player");
        parent = parent.parentNode;
    }

    // Append a <div> container to the player
    var container = document.createElement('div');
    parent.appendChild(container);
    container.setAttribute('class', 'ArteDownloader-v' + GM_info.script.version)
    container.setAttribute('style', 'background-image:url("data:image/gif;base64,R0lGODlhAwADAIAAAMhFJuFdPiH5BAAAAAAALAAAAAADAAMAAAIERB5mBQA7"); padding: 10px;');

    // Create index indicator if Royal Slider
    if (bRoyalSlider === true) {
        var indexElement = document.createElement('span');
        indexElement.innerHTML = "Video " + (videoElementIndex + 1) + " / " + nbVideoPlayers;
        indexElement.setAttribute('style', 'margin:10px; text-align: center; color:rgb(255, 255, 255); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px;');
        container.appendChild(indexElement);
    }

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

    // Create download button
    var btnDownload = createButtonDownload(videoElementIndex, selectedLanguage)
    if (btnDownload !== null) {
        container.appendChild(btnDownload);
    }

    // Create metadata button
    var btnMetadata = createButtonMetadata(videoElementIndex);
    if (btnMetadata !== null) {
        container.appendChild(btnMetadata); // @TODO display instead of download
    }

    // Create credits element if not RoyalSlider or if last player from RoyalSlider
    if (bRoyalSlider === false || videoElementIndex === nbVideoPlayers - 1) { // glitch: 
        var credits = document.createElement('div');
        credits.setAttribute('style', 'text-align: center; line-height: 20px; font-size: 11.2px; color: rgb(255, 255, 255); font-family: ProximaNova, Arial, Helvetica, sans-serif; padding: 5px; background-image:url("data:image/gif;base64,R0lGODlhAwADAIAAAMhFJuFdPiH5BAAAAAAALAAAAAADAAMAAAIERB5mBQA7")');
        credits.innerHTML = 'Arte Downloader v.' + GM_info.script.version
                        + ' built by and for the community with love'
                        + '<br /><a style=\'color: #020202;\' href="https://github.com/GuGuss/ARTE-7-Downloader">Contribute Here.</a>';
        parent.appendChild(credits);

    }
}

function parsePlayerJson(playerUrl, videoElement, videoElementIndex) {
    console.log("    - #" + videoElementIndex + " player JSON: " + playerUrl);
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


function getVideoName(videoElementIndex) {
    var name = playerJson[videoElementIndex]['videoJsonPlayer']['VTI'];
    if (name === null) {
        name = playerJson[videoElementIndex]['videoJsonPlayer']['VST']['VNA'];
        if (name === null) {
            return "undefined";
        }
    }
    name = name.split('_').join(' ');
    return name.charAt(0).toUpperCase() + name.slice(1);
}

function getVideoUrl(videoElementIndex, quality, language) {
    //console.log("> Looking for a " + quality + " quality track in " + language + ", for player " + videoElementIndex);

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
                        console.log("> " + quality + " quality MP4 in " + language + ": " + url);
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
                console.log("> " + quality + "RTMP stream: " + url);
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
                console.log("> HLS stream: " + url);
                return (url);
            }
        }
    }

    // No video feed
    console.log("...not found.")
    return '';
}

function insertAfter(newNode, referenceNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

function decorateVideo(videoElement, videoElementIndex) {

    // Get player URL
    var playerUrl = null;
    for (key in videoPlayerClass) {
        playerUrl = videoElement.getAttribute(videoPlayerClass[key]);
        if (playerUrl !== null) {
            break;
        }
    }

    // iframe embedded media
    if (playerUrl === null) {

        // Get src attribute
        playerUrl = unescape(videoElement.getAttribute('src'));

        // Get JSON URL
        var jsonUrl = playerUrl.split('json_url=')[1];
        if (jsonUrl !== undefined) {
            parsePlayerJson(jsonUrl.split('&')[0], videoElement, videoElementIndex);
        }
        else {
            // Find the 360 video in the URL
            console.log("> Searching a 360 video");
            GM_xmlhttpRequest({
                method: "GET",
                url: playerUrl,
                onload: function (response) {
                    var doc = response.responseText;
                    var xml = doc.split('xml:"')[1].split('"')[0];

                    // Get XML
                    GM_xmlhttpRequest({
                        method: "GET",
                        url: playerUrl + xml,
                        onload: function (response) {
                            xml = response.responseText;

                            // Get video URL
                            var videoName = xml.split('videourl="%SWFPATH%/')[1].split('"')[0];
                            var videoUrl = playerUrl + videoName;
                            console.log(videoUrl);

                            // Decorate
                            var container = document.createElement('div');
                            insertAfter(container, videoElement);
                            container.setAttribute('class', 'ArteDownloader-v' + GM_info.script.version)
                            container.setAttribute('style', 'background-image:url("data:image/gif;base64,R0lGODlhAwADAIAAAMhFJuFdPiH5BAAAAAAALAAAAAADAAMAAAIERB5mBQA7"); padding: 10px;');
                            var button = document.createElement('a');
                            button.innerHTML = "<strong>Download " + videoName + " </strong><span class='icomoon-angle-down force-icomoon-font'></span>";
                            button.setAttribute('id', 'btnArteDownloader');
                            button.setAttribute('href', videoUrl);
                            button.setAttribute('target', '_blank');
                            button.setAttribute('download', videoName);
                            button.setAttribute('class', 'btn btn-default');
                            button.setAttribute('style', 'margin-left:10px; text-align: center; padding-top: 9px; padding-bottom: 9px; padding-left: 12px; padding-right: 12px; color:rgb(40, 40, 40); background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px; font-weight: 400;');
                            container.appendChild(button);
                        }
                    });
                }
            });
        }
    }

    else if (playerUrl.substring(playerUrl.length - 6, playerUrl.length - 1) === ".json") { // Check if player URL points to a JSON
        parsePlayerJson(playerUrl, videoElement, videoElementIndex);
    }

    else {
        // Find the player JSON in the URL
        GM_xmlhttpRequest({
            method: "GET",
            url: playerUrl,
            onload: function (response) {

                // Look for player URL inside the livestream player URL
                var json = JSON.parse(response.responseText);
                playerUrl = json["videoJsonPlayer"]["videoPlayerUrl"];

                // not found ? Look for playlist file inside the livestream player
                if (playerUrl === undefined) {
                    console.log("Video player URL not available. Fetching livestream player URL");
                    playerUrl = videoElement.getAttribute(videoPlayerClass['live']);
                }
                parsePlayerJson(playerUrl, videoElement, videoElementIndex);
            }
        });
    }
};



/*
 * main: script entry
 */
main();

function main() {
    var videoPlayerElements;

    // Check regular tags
    for (tag in videoPlayerClass) {
        videoPlayerElements = document.querySelectorAll("div[" + videoPlayerClass[tag] + "]");
        if (videoPlayerElements.length > 0) {
            break;
        }
    }

    // Check iframe tags
    if (videoPlayerElements.length === 0) {
        for (tag in videoPlayerClassEmbedded) {
            videoPlayerElements = document.querySelectorAll("div." + videoPlayerClassEmbedded[tag]);
            if (videoPlayerElements.length > 0) {
                break;
            }
        }
    }

    // Check 360 (no tags yet)
    if (videoPlayerElements.length === 0) {
        videoPlayerElements = document.querySelectorAll("iframe");
    }

    nbVideoPlayers = videoPlayerElements.length;
    console.log("> Found " + nbVideoPlayers + " video players:");

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

        // Clone available languages from base object
        availableLanguages[i] = Object.assign({}, languages);

        // Resets available languages
        for (l in availableLanguages[i]) {
            availableLanguages[i][l] = 0;
        }
    }

    // Inject buttons in the video's face
    for (var i = 0; i < nbVideoPlayers; i++) {
        decorateVideo(videoPlayerElements[i], i);
    }
}
