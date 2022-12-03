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

    constructor(text: string, id: number) {
        this.elem = document.createElement('p')
        this.elem.id = 'txt'+id
        this.elem.style.transition = 'all 1s'
        this.elem.style.top = '0px'
        this.elem.style.left = '0px'
        this.elem.style.fontSize = `5px`;
        this.setText(this.text)
        this.updateFlag = this.id < Number.MAX_SAFE_INTEGER/2

        let body = document.getElementsByTagName('body')[0]
        body.append(this.elem)

        let options = {
            root: this.elem,
            rootMargin: '0px',
            threshold: 1.0
        }

        //this.intersectObs = new IntersectionObserver(this.handleOutsideOfScreen, options);

        this.id = id
        this.text = text
    }

    // handleOutsideOfScreen(entry : any){
    //     console.log(entry.intersectionRatio ,entry)
    // }

    destroy() {
        this.elem.remove()
    }

    setText(text: string) {
        this.elem.textContent = text
    }

    refresh() {
        this.setText(this.text)
    }
}
