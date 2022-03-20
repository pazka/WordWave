import {On, send} from "./events";

export default class Speech2Text {
    recognition

     public constructor() {
        //@ts-ignore
        let SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'fr-FR';
        this.recognition.continuous = true;

        // This runs when the speech recognition service starts
        this.recognition.onstart = function () {
            console.log("We are listening. Try speaking into the microphone.");
        };

        this.recognition.onspeechend = function () {
            console.log("We are listening. Try speaking into the microphone.");
            // when user is done speaking
            //recognition.stop();
        }

        // This runs when the speech recognition service returns result
        this.recognition.onresult = function (event: any) {
            let res = event.results[event.results.length - 1]

            var transcript = res[0].transcript;
            var confidence = res[0].confidence;

            console.log(transcript, confidence)
            send(On.new_text, transcript)
        };

        // start recognition
        this.recognition.start();
    }
}