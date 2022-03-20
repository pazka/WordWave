
let s2t

function checkInit(checkNotInit ){
    if(s2t && !shouldBeInited)
        throw new Error("Already inited SpeechRecognition")
    if(!s2t && shouldBeInited)
        throw new Error("Didn't init SpeechRecognition")
}

export function initSpeechRecognition(lang = 'fr-FR'){
    checkInit(true)
    
    let SpeechRecognition = SpeechRecognition || webkitSpeechRecognition;
    s2t = new SpeechRecognition();
    s2t.lang = lang;
    s2t.continuous = true;

// This runs when the speech recognition service starts
    s2t.onstart = function () {
        console.log("We are listening. Try speaking into the microphone.");
    };

    s2t.onspeechend = function () {
        // when user is done speaking
        //recognition.stop();
        //recognition.start();
    }

// This runs when the speech recognition service returns result
    s2t.onresult = function (event) {
        let res = event.results[event.results.length-1]

        var transcript = res[0].transcript;
        var confidence = res[0].confidence;

        console.log(transcript,confidence)
    };
}

const handlers = {}
export function addSpeechRecognizedListener(handler) {
    const handlerId = Math.random() * Date.now()
    handlers[handlerId] = handler
    return handlerId
}

export function removeSpeechRecognizedListener(handlerId) {
    delete handlers[handlerId]
}

export function startSpeechRecognition(){
    checkInit()
    
    s2t.start();
}
export function stopSpeechRecognition(){
    checkInit()
    
    s2t.stop();
}