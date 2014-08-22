// ==UserScript==
// @name        Arte +7 Download - CHROME
// @namespace   GuGuss
// @description Display a button to get RTMP URL of an Arte video
// @include     http://videos.arte.tv/*/videos/*.html
// @version     1.0
// ==/UserScript==

if ('function' !== GM_xmlhttpRequest) {
  console.log('Userscript manager not supported');
} else {
  console.log("C'est bon c'est good !");
}

var GM_Debug = 0;

if(!GM_Debug) {
  console.log('Debug mode is disabled');
  console.log = function() {};
} else {
  console.log('Debug mode is enabled');
}

// Create a download button.
var downloadButton = document.createElement( 'input' );
with( downloadButton ) {
  setAttribute( 'onclick', 'triggerOnClick();' ); // For FF
  setAttribute( 'value', 'Download' );
  setAttribute( 'type', 'button' );
}

downloadButton.onclick = function() { triggerOnClick() }; // For Chrome

// Append the button on the page
document.getElementsByTagName( 'body' )[ 0 ].appendChild( downloadButton );

/*
 * Action callback when clicking the Download button.
 */
function triggerOnClick(){
  console.log('onClick triggered');

  // Get the current language from the URL
  var currentLanguage = getCurrentLanguage();

  // Get the Player XML URL
  var playerXmlUrl = getPlayerXmlUrl(currentLanguage);

  // Get the Video As Player XML URL
  GM_xmlhttpRequest({
    method: "GET",
    url: playerXmlUrl,
    onload: function(response) {
      getVideoAsPlayerXmlUrl(response);
    }
  });

}

/*
 * Get the current language from the URL.
 */
function getCurrentLanguage() {
  // Get current page URL
  var currentURL = window.location.href;
  /* TODO : Remove that line to use the correct URL */
  currentURL = "http://videos.arte.tv/fr/videos/le-president-et-la-chanceliere-face-aux-jeunes--7263932.html";

  /* TODO : Explode the currentURL to use the correct language from the URL. */
  currentLanguage = 'fr';

  return currentLanguage;
}

/*
 * Get the Player XML URL from the current URL in the correct language.
 */
function getPlayerXmlUrl(currentLanguage) {
  // Get current page URL
  var currentURL = window.location.href;

  // Get the video path (without the domain)
  var videoPath = currentURL.split("/").pop();  // Get the last element of the URL

  // Get the video name (without the extension)
  var playerXML = videoPath.split(".").shift();  // Get the first element of the video path
  console.log("playerXML : " + playerXML);

  var playerXmlUrl = "http://videos.arte.tv/" + currentLanguage + "/do_delegate/videos/" + playerXML + ",view,asPlayerXml.xml";
  console.log("playerXmlUrl : " + playerXmlUrl);

  return playerXmlUrl;
}

/*
 * Get the Video As Player XML URL.
 */
function getVideoAsPlayerXmlUrl(response){
  var responseXML = null;

  // Inject responseXML into existing Object (only appropriate for XML content).
  if (!response.responseXML) {
    responseXML = new DOMParser().parseFromString(response.responseText, "application/xml");
  }

  // Get the Videos As Player XML URLs
  var videosHTML = responseXML.getElementsByTagName("video");
  console.log("videosHTML : " + videosHTML);

  for(var i = 0; i < videosHTML.length; i++) {
    if (videosHTML[i].getAttribute("lang") == currentLanguage) var videoAsPlayerXmlUrl = videosHTML[i].getAttribute("ref");
  }

  console.log("videoAsPlayerXmlUrl : " + videoAsPlayerXmlUrl);

  // Get the RTMP stream URL
  GM_xmlhttpRequest({
    method: "GET",
    url: videoAsPlayerXmlUrl,
    onload: function(response) {
      getRtmpStreamUrl(response);
    }
  });

}

/*
 * Get the RTMP stream URL.
 */
function getRtmpStreamUrl(response){
  var responseXML = null;

  // Inject responseXML into existing Object (only appropriate for XML content).
  if (!response.responseXML) {
    responseXML = new DOMParser().parseFromString(response.responseText, "application/xml");
  }

  // Get the RTMP stream URLs
  var urlsTag = responseXML.getElementsByTagName("urls");
  console.log(urlsTag);

  var rtmpUrls = urlsTag[0].childNodes;
  console.log(rtmpUrls);

  var rtmpUrl = null;

  for(var i = 0; i < rtmpUrls.length; i++) {
    if(rtmpUrls[i].nodeName == "url") {
      console.log("bingo");
      if (rtmpUrls[i].getAttribute("quality") == "sd") rtmpUrl = rtmpUrls[i].textContent;
    }
  }

  alert(rtmpUrl);
}
