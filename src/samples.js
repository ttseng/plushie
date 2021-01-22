// loading sample applications 
// these assume that the user hasn't changed the default set of gestures (none, shake, bow)

function loadFortune() {

    // load gestures
    removeGestures();
    loadDefaultGestures();

    
        // load langauge
        setAudioLanguage(textLang);

        // load sounds
        let tracks = [
            'without-a-doubt',
            'it-is-likely',
            'it-is-certain',
            'ask-later',
            'probably-not',
            'unfortunately-no',
        ];

        document.getElementById('sounds-container').querySelectorAll('.content .sound').forEach(function (el) {
            el.remove();
        })

        tracks.forEach(function (trackName) {
            addSound(trackName, false);
        });

        let shakeSelect = document.getElementById("shake-select");
        let bowSelect = document.getElementById("bow-select");
        let noneSelect = document.getElementById("none-select");

        if(shakeSelect && bowSelect && noneSelect){
            // load default gesture behavior
            shakeSelect.value = "random";
            bowSelect.value = "none";
            noneSelect.value = "none";
            document.getElementById("timer-countdown-start-select").value = "none";
        }  
}

function loadExercise() {

    // load gestures
    removeGestures();
    loadExerciseSampleGestures();

    // load sounds
    let dir = "/samples/exercise-froggy";
    let tracks = [
        'jumping-jacks',
        'ready',
        'stretch',
    ];

    document.getElementById('sounds-container').querySelectorAll('.content .sound').forEach(function (el) {
        el.remove();
    });

    tracks.forEach(function (trackName) {
        let soundHTML = `
    <div class="sound">
    <div class="name">${trackName}</div>
    <div class="play" onclick="onClickPlay()">
        <audio id="${trackName}-audio" onended="stopPlayback()" onplay="startPlayback()">
        <source src="${dir}/${trackName}.m4a" type="audio/mpeg" />
        </audio>
        <i class="fas fa-play"></i>
    </div>
    <div class="remove" onclick="removeAudio()">
        <i class="fas fa-times"></i>
    </div>
    </div>
    `;
    // add to page
    const soundsContainer = document.querySelector("#sounds-container .sound-items");
    soundsContainer.innerHTML += soundHTML;

        // add event listeners
        addAudioEvtListeners();

        // update selects
        addToSelects(name);

        // clear file field
        inputFile.value = '';

        // set trigger sound
        // let select = document.getElementById(`${trackName}-select`);
        // select.value = trackName;

    });



}