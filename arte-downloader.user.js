// ==UserScript==
// @name        Arte+7 Downloader
// @namespace   GuGuss
// @description Display a link to the MP4 URL of an Arte+7 video
// @include     http://www.arte.tv/guide/*
// @version     1.1
// ==/UserScript==

if ('function' !== GM_xmlhttpRequest) {
  console.log('Userscript manager not supported');
}

var GM_Debug = 1;
if(!GM_Debug) {
  console.log('Debug mode disabled');
  console.log = function() {};
} else {
  console.log('Debug mode enabled');
}

// Create a download LQ button.
var downloadLQButton = document.createElement('input');
with(downloadLQButton) {
  setAttribute('value','Download LQ');
  setAttribute('type','button');
}
downloadLQButton.onclick = function() { triggerOnClick('SQ') }; // For Chrome

// Create a download HQ button.
var downloadHQButton = document.createElement('input');
with(downloadHQButton) {
  setAttribute('value','Download HQ');
  setAttribute('type','button');
}
downloadHQButton.onclick = function() { triggerOnClick('HQ') }; // For Chrome

// Display the buttons on the bottom of the page.
document.getElementsByTagName('body')[0].appendChild(downloadLQButton);
document.getElementsByTagName('body')[0].appendChild(downloadHQButton);

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
  result = document.evaluate("//*[@id='details-focus']/div/div/div/div/div[2]", document.documentElement, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  
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