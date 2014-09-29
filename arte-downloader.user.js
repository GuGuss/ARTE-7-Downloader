// ==UserScript==
// @name        Arte+7 Downloader
// @namespace   GuGuss
// @description Display direct links to MP4 videos of Arte+7 programs
// @include     http://www.arte.tv/guide/*
// @updateURL   https://github.com/GuGuss/ARTE-7-Downloader/blob/master/arte-downloader.user.js
// @downloadURL https://github.com/GuGuss/ARTE-7-Downloader/blob/master/arte-downloader.meta.js
// @version     1.4.1
// @grant       GM_xmlhttpRequest
// ==/UserScript==

(function(window, document) {
    'use strict';
    var Arte7Downloader = {
        // Set this to 1 to enable console logs.
        debug_mode: 0,

        init: function() {
            if (!Arte7Downloader.debug_mode) {
                console.log('Debug mode disabled');
                console.log = function() {};
            } else {
                console.log('Debug mode enabled');
            }

            // Grease Monkey check.
            if ('function' !== GM_xmlhttpRequest) {
                console.log('Userscript manager not supported');
            }

            var video_elements = document.querySelectorAll('div[arte_vp_url]');

            for (var i = 0; i < video_elements.length; i++) {
                Arte7Downloader.addButtons(video_elements[i]);
            }
        },

        addButtons: function(element) {

              var credit = document.createElement('div');
              credit.setAttribute('style', 'width: 100%; text-align: center; font-size: 0.8em; padding: 3px;');
              credit.innerHTML = 'This downloader was built for you with love. <a href="https://github.com/GuGuss/ARTE-7-Downloader">Contribute Here.</a>';

              var parent = element.parentNode.parentNode;

              var container = document.createElement('div');
              container.setAttribute('style', 'display: table; width: 100%;');

              container.appendChild(Arte7Downloader.createButton(element, 'High'));
              container.appendChild(Arte7Downloader.createButton(element, 'Standard'));
              container.appendChild(Arte7Downloader.createButton(element, 'Low'));
              parent.appendChild(container);
              parent.appendChild(credit);
        },

        createButton: function(element, quality) {

            var button = document.createElement('a');
            button.setAttribute('class', 'btn btn-default');
            button.setAttribute('style', 'text-align: center; display: table-cell;');
            button.innerHTML = 'Download <strong>' + quality + '</strong> Quality <span class="icomoon-angle-right pull-right"></span>';

            // Get the content of the JSON file.
            var jsonUrl = Arte7Downloader.getJsonUrl(element);
            console.log(jsonUrl);
            GM_xmlhttpRequest({
                method: 'GET',
                url: jsonUrl,
                onload: function(response) {
                    var video_name = Arte7Downloader.getVideoName(response, quality);
                    var video_url = Arte7Downloader.getVideoUrl(response, quality);
                    button.setAttribute('href', video_url);
                    button.setAttribute('download', video_name);
                }
            });
            return button;
        },

        /*
         * Action callback when clicking the Download button.
         */
        triggerOnClick: function(element, quality) {
            console.log('onClick triggered');

            // Get the Player XML URL
            var jsonUrl = Arte7Downloader.getJsonUrl(element);
            console.log(jsonUrl);

            // Get the content of the JSON file.
            GM_xmlhttpRequest({
                method: 'GET',
                url: jsonUrl,
                onload: function(response) {
                    var MP4 = Arte7Downloader.parseJsonDocument(response, quality);
                    window.open(MP4);
                }
            });
        },

        /*
         * Run an X-Path query to retrieve the URL of the JSON file which contains the MP4 video URLs.
         */
        getJsonUrl: function(element) {
            // Get the value of the "arte_vp_url" attribute which contains the player URL.
            var playerUrl = element.getAttribute('arte_vp_url');

            // Get the URL of the JSON file by removing the "player/".
            var json = playerUrl.replace('player/', '');

            return json;
        },

        getVideoName: function(response, quality) {
            var json = JSON.parse(response.responseText);
            console.log(json);
            return json.video.VST.VNA + '_' + quality.toLowerCase() + '_quality.mp4';
        },

        /*
         * Parse the content of the JSON file and extract the MP4 videos URLs.
         */
        getVideoUrl: function(response, quality) {
            if (response) {
                var quality_code = {
                    'Low': 'HQ',
                    'Standard': 'EQ',
                    'High': 'SQ'
                };

                // Parse the JSON text into a JavaScript object.
                var json = JSON.parse(response.responseText);

                // Loop through all videos URLs.
                for (var i = 0; i < json.video.VSR.length; i++) {
                    // Get the videos where VFO is "HBBTV".
                    if (json.video.VSR[i].VFO === 'HBBTV') {
                        // Get the video URL using the requested quality.
                        if (json.video.VSR[i].VQU === quality_code[quality]) {
                            console.log(quality_code[quality] + ' MP4 URL : ' + json.video.VSR[i].VUR);
                            return json.video.VSR[i].VUR;
                        }
                    }
                }
                return 0;
            }
        }
    };
    window.Arte7Downloader = Arte7Downloader;
    Arte7Downloader.init();
})(window, window.document);
