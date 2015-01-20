// ==UserScript==
// @name        Arte+7 Downloader
// @namespace   GuGuss
// @description Display direct links to MP4 videos of Arte+7 programs
// @include     http://www.arte.tv/guide/*
// @include     http*archive.org/*arte.tv/guide*
// @updateURL   https://github.com/GuGuss/ARTE-7-Downloader/blob/master/arte-downloader.user.js
// @downloadURL https://github.com/GuGuss/ARTE-7-Downloader/raw/master/arte-downloader.user.js
// @version     2.0
// ==/UserScript==

// Set this to 1 to enable console logs.
var debug_mode = 0;
if(!debug_mode) {
  console.log('Debug mode disabled');
  console.log = function() {};
} else {
  console.log('Debug mode enabled');
}

/*
 * Some user scripts implementations natively support cross origin ajax requests.
 * The result is they don't set the Origin header.
 * See http://stackoverflow.com/q/26247041/2284570?noredirect=1#comment41183426_26247041 for more details.
 */
var SOP='';
if (document.URL.indexOf("web.archive.org/")>-1) {
  SOP='https://web.archive.org/web/';
  console.log('Watching an archived video'); // There are many cors proxies to circumvent the same origin policy, but this is not needed in the case of web.archive.org
} else {
  var ajax = new XMLHttpRequest();
  ajax.onloadend = function () {
    SOP=(this.response==='')?'https://cors-anywhere.herokuapp.com/':'';
  };
  ajax.open('GET', 'http://www.example.com', true); // this a IANA reserved domain. It is safe to use it for that purpose.
  ajax.send(null);
}


/*
 * The opera implementation of User Scripts allow scripts to be started before the page is loaded.
 * The following code makes use of that speed benefit.
 */
var IsOpera=(typeof window.opera != "undefined")?true:false;
IsOpera?opera.addEventListener('AfterScript',StartScript,false):StartScript(); // run the script
function StartScript(Script) {
  if (IsOpera)
    if (Script.element.src.indexOf('main.js') == -1) // check if called by an EventListener.
      return;
    else
      opera.removeEventListener('AfterScript', StartScript, false); // need to remove the event before the listener raise a secound time.
  var video_elements = document.querySelectorAll("div[arte_vp_url]");
  for(var i=0;video_elements.length;i++)
    addButtons(video_elements[i]);

}


function addButtons(element) {
  var credit = document.createElement('div');
  credit.setAttribute('style', 'width: 100%; text-align: center; font-size: 0.8em; padding: 3px;');
  credit.innerHTML = 'This downloader was built for you with love. <a href="https://github.com/GuGuss/ARTE-7-Downloader">Contribute Here.</a>';

  var parent = element.parentNode.parentNode;

  var container = document.createElement('div');
  container.setAttribute('style', 'display: table; width: 100%;');

  container.appendChild(createButton(element, 'High'));
  container.appendChild(createButton(element, 'Standard'));
  container.appendChild(createButton(element, 'Low'));
  parent.appendChild(container);
  parent.appendChild(credit);
};

function createButton(element, quality) {
  var button = document.createElement('a');
  button.setAttribute('class', 'btn btn-default');
  button.setAttribute('style', 'text-align: center; display: table-cell;');
  button.innerHTML= "Download <strong>"+quality+"</strong> Quality <span class='icomoon-angle-right pull-right'></span>";

  // Get the content of the JSON file.
  var jsonUrl = getJsonUrl(element);
  console.log(jsonUrl);

  var VideoButton = new XMLHttpRequest();
  VideoButton.open('GET', jsonUrl, true);
  VideoButton.onloadend = function () {
    // add support for already archived pages.
    var VideoUrl=getVideoUrl(this, quality, true);
    SetFileSize(button, (SOP + ((SOP.indexOf("web.archive.org/")>-1)?VideoUrl.replace('http://artestras.vo.llnwd.net','artestras.vo.llnwd.net'):VideoUrl)));
    button.setAttribute('href', ((SOP.indexOf("web.archive.org/")>-1)?SOP:'') + VideoUrl );
    button.setAttribute('download', getVideoName(this, quality));
  };
  VideoButton.onerror = console.log("ERROR: script not loaded: " , this.status);
  VideoButton.send(null);
  return button;
}

/*
 * Run an X-Path query to retrieve the URL of the JSON file which contains the MP4 video URLs.
 */
function getJsonUrl(element) {  
  
  // Get the value of the "arte_vp_url" attribute which contains the player URL.
  // playerUrl = result.snapshotItem(0).getAttribute("arte_vp_url");
  var playerUrl = element.getAttribute("arte_vp_url");

  // Get the URL of the JSON file by removing the "player/".
  return playerUrl.replace("player/", ""); // I can't add support for checking about the json file on web.archive.org due http://arte.tv/robots.txt. Meanwhile, the JSON file stay after the end of the watch period.
}

function getVideoName (response, quality) {
  var json = JSON.parse(response.responseText);
  console.log(json);
  return (json.video.VST.VNA+' '+quality.toLowerCase()+' quality.mp4').replace(/_/g,' '); //use paces for better filename.
}

/*
 * Parse the content of the JSON file and extract the MP4 videos URLs.
 */
function getVideoUrl(response, quality){
  if(response) {

    var quality_code = {
      'Low': 'HQ',
      'Standard': 'EQ',
      'High': 'SQ'
    };

    // Parse the JSON text into a JavaScript object.
    var json = JSON.parse(response.responseText);

    // Loop through all videos URLs.
    for(var i = 0; i < json.video.VSR.length; i++) { 
      // Get the videos where VFO is "HBBTV".
      if(json["video"]["VSR"][i]["VFO"] === "HBBTV") {

        // Get the video URL using the requested quality.
        if(json["video"]["VSR"][i]["VQU"] === quality_code[quality]) {
          console.log(quality_code[quality] + " MP4 URL : " + json["video"]["VSR"][i]["VUR"]);
          return(json["video"]["VSR"][i]["VUR"]);
        }
      }
    }
    return 0;
  }
}

/*
 * Retrieve width and height from an MPEG-4 file.
 * Width and height are stored as float values, where witdh come next to heigth inside binary data.
 * There is no fixed place in the file. The method is to get them at 10 bytes before "mdia".
 * Using DataView as Typed arrays depend on the endianness of the machine
 */
function GetResolution(Button, Url, FileSize) {
  var ajax = new XMLHttpRequest();
  ajax.onloadend = function () {
    var metadata= new DataView(this.response);
    for(var i=0;(i<metadata.byteLength) && (metadata.getUint32(i)!=0x6D646961); i+=16) {} // 0x6D646961="mdia"
    Button.setAttribute('title',metadata.getUint32(i-14) + 'x' + metadata.getUint32(i-10) + FileSize);
  };
  ajax.responseType = 'arraybuffer'; // We want to handle binary data.
  ajax.open('GET', Url, true);
  //ajax.setRequestHeader('x-requested-with', document.domain); // chrome doesn't support setting the 'Origin' header automatically.
  ajax.setRequestHeader('Range', 'bytes=117-511'); // Proceed with a partial download.
  ajax.send(null);
}

/*
 * Get the size of the file.
 * @Button the current button for downloading the video.
 * @Url the http url of the video.
 */
function SetFileSize(Button,Url) {
  var ajax = new XMLHttpRequest();
  ajax.onloadend = function () {
    GetResolution(Button, Url, ' - ' + (parseInt(this.getResponseHeader("Content-Length"))/1048576).toFixed(3) + ' Mo');
  };
  ajax.open('HEAD', Url, true); // <-- HEAD allow to get only the data of the headers.
  ajax.send(null);
}
