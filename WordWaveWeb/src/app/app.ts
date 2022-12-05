import {PerspectiveCamera, Scene, TextureLoader, Vector3, WebGLRenderer} from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import {Sphere} from "./shapes";
import {TextSprite} from "./shapes/TextSprite";
import {WordMeta} from "./DTO/WordData";
import {TextElem} from "./TextElem";
import {getXYRot} from "./positionRender";
import {tryKeepAwake} from "./wake-screen";

const START_CULLING_AFTER = 200

export class App {
    //TODO : Register allTexts by word not by array, to keep track of already added words

    allTexts: Record<string, TextElem> = {} // dict(word : Text)
    meta: WordMeta = new WordMeta()
    uvSize = window.innerHeight / window.innerWidth > 1 ? window.innerWidth : window.innerHeight
    sizeX = window.innerWidth
    sizeY = window.innerHeight
    startTime = Date.now()
    params = new URLSearchParams(new URL(window.location.href).search)
    count = 1
    

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

    cullBatchSize = 800
    doNotCullAt = 5
    cullCount = 0
    cullCountDone = 0

    public shouldCull(occ: number) {
        //
        if (
            Object.keys(this.allTexts).length > START_CULLING_AFTER &&
            occ < this.doNotCullAt &&
            this.cullCount++ < this.cullBatchSize
        ) {
            console.debug(`the weak has been culled n°${this.cullCountDone}/${this.cullCount} : ${this.cullCount - this.cullCountDone} left`)
            this.cullCountDone++
            return true
        }

        if (this.cullCount > this.cullBatchSize) {
            this.cullCount = 0
        }

        return false
    }

    public addWordCount(text: string, occ = 1) {
        if (this.params.has("min") && !(occ >= Number(this.params.get("min"))))
            return
        
        if(this.shouldCull(occ))return

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
        const t = Date.now() / 20000
        let rdmAmplitude = 25
        //@ts-ignore
        Object.values(this.allTexts).forEach((text: TextElem) => {
            if(text.isCulled) return

            let cos = Math.cos(text.id % (2 * Math.PI) + t)
            let sin = Math.sin(text.id % (2 * Math.PI) + t)

            if(!text.elem) return
            let boxWidth = text.elem.offsetWidth;
            let boxHeight = text.elem.offsetHeight;
            let sincos = cos - sin
            let l = text.text.length / 8

            let rawOccRate = (text.occ - this.meta.min_occ) / ((this.meta.max_occ - this.meta.min_occ) || 1)
            let occRate = 0.01 + 0.99 * rawOccRate
            /**
             * Transformation because too many words are spoken too rarely and very little words are spoken often
             * The rule is the zipf law or something like that
             *
             * The goal is to linearize an exponetial function
             * linearization function : y=Ae^(Bx) => y=Bx+log(A)
             */
            let uvOcc = (1 - occRate) * Math.log1p(occRate) * 5

            let colorUv1 = (1 - occRate) * Math.log1p(occRate) * 4
            //let colorUv = Math.pow(Math.tan(occRate), 2) / (occRate+1.4)
            let colorUv = Math.atan(2*occRate)*Math.pow(0.9,occRate)

            if (occRate < 0.02) {
                rdmAmplitude = 800
            }

            let rdmX = cos * text.rndX * rdmAmplitude
            let rdmY = sin * text.rndY * rdmAmplitude

            const sizeXWithoutExtraParams = this.sizeX - boxWidth - Math.abs(rdmX)
            const sizeYWithoutExtraParams = this.sizeY - boxHeight - Math.abs(rdmY)

            const centerX = sizeXWithoutExtraParams / 2
            const centerY = sizeYWithoutExtraParams / 2


            let uvx = (uvOcc * cos)
            let uvy = (uvOcc * sin)

            let possiblePosX = centerX + rdmX + (uvx * (sizeXWithoutExtraParams / 2))
            let possiblePosY = centerY + rdmY + (uvy * (sizeYWithoutExtraParams / 2))

            if (possiblePosX > this.sizeX - boxWidth) {
                possiblePosX = this.sizeX - boxWidth
            } else if (possiblePosX < 0) {
                possiblePosX = 0
            }

            if (possiblePosY > this.sizeY - boxHeight) {
                possiblePosY = this.sizeY - boxHeight
            } else if (possiblePosY < 0) {
                possiblePosY = 0
            }

            text.elem.style.left = possiblePosX + 'px';
            text.elem.style.top = possiblePosY + 'px'

            const textSize = this.uvSize/10
            text.elem.style.fontSize = `${textSize * occRate + textSize/8 + textSize/12*text.rndX }px`;
            text.elem.style.zIndex = '' + Math.round(10000 * rawOccRate);

            //text.elem.style.color = `rgb(${colorUv1},${colorUv1},${colorUv})`
            text.elem.style.color = App.getGradientColor(colorUv, [100, 100, 100], [255, 255, 255])

            text.updateFlag = true
        })
    };

    private static getGradientColor(uv: number, c1: number[], c2: number[]): string {
        const res = [
            c1[0] + (c2[0] - c1[0]) * uv,
            c1[1] + (c2[1] - c1[1]) * uv,
            c1[2] + (c2[2] - c1[2]) * uv,
        ]

        return `rgb(${res.join(',')})`
    }

    private rendera(timestamp: number = Date.now()) {
        const t = Date.now() / 10000000
        Object.values(this.allTexts).forEach((text: TextElem) => {

            const [x, y, rot] = getXYRot(text, t)

            if(!text.elem) return
            text.elem.style.top = y + 'px'
            text.elem.style.left = x + 'px';
            text.elem.style.transform = `rotate(${rot}deg)`;
        })
    };

    public resize(width: number, height: number) {
    }

}