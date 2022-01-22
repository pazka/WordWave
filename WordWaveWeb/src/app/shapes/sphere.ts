import { Mesh, MeshBasicMaterial, SphereGeometry } from "three";

export class Sphere extends Mesh {

    constructor() {
        super(
            new SphereGeometry(1, 20, 20),
            new MeshBasicMaterial({ color: "#ff9800", wireframe: true })
        );
    }

    public rotate(): void {
        this.rotation.x += 0.01;
        this.rotation.y += 0.01;
    }

}