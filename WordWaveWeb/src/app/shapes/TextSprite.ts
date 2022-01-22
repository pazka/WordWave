import TextTexture from '@seregpie/three.text-texture';
import {Sprite, SpriteMaterial} from "three";

export class TextSprite extends Sprite {
    constructor(text: string) {
        let texture = new TextTexture({
            alignment: 'left',
            color: '#24ff00',
            fontFamily: '"Times New Roman", Times, serif',
            fontSize: 80,
            fontStyle: 'bold',
            text: text,
        });
        let material = new SpriteMaterial({map: texture});
        super(material);
        texture.redraw();
        this.scale.setY(texture.height / texture.width)
        this.position.set( 5*Math.random(), 5*Math.random(),  5*Math.random())
    }

}