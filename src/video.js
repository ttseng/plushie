let showVideoTxt = 'Show Video';
let hideVideoTxt = 'Hide Video';

function toggleVideoBtnOnClick(){
    if(!document.getElementById('video-container')){
        // create video element 
        let videoContainer = document.createElement('div');
        videoContainer.id = "video-container";
    
        let contents = document.createElement('video');
    
        videoContainer.append(contents);
        
        document.body.appendChild(videoContainer);
        startVideo();
    
        dragElement(document.getElementById('video-container'));
    }else{
        // check if it's visible or not
        if(isVideoVisible()){
            // turn off video
            stopVideo();
        }else{
            /// show video
            startVideo();
        }   
        toggleVideoVisibility();
    }
    toggleVideoBtnTxt();
}

function isVideoVisible(){
    return !document.querySelector('video').classList.contains('hidden');
}

function toggleVideoVisibility(){
    videoEl = document.querySelector('video');
    if(videoEl.classList.contains('hidden')){
        videoEl.classList.remove('hidden');
    }else{
        videoEl.classList.add('hidden');
    }
}

function toggleVideoBtnTxt(){
    videoBtn = document.getElementById('toggle-video-btn');
    if(videoBtn.innerHTML == showVideoTxt){
        videoBtn.innerHTML = hideVideoTxt;
    }else{
        videoBtn.innerHTML = showVideoTxt;
    }
}

function startVideo(){
    console.log('start video');
    let videoParams = {video: {width: 1280, height: 720}};
    navigator.mediaDevices.getUserMedia(videoParams).then(function(stream){
        let video = document.querySelector('video');
        video.srcObject = stream;
        video.onloadedmetadata = function(e){
            video.play();
        }
    })
}

function stopVideo(){
    console.log('stop video');
    document.querySelector('video').srcObject.getTracks()[0].stop();
}

// https://www.w3schools.com/howto/howto_js_draggable.asp
function dragElement(elmnt) {
    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    if (document.getElementById(elmnt.id + "header")) {
      // if present, the header is where you move the DIV from:
      document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
    } else {
      // otherwise, move the DIV from anywhere inside the DIV:
      elmnt.onmousedown = dragMouseDown;
    }
  
    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      // get the mouse cursor position at startup:
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      // call a function whenever the cursor moves:
      document.onmousemove = elementDrag;
    }
  
    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      // calculate the new cursor position:
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      // set the element's new position:
      elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
      elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    }
  
    function closeDragElement() {
      // stop moving when mouse button is released:
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }