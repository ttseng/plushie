// countdown for recording gesture, timer UI

let recordCountdownTime = 2.0; // time to record gesture = 2 seconds
let recordCountdownRunning = false;

let timerCountdownTime = 10; // 10 seconds
let timerCountdownRunning = false;

let countdownTimer = (function (document) {
  function start(timeLimit, display, atSetup, toDisplay, atEnd) {
    atSetup(display); // funciton to run when setting up timer

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
