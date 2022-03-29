let s2t : SpeechRecognition = null
let wantedState = "stopped"
let forceRetry = true

const handlers = {
    start : ()=>{}, // Fired when the speech recognition service has begun listening to incoming audio with intent to recognize grammars associated with the current SpeechRecognition
    end : ()=>{}, // Fired when the speech recognition service has disconnected.
    
    audiostart : ()=>{},
    audioend : ()=>{}, // Fired when the user agent has finished capturing audio.

    soundstart : ()=>{}, // Fired when any sound — recognizable speech or not — has been detected
    soundend : ()=>{},

    speechstart : ()=>{}, // Fired when sound that is recognized by the speech recognition service as speech has been detected.
    speechend : ()=>{},
    
    error : ()=>{}, // 
    result : ()=>{} // Fired when the speech recognition service returns a result — a word or phrase has been positively recognized and this has been communicated back to the app
}

export function setListener(event : string,callback : Function){
    if(!Object.keys(handlers).includes(event))
        console.error(`No events ${event} to listen to, available are : ${Object.keys(handlers)}`)
    
    handlers[event] = callback
}

export function initSpeechRecognition(lang = 'fr-FR') {
    console.log("Initing speechRecognition")
    if (s2t){
        console.warn("Restarting SpeechRecognition")
        s2t.onstart = ()=>{}
        s2t.onend = ()=>{}
        
        s2t.onspeechend = ()=>{}
        s2t.onaudioend = ()=>{}
        s2t.onsoundend = ()=>{}
        
        s2t.onspeechstart = ()=>{}
        s2t.onaudioend = ()=>{}
        s2t.onsoundstart = ()=>{}
        s2t.stop()
        s2t.abort()
    }

    const SpeechRecognition = window.speechRecognition || window.webkitSpeechRecognition;
    s2t = new SpeechRecognition();
    s2t.lang = lang;
    s2t.continuous = true;

// This runs when the speech recognition service starts
    s2t.onstart = function (e) {
        console.log("[S2T] : Started");
        handlers.start(e)
    };

    s2t.onend = function (e) {
        console.log("[S2T] : End");
        if (wantedState === "started" && forceRetry) {
            s2t.start();
            return;
        }
        
        handlers.end(e)
    }
    
    s2t.onerror = function (e) {
        console.log("[S2T] : Error",e);
        handlers.error(e)
    }

    s2t.onspeechend = function (e) {
        console.log("[S2T] : Speech End");
        handlers.speechend(e)
    }
    s2t.onaudioend = function (e) {
        console.log("[S2T] : Audio End");
        handlers.audioend(e)
    }
    s2t.onsoundend = function (e) {
        console.log("[S2T] : Sound End");
        handlers.soundend(e)
    }
    s2t.onspeechstart = function (e) {
        console.log("[S2T] : Speech Start");
        handlers.speechstart(e)
    }
    s2t.onaudiostart = function (e) {
        console.log("[S2T] : Audio Start");
        handlers.audiostart(e)
    }
    s2t.onsoundstart = function (e) {
        console.log("[S2T] : Sound Start");
        handlers.soundstart(e)
    }

// This runs when the speech recognition service returns result
    s2t.onresult = function (event) {
        let res = event.results[event.results.length - 1]

        var transcript = res[0].transcript;
        var confidence = res[0].confidence;

        console.log(transcript, confidence)
        handlers.result(transcript)
    };
}

export function startSpeechRecognition() {
    if (!s2t)
        throw new Error("s2t not inited")

    wantedState = "started"
    s2t.start();
    console.log("[S2T]=", wantedState)
}

export function stopSpeechRecognition() {
    if (!s2t)
        throw new Error("s2t not inited")

    wantedState = "stopped"
    s2t.stop();
    console.log("[S2T]=", wantedState)
}

export function setForceRetry(shouldForceRetry) {
    console.log("[S2T] ForcedRetry is", shouldForceRetry)
    forceRetry = shouldForceRetry
}