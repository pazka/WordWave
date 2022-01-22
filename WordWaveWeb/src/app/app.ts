import {PerspectiveCamera, Scene, TextureLoader, Vector3, WebGLRenderer} from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import {Sphere} from "./shapes";
import {TextSprite} from "./shapes/TextSprite";

class Text {
    elem: HTMLElement
    text : string
    id: number
    rnd : number = Math.random()
    
    constructor(text:string,id : number) {
        this.elem = document.createElement('p')
        this.elem.textContent = text
        let body = document.getElementsByTagName('body')[0]
        body.append(this.elem)
        
        this.id = id
        this.text = text
    }
}

export class App {
    all_texts: Text[] = []

    constructor() {
        setInterval(()=>this.render(), 1)
    }

    public addText(text: string) {
        let newText = new Text(text,this.all_texts.length)

        this.all_texts.push(newText)
    }
    
    private render() {
        const t = Date.now() / 1000000
        this.all_texts.forEach((text: Text) => {
            let l = text.text.length / 8
            text.elem.style.top = 500+text.rnd * Math.sin(text.id * t) * l * 500 + 'px'
            text.elem.style.left = 800+text.rnd * Math.cos(text.id * t) * l * 500 + 'px';
        })
    };

    public resize(width: number, height: number) {
    }

}