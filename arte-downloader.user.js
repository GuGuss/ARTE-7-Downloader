// ==UserScript==
// @name        Arte+7 Downloader
// @namespace   GuGuss
// @description Display direct links to MP4 videos of Arte+7 programs
// @include     http://www.arte.tv/guide/*
// @version     1.2.1
// ==/UserScript==

// Set this to 1 to enable console logs.
var debug_mode = 0;
if(!debug_mode) {
  console.log('Debug mode disabled');
  console.log = function() {};
} else {
  console.log('Debug mode enabled');
}

// Grease Monkey check.
if ('function' !== GM_xmlhttpRequest) {
  console.log('Userscript manager not supported');
}

// High quality link (SQ: 2200).
var downloadHQ = document.createElement('a');
with(downloadHQ) {
  setAttribute('class', 'btn btn-block');
  setAttribute('style', 'margin-left:auto; margin-right:auto; width:200px; color:black; margin-top:5px;');
}
downloadHQ.innerHTML= "Download <strong>High</strong> Quality <span class='icomoon-angle-right pull-right'></span>";
downloadHQ.onclick = function() { triggerOnClick('SQ') }; // For Chrome

// Standard quality link (EQ: 1500).
var downloadEQ = document.createElement('a');
with(downloadEQ) {
  setAttribute('class', 'btn btn-block');
  setAttribute('style', 'margin-left:auto; margin-right:auto; width:200px; color:black;');
}
downloadEQ.innerHTML= "Download <strong>Standard</strong> Quality <span class='icomoon-angle-right pull-right'></span>";
downloadEQ.onclick = function() { triggerOnClick('EQ') }; // For Chrome

// Low quality link (HQ: 800).
var downloadSQ = document.createElement('a');
with(downloadSQ) {
  setAttribute('class', 'btn btn-block');
  setAttribute('style', 'margin-left:auto; margin-right:auto; width:200px; color:black;');
}
downloadSQ.innerHTML= "Download <strong>Low</strong> Quality <span class='icomoon-angle-right pull-right'></span>";
downloadSQ.onclick = function() { triggerOnClick('HQ') }; // For Chrome

// Display the buttons at the bottom of the page.
var details_focus = document.evaluate("body", document.documentElement, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
details_focus.snapshotItem(0).appendChild(downloadHQ);
details_focus.snapshotItem(0).appendChild(downloadEQ);
details_focus.snapshotItem(0).appendChild(downloadSQ);

/*
 * Action callback when clicking the Download button.
 */
function triggerOnClick(quality){
  console.log('onClick triggered');

  // Get the Player XML URL
  var jsonUrl = getJsonUrl();
  console.log(jsonUrl);

  // Get the content of the JSON file.
  GM_xmlhttpRequest({
    method: "GET",
    url: jsonUrl,
    onload: function(response) {
      MP4 = parseJsonDocument(response, quality);
      window.open(MP4);
    }
  });
}

/*
 * Run an X-Path query to retrieve the URL of the JSON file which contains the MP4 video URLs.
 */
function getJsonUrl() {  
  
  // Run the XPath query using the XPath identifier of the player.
  result = document.evaluate("//*[@arte_vp_url]", document.documentElement, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  
  // Get the value of the "arte_vp_url" attribute which contains the player URL.
  playerUrl = result.snapshotItem(0).getAttribute("arte_vp_url");

  // Get the URL of the JSON file by removing the "player/".
  json = playerUrl.replace("player/", "");

  return json;
}

/*
 * Parse the content of the JSON file and extract the MP4 videos URLs.
 */
function parseJsonDocument(response, quality){
  if(response) {
    // Parse the JSON text into a JavaScript object.
    var json = JSON.parse(response.responseText);

    // Loop through all videos URLs.
    for(var i = 0; i < json["video"]["VSR"].length; i++) {
      
      // Get the videos where VFO is "HBBTV".
      if(json["video"]["VSR"][i]["VFO"] === "HBBTV") {

        // Get the video URL using the requested quality.
        if(json["video"]["VSR"][i]["VQU"] === quality) {
          console.log(quality + " MP4 URL : " + json["video"]["VSR"][i]["VUR"]);
          return(json["video"]["VSR"][i]["VUR"]);
        }
      }
    }

    return 0;
  }
}
