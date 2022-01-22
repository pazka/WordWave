import {App} from './app/app';
import * as events from "./app/events";
import {On} from "./app/events";
import {getTextData} from "./app/rest";

class Main {

    private app: App;

    constructor() {
        this.app = new App(document.getElementById('three-canvas') as HTMLCanvasElement, window.innerWidth, window.innerHeight);
        window.addEventListener("resize", this.resize);
        (document.getElementById('btn') as HTMLCanvasElement).addEventListener("click", () => this.app.addText("OKOK"));
        this.init_com()
    }

    private init_com() {
        events.sub(On.new_text, "app", (data: any) => this.app.addText(data))
        getTextData('/words/current').then((data: string) => {
            data.split(' ').forEach(
                (word: any) => {
                    this.app.addText(word)
                }
            )
        }).catch(err=>{
            console.error(err)
        })
    }

    private resize = (): void => {
        this.app.resize(window.innerWidth, window.innerHeight);
    }

}

new Main();