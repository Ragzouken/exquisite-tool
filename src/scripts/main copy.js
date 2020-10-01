class Thingy {
    constructor() {
        this.rendering = createRendering2D(200, 150);
        this.canvas = this.rendering.canvas;
        this.matrix = new DOMMatrixReadOnly();
    }

    setMatrix(matrix) {
        this.matrix = matrix;
        this.canvas.style.setProperty('transform', matrix.toString());
    }
}

async function start() {
    const container = document.getElementById("scene-container");
    const brush = createRendering2D(5, 5);
    fillRendering2D(brush, 'green');

    for (let i = 0; i < 10; ++i) {
        const thingy = new Thingy();
        fillRendering2D(thingy.rendering, `white`);
        thingy.canvas.addEventListener('pointerenter', () => fillRendering2D(thingy.rendering, `red`));
        thingy.canvas.addEventListener('pointerleave', () => {
            fillRendering2D(thingy.rendering, `white`);
            thingy.setMatrix(thingy.matrix.rotate(13));
        });
        thingy.canvas.addEventListener('pointermove', (event) => {
            const rect = container.getBoundingClientRect();
            const [x, y] = [event.clientX - rect.x, event.clientY - rect.y];
            const inv = thingy.matrix.inverse();
            const pos = inv.transformPoint(new DOMPointReadOnly(x, y));
            thingy.rendering.drawImage(brush.canvas, Math.round(pos.x), Math.round(pos.y));
        });
        container.appendChild(thingy.canvas);
        const matrix = (new DOMMatrixReadOnly()).scale(i / 3).translate(i * 100, 50 * i).rotate(i * 10);
        thingy.setMatrix(matrix);
    }
}
