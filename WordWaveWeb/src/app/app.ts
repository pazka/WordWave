import {PerspectiveCamera, Scene, TextureLoader, Vector3, WebGLRenderer} from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import {Sphere} from "./shapes";
import {TextSprite} from "./shapes/TextSprite";
import {WordMeta} from "./DTO/WordData";

class Text {
    elem: HTMLElement
    text: string
    id: number
    rnd: number = Math.random()
    occ : number = 1

    constructor(text: string, id: number) {
        this.elem = document.createElement('p')
        this.elem.textContent = text
        let body = document.getElementsByTagName('body')[0]
        body.append(this.elem)

        this.id = id
        this.text = text
    }
}

export class App {
    //TODO : Register allTexts by word not by array, to keep track of already added words
    
    allTexts: Record<string,Text> = {} // dict(word : Text)
    meta : WordMeta = new WordMeta()
    
    constructor() {
        setInterval(() => this.render(), 1)
    }
    
    public saveMeta(meta : WordMeta){
        this.meta = meta
    }

    public loadWordCount(wordCount : Record<string, number>){
        this.allTexts = {}
        this.saveWordCount(wordCount)
    }
    
    public saveWordCount(wordCount : Record<string, number>){
        Object.keys(wordCount).forEach(word=>{
            this.addWordCount(word,wordCount[word])
        })
    }
    
    public addWordCount(text: string,occ = 1) {
        let newText = new Text(text,Object.keys(this.allTexts).length)
        newText.occ = occ
        
        this.allTexts[newText.text] = newText
    }

    private render() {
        const t = Date.now() / 1000000
        //@ts-ignore
        Object.values(this.allTexts).forEach((text: Text) => {
            let sin = Math.sin((text.id * t)% 400 )
            let cos = Math.cos((text.id * t)% 400 )
            let l = text.text.length / 8

            let occ = 0.1 + 0.9 * (text.occ-this.meta.min_occ) / (this.meta.max_occ-this.meta.min_occ)
            
            text.elem.style.top = 500 +  text.occ * sin * l * 500 + 'px'
            text.elem.style.left = 800 +  text.occ * cos * l * 500 + 'px';
            text.elem.style.transform = `scale(${occ*5})`;
        })
    };

    private rendera() {
        const t = Date.now() / 10000000
        Object.values(this.allTexts).forEach((text: Text) => {
            let sin = Math.sin(text.id * t)
            let cos = Math.cos(text.id * t)
            let l = text.text.length / 8


            let angleRadian = (sin > 0) ? Math.acos(cos) : -Math.acos(cos);
            let rot = angleRadian * 180 / Math.PI;

            text.elem.style.top = 500 + text.rnd * sin * l * 500 + 'px'
            text.elem.style.left = 800 + text.rnd * cos * l * 500 + 'px';
            text.elem.style.transform = `rotate(${rot}deg)`;
        })
    };

    public resize(width: number, height: number) {
    }

}