import {PerspectiveCamera, Scene, TextureLoader, Vector3, WebGLRenderer} from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import {Sphere} from "./shapes";
import {TextSprite} from "./shapes/TextSprite";
import {WordMeta} from "./DTO/WordData";
import {TextElem} from "./TextElem";
import {getXYRot} from "./positionRender";
import {tryKeepAwake} from "./wake-screen";

export class App {
    //TODO : Register allTexts by word not by array, to keep track of already added words

    allTexts: Record<string, TextElem> = {} // dict(word : Text)
    meta: WordMeta = new WordMeta()
    size = window.innerHeight / window.innerWidth > 1 ? window.innerWidth : window.innerHeight
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
        console.log("replacing", this.meta, "with", meta)
        this.meta = meta
        console.log("is now", this.meta)
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

    cullLimit = 8
    cullCount = 0
    cullCountDone = 0

    public shouldCull(occ: number) {
        //
        if (occ < 3 && (this.cullCount++ % this.cullLimit)) {
            console.debug(`the weak has been culled n°${this.cullCountDone}/${this.cullCount} : ${this.cullCount - this.cullCountDone} left`)
            this.cullCountDone++
            return true
        }

        return false
    }

    public addWordCount(text: string, occ = 1) {
        if (this.params.has("min") && !(occ >= Number(this.params.get("min"))))
            return

        if (this.shouldCull(occ)) {
            return
        }

        if (this.allTexts[text]) {
            this.allTexts[text].occ = occ
        } else {
            //let newText = new Text(text, Object.keys(this.allTexts).length)
            let newText = new TextElem(text, Math.random() * Number.MAX_SAFE_INTEGER)
            newText.occ = occ

            this.allTexts[text] = newText
        }

        this.allTexts[text].refresh()
    }

    private render(timestamp: number = Date.now()) {
        const t = Date.now() / 10000
        const rdmAmpl = 50
        //@ts-ignore
        Object.values(this.allTexts).forEach((text: TextElem) => {
            let cos = Math.cos(text.id % (2 * Math.PI) + t)
            let sin = Math.sin(text.id % (2 * Math.PI) + t)
            let sincos = cos - sin
            let l = text.text.length / 8

            let rawOccRate = (text.occ - this.meta.min_occ) / ((this.meta.max_occ - this.meta.min_occ) || 1)
            let occRate = 0.02 + 0.88 * rawOccRate
            // y=Ae^(Bx) => y=Bx+log(A)
            let linOccRate = (1 - occRate) * Math.log1p(occRate) * 6
            let uvOcc = linOccRate
            let rdm = text.rnd * rdmAmpl - rdmAmpl / 2
            let rdm1 = text.rnd1 * rdmAmpl - rdmAmpl / 2

            const width = this.size / 2 - 100
            const colorUv = 50 + 205 * rawOccRate
            //const colorUv = 100 + 155 * rawOccRate
            const colorUv1 = 30 + 60 * rawOccRate

            const uvy = (uvOcc * sin)
            const uvx = (uvOcc * cos)

            text.elem.style.top = (width + (width / 5)) + uvy * (width) + rdm + 'px'
            text.elem.style.left = "calc(45vw + " + (uvx * (width) + rdm1) + 'px)';
            
            text.elem.style.fontSize = `${5 + occRate * 70}px`;
            text.elem.style.zIndex = '' + Math.round(10000 * rawOccRate);

            //text.elem.style.color = `rgb(${colorUv1},${colorUv1},${colorUv})`
            text.elem.style.color = `rgb(${colorUv},${colorUv},${colorUv})`
        })
    };

    private rendera(timestamp: number = Date.now()) {
        const t = Date.now() / 10000000
        Object.values(this.allTexts).forEach((text: TextElem) => {

            const [x, y, rot] = getXYRot(text, t)

            text.elem.style.top = y + 'px'
            text.elem.style.left = x + 'px';
            text.elem.style.transform = `rotate(${rot}deg)`;
        })
    };

    public resize(width: number, height: number) {
    }

}