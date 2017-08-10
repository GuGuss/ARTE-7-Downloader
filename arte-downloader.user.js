// ==UserScript==
// @name        Arte+7 Downloader
// @namespace   GuGuss
// @description Download videos or get stream link of ARTE programs in the selected language.
// @include     https://*.arte.tv/*
// @version     2.7
// @updateURL   https://github.com/GuGuss/ARTE-7-Downloader/raw/master/arte-downloader.user.js
// @grant       GM_xmlhttpRequest
// @icon        http://www.arte.tv/favicon.ico
// ==/UserScript==
/*
    Support:
    - new 360 HTML5 player: http://info.arte.tv/fr/wasala-arriver
    - old 360 flash player: http://future.arte.tv/fr/5-metres-une-plongee-360deg-sur-votre-ordinateur
*/
/* --- GLOBAL VARIABLES --- */
var scriptVersion = "2.6";
var player = [];
var nbVideoPlayers = 0;
var is_playlist = false;
var playerJson;
var nbVideos;
var nbHTTP;
var nbRTMP;
var nbHLS;
var languages;
var qualities;
var videoPlayerElements;

var videoPlayerClass = {
    'standard': 'arte_vp_url',
    'oembed': 'arte_vp_url_oembed',
    'general': 'video-container',
    'live-oembed': 'arte_vp_live-url-oembed',
    'generic': 'data-url',
    'teaser': 'data-teaser-url'
};

var videoPlayerClassEmbedded = {
    'story': 'embed.embed--delay iframe',
    'embedded': 'media_embed iframe'
};

/* --- FUNCTIONS: utilities --- */
function getURLParameter(url, name) {
    return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(url) || [, ""])[1].replace(/\+/g, '%20')) || null;
}

function insertAfter(newNode, referenceNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

function stringStartsWith(string, prefix) {
    return string.slice(0, prefix.length) === prefix;
}

function hasClass(element, cls) {
    return (' ' + element.className + ' ').indexOf(' ' + cls + ' ') > -1;
}

// Get a parent node of the chosen type and class
function getParent(nodeReference, nodeName, classString) {
    var parent = node;
    var nbNodeIteration = 0;
    var nbNodeIterationMax = 10;

    // any node
    if (nodeName === '') {
        console.log("> Looking for a parent node with class '" + classString + "'");
        while (parent.nodeName !== "BODY" &&
            nbNodeIteration < nbNodeIterationMax &&
            hasClass(parent, classString) === false) {
            nbNodeIteration++;
            parent = parent.parentNode;
        }
    }

    // with defined node type
    else {
        console.log("> Looking for a <" + nodeName + " class='" + classString + "'> parent node");
        while (parent.nodeName !== "BODY" &&
            nbNodeIteration < nbNodeIterationMax &&
            (parent.nodeName !== nodeName.toUpperCase() || hasClass(parent, classString) === false)) {
            nbNodeIteration++;
            parent = parent.parentNode;
        }
    }
    return parent;
}

/* --- FUNCTIONS: analysis --- */
function addLanguage(videoElementIndex, language, wording) {
    if (!languages[videoElementIndex].hasOwnProperty(language)) {
        languages[videoElementIndex][language] = wording;
    }
}

function addQuality(videoElementIndex, quality, wording) {
    if (!qualities[videoElementIndex].hasOwnProperty(quality)) {
        qualities[videoElementIndex][quality] = wording;
    }
}

function preParsePlayerJson(videoElementIndex) {
    if (playerJson[videoElementIndex]) {
        var videos = Object.keys(playerJson[videoElementIndex]["videoJsonPlayer"]["VSR"]);
        nbVideos[videoElementIndex] = videos.length;

        // Loop through all videos URLs.
        for (var key in videos) {
            var video = playerJson[videoElementIndex]["videoJsonPlayer"]["VSR"][videos[key]];

            // Check if video format or media type
            if (video["videoFormat"] === "HBBTV" || video["mediaType"] === "mp4") {
                nbHTTP[videoElementIndex]++;
            } else if (video["videoFormat"] === "RMP4" || video["mediaType"] === "rtmp") {
                nbRTMP[videoElementIndex]++;
            } else if (video["videoFormat"] === "M3U8" || video["mediaType"] === "hls") {
                nbHLS[videoElementIndex]++;
            }

            addLanguage(videoElementIndex, video["versionCode"], video["versionLibelle"]);
            addQuality(videoElementIndex, (
                    video["VQU"] !== undefined ? video["VQU"] : video["quality"]),
                video["height"] ? video["height"] + "p@" + video["bitrate"] + "bps" : video["quality"]);
        }

        // Remove Apple HLS if HTTP available
        if (nbHTTP[videoElementIndex] > 0) {
            delete qualities[videoElementIndex]["XS"];
            delete qualities[videoElementIndex]["XQ"];
        }

        // Reorder qualities
        var sortedKeys = Object.keys(qualities[videoElementIndex]).sort(
            function(a, b) {
                // array of sorted keys
                return qualities[videoElementIndex][b].split('@')[1].split('b')[0] * 1 - qualities[videoElementIndex][a].split('@')[1].split('b')[0] * 1;
            }
        );

        // Create new object to rearrange qualities according to new key order
        var temp = new Object;
        for (var i = 0; i < sortedKeys.length; i++) {
            temp[sortedKeys[i]] = qualities[videoElementIndex][sortedKeys[i]];
        }
        qualities[videoElementIndex] = temp; // replace with new ordered object

        // Display preparse info
        console.log("\n====== player #" + videoElementIndex + " ======\n> " +
            nbVideos[videoElementIndex] + " formats: " + nbHTTP[videoElementIndex] + " HTTP videos | " + nbRTMP[videoElementIndex] + " RTMP streams | " + nbHLS[videoElementIndex] + " HLS streams.");
        var languagesFound = "";
        for (l in languages[videoElementIndex]) {
            languagesFound += "\n    - " + languages[videoElementIndex][l];
        }
        console.log("> Languages:" + languagesFound);
    }
}

function parsePlayerJson(playerJsonUrl, videoElement, videoElementIndex) {
    console.log("    - #" + videoElementIndex + " player JSON: " + playerJsonUrl);
    GM_xmlhttpRequest({
        method: "GET",
        url: playerJsonUrl,
        onload: function(response) {
            playerJson[videoElementIndex] = JSON.parse(response.responseText);
            preParsePlayerJson(videoElementIndex);
            decoratePlayer(videoElement, videoElementIndex);
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
    // Get videos object
    var videos = Object.keys(playerJson[videoElementIndex]["videoJsonPlayer"]["VSR"]);

    // Check if there are HTTP videos
    if (nbHTTP[videoElementIndex] > 0) {

        // Loop through all videos URLs.
        for (var key in videos) {
            var video = playerJson[videoElementIndex]["videoJsonPlayer"]["VSR"][videos[key]];

            // Check language, format, quality
            if (video["versionCode"] === language &&
                (video["videoFormat"] === "HBBTV" || video["mediaType"] === "mp4") &&
                (video["VQU"] === quality || video["quality"] === quality)) {
                console.log("> " + quality + " MP4 in " + language + ": " + video["url"]);
                return video["url"];
            }
        }
    }

    // Search RTMP streams
    if (nbRTMP[videoElementIndex] > 0) {
        for (var key in videos) {
            var video = playerJson[videoElementIndex]["videoJsonPlayer"]["VSR"][videos[key]];
            if ((video["versionCode"] === language || language === undefined) &&
                (video["VQU"] === quality || video["quality"] === quality) &&
                (video["videoFormat"] === "RMP4" || video["mediaType"] === "rtmp")
            ) {
                var url = video["streamer"] + video["url"];
                console.log("> " + quality + " RTMP stream: " + url);
                return url;
            }
        }
    }

    // Search HLS streams
    if (nbHLS[videoElementIndex] > 0) {
        for (var key in videos) {
            var video = playerJson[videoElementIndex]["videoJsonPlayer"]["VSR"][videos[key]];
            if (
                (video["videoFormat"] === "M3U8" || video["mediaType"] === "hls") &&
                (video["VQU"] === quality || video["quality"] === quality) &&
                video["versionCode"] === language
            ) {
                console.log("> HLS stream: " + video["url"]);
                return video["url"];
            }
        }
    }

    console.log("> Video not found.")
    return '';
}

function findPlayerJson(videoElement, videoElementIndex) {
    // Get player URL to find its associated json
    var playerUrl = null;
    var jsonUrl = null;
    for (key in videoPlayerClass) {
        playerUrl = videoElement.getAttribute(videoPlayerClass[key]);
        if (playerUrl !== null) {
            break;
        }
    }

    // oembed
    if (playerUrl !== null && (key === "oembed" || (key === "live-oembed"))) {
        GM_xmlhttpRequest({
            method: "GET",
            url: playerUrl,
            onload: function(response) {
                jsonUrl = unescape(response.responseText.split("json_url=")[1].split('"')[0]);
                if (jsonUrl !== undefined) {
                    parsePlayerJson(jsonUrl, videoElement, videoElementIndex);
                }
            }
        });
    }

    // http://www.arte.tv/arte_vp/
    else if (stringStartsWith(location.href, "http://www.arte.tv/arte_vp/")) {
        playerUrl = unescape(location.href.split("json_url=")[1]);
        parsePlayerJson(playerUrl, videoElement, videoElementIndex);
    }

    // iframe embedded media
    else if (playerUrl === null) {
        playerUrl = unescape(videoElement.getAttribute('src'));

        jsonUrl = playerUrl.split('json_url=')[1];
        if (jsonUrl !== undefined) {
            parsePlayerJson(jsonUrl, videoElement, videoElementIndex);
        } else {
            console.log("> Searching a 360 video in: " + playerUrl);
            GM_xmlhttpRequest({
                method: "GET",
                url: playerUrl,
                onload: function(response) {

                    var doc = response.responseText;
                    var videoName, videoURL;

                    // new 360 HTML5 player
                    if (playerUrl.indexOf("arte360") > -1) {
                        var playerJS = playerUrl.split("?root")[0] + "jsmin/output.min.js?" + doc.split("window.appVersion = \"")[1].split("\"")[0];
                        console.log("> 360 player JS: " + playerJS);
                        var root = getURLParameter(playerUrl, "root")
                        videoName = getURLParameter(playerUrl, "video")
                        videoURL = root + "/video/download/4K/" + videoName + "_4K.mp4";
                        console.log("> Video URL: " + videoURL);
                        var subtitlesURL = root + "/subtitles/" + videoName + "_" + getURLParameter(playerUrl, "lang") + ".srt";
                        console.log("> Subtitles URL: " + subtitlesURL);
                        decoratePlayer360(videoElement, videoURL, videoName, subtitlesURL);
                    }

                    // old 360 flash player
                    else if (playerUrl.indexOf("360FlashPlayers") > -1) {
                        console.log("> old player");
                        var xml = doc.split('xml:"')[1].split('"')[0];
                        GM_xmlhttpRequest({
                            method: "GET",
                            url: playerUrl + xml,
                            onload: function(response) {
                                xml = response.responseText;

                                // Get video URL
                                videoName = xml.split('videourl="%SWFPATH%/')[1].split('"')[0];
                                videoURL = playerUrl + videoName;
                                console.log(videoURL);
                                decoratePlayer360(videoElement, videoURL, videoName);
                            }
                        });
                    }
                }
            });
        }
    }

    // Check if player URL is the json
    else if (playerUrl.substring(playerUrl.length - 6, playerUrl.length - 1) === ".json") {
        parsePlayerJson(playerUrl, videoElement, videoElementIndex);
    }

    // Look for player URL inside the player json
    else {
        GM_xmlhttpRequest({
            method: "GET",
            url: playerUrl,
            onload: function(response) {
                var json = JSON.parse(response.responseText);
                playerUrl = json["videoJsonPlayer"]["videoPlayerUrl"];

                if (playerUrl === undefined) { // not found ? Look for playlist file inside the livestream player
                    console.log("Video player URL not available. Fetching livestream player URL");
                    playerUrl = videoElement.getAttribute(videoPlayerClass['live']);
                }
                parsePlayerJson(playerUrl, videoElement, videoElementIndex);
            }
        });
    }
}

function findPlayers() {
    // Check playlist
    playlistJson = unescape(window.location.href.split("json_playlist_url=")[1])
    if (playlistJson !== "undefined") {
        console.log("> Found playlist json: " + playlistJson)
        console.log()
        videoPlayerElements = parent.document.querySelectorAll("div.arte-playerfs.arte-playerfs--show");
        GM_xmlhttpRequest({
            method: "GET",
            url: playlistJson,
            onload: function(response) {
                jsonUrl = JSON.parse(response.responseText)["videos"][0]["jsonUrl"];
                jsonUrl = jsonUrl.replace(/\\/g, ''); // remove backslashes from the URL
                if (jsonUrl !== undefined) {
                    parsePlayerJson(jsonUrl, videoPlayerElements[0], 0);
                }
            }
        });
        nbVideoPlayers = videoPlayerElements.length;
        return true;
    } else {
        // Check regular tags
        for (tag in videoPlayerClass) {
            videoPlayerElements = document.querySelectorAll("div[" + videoPlayerClass[tag] + "]");
            if (videoPlayerElements.length > 0) {
                console.log(videoPlayerClass[tag])
                break;
            }
        }

        // Check embedded tags
        if (videoPlayerElements.length === 0) {
            for (tag in videoPlayerClassEmbedded) {
                videoPlayerElements = document.querySelectorAll("div." + videoPlayerClassEmbedded[tag]);
                if (videoPlayerElements.length > 0) {
                    console.log(tag)
                    break;
                }
            }
        }

        // Check iframe
        if (videoPlayerElements.length === 0) {
            videoPlayerElements = document.querySelectorAll("iframe[arte-video]");

            // Check 360 (no attributes yet)
            if (videoPlayerElements.length === 0) {
                videoPlayerElements = document.querySelectorAll("iframe");
            }
        }

        // Check arte_vp with no parent frame
        if (videoPlayerElements.length === 0 && stringStartsWith(unescape(top.location), "http://www.arte.tv/arte_vp/")) {
            videoPlayerElements = document.querySelectorAll("body");
        }

        nbVideoPlayers = videoPlayerElements.length;
        return false;
    }
}

/* --- FUNCTIONS: decorating --- */
function createButtonDownload(videoElementIndex, language) {
    var button = document.createElement('a');
    var videoUrl;

    for (q in qualities[videoElementIndex]) {
        videoUrl = getVideoUrl(videoElementIndex, q, language);
        if (videoUrl !== '') {
            quality = q;
            break;
        }
    }

    // Check if video exists
    if (videoUrl === null) {
        console.log("Could not find video feed");
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
        button.innerHTML = "Open <a style='text-decoration: underline;' href='https://www.videolan.org/vlc/'>VLC</a> > CTRL+R > Network > Copy this link > <strong>Convert/Save video.</strong> <span class='icomoon-angle-down force-icomoon-font'></span>";
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
    button.setAttribute('class', 'btn btn-default');
    button.setAttribute('style', 'line-height: 17px; margin-left:10px; text-align: center; padding-top: 9px; padding-bottom: 9px; padding-left: 12px; padding-right: 12px; color:rgb(40, 40, 40); background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px; font-weight: 400;');
    return button;
}

function createButtonMetadata(videoElementIndex) {
    var title = getVideoName(videoElementIndex);
    var subtitle = playerJson[videoElementIndex]['videoJsonPlayer']['VSU'];
    var description_short = playerJson[videoElementIndex]['videoJsonPlayer']['V7T'];
    var description = playerJson[videoElementIndex]['videoJsonPlayer']['VDE'];
    var tags = playerJson[videoElementIndex]['videoJsonPlayer']['VTA'];

    // Continue if at least one field is filled
    if (title !== undefined || description_short !== undefined || subtitle !== undefined || description !== undefined || tags !== undefined) {
        var button = document.createElement('a');
        button.setAttribute('class', 'btn btn-default');
        button.setAttribute('style', 'line-height: 17px; margin-left:10px; text-align: center; padding: 10px; color:rgb(40, 40, 40);  background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px;');
        button.innerHTML = "Download description <span class='icomoon-angle-down force-icomoon-font'></span>";
        var metadata = "[Title]\n" + title + "\n\n[Subtitle]\n" + subtitle + "\n\n[Description-short]\n" + description_short + "\n\n[Description]\n" + description + "\n\n[Tags]\n" + tags;
        var encodedData = window.btoa(unescape(encodeURIComponent(metadata)));
        button.setAttribute('href', 'data:application/octet-stream;charset=utf-8;base64,' + encodedData);
        button.setAttribute('download', getVideoName(videoElementIndex) + '.txt');
        return button;
    } else {
        return null;
    }
}

function getComboboxSelectedValue(combobox) {
    var cb = document.getElementById(combobox);
    if (cb == null) {
        cb = parent.document.getElementById(combobox);
    }
    return cb[cb.selectedIndex].value;
}

function createLanguageComboBox(videoElementIndex) {
    var languageComboBox = document.createElement('select');
    languageComboBox.setAttribute('id', 'cbLanguage' + videoElementIndex);

    // Associate onchange event with function (bypass for GM)
    languageComboBox.onchange = function() {
        var selectedLanguage = languageComboBox.options[languageComboBox.selectedIndex].value;
        console.log("\n> Language changed to " + selectedLanguage);
        var btn = document.getElementById('btnDownload' + videoElementIndex);
        var selectedQuality = getComboboxSelectedValue('cbQuality' + videoElementIndex);
        var url = getVideoUrl(videoElementIndex, selectedQuality, selectedLanguage);
        if (url !== '') {
            btn.style.visibility = "visible";
            btn.setAttribute('href', url);
        } else {
            btn.style.visibility = "hidden";
        }
    };

    // Fill with available languages
    for (l in languages[videoElementIndex]) {
        if (languages[videoElementIndex][l] !== 0) {
            languageComboBox.innerHTML += "<option value='" + l + "'>" + languages[videoElementIndex][l] + "</option>";
        }
    }
    languageComboBox.setAttribute('class', 'btn btn-default');
    languageComboBox.setAttribute('style', (languageComboBox.innerHTML === "" ? "visibility:hidden;" : "max-width: 140px; padding: 6px; color:rgb(40, 40, 40); background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px; font-weight: 400;"));
    return languageComboBox;
}

function createQualityComboBox(videoElementIndex) {
    var qualityComboBox = document.createElement('select');
    qualityComboBox.setAttribute('id', 'cbQuality' + videoElementIndex);

    // Associate onchange event with function (bypass for GM)
    qualityComboBox.onchange = function() {
        var selectedQuality = qualityComboBox.options[qualityComboBox.selectedIndex].value;
        console.log("\n> Quality changed to " + selectedQuality);
        var btn = document.getElementById('btnDownload' + videoElementIndex);
        if (btn == null) {
            btn = parent.document.getElementById('btnDownload' + videoElementIndex);
        }
        var selectedLanguage = getComboboxSelectedValue('cbLanguage' + videoElementIndex);
        console.log(selectedLanguage);
        var url = getVideoUrl(videoElementIndex, selectedQuality, selectedLanguage);
        if (url !== '') {
            btn.style.visibility = "visible";
            btn.setAttribute('href', url);
        } else {
            console.log("Video not found for these settings!")
            btn.style.visibility = "hidden";
        }
    };

    // Fill with available qualities
    for (q in qualities[videoElementIndex]) {
        if (qualities[videoElementIndex][q] !== 0) {
            qualityComboBox.innerHTML += "<option value='" + q + "'>" + qualities[videoElementIndex][q] + "</option>";
        }
    }
    qualityComboBox.setAttribute('class', 'btn btn-default');
    qualityComboBox.setAttribute('style', 'width:140px; padding: 6px; margin-left:10px; color:rgb(40, 40, 40); background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px; font-weight: 400;');
    return qualityComboBox;
}

function createCreditsElement() {
    var credits = document.createElement('div');
    credits.setAttribute('style', 'text-align: center; line-height: 20px; font-size: 11.2px; color: rgb(255, 255, 255); font-family: ProximaNova, Arial, Helvetica, sans-serif; padding: 5px; background-image:url("data:image/gif;base64,R0lGODlhAwADAIAAAMhFJuFdPiH5BAAAAAAALAAAAAADAAMAAAIERB5mBQA7")');
    credits.innerHTML = 'Arte Downloader v.' + scriptVersion + ' built by and for the community with love' +
        '<br /><a style=\'color: #020202;\' href="https://github.com/GuGuss/ARTE-7-Downloader">Contribute Here.</a>';
    return credits;
}

function decoratePlayer360(videoElement, videoURL, videoName) {
    var container = document.createElement('div');
    insertAfter(container, videoElement);
    container.setAttribute('class', 'ArteDownloader-v' + scriptVersion)
    container.setAttribute('style', 'background-image:url("data:image/gif;base64,R0lGODlhAwADAIAAAMhFJuFdPiH5BAAAAAAALAAAAAADAAMAAAIERB5mBQA7"); padding: 10px;');
    var button = document.createElement('a');
    button.innerHTML = "<strong>Download " + videoName + " </strong><span class='icomoon-angle-down force-icomoon-font'></span>";
    button.setAttribute('id', 'btnArteDownloader');
    button.setAttribute('href', videoURL);
    button.setAttribute('target', '_blank');
    button.setAttribute('download', videoName);
    button.setAttribute('class', 'btn btn-default');
    button.setAttribute('style', 'margin-left:10px; text-align: center; padding-top: 9px; padding-bottom: 9px; padding-left: 12px; padding-right: 12px; color:rgb(40, 40, 40); background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px; font-weight: 400;');
    container.appendChild(button);
}

function decoratePlayer(videoElement, videoElementIndex) {
    var parent;
    var bRoyalSlider = false;
    var container = document.createElement('div');

    if (is_playlist) {
        console.log("> Decorating playlist player")
        videoElement.insertBefore(container, videoElement.firstChild)
    } else {
        // Look for the parent to decorate
        parent = videoElement.parentNode;

        if (videoElement.id == "jwPlayerContainer") {
            console.log("> Decorating playlist player");
        }

        // iframe player
        else if (videoElement.nodeName === "IFRAME") {
            console.log("> Decorating iFrame player");

            // Arte touslesinternets
            if (stringStartsWith(window.location.href, "http://touslesinternets.arte")) {
                parent.insertBefore(container, videoElement);
            } else {
                // Arte Tracks
                if (stringStartsWith(window.location.href, "http://tracks.arte")) {
                    parent = getParent(videoElement, '', "video");
                }
                insertAfter(container, parent);
            }
        }

        // http://www.arte.tv/arte_vp
        else if (stringStartsWith(unescape(top.location), "http://www.arte.tv/arte_vp/")) {
            console.log("> Decorating arte_vp");
            var child = document.getElementById("arte_vp_player_container");
            child.parentNode.insertBefore(container, child);
            parent = container;
        }

        // overlayed player for Arte Cinema or media embedded
        else if (stringStartsWith(location.href, "http://cinema.arte") ||
            (parent.parentNode.getAttribute('id') === "embed_widget")) {

            console.log("> Decorating overlayed Cinema player");
            parent = parent.parentNode.parentNode;
            parent.appendChild(container);
        }

        // royal slider player
        else if (stringStartsWith(videoElement.getAttribute('class'), 'rsContent')) {
            console.log("> Decorating RoyalSlider player");
            bRoyalSlider = true;

            // Get the parent with SliderTeaserView type
            while (parent.getAttribute('data-teaser-type') !== "SliderTeaserView" && parent.getAttribute('class') !== 'dnd-drop-wrapper') {
                parent = parent.parentNode;
            }
            insertAfter(container, parent);
        }

        // regular player
        else {
            console.log("> Decorating regular player");
            if (stringStartsWith(location.href, "http://concert.arte")) {
                var playerSection = document.querySelector('section#section-player');
                if (playerSection !== null) {
                    insertAfter(container, playerSection);
                } else {
                    parent = parent.parentNode;
                    parent.appendChild(container);
                }
            } else {
                parent = parent.parentNode;
                parent.appendChild(container);
            }
        }
    }

    container.setAttribute('class', 'ArteDownloader-v' + scriptVersion)
    container.setAttribute('style', 'background-image:url("data:image/gif;base64,R0lGODlhAwADAIAAAMhFJuFdPiH5BAAAAAAALAAAAAADAAMAAAIERB5mBQA7"); padding: 10px;');

    // Create index indicator if Royal Slider
    if (bRoyalSlider === true) {
        var indexElement = document.createElement('span');
        indexElement.innerHTML = "Video " + (videoElementIndex + 1) + " / " + nbVideoPlayers;
        indexElement.setAttribute('style', 'margin:10px; text-align: center; color:rgb(255, 255, 255); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px;');
        container.appendChild(indexElement);
    }

    // Create video name + description span
    var videoNameSpan = document.createElement('span');
    var subtitle = playerJson[videoElementIndex]['videoJsonPlayer']['VSU'];
    videoNameSpan.innerHTML = "<strong>" + getVideoName(videoElementIndex) + (subtitle !== undefined ? " - " + subtitle : "") + "</strong><br/>";
    videoNameSpan.setAttribute('style', 'margin:10px; text-align: center; color:rgb(255, 255, 255); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px;');
    container.appendChild(videoNameSpan);

    // Create language combobox
    var languageComboBox = createLanguageComboBox(videoElementIndex)
    container.appendChild(languageComboBox);

    // Check if there are languages available to select
    var selectedLanguage;
    if (languageComboBox.options.length > 0) {
        selectedLanguage = languageComboBox.options[languageComboBox.selectedIndex].value;
    }

    // Create quality combobox
    container.appendChild(createQualityComboBox(videoElementIndex));

    // Create download button
    var btnDownload = createButtonDownload(videoElementIndex, selectedLanguage);
    if (btnDownload !== null) {
        container.appendChild(btnDownload);
    }

    // Create metadata button
    var btnMetadata = createButtonMetadata(videoElementIndex);
    if (btnMetadata !== null) {
        container.appendChild(btnMetadata);
    }

    // Create credits element if not RoyalSlider or if last player from RoyalSlider
    if (bRoyalSlider === false || videoElementIndex === nbVideoPlayers - 1) { // glitch with javascript XHR requests concurrency
        var credits = createCreditsElement();
        parent.appendChild(credits);
    }
}

is_playlist = findPlayers();
console.log("> Found " + nbVideoPlayers + " video player(s):");
if (nbVideoPlayers > 0) {
    // Init global vars
    playerJson = [nbVideoPlayers];
    nbVideos = [nbVideoPlayers];
    nbHTTP = [nbVideoPlayers];
    nbRTMP = [nbVideoPlayers];
    nbHLS = [nbVideoPlayers];
    languages = [nbVideoPlayers];
    qualities = [nbVideoPlayers];
    for (i = 0; i < nbVideoPlayers; i++) {
        playerJson[i] = 0;
        nbVideos[i] = 0;
        nbHTTP[i] = 0;
        nbRTMP[i] = 0;
        nbHLS[i] = 0;
        languages[i] = new Object;
        qualities[i] = new Object;
    }

    if (!is_playlist) {
        // Analyse each video player, then decorate them
        for (var i = 0; i < nbVideoPlayers; i++) {
            findPlayerJson(videoPlayerElements[i], i);
        }
    }
}
