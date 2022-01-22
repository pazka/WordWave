import { BoxGeometry, Mesh, MeshBasicMaterial } from "three";

export class Cube extends Mesh {

    constructor() {
        super(
            new BoxGeometry(),
            new MeshBasicMaterial({ color: "#ff9800", wireframe: true })
        );
    }

    public rotate(): void {
        this.rotation.x += 0.01;
        this.rotation.y += 0.01;
    }

}