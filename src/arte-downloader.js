// ==UserScript==
// @name        Arte+7 Downloader
// @description Download videos or get stream link of ARTE programs in the selected language.
// @version     3.5
// @license     GPL
// @include     https://*.arte.tv/*
// @icon        https://www.arte.tv/favicon.ico
// @homepageURL https://github.com/GuGuss/ARTE-7-Downloader
// @supportURL  https://github.com/GuGuss/ARTE-7-Downloader/issues
// @downloadURL https://raw.githubusercontent.com/GuGuss/ARTE-7-Downloader/master/src/arte-downloader.js
// @updateURL   https://raw.githubusercontent.com/GuGuss/ARTE-7-Downloader/master/src/arte-downloader.js
// ==/UserScript==

/* --- GLOBAL VARIABLES --- */
const scriptVersion = 3.5;
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

    console.log("> No video found in " + language + " [" + quality + "] for #" + videoElementIndex )
    return '';
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
    } else {
        console.log("> No video players found.");
    }
}

/*
===========
ENTRY POINT
===========
*/
(function findPlayers() {
    console.log('\n===== ARTE DOWNLOADER v' + scriptVersion + ' started =====');
  
    // Observe href change => rerun script.
    var oldHref = document.location.href;
    window.addEventListener("load",function(event) {
        var
             bodyList = document.querySelector("body")
            ,observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (oldHref != document.location.href) {
                        console.log("> URL changed from " + oldHref + " => " + document.location.href );
                        oldHref = document.location.href;

                        // dirty hack avoiding vars reset.
                        // @TODO: reset global vars
                        console.log("> Reloading page to rerun the script..");
                        window.location.reload();
                    }
                });
            });
        var config = {
            childList: true,
            subtree: true
        };
        observer.observe(bodyList, config);
    }, false);

    // Check playlist
    // @TODO parse inline script to find playlist link
    // Find highlight of the day playlist
    /*let scripts = document.querySelectorAll("script");
    if (scripts !== undefined) {
        let matchStringStart = "window.__INITIAL_STATE__ = ";
        let matchStringEnd = "}]}]}";
        for(let i=0; i < scripts.length; i++) {
            let str = scripts[i].innerHTML.trim();
            if (str.startsWith(matchStringStart)) {
                str = str.split(matchStringStart)[1].split(matchStringEnd)[0] + matchStringEnd;
                let inlineJson = JSON.parse(str);
                inlineJson = inlineJson.pages.list["LIVE_fr_{}"].zones;
                inlineJson.forEach( el => {
                    if (el.code.name == "today_guide_LIVE") {
                        inlineJson = el.data;
                        console.debug(inlineJson);
                    } 
                });
            }
        }
    }

    let playlistJson = ...................................
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
                    
                    let videoElementIndex = i;
                        console.log("    - #" + videoElementIndex + " player JSON: " + videoJsonUrl);
                        let _cb = (json) => {
                            playerJson[videoElementIndex] = json;
                            preParsePlayerJson(videoElementIndex);
                            // decorate playlist
                        };
                        window.fetch(videoJsonUrl).then((resp) => resp.json()).then(_cb);
                    }

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
    else {*/
            // @XXX
            // Think of a more clever way to trigger/retrigger this,
            // because ARTE.tv is now hip and uses some clever way to
            // load data incrementally and not only on real page-loads
            // so this is sometimes broken - but works,
            // if you force a browser reload (either via F5 or CTRL+R ..)
            //
            // So we need to keep track of that in the future,
            // somehow.. IDK
            //
            // - Walialu, 2019-09-04 18:12 +0200
            console.log("> Querying Arte API");
            const _win_loc = window.location.pathname.split('/');
            const _lang = _win_loc[1];
            const _api_base = "https://api.arte.tv/api/player/v1/config/" + _lang + "/";
            const _video_id = _win_loc[3];
            const _video_name = _win_loc[4];
            const _maxNags = 20;
            const _nagDelay = 500;
            let _nagCounter = 0;

            initParsingSystem(1);
            // This is because some weird shit is causing redraws on the ARTE.tv site
            // probably whatever frontend-framework is currently hyped on hackernews
            //
            // So we force our UI to be drawn up to (_maxNags*_nagDelay) seconds
            // if it does not exist, yet!
            //
            // - Walialu, 2019-09-04 17:17 +0200
            const _naggerFunc = () => {
                if (_nagCounter < _maxNags) {
                    _nagCounter++;
                    if (!document.getElementById("cbLanguage0")) {
                        let anchor = document.querySelector('main[role="main"]');
                        console.debug(anchor);
                        // insert before the player otherwise it gets overlayed by the player (@TODO find a way to place it below)
                        anchor.insertBefore(buildContainer(0), anchor.firstChild);
                    }
                    setTimeout(_naggerFunc, _nagDelay);
                }
            };
            let _cb = (json) => {
                playerJson[0] = json;
                preParsePlayerJson(0);
                setTimeout(_naggerFunc, _nagDelay);
            };
            window.fetch(_api_base + _video_id).then((resp) => resp.json()).then(_cb).catch((err) => console.error(err));
    //}
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
        button.innerHTML = "<strong>📥 video </strong><span class='icomoon-angle-down force-icomoon-font'></span>";
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
    button.setAttribute('style', 'line-height: 17px; margin-left:10px; text-align: center; padding: 10px; color:rgb(40, 40, 40); background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px; font-weight: 400;');
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
        button.innerHTML = "📥 description <span class='icomoon-angle-down force-icomoon-font'></span>";
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
                                            : "max-width: 100px; padding: 10px; color:rgb(40, 40, 40); background-color: rgb(230, 230, 230); font-family: ProximaNova,Arial,Helvetica,sans-serif; font-size: 13px; font-weight: 400;"));
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
    credits.innerHTML = '<a style=\'color:rgb(255, 255, 255);\' href="https://github.com/GuGuss/ARTE-7-Downloader">Arte Downloader v. ' + scriptVersion + '</a>';
    return credits;
}

function buildContainer(videoElementIndex) {
    let container = document.createElement('div');
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

    return container;
}
