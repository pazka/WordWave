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
    rnd1: number = Math.random()
    occ: number = 1

    constructor(text: string, id: number) {
        this.elem = document.createElement('p')
        this.elem.textContent = text
        this.elem.style.transition = 'all 1s'
        this.elem.style.top = '0px'
        this.elem.style.left = '0px'

        let body = document.getElementsByTagName('body')[0]
        body.append(this.elem)

        this.id = id
        this.text = text
    }

    destroy() {
        this.elem.remove()
    }

    refresh() {
        this.elem.textContent = this.text
    }
}

export class App {
    //TODO : Register allTexts by word not by array, to keep track of already added words

    allTexts: Record<string, Text> = {} // dict(word : Text)
    meta: WordMeta = new WordMeta()
    uv = window.innerHeight / window.innerWidth > 1 ? window.innerWidth : window.innerHeight
    startTime = Date.now()
    params = new URLSearchParams(new URL(window.location.href).search)

    constructor() {
        let update = () => {
            window.requestAnimationFrame((t) => {
                this.render(t)
                update()
            })
        }
        update()
    }

    public saveMeta(meta: WordMeta) {
        this.meta = meta
    }

    public loadWordCount(wordCount: Record<string, number>) {
        Object.values(this.allTexts).forEach(text => {
            text.destroy()
        })

        this.allTexts = {}
        this.saveWordCount(wordCount)
    }

    public saveWordCount(wordCount: Record<string, number>) {
        Object.keys(wordCount).forEach(word => {
            this.addWordCount(word, wordCount[word])
        })
    }

    public addWordCount(text: string, occ = 1) {
        if (this.params.has("min") && !(occ >= Number(this.params.get("min"))))
            return

        if (this.allTexts[text]) {
            this.allTexts[text].occ = occ
        } else {
            //let newText = new Text(text, Object.keys(this.allTexts).length)
            let newText = new Text(text, Math.random() * Number.MAX_SAFE_INTEGER)
            newText.occ = occ

            this.allTexts[text] = newText
        }

        this.allTexts[text].refresh()
    }

    private render(timestamp: number = Date.now()) {
        const t = Date.now() / 5000
        const rdmAmpl = 50
        //@ts-ignore
        Object.values(this.allTexts).forEach((text: Text) => {
            let cos = Math.cos(text.id % (2 * Math.PI) + t)
            let sin = Math.sin(text.id % (2 * Math.PI) + t)
            let sincos = cos - sin
            let l = text.text.length / 8

            let rawOccRate = (text.occ - this.meta.min_occ) / ((this.meta.max_occ - this.meta.min_occ) || 1)
            let occRate = 0.1 + 0.88 * rawOccRate
            // y=Ae^(Bx) => y=Bx+log(A)
            let linOccRate = (1 - occRate) * Math.log1p(occRate) * 6
            let rdm = text.rnd * rdmAmpl - rdmAmpl / 2
            let rdm1 = text.rnd1 * rdmAmpl - rdmAmpl / 2

            const width = this.uv / 2 - 100
            text.elem.style.top = (width + (width / 5)) + (linOccRate * sin) * (width) + rdm + 'px'
            text.elem.style.left = "calc(45vw + " + ((linOccRate * cos) * (width) + rdm1) + 'px)';
            text.elem.style.fontSize = `${5 + occRate * 50}px`;
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