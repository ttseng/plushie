// countdown for recording gesture, timer UI

let recordCountdownTime = 200; // time to record gesture = 3 seconds
let recordCountdownRunning = false;

let timerCountdownTime = 10; // 10 seconds
let timerCountdownRunning = false;


// recordCountdown - for recording gestures
let recordCountdown = (function (document) {
    let myTimer;
  
    function start() {
      if (!recordCountdownRunning) {
        recordCountdownRunning = true;
  
        // display countdown
        let display = document.querySelector(
          `#${currentGesture} .countdown-timer`
        );
        display.classList.add("active");
  
        myTimer = setInterval(myClock, 10);
  
        accelXSample = [];
        accelYSample = [];
        accelZSample = [];
      }
      let time = recordCountdownTime;
  
      function myClock() {
        time--;
  
        // update countdown timer
        let display = document.querySelector(
          `#${currentGesture} .countdown-timer`
        );
        display.innerHTML = time / 100;
  
        if (time == 0) {
          end();
          isCollectingData = false;
        }
      }
    }
    function reset() {
      clearInterval(myTimer);
      stopAllAudio();
      recordCountdownRunning = false;
      let display = document.querySelector(`#${currentGesture} .countdown-timer`);
      display.innerHTML = "2.00"; // iniital countdown time
      display.classList.remove("active");
  
      let recordBtn = document.querySelector(`#${currentGesture} .record-btn`);
      recordBtn.disabled = false;
  
      generatePlotly();
  
      // add data
      addData();
    }
  
    function end() {
      reset();
      isCollectingData = false;
    }
  
    return { start: start, end: end, reset: reset };
  })(document);
  
  String.prototype.toMMSS = function () {
    var sec_num = parseInt(this, 10); // don't forget the second param
    var hours = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - hours * 3600) / 60);
    var seconds = sec_num - hours * 3600 - minutes * 60;
  
    if (minutes < 10) {
      minutes = "0" + minutes;
    }
    if (seconds < 10) {
      seconds = "0" + seconds;
    }
    return minutes + ":" + seconds;
  };
  
  function setTimer() {
    let length = prompt("Enter new countdown time (in seconds)", timerCountdownTime);
    if (parseInt(length) !== timerCountdownTime) {
      timerCountownTime = parseInt(length);
      event.target.innerHTML = length.toMMSS();
    }
  }
  
  // timerCountdown - for setting countdown timer for triggering sounds
  let timerCountdown = (function(document){
    let myTimer;
  
    function start(){
      if(!timerCountdownRunning){
        timerCountdownRunning = true;
        myTimer = setInterval(myClock, 1000);
        
        // check whether to loop audio
        let countdownStartSelect = document.getElementById('timer-countdown-start-select');
        let audioFileName = countdownStartSelect.options[countdownStartSelect.selectedIndex].value.toLowerCase();  
        let audioEl = document.getElementById(audioFileName + "-audio");
        if(document.getElementById('timer-countdown-start-loop-checkbox').checked){
          audioEl.loop = true;
        }else{
          audioEl.loop = false;
        }
  
        // play audio
        playAudio("timer-countdown-start");
      }
      let time = timerCountdownTime;
  
      function myClock(){
        console.log('time: ', time);
        time--;
  
        minutes = parseInt(time / 60, 10);
        seconds = parseInt(time % 60, 10);
    
        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;
    
        let display = document.getElementById('timer-countdown');
        display.innerHTML = minutes + ":" + seconds;
        // display.innerHTML = --time;
        if(time == 0){
          end();
        }
      }
    }
    function reset(){
      console.log('end timer');
      clearInterval(myTimer);
      stopAllAudio();
      timerCountdownRunning = false;
      let display = document.getElementById('timer-countdown');
      display.innerHTML = timerCountdownTime.toString().toMMSS();
    }
    
    function end(){
      reset();
      playAudio("timer-countdown-end");
    }
  
    return {start: start, end: end, reset: reset};
  })(document);
  