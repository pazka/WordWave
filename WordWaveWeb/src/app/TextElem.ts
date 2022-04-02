
export class TextElem {
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
        this.elem.style.fontSize = `5px`;

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
