import {App} from './app/app';
import * as events from "./app/events";
import {On} from "./app/events";
import {getJsonData} from "./app/rest";
import SocketIOService from "./app/socket";
import {WordData} from "./app/DTO/WordData";
import {tryKeepAwake} from "./app/wake-screen";

class Main {

    private app: App;
    private socket = SocketIOService()
    params = new URLSearchParams(new URL(window.location.href).search)

    constructor() {
        this.app = new App()
        this.init_com()
        tryKeepAwake()
        
        if(this.params.has("light"))
            document.getElementsByTagName('body')[0].className = "light"
    }

    private init_com() {
        events.sub(On.new_text, "app", (data: WordData) =>{
            this.app.saveMeta(data.meta)
            this.app.saveWordCount(data.words)
        })

        events.sub(On.reset, "reset", (data: WordData) =>{
            this.init_com()
        })

        events.sub(On.reload, "reload", (data: WordData) =>{
            window.location.reload()
        })

        getJsonData('/words/current').then((data: WordData) =>{
            this.app.saveMeta(data.meta)    
            this.app.loadWordCount(data.words)
        }).catch(err => {
            console.error(err)
        })
    }

    private resize = (): void => {
        this.app.resize(window.innerWidth, window.innerHeight);
    }

}

new Main();