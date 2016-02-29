// ==UserScript==
// @name        Arte+7 Downloader
// @namespace   GuGuss
// @description Download videos or get stream link of ARTE programs in the selected language.
// @include     http://*.arte.tv/*
// @version     2.5
// @updateURL   https://github.com/GuGuss/ARTE-7-Playground/blob/master/arte-downloader.user.js
// @grant       GM_xmlhttpRequest
// @grant       GM_setValue
// @grant       GM_getValue
// @icon        http://www.arte.tv/favicon.ico
// ==/UserScript==

/*
    Arte-Downloader decorates videos from : 

    - Arte live: http://www.arte.tv/guide/fr/direct
    - Arte +7: http://www.arte.tv/guide/fr/057458-000/albert-einstein-portrait-d-un-rebelle
    - Arte info: http://info.arte.tv/fr/videos?id=71611    
    - Arte info Story: http://www.arte.tv/sites/fr/story/reportage/areva-uramin-bombe-a-retardement-du-nucleaire-francais/#fitvid0
    - Arte info royal slider:
        > #1: http://info.arte.tv/fr/letat-durgence-un-patriot-act-la-francaise
        > #2: http://info.arte.tv/fr/interview-de-jerome-fritel        
    - Arte info journal tiles: http://info.arte.tv/fr/emissions/arte-journal
    - Arte Info Touslesinternets: http://touslesinternets.arte.tv/inakba-la-seconde-vie-des-villages-palestiniens-disparus/
    - Arte future: http://future.arte.tv/fr/ilesdufutur/les-iles-du-futur-la-serie-documentaire
    - Arte future embedded : http://future.arte.tv/fr/polar-sea-360deg-les-episodes    
    - Arte Future 360: http://future.arte.tv/fr/5-metres-une-plongee-360deg-sur-votre-ordinateur (powered by http://deep-inc.com/)
    - Arte creative: http://creative.arte.tv/fr/episode/bonjour-afghanistan
    - Arte Concert: http://concert.arte.tv/fr/documentaire-dans-le-ventre-de-lorgue-de-notre-dame
    - Arte Concert Tape: http://concert.arte.tv/fr/tape-etienne-daho
    - Arte Cinema: http://cinema.arte.tv/fr/program/jude
    - Arte Cinema embedded: http://cinema.arte.tv/fr/article/tirez-la-langue-mademoiselle-daxelle-ropert-re-voir-pendant-7-jours
    - Arte Tracks: http://tracks.arte.tv/fr/nicolas-winding-refn-soyez-sympas-rembobinez
    - Arte Tracks bonus: http://tracks.arte.tv/fr/mickey-mouse-tmr-en-remix-3d
    - Arte vp: http://www.arte.tv/arte_vp/index.php?json_url=https%3A%2F%2Fapi.arte.tv%2Fapi%2Fplayer%2Fv1%2Fconfig%2Ffr%2F066698-000-A%3Fplatform%3DEXTERNAL%26autostart%3D0%26infoLink%3D%26primaryAudioVersion%3D&amp;lang=fr_FR&amp;config=arte_external
    
    @TODO
    - Arte cinema magazine decoration: http://cinema.arte.tv/fr/magazine/blow-up
    - Arte cinema: http://cinema.arte.tv/fr
    - Arte creative decoration: http://creative.arte.tv/fr/starwars-retourenforce
*/

/* --- GLOBAL VARIABLES --- */
var scriptVersion = "2.5";
var player = [];
var nbVideoPlayers = 0;
var playerJson;
var nbVideos;
var nbHTTP;
var nbRTMP;
var nbHLS;
var availableLanguages;
var availableQualities;
var videoPlayerElements;

var videoPlayerClass = {
    'live': 'arte_vp_live-url',
    'live-oembed': 'arte_vp_live-url-oembed',
    '+7': 'arte_vp_url',
    'oembed': 'arte_vp_url_oembed',
    'generic': 'data-url',
    'teaser': 'data-teaser-url'
};

var videoPlayerClassEmbedded = {
    'story': 'embed.embed--delay iframe',
    'embedded': 'media_embed iframe'
};

var qualityCode = {
    'SQ': '720p (2200 kbps)',
    'EQ': '406p (1500 kbps)',
    'HQ': '406p (800 kbps)',
    'MQ': '216p (300 kbps)'
};

// Reference languages object 'versionCode':'language'
var languages = {
    // VO
    'VO': 'Original',
    'VO-STF': 'Original subtitled in french',
    'VO-STA': 'Original subtitled in german',
    'VO-STE[ANG]': 'Original subtitled in english',
    'VO-STE[ESP]': 'Original subtitled in spanish',

    // VOF
    'VOF': 'Original in french',
    'VOF-STF': 'Original in french subtitled',
    'VOF-STA': 'Original in french subtitled in german',
    'VOF-STE[ANG]': 'Original in french subtitled in english',
    'VOF-STE[ESP]': 'Original in french subtitled in spanish',
    'VOF-STMF': 'Original in french for hearing impaired',

    // VOA
    'VOA': 'Original in german',
    'VOA-STMA': 'Original in german for hearing impaired',
    'VOA-STA': 'Original in german subtitled',
    'VOA-STF': 'Original in german subtitled in french',
    'VOA-STE[ANG]': 'Original in german subtitled in english',
    'VOA-STE[ESP]': 'Original in german subtitled in spanish',

    // VF
    'VF': 'French dubbed',
    'VF-STF': 'French dubbed subtitled',
    'VF-STMF': 'French dubbed for hearing impaired',
    'VFAUD': 'French with audio description',

    // VA
    'VA': 'German dubbed',
    'VA-STA': 'German dubbed subtitled',
    'VA-STMA': 'German dubbed for hearing impaired',
    'VAAUD': 'German with audio description',

    // Live
    'liveFR': 'Live french',
    'liveDE': 'Live german'
};



/* --- FUNCTIONS: utilities --- */
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
        while (parent.nodeName !== "BODY"
                && nbNodeIteration < nbNodeIterationMax
                && hasClass(parent, classString) === false) {
            nbNodeIteration++;
            parent = parent.parentNode;
        }
    }

        // with defined node type
    else {
        console.log("> Looking for a <" + nodeName + " class='" + classString + "'> parent node");
        while (parent.nodeName !== "BODY"
                && nbNodeIteration < nbNodeIterationMax
                && (parent.nodeName !== nodeName.toUpperCase() || hasClass(parent, classString) === false)) {
            nbNodeIteration++;
            parent = parent.parentNode;
        }
    }
    return parent;
}



/* --- FUNCTIONS: decorating --- */
function addLanguage(videoElementIndex, language) {
    if (availableLanguages[videoElementIndex][language] === 0) {
        availableLanguages[videoElementIndex][language] = languages[language];
    }
}

function addQuality(videoElementIndex, quality) {
    if (availableQualities[videoElementIndex][quality] === 0) {
        availableQualities[videoElementIndex][quality] = qualityCode[quality];
    }
}

function preParsePlayerJson(videoElementIndex) {
    if (playerJson[videoElementIndex]) {
        var videos = Object.keys(playerJson[videoElementIndex]["videoJsonPlayer"]["VSR"]);
        nbVideos[videoElementIndex] = videos.length;
        var video = null;
        var langTags = "";

        // Loop through all videos URLs.
        for (var key in videos) {
            video = playerJson[videoElementIndex]["videoJsonPlayer"]["VSR"][videos[key]];

            // Check if video format or media type
            if (video["videoFormat"] === "HBBTV" || video["mediaType"] === "mp4") {
                nbHTTP[videoElementIndex]++;
            }
            else if (video["videoFormat"] === "RMP4" || video["mediaType"] === "rtmp") {
                nbRTMP[videoElementIndex]++;
            }
            else if (video["videoFormat"] === "M3U8" || video["mediaType"] === "hls") {
                nbHLS[videoElementIndex]++;
            }

            // Add to available languages
            addLanguage(videoElementIndex, video["versionCode"]);

            // Check if it's a new lang tag
            if (languages[video["versionCode"]] === undefined) {
                langTags += " | " + video["versionCode"];
            }

            // Add to available qualities
            var quality = (video["VQU"] !== undefined ? video["VQU"] : video["quality"]);
            addQuality(videoElementIndex, quality);
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
        console.log("> Languages:" + languagesFound + (langTags !== "" ? "\n\n    ! Unreferenced tags: " + langTags : ""));
    }
}

function createButtonDownload(videoElementIndex, language) {
    var button = document.createElement('a');
    var videoUrl;

    for (q in qualityCode) {
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
        button.innerHTML = "<a href='https://en.wikipedia.org/wiki/HTTP_Live_Streaming'> Apple Quicktime > open HLS stream</a><span class='icomoon-angle-down force-icomoon-font'></span>";
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
        var url = getVideoUrl(videoElementIndex, selectedQuality, selectedLanguage);
        if (url !== '') {
            btn.style.visibility = "visible";
            btn.setAttribute('href', url);
        } else {
            btn.style.visibility = "hidden";
        }
    };

    // Fill with available languages
    for (l in availableLanguages[videoElementIndex]) {
        if (availableLanguages[videoElementIndex][l] !== 0) {
            languageComboBox.innerHTML += "<option value='" + l + "'>" + availableLanguages[videoElementIndex][l] + "</option>";
        }
    }
    languageComboBox.setAttribute('class', 'btn btn-default');
    languageComboBox.setAttribute('style', (languageComboBox.innerHTML === "" ? "visibility:hidden;" : "width:140px; padding: 6px; color:rgb(40, 40, 40); background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px; font-weight: 400;"));
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
        var url = getVideoUrl(videoElementIndex, selectedQuality, selectedLanguage);
        if (url !== '') {
            btn.style.visibility = "visible";
            btn.setAttribute('href', url);
        } else {
            btn.style.visibility = "hidden";
        }
    };

    // Fill with available qualities
    for (q in availableQualities[videoElementIndex]) {
        if (availableQualities[videoElementIndex][q] !== 0) {
            qualityComboBox.innerHTML += "<option value='" + q + "'>" + availableQualities[videoElementIndex][q] + "</option>";
        }
    }
    qualityComboBox.setAttribute('class', 'btn btn-default');
    qualityComboBox.setAttribute('style', 'width:140px; padding: 6px; margin-left:10px; color:rgb(40, 40, 40); background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px; font-weight: 400;');
    return qualityComboBox;
}

function createCreditsElement() {
    var credits = document.createElement('div');
    credits.setAttribute('style', 'text-align: center; line-height: 20px; font-size: 11.2px; color: rgb(255, 255, 255); font-family: ProximaNova, Arial, Helvetica, sans-serif; padding: 5px; background-image:url("data:image/gif;base64,R0lGODlhAwADAIAAAMhFJuFdPiH5BAAAAAAALAAAAAADAAMAAAIERB5mBQA7")');
    credits.innerHTML = 'Arte Downloader v.' + scriptVersion + ' built by and for the community with love'
                    + '<br /><a style=\'color: #020202;\' href="https://github.com/GuGuss/ARTE-7-Downloader">Contribute Here.</a>';
    return credits;
}

function decoratePlayer(videoElement, videoElementIndex) {
    var parent;
    var bRoyalSlider = false;
    var container = document.createElement('div');

    // Look for the parent to decorate
    parent = videoElement.parentNode;

    // iframe player
    if (videoElement.nodeName === "IFRAME") {
        console.log("> Decorating iFrame player");

        // Arte touslesinternets
        if (stringStartsWith(window.location.href, "http://touslesinternets.arte")) {
            parent.insertBefore(container, videoElement);
        }

        else {
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
    else if (stringStartsWith(location.href, "http://cinema.arte")
        || (parent.parentNode.getAttribute('id') === "embed_widget")) {

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

function parsePlayerJson(playerJsonUrl, videoElement, videoElementIndex) {
    console.log("    - #" + videoElementIndex + " player JSON: " + playerJsonUrl);
    GM_xmlhttpRequest({
        method: "GET",
        url: playerJsonUrl,
        onload: function (response) {
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
            if (video["versionCode"] === language
                && (video["videoFormat"] === "HBBTV" || video["mediaType"] === "mp4")
                && (video["VQU"] === quality || video["quality"] === quality)) {
                console.log("> " + quality + " MP4 in " + language + ": " + video["url"]);
                return video["url"];
            }
        }
    }

    // Search RTMP streams
    if (nbRTMP[videoElementIndex] > 0) {
        for (var key in videos) {
            var video = playerJson[videoElementIndex]["videoJsonPlayer"]["VSR"][videos[key]];
            if ((video["versionCode"] === language || language === undefined)
                    && (video["VQU"] === quality || video["quality"] === quality)
                    && (video["videoFormat"] === "RMP4" || video["mediaType"] === "rtmp")
                ) {
                var url = video["streamer"] + video["url"];
                console.log("> " + quality + " RTMP stream: " + url);
                return url;
            }
        }
    }

    // Search HLS streams (should not at that point, but we never know)
    if (nbHLS[videoElementIndex] > 0) {
        for (var key in videos) {
            var video = playerJson[videoElementIndex]["videoJsonPlayer"]["VSR"][videos[key]];
            if ((video["videoFormat"] === "M3U8" || video["mediaType"] === "hls") && (video["VQU"] === quality || video["quality"] === quality)) {
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
            onload: function (response) {
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
            // Find the 360 video in the URL
            console.log("> Searching a 360 video for " + playerUrl);
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
                            container.setAttribute('class', 'ArteDownloader-v' + scriptVersion)
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

        // Check if player URL is the json
    else if (playerUrl.substring(playerUrl.length - 6, playerUrl.length - 1) === ".json") {
        parsePlayerJson(playerUrl, videoElement, videoElementIndex);
    }

        // Look for player URL inside the player json
    else {
        GM_xmlhttpRequest({
            method: "GET",
            url: playerUrl,
            onload: function (response) {
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
    // Check regular tags
    for (tag in videoPlayerClass) {
        videoPlayerElements = document.querySelectorAll("div[" + videoPlayerClass[tag] + "]");
        if (videoPlayerElements.length > 0) {
            break;
        }
    }

    // Check embedded tags
    if (videoPlayerElements.length === 0) {
        for (tag in videoPlayerClassEmbedded) {
            videoPlayerElements = document.querySelectorAll("div." + videoPlayerClassEmbedded[tag]);
            if (videoPlayerElements.length > 0) {
                break;
            }
        }
    }

    // Check iframe
    if (videoPlayerElements.length === 0) {
        videoPlayerElements = document.querySelectorAll("iframe[arte-video]");

        // Check 360 (no tags yet)
        if (videoPlayerElements.length === 0) {
            videoPlayerElements = document.querySelectorAll("iframe");
        }
    }

    // Check arte_vp with no parent frame
    if (videoPlayerElements.length === 0 && stringStartsWith(unescape(top.location), "http://www.arte.tv/arte_vp/")) {
        videoPlayerElements = document.querySelectorAll("body");
    }

    nbVideoPlayers = videoPlayerElements.length;
    console.log("> Found " + nbVideoPlayers + " video player(s):");
}

// Returns a struct, given member names
function makeStruct(membersName) {
    var members = membersName.split(' ') // members names are separated with spaces

    function constructor() {
        for (var i = 0; i < members.length; i++) {

        }
    }
}

function init() {
    playerJson = new Array(nbVideoPlayers);
    nbVideos = new Array(nbVideoPlayers);
    nbHTTP = new Array(nbVideoPlayers);
    nbRTMP = new Array(nbVideoPlayers);
    nbHLS = new Array(nbVideoPlayers);
    availableLanguages = new Array(nbVideoPlayers);
    availableQualities = new Array(nbVideoPlayers);
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

        // Clone available qualities from base object
        availableQualities[i] = Object.assign({}, qualityCode);

        // Resets available qualities
        for (l in availableQualities[i]) {
            availableQualities[i][l] = 0;
        }
    }

    //player.push({ playerJson, })
}



/* --- MAIN SCRIPT ENTRY --- */
main();
function main() {
    findPlayers();
    if (nbVideoPlayers > 0) {
        init();

        // Parse each video player
        for (var i = 0; i < nbVideoPlayers; i++) {
            findPlayerJson(videoPlayerElements[i], i);
        }
    }
}
