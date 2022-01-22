import {App} from './app/app';
import * as events from "./app/events";
import {On} from "./app/events";
import {getTextData} from "./app/rest";
import SocketIOService from "./app/socket";

class Main {

    private app: App;
    private socket = SocketIOService()

    constructor() {
        this.app = new App()
        this.init_com()
    }

    private init_com() {
        events.sub(On.new_text, "app", (data: any) =>
                data.split(' ').forEach(
                    (word: string) => this.app.addText(word)
                )
        )
        getTextData('/words/current').then((data: string) =>
            data.split(' ').forEach(
                (word: string) => this.app.addText(word)
            )
        ).catch(err => {
            console.error(err)
        })
    }

    private resize = (): void => {
        this.app.resize(window.innerWidth, window.innerHeight);
    }

}

new Main();