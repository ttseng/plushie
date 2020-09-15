// countdown for recording gesture, timer UI
let preRecordTime = 3.15 // 3 2 1 countdown - slightly calibrated to align with the audio clip

let recordCountdownTime = 2.0; // time to record gesture = 2 seconds
let recordCountdownRunning = false;

let timerCountdownTime = 10; // 10 seconds
let timerCountdownRunning = false;

// generalized countdown timer
let countdownTimer = (function (document) {
  function start(timeLimit, display, atSetup, toDisplay, atEnd) {
    if(atSetup){
      atSetup(display); // funciton to run when setting up timer
    }

    let time = timeLimit;
    let startTime = new Date().getTime();

    let myTimer = setInterval(myClock, 10);

    function myClock() {
      let remaining = time - (new Date().getTime() - startTime) / 1000; // in seconds

      // update countdown timer
      display.innerHTML = toDisplay(remaining);

      if (remaining <= 0) {
        clearInterval(myTimer);
        atEnd(timeLimit, display);
      }
    }
  }
  return { start: start };
})(document);

// gesture-triggered countdown timer
function setTimer() {
  let length = prompt(
    "Enter new countdown time (in seconds)",
    timerCountdownTime
  );
  if (parseInt(length) !== timerCountdownTime) {
    timerCountownTime = parseInt(length);
    event.target.innerHTML = length.toMMSS();
  }
}

// for 3 / 2 / 1 countdown when recording gesture data
function preRecordStart(){
  isCollectingData = true;
  let preCountdownAudio = document.getElementById('pre-countdown-audio');
  preCountdownAudio.play();
}

function preRecordTimeLeft(timeLeft){
  let timeToDisplay = (timeLeft).toFixed(0);
  if(timeToDisplay <= 0){
    timeToDisplay = 1;
  }
  return `......${timeToDisplay}......`;
}

function atPreRecordTimeEnd(defaulTime, display){
  display.innerHTML = `Recording...`;

  // run countdown timer
  countdownTimer.start(recordCountdownTime,
    document.querySelector(`#${currentGesture} .countdown-timer`),
    atRecordTimerStart,
    recordTimerDisplay,
    atRecordTimeEnd);
}


