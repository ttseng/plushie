let textLang = 'en';
let lang = "en-GB"; // target audio language

// language translation for default gestures
let gestureTranslation = {
  none: "なし",
  shake: "振る",
  bow: "おじぎする",
};

let defaultAudioTranslation = {
  none: "なし",
  random: "ランダム",
  silence: "沈黙",
  wow: "ワオ",
  applause: "拍手",
  "tick-tock": "チクタク",
};

let soundEmojiDecorators = {
  none: " ",
  random: "🔀 ",
  silence: "🔇 ",
};

let consoleBtns = {
    "pair-btn": ["Pair Your Microbit", "Microbitをつなげる"],
    "reconnect-btn": ["Reconnect Microbit", "Microbitをつなげる"]
}

function setLanguage(el, language) {
  setUILanguage(language);
  document.querySelector(".lang-link.active").classList.remove("active");
  el.classList.add("active");
}

function toggleDefaultGestureNames(el){
    let defaultGestureName = el.innerHTML.trim();
    if (gestureTranslation[defaultGestureName]) {
      if (isJapanese() && gestureTranslation[defaultGestureName]) {
        el.innerHTML = gestureTranslation[defaultGestureName];
      }
    } else if (getKeyByValue(gestureTranslation, defaultGestureName)) {
      el.innerHTML = getKeyByValue(
        gestureTranslation,
        defaultGestureName
      );
    }
}

function setUILanguage(languageInput) {
  if (languageInput) {
    textLang = languageInput;
  } else {
    textLang = navigator.language;
    if (lang.includes("en")) {
      textLang = "en";
    }
  }

  // toggle language labels
  document.querySelectorAll("[lang]").forEach(function (el) {
    if (el.lang != textLang) {
      el.classList.add("hidden");
    } else {
      el.classList.remove("hidden");
    }
  });

  // change default gestures if needed
  let defaultGestureNames = document.querySelectorAll(
    "#default-gestures .name"
  );
  defaultGestureNames.forEach(function (defaultGesture) {
    toggleDefaultGestureNames(defaultGesture);
  });

  // change confidence labels
  let confidenceGestures = document.querySelectorAll("#gesture-confidence-container label span");
  confidenceGestures.forEach(function(gesture){
      toggleDefaultGestureNames(gesture);
  })

  // change selects
  let soundSelects = [
    "shake-select",
    "bow-select",
    "none-select",
    "loud-select",
    "timer-countdown-start-select",
    "timer-countdown-end-select",
  ];
  soundSelects.forEach(function (selectorName) {
    let selector = document.getElementById(selectorName);
    if (selector) {
      // replace sounds with japanese as needed
      let selectOptions = Array.from(selector.options);
      selectOptions.forEach(function (option) {
        let soundDecorator = "🔊 "; // default
        // check if it's one of the default sounds
        if (defaultAudioTranslation[option.value]) {
          if (soundEmojiDecorators[option.value] !== undefined) {
            soundDecorator = soundEmojiDecorators[option.value];
          }
          // console.log('option.value: ', option.value, ' with decorator ', soundDecorator);
          if (isJapanese()) {
            option.innerHTML =
              soundDecorator + defaultAudioTranslation[option.value];
          } else {
            option.innerHTML = soundDecorator + option.value;
          }
        }
      });
    }
  });

  // change console btns
  let consoleBtnNames = Object.keys(consoleBtns);
  consoleBtnNames.forEach(function(name){
    let el = document.getElementById(name);
    if(isJapanese()){
        el.innerHTML = consoleBtns[name][1];
    }else{
        el.innerHTML = consoleBtns[name][0];
    }
  });
}

function setAudioLanguage(languageInput) {
  // let browserLang = navigator.language;
  // let language = browserLang;

  if (languageInput) {
    lang = languageInput;
  }
  lang = languageCodes[lang];
  getVoices();
}

function isJapanese() {
  return textLang.includes("ja");
}

// UTILS
function getKeyByValue(object, value) {
  return Object.keys(object).find((key) => object[key] === value);
}
