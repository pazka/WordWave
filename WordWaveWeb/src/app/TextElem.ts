export class TextElem {
    elem: HTMLElement
    text: string
    id: number
    // [-0.5;0.5]
    rndX: number = Math.random() - 0.5
    // [-0.5;0.5]
    rndY: number = Math.random() - 0.5
    occ: number = 1
    updateFlag = false
    isCulled = false
    styleMemo: any = {}

    constructor(text: string, id: number) {
        this.id = id
        this.text = text
        this.updateFlag = this.id < Number.MAX_SAFE_INTEGER / 2
        this.initHtml()

        let options = {
            root: this.elem,
            rootMargin: '0px',
            threshold: 1.0
        }

        //this.intersectObs = new IntersectionObserver(this.handleOutsideOfScreen, options);

    }

    initHtml() {
        if(this.elem) {
            this.elem.style.display = "inherit"
        }
        this.elem = document.createElement('p')
        this.elem.id = 'txt' + this.id
        this.elem.style.transition = 'all 1s'
        this.elem.style.top = '0px'
        this.elem.style.left = '0px'
        this.elem.style.fontSize = `5px`;
        this.setText(this.text)
        let body = document.getElementsByTagName('body')[0]
        body.append(this.elem)
    }

    // handleOutsideOfScreen(entry : any){
    //     console.log(entry.intersectionRatio ,entry)
    // }

    destroy() {
        if(this.elem) {
            this.elem.style.display = "none"
        }
    }

    setText(text: string) {
        if (this.elem)
            this.elem.textContent = text
    }
    
    isDestroyed(){
        return this.elem?.style.display == "none"
    }

    setIsCulled(value: boolean) {
        this.isCulled = value

        if (this.isDestroyed() && !this.isCulled) {
            this.initHtml();
        } else if (!this.isDestroyed() && this.isCulled) {
            this.destroy()
        }
    }

    refresh() {
        this.setText(this.text)
    }
}
