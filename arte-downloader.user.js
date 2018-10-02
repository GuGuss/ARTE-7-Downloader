// ==UserScript==
// @name        Arte+7 Downloader
// @namespace   GuGuss
// @description Download videos or get stream link of ARTE programs in the selected language.
// @include     *//*.arte.tv/*
// @version     2.12
// @grant       GM.xmlHttpRequest
// @updateURL   https://github.com/GuGuss/ARTE-7-Downloader/raw/master/arte-downloader.user.js
// @icon        http://www.arte.tv/favicon.ico
// ==/UserScript==
/*
    Support:
    - 360 HTML5 player: http://info.arte.tv/fr/wasala-arriver
*/
/* --- GLOBAL VARIABLES --- */

var scriptVersion = GM_info.script.version;
var player = [];
var nbVideoPlayers = 0;
var is_playlist = false;
var playerJson;
var nbVideos;
var nbHTTP;
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
    var parent = nodeReference;
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
            nbVideos[videoElementIndex] + " formats: " + nbHTTP[videoElementIndex] + " MP4 videos | " + nbHLS[videoElementIndex] + " streams.");
        var languagesFound = "";
        for (l in languages[videoElementIndex]) {
            languagesFound += "\n    - " + languages[videoElementIndex][l];
        }
        console.log("> Languages:" + languagesFound);
    }
}

function parsePlayerJson(playerJsonUrl, videoElement, videoElementIndex) {
    console.log("    - #" + videoElementIndex + " player JSON: " + playerJsonUrl);
    let _cb = (json) => {
        playerJson[videoElementIndex] = json;
        preParsePlayerJson(videoElementIndex);
        decoratePlayer(videoElement, videoElementIndex);
    };
    window.fetch(playerJsonUrl).then((resp) => resp.json()).then(_cb);
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
    for (var key in videoPlayerClass) {
        playerUrl = videoElement.getAttribute(videoPlayerClass[key]);
        if (playerUrl !== null) {
            break;
        }
    }

    // oembed
    if (playerUrl !== null && (key === "oembed" || (key === "live-oembed"))) {
        GM.xmlHttpRequest({
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
        if (jsonUrl == undefined) {
            jsonUrl = playerUrl.split('json_playlist_url=')[1];
            if (jsonUrl !== undefined) {
                return;
            }
        }
        if (jsonUrl !== undefined) {
            parsePlayerJson(jsonUrl, videoElement, videoElementIndex);
        } else {
            console.log("> Searching a 360 video in: " + playerUrl);
            GM.xmlHttpRequest({
                method: "GET",
                url: playerUrl,
                onload: function(response) {

                    var doc = response.responseText;
                    var videoName, videoURL;

                    // 360 HTML5 player
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
        GM.xmlHttpRequest({
            method: "GET",
            url: playerUrl,
            onload: function(response) {
                var json = JSON.parse(response.responseText);
                playerUrl = json["videoJsonPlayer.videoPlayerUrl"];

                // not found ? Look for playlist file inside the livestream player
                if (playerUrl === undefined) {
                    console.log("Video player URL not available. Fetching livestream player URL");
                    playerUrl = videoElement.getAttribute(videoPlayerClass['live']);
                }
                if (playerUrl !== undefined) {
                    parsePlayerJson(playerUrl, videoElement, videoElementIndex);
                } else {
                    console.log("Couldn't find a player URL.");
                }
            }
        });
    }
}

function findPlayers() {
    // Check playlist
    var playlistJson = /playlist_url=([^&]+)/.exec(window.location.href);
    if (playlistJson != null) {
        playlistJson=unescape(playlistJson[1]);
        console.log("> Found playlist json: " + playlistJson);
        videoPlayerElements = document.childNodes;
        GM.xmlHttpRequest({
            method: "GET",
            url: playlistJson,
            onload: function(response) {
                var jsonUrl = JSON.parse(response.responseText);
                //check whether exists a valid entry
                if(typeof jsonUrl["videos"]!=="undefined" && typeof jsonUrl["videos"][0]!=="undefined") {
                    jsonUrl = jsonUrl["videos"][0]["jsonUrl"];
                    jsonUrl = jsonUrl.replace(/\\/g, ''); // remove backslashes from the URL
                    parsePlayerJson(jsonUrl, videoPlayerElements[0], 0);
                }
            }
        });
        nbVideoPlayers = videoPlayerElements.length;
        return true;
    } else {
        // Check regular tags
        for (var tag in videoPlayerClass) {
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

    for (var q in qualities[videoElementIndex]) {
        videoUrl = getVideoUrl(videoElementIndex, q, language);
        if (videoUrl !== '') {
            break;
        }
    }

    // Check if video exists
    if (videoUrl === null) {
        console.log("Could not find video feed");
        return null;
    }

    // Check HTTP
    if (nbHTTP[videoElementIndex] > 0 && videoUrl.substring(videoUrl.length - 4, videoUrl.length) === ".mp4") {
        button.innerHTML = "<strong>Download video </strong><span class='icomoon-angle-down force-icomoon-font'></span>";
    }

    // Check HTTP Live Stream
    else if (nbHLS[videoElementIndex] > 0 && videoUrl.substring(videoUrl.length - 5, videoUrl.length === ".m3u8")) {
        button.innerHTML = "Copy this link > Open <a style='text-decoration: underline;' href='https://www.videolan.org/vlc/'>VLC</a> > CTRL+R > Network > CTRL+V > <strong>Convert/Save video.</strong> <span class='icomoon-angle-down force-icomoon-font'></span>";
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
    var subtitle = playerJson[videoElementIndex].videoJsonPlayer.VSU;
    var description_short = playerJson[videoElementIndex].videoJsonPlayer.V7T;
    var description = playerJson[videoElementIndex].videoJsonPlayer.VDE;
    var tags = playerJson[videoElementIndex].videoJsonPlayer.VTA;

    // Continue if at least one field is filled
    if (title !== undefined || description_short !== undefined || subtitle !== undefined || description !== undefined || tags !== undefined) {
        var button = document.createElement('a');
        button.setAttribute('class', 'btn btn-default');
        button.setAttribute('style', 'line-height: 17px; margin-left:10px; text-align: center; padding: 10px; color:rgb(40, 40, 40);  background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px;');
        button.innerHTML = "Download description <span class='icomoon-angle-down force-icomoon-font'></span>";
        var metadata = (title !== undefined ? "[Title]\n" + title:'')
            + (subtitle !== undefined ? "\n\n[Subtitle]\n" + subtitle:'')
            + (description_short !== undefined ? "\n\n[Description-short]\n" + description_short:'')
            + (description !== undefined ? "\n\n[Description]\n" + description:'')
            + (tags !== undefined ? "\n\n[Tags]\n" + tags:'');
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
    for (var l in languages[videoElementIndex]) {
        if (languages[videoElementIndex][l] !== 0) {
            languageComboBox.innerHTML += "<option value='" + l + "'>" + languages[videoElementIndex][l] + "</option>";
        }
    }
    languageComboBox.setAttribute('class', 'btn btn-default');
    languageComboBox.setAttribute('style', (languageComboBox.innerHTML === "" ? "visibility:hidden;" : "max-width: 160px; padding: 6px; color:rgb(40, 40, 40); background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px; font-weight: 400;"));
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
    for (var q in qualities[videoElementIndex]) {
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
    credits.setAttribute('style', 'text-align: center; line-height: 20px; font-size: 11.2px; color: rgb(255, 255, 255); font-family: ProximaNova, Arial, Helvetica, sans-serif; padding: 5px; background:#262626');
    credits.innerHTML = 'Arte Downloader v.' + scriptVersion + ' built by and for the community with love' +
        '<br /><a style=\'color:rgb(255, 255, 255);\' href="https://github.com/GuGuss/ARTE-7-Downloader">Contribute Here.</a>';
    return credits;
}

function decoratePlayer360(videoElement, videoURL, videoName) {
    var container = document.createElement('div');
    insertAfter(container, videoElement);
    container.setAttribute('class', 'ArteDownloader-v' + scriptVersion)
    container.setAttribute('style', 'background:#262626; padding: 10px;');
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
    var container = document.createElement('div');
    var parent = videoElement.parentNode;

    // decorate iframe from embedment
    if (window.frameElement !== null) {
        parent = window.parent.document.querySelector('div.video-embed');
        setTimeout(function(){ insertAfter(container, parent); }, 2000);
    } else {
        // decorate iframe from top window
        if (videoElement.nodeName === "IFRAME") {
            console.log("> Decorating iFrame player");
            parent = document.querySelector('div.video-embed');
            if ( parent == null ) {
                parent = document.querySelector('div.article-video');
                if ( parent == null ) {
                    console.error("> Could not find a parent to decorate.");
                }
            }
            setTimeout(function(){ insertAfter(container, parent); }, 2000);
        }
    }
    container.setAttribute('class', 'ArteDownloader-v' + scriptVersion)
    container.setAttribute('style', 'background:#262626; padding: 10px;');

    // Create video name span
    var videoNameSpan = document.createElement('span');
    var subtitle = playerJson[videoElementIndex].videoJsonPlayer.VSU;
    videoNameSpan.innerHTML = "<strong>" + getVideoName(videoElementIndex) + (subtitle !== undefined ? " - " + subtitle : "") + "</strong><br/>";
    videoNameSpan.setAttribute('style', 'margin-top:10px; text-align: center; color:rgb(255, 255, 255); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 16px;');
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

    // Create credits ribbon
    var credits = createCreditsElement();
    container.appendChild(credits);

    // Workaround decoration overlapping next SECTION
    var parentSection = getParent(parent, 'SECTION', 'margin-bottom-s');
    parentSection.style.marginBottom = "9rem";
}

is_playlist = findPlayers();
console.log("> Found " + nbVideoPlayers + " video player(s):");
if (nbVideoPlayers > 0) {
    // Init global vars
    playerJson = [nbVideoPlayers];
    nbVideos = [nbVideoPlayers];
    nbHTTP = [nbVideoPlayers];
    nbHLS = [nbVideoPlayers];
    languages = [nbVideoPlayers];
    qualities = [nbVideoPlayers];
    for (i = 0; i < nbVideoPlayers; i++) {
        playerJson[i] = 0;
        nbVideos[i] = 0;
        nbHTTP[i] = 0;
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
