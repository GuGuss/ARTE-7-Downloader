// ==UserScript==
// @name        Arte+7 Downloader
// @description Download videos or get stream link of ARTE programs in the selected language.
// @include     *//*.arte.tv/*
// @updateURL   https://github.com/GuGuss/ARTE-7-Downloader/raw/master/arte-downloader.user.js
// @icon        https://www.arte.tv/favicon.ico
// ==/UserScript==

/* --- GLOBAL VARIABLES --- */
let scriptVersion = 3.1;
let playerJson;
let nbVideos;
let nbHTTP;
let nbHLS;
let languages;
let qualities;


/* --- FUNCTIONS: utilities --- */
function getURLParameter(url, name) {
    return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(url) || [, ""])[1].replace(/\+/g, '%20')) || null;
}

function insertAfter(newNode, referenceNode) {
    if (referenceNode.parentNode == null) {
        referenceNode.insertBefore(newNode, referenceNode.nextSibling);
    } else {
        referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
    }
}

function stringStartsWith(string, prefix) {
    return string.slice(0, prefix.length) === prefix;
}

function hasClass(element, cls) {
    return (' ' + element.className + ' ').indexOf(' ' + cls + ' ') > -1;
}

// Get a parent node of the chosen type and class
function getParent(nodeReference, nodeName, classString) {
    let parent = nodeReference;
    let nbNodeIteration = 0;
    let nbNodeIterationMax = 10;

    // any node
    if (nodeName === '') {
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
               parent.parentNode !== null &&
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
        let videos = Object.keys(playerJson[videoElementIndex].videoJsonPlayer.VSR);
        nbVideos[videoElementIndex] = videos.length;

        // Loop through all videos URLs.
        for (let key in videos) {
            let video = playerJson[videoElementIndex].videoJsonPlayer.VSR[videos[key]];

            // Check if video format or media type
            if (video.videoFormat === "HBBTV" || video.mediaType === "mp4") {
                nbHTTP[videoElementIndex]++;
            } else if (video.videoFormat === "M3U8" || video.mediaType === "hls") {
                nbHLS[videoElementIndex]++;
            }

            addLanguage(videoElementIndex, video.versionCode, video.versionLibelle);
            addQuality(videoElementIndex, (
                video.VQU !== undefined ? video.VQU : video.quality),
                video.height ? video.height
                    + "p@" + Math.round(video.bitrate /1000*10) /10 + "Mbps (" // convert kbps > Mbps
                    + Math.round(video.bitrate *1000/8/1024) + "kB/s)"         // convert kbps > kB/s
                    : video.quality);
        }

        // Remove Apple HLS if HTTP available
        if (nbHTTP[videoElementIndex] > 0) {
            delete qualities[videoElementIndex].XS;
            delete qualities[videoElementIndex].XQ;
        }

        // Reorder qualities
        let sortedKeys = Object.keys(qualities[videoElementIndex]).sort(
            function(a, b) {
                // array of sorted keys
                return qualities[videoElementIndex][b].split('@')[1].split('M')[0] * 1 - qualities[videoElementIndex][a].split('@')[1].split('M')[0] * 1;
            }
        );

        // Create new object to rearrange qualities according to new key order
        let temp = new Object;
        for (let i = 0; i < sortedKeys.length; i++) {
            temp[sortedKeys[i]] = qualities[videoElementIndex][sortedKeys[i]];
        }
        qualities[videoElementIndex] = temp; // replace with new ordered object

        // Display preparse info
        console.log("\n====== player #" + videoElementIndex+1 + " ======\n> " +
            nbVideos[videoElementIndex] + " formats: " + nbHTTP[videoElementIndex] + " MP4 videos | " + nbHLS[videoElementIndex] + " streams.");
        let languagesFound = "";
        for (let l in languages[videoElementIndex]) {
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
    let name = playerJson[videoElementIndex].videoJsonPlayer.VTI;
    if (name === null) {
        name = playerJson[videoElementIndex].videoJsonPlayer.VST.VNA;
        if (name === null) {
            return "undefined";
        }
    }
    name = name.split('_').join(' ');
    return name.charAt(0).toUpperCase() + name.slice(1);
}

function getVideoUrl(videoElementIndex, quality, language) {
    // Get videos object
    let videos = Object.keys(playerJson[videoElementIndex].videoJsonPlayer.VSR);

    // Check if there are HTTP videos
    if (nbHTTP[videoElementIndex] > 0) {

        // Loop through all videos URLs.
        for (let key in videos) {
            let video = playerJson[videoElementIndex].videoJsonPlayer.VSR[videos[key]];

            // Check language, format, quality
            if (video.versionCode === language &&
                (video.videoFormat === "HBBTV" || video.mediaType === "mp4") &&
                (video.VQU === quality || video.quality === quality)) {
                console.log("> " + quality + " MP4 in " + language + ": " + video.url);
                return video.url;
            }
        }
    }

    // Search HLS streams
    if (nbHLS[videoElementIndex] > 0) {
        for(let key in videos) {
            let video = playerJson[videoElementIndex].videoJsonPlayer.VSR[videos[key]];
            if (
                (video.videoFormat === "M3U8" || video.mediaType === "hls") &&
                (video.VQU === quality || video.quality === quality) &&
                video.versionCode === language
            ) {
                console.log("> HLS stream: " + video.url);
                return video.url;
            }
        }
    }

    console.log("> Video not found.")
    return '';
}

function findPlayerJson(videoElement, videoElementIndex) {
    // Get player URL to find its associated json
    let playerUrl = null;
    let jsonUrl = null;

    // iframe embedded media
    if (playerUrl === null) {
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
            xmlHttpRequest({
                method: "GET",
                url: playerUrl,
                onload: response => {
                    var doc = response.responseText;
                    var videoName, videoURL;
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
        xmlHttpRequest({
            method: "GET",
            url: playerUrl,
            onload: response => {
                let json = JSON.parse(response.responseText);
                playerUrl = json["videoJsonPlayer.videoPlayerUrl"];
                if (playerUrl !== undefined) {
                    parsePlayerJson(playerUrl, videoElement, videoElementIndex);
                } else {
                    console.error("Couldn't find a player URL.");
                }
            }
        });
    }
}

function initParsingSystem(nbVideoPlayers) {
    if (nbVideoPlayers > 0) {
        console.log("> Found " + nbVideoPlayers + " video player" + (nbVideoPlayers > 1 ? 's':''));
        playerJson = [nbVideoPlayers];
        nbVideos = [nbVideoPlayers];
        nbHTTP = [nbVideoPlayers];
        nbHLS = [nbVideoPlayers];
        languages = [nbVideoPlayers];
        qualities = [nbVideoPlayers];
        for (let i = 0; i < nbVideoPlayers; i++) {
            playerJson[i] = 0;
            nbVideos[i] = 0;
            nbHTTP[i] = 0;
            nbHLS[i] = 0;
            languages[i] = new Object;
            qualities[i] = new Object;
        }
    }
}

/*
===========
ENTRY POINT
===========
*/
(function findPlayers() {
    console.log('\n===== ARTE DOWNLOADER v' + scriptVersion + ' started =====');
    // Look up inline scripts to find highlight of the day playlist
    /*let scripts = document.querySelectorAll("script");
    if (scripts !== undefined) {
        let matchStringStart = "window.__INITIAL_STATE__ = ";
        let matchStringEnd = "}}}}";
        for(let i=0; i < scripts.length; i++) {
            let str = scripts[i].innerHTML.trim();
            if (str.startsWith(matchStringStart)) {
                str = str.split(matchStringStart)[1].split(matchStringEnd)[0] + matchStringEnd;
                let inlineJson = JSON.parse(str);
                inlineJson = inlineJson.pages.list["LIVE_fr_{}"].zones;
                if (inlineJson[0].code.name == "today_guide_LIVE") {
                    inlineJson = inlineJson[0].data;
                    console.log(inlineJson);
                }
            }
        }
    }*/

    // Check playlist
    let playlistJson = /playlist_url=([^&]+)/.exec(window.location.href);
    if (playlistJson != null) {
        playlistJson = unescape(playlistJson[1]);
        console.log("> Found playlist json: " + playlistJson);

        // Fetch playlist json
        window.fetch(playlistJson).then(resp => resp.json()).then( jsonUrl => {
            // Check for valid entry
            if(typeof jsonUrl.videos !== "undefined" && typeof jsonUrl.videos[0] !== "undefined") {
                let total = jsonUrl.videos.length;
                initParsingSystem(total);
                for (let i = 0; i < total; i++) {
                    let videoJsonUrl = jsonUrl.videos[i].jsonUrl;
                    videoJsonUrl = videoJsonUrl.replace(/\\/g, ''); // remove backslashes from the URL
                    parsePlayerJson(videoJsonUrl, document, i); // document shall be the inner player iframe
                }

                // Wait recursively for each video downloaders to be created
                let playlistSelector;
                (function fetchDownloaders (i) {
                    let videoDownloaders;
                    setTimeout( () => {
                        videoDownloaders = parent.document.querySelectorAll('div[id^=video_]');

                        // when each have been created
                        if (videoDownloaders.length == total) {

                            // Create a playlist selector
                            console.log("\n===== PLAYLIST ======");
                            console.log("> Creating playlist selector.");
                            let container = document.createElement('div');
                            let span = document.createElement('span');
                            span.innerHTML = '<strong>Select video to download</strong>';
                            span.setAttribute('style', "margin-top: 10px; padding: 10px; max-width: 720px; color:white; font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 16px;");
                            container.appendChild(span);
                            let cbVideoSelector = document.createElement('select');
                            container.appendChild(cbVideoSelector);
                            cbVideoSelector.setAttribute('id', 'playlistSelector');
                            cbVideoSelector.setAttribute('style', "margin-top: 10px; padding: 10px; max-width: 720px;");
                            cbVideoSelector.onchange = () => {
                                // hide others
                                parent.document.querySelectorAll('div[id^=video_]').forEach( el => {
                                    el.style.visibility = "hidden";
                                    el.style.height = "0px";
                                    el.style.padding = "0px";
                                    el.style.margin = "0px";
                                    el.style.lineHeight = "0px";
                                    el.style.visibility = "hidden"
                                });

                                let selection = cbVideoSelector.options[cbVideoSelector.selectedIndex].value;
                                let downloader = parent.document.getElementById(selection);
                                downloader.style.visibility = "visible";
                                downloader.style.height = "7rem";
                                downloader.style.padding = "10px";
                                downloader.style.margin = "10px";
                                downloader.style.lineHeight = "1.5";
                                insertAfter(downloader, cbVideoSelector);
                                console.log("> Selected downloader for " + selection);
                            };

                            // Hide each downloader to only display the current selected by the playlist selector
                            videoDownloaders.forEach( (el, i) => {
                                el.style.visibility = "hidden";
                                el.style.height = "0px";
                                el.style.padding = "0px";
                                el.style.margin = "0px";
                                el.style.lineHeight = "0px";
                                el.style.visibility = "hidden"
                                let id = "video_" + i;
                                cbVideoSelector.innerHTML += "<option value='" + id + "'>" + parent.document.getElementById(id).firstChild.firstChild.innerHTML + "</option>";
                            });
                            videoDownloaders[0].parentNode.insertBefore(container, videoDownloaders[0]);
                        } else {
                            if (--i) {
                                fetchDownloaders(i);
                            } else {
                                console.log("===== PLAYLIST ======");
                                if (videoDownloaders.length !== total) {
                                    console.warn("Not every video downloaders were created: " + videoDownloaders.length + "/" + total);
                                }
                            }
                        }
                    }, 1000)
                })(10);
            }
        });
    }

    // else deal w/ single video players
    else {
        let playerIframes = document.querySelectorAll("iframe");
        initParsingSystem(playerIframes.length);
        for (let i = 0; i < playerIframes.length; i++) {
            findPlayerJson(playerIframes[i], i);
        }
    }
})();

/* --- FUNCTIONS: decorating --- */
function createButtonDownload(videoElementIndex, language) {
    let button = document.createElement('a');
    let videoUrl;

    for (let q in qualities[videoElementIndex]) {
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
        console.error('Unknown URL format');
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
    let title = getVideoName(videoElementIndex);
    let subtitle = playerJson[videoElementIndex].videoJsonPlayer.VSU;
    let description_short = playerJson[videoElementIndex].videoJsonPlayer.V7T;
    let description = playerJson[videoElementIndex].videoJsonPlayer.VDE;
    let tags = playerJson[videoElementIndex].videoJsonPlayer.VTA;

    // Continue if at least one field is filled
    if (title !== undefined || description_short !== undefined || subtitle !== undefined || description !== undefined || tags !== undefined) {
        let button = document.createElement('a');
        button.setAttribute('class', 'btn btn-default');
        button.setAttribute('style', 'line-height: 17px; margin-left:10px; text-align: center; padding: 10px; color:rgb(40, 40, 40);  background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px;');
        button.innerHTML = "Download description <span class='icomoon-angle-down force-icomoon-font'></span>";
        let metadata = (title !== undefined ? "[Title]\n" + title:'')
            + (subtitle !== undefined ? "\n\n[Subtitle]\n" + subtitle:'')
            + (description_short !== undefined ? "\n\n[Description-short]\n" + description_short:'')
            + (description !== undefined ? "\n\n[Description]\n" + description:'')
            + (tags !== undefined ? "\n\n[Tags]\n" + tags:'');
        let encodedData = window.btoa(unescape(encodeURIComponent(metadata)));
        button.setAttribute('href', 'data:application/octet-stream;charset=utf-8;base64,' + encodedData);
        button.setAttribute('download', getVideoName(videoElementIndex) + '.txt');
        return button;
    } else {
        return null;
    }
}

function getComboboxSelectedValue(combobox) {
    let cb = document.getElementById(combobox);
    if (cb == null) {
        cb = parent.document.getElementById(combobox);
    }
    return cb[cb.selectedIndex].value;
}

function getDownloadButton(index) {
    let btn = document.getElementById('btnDownload' + index);
    if (btn == null) {
        btn = parent.document.getElementById('btnDownload' + index);
    }
    return btn;
}

function createLanguageComboBox(videoElementIndex) {
    let languageComboBox = document.createElement('select');
    languageComboBox.setAttribute('id', 'cbLanguage' + videoElementIndex);

    // Associate onchange event with function (bypass for GM)
    languageComboBox.onchange = () => {
        let selectedLanguage = languageComboBox.options[languageComboBox.selectedIndex].value;
        console.log("\n> Language changed to " + selectedLanguage);
        let btn = getDownloadButton(videoElementIndex);
        let selectedQuality = getComboboxSelectedValue('cbQuality' + videoElementIndex);
        let url = getVideoUrl(videoElementIndex, selectedQuality, selectedLanguage);
        if (url !== '') {
            btn.style.visibility = "visible";
            btn.setAttribute('href', url);
        } else {
            btn.style.visibility = "hidden";
        }
    };

    // Fill with available languages
    for (let l in languages[videoElementIndex]) {
        if (languages[videoElementIndex][l] !== 0) {
            languageComboBox.innerHTML += "<option value='" + l + "'>" + languages[videoElementIndex][l] + "</option>";
        }
    }
    languageComboBox.setAttribute('class', 'btn btn-default');
    languageComboBox.setAttribute('style', (languageComboBox.innerHTML === "" ? "visibility:hidden;"
                                            : "max-width: 160px; padding: 6px; color:rgb(40, 40, 40); background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px; font-weight: 400;"));
    return languageComboBox;
}

function createQualityComboBox(videoElementIndex) {
    let qualityComboBox = document.createElement('select');
    qualityComboBox.setAttribute('id', 'cbQuality' + videoElementIndex);

    // Associate onchange event with function (bypass for GM)
    qualityComboBox.onchange = () => {
        let selectedQuality = qualityComboBox.options[qualityComboBox.selectedIndex].value;
        console.log("\n> Quality changed to " + selectedQuality);
        let btn = document.getElementById('btnDownload' + videoElementIndex);
        if (btn == null) {
            btn = parent.document.getElementById('btnDownload' + videoElementIndex);
        }
        let selectedLanguage = getComboboxSelectedValue('cbLanguage' + videoElementIndex);
        console.log(selectedLanguage);
        let url = getVideoUrl(videoElementIndex, selectedQuality, selectedLanguage);
        if (url !== '') {
            btn.style.visibility = "visible";
            btn.setAttribute('href', url);
        } else {
            console.log("Video not found for these settings!")
            btn.style.visibility = "hidden";
        }
    };

    // Fill with available qualities
    for (let q in qualities[videoElementIndex]) {
        if (qualities[videoElementIndex][q] !== 0) {
            qualityComboBox.innerHTML += "<option value='" + q + "'>" + qualities[videoElementIndex][q] + "</option>";
        }
    }
    qualityComboBox.setAttribute('class', 'btn btn-default');
    qualityComboBox.setAttribute('style', 'width:200px; padding: 6px; margin-left:10px; color:rgb(40, 40, 40); background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px; font-weight: 400;');
    return qualityComboBox;
}

function createCreditsElement() {
    let credits = document.createElement('div');
    credits.setAttribute('style', 'text-align: center; line-height: 20px; font-size: 11.2px; color: rgb(255, 255, 255); font-family: ProximaNova, Arial, Helvetica, sans-serif; padding: 5px; background:#262626');
    credits.innerHTML = 'Arte Downloader v.' + scriptVersion + ' built by and for the community with love' +
        '<br /><a style=\'color:rgb(255, 255, 255);\' href="https://github.com/GuGuss/ARTE-7-Downloader">Contribute Here.</a>';
    return credits;
}

function decoratePlayer360(videoElement, videoURL, videoName) {
    let container = document.createElement('div');
    insertAfter(container, videoElement);
    container.setAttribute('class', 'ArteDownloader-v' + scriptVersion)
    container.setAttribute('style', 'background:#262626; padding: 10px;');
    let button = document.createElement('a');
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
    let container = document.createElement('div');
    let parent = videoElement.parentNode;

    // find parent to decorate
    // @TODO: deco https://info.arte.tv/fr/litalie-veut-redonner-leur-identite-aux-refugies-noyes-en-mediterranee
    if (videoElement.nodeName === "IFRAME" || window.frameElement !== null) {
        // !hardcoded spaghetti, @TODO: find a better way to find parent
        parent = window.parent.document.querySelector('div.video-embed');
        if (parent == null) {
            parent = window.parent.document.querySelector('div.next-video-playlist');
            if ( parent == null ) {
                parent = window.parent.document.querySelector('div.article-video');
                if (parent == null) {
                    parent = window.parent.document.querySelector('div.video-container');
                    if (parent == null) {
                        console.error("Couldn't find parent to decorate.");
                        return;
                    }
                }
            }
        }
    }

    setTimeout( () => { insertAfter(container, parent); }, 3500); // !hardcoded, @TODO: callback after parent stops cleaning his childNodes
    container.setAttribute('id', 'video_' + videoElementIndex);
    container.setAttribute('class', 'ArteDownloader-v' + scriptVersion)
    container.setAttribute('style', 'background:#262626; padding: 10px;');

    // Create video name span
    let videoNameSpan = document.createElement('span');
    let subtitle = playerJson[videoElementIndex].videoJsonPlayer.subtitle;
    videoNameSpan.innerHTML = "<strong>" + getVideoName(videoElementIndex) + (subtitle !== undefined ? " - " + subtitle : "") + "</strong><br/>";
    videoNameSpan.setAttribute('style', 'margin-top:10px; text-align: center; color:rgb(255, 255, 255); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 16px;');
    container.appendChild(videoNameSpan);

    // Create language combobox
    let languageComboBox = createLanguageComboBox(videoElementIndex)
    container.appendChild(languageComboBox);

    // Check if there are languages available to select
    let selectedLanguage;
    if (languageComboBox.options.length > 0) {
        selectedLanguage = languageComboBox.options[languageComboBox.selectedIndex].value;
    }

    // Create quality combobox
    container.appendChild(createQualityComboBox(videoElementIndex));

    // Create download button
    let btnDownload = createButtonDownload(videoElementIndex, selectedLanguage);
    if (btnDownload !== null) {
        container.appendChild(btnDownload);
    }

    // Create metadata button
    let btnMetadata = createButtonMetadata(videoElementIndex);
    if (btnMetadata !== null) {
        container.appendChild(btnMetadata);
    }

    // Create credits ribbon
    let credits = createCreditsElement();
    container.appendChild(credits);

    // Workaround decoration overlapping next SECTION
    let parentSection = getParent(parent, 'SECTION', 'margin-bottom-s'); //!hardcoded, @TODO: find a better way to find proper parent
    parentSection.style.marginBottom = playerJson.length * 8 + "rem";
}
