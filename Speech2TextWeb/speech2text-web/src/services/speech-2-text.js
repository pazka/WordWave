
let s2t = null
const handlers = {}

export function initSpeechRecognition(lang = 'fr-FR'){
    if(s2t)
        return
    
    const SpeechRecognition = window.speechRecognition || window.webkitSpeechRecognition;
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
        handlers.forEach(h=>{
            h(transcript)
        })
    };
}

export function addSpeechRecognizedListener(handler) {
    const handlerId = Math.random() * Date.now()
    handlers[handlerId] = handler
    return handlerId
}

export function removeSpeechRecognizedListener(handlerId) {
    delete handlers[handlerId]
}

export function startSpeechRecognition(){
    if(!s2t)
        throw "s2t not inited"
    
    s2t.start();
}
export function stopSpeechRecognition(){
    if(!s2t)
        throw "s2t not inited"
    
    s2t.stop();
}