let project;
let palette = { default: 0 };

function start() {
    const dataElement = document.getElementById("exquisite-tool-b-data");
    project = JSON.parse(dataElement.innerHTML);

    const sceneContainer = document.getElementById("scene-container");
    sceneContainer.innerHTML = "";

    sceneContainer.append(rendering.canvas);
    rendering.canvas.setAttribute("style", "width: 512px; height: 512px;");
    rendering.canvas.id = "drawing";
    makeDrawable(rendering);
    clearRendering2D(rendering);
    loadImage(project.image).then((image) => rendering.drawImage(image, 0, 0));

    const brushEditor = /** @type {HTMLTextAreaElement} */ (document.getElementById("brush-editor"));
    function updateBrushFromEditor() {
        project.brushes[activeBrush.brushId] = brushEditor.value;
        reloadAllBrushes();
    }
    brushEditor.addEventListener("input", () => updateBrushFromEditor());

    const paletteEditor = /** @type {HTMLTextAreaElement} */ (document.getElementById("palette-editor"));
    function updatePaletteFromEditor() {
        project.palette = paletteEditor.value;
        palette = parsePalette(project.palette);
        reloadAllBrushes();
    }
    paletteEditor.addEventListener("input", () => updatePaletteFromEditor());
    paletteEditor.value = project.palette;
    
    updatePaletteFromEditor();
}

function parsePalette(text) {
    const palette = { 'default': 0 };
    const lines = text.trim().split("\n");
    lines.forEach((line) => {
        try {
            const [char, hex] = line.trim().split(/\s+/);
            palette[char] = hexToNumber(hex);
        } catch (e) {}
    });
    return palette;
}

/**
 * @typedef {Object} Brush
 * @property {string} brushId
 * @property {HTMLElement} toggle
 * @property {HTMLCanvasElement} canvas
 * @property {CanvasRenderingContext2D} context
 * @property {HTMLElement} dataElement
 */

/** @type {Brush} */
let activeBrush;

/**
 * @param {CanvasRenderingContext2D} rendering 
 */
function makeDrawable(rendering) {
    let prevCursor = undefined;

    function draw(x, y) {
        const brush = activeBrush.canvas;
        const [ox, oy] = [brush.width / 2, brush.height / 2];
        rendering.drawImage(brush, x - ox|0, y - oy|0);
    }

    function eventToPixel(event) {
        const scale = rendering.canvas.width / rendering.canvas.clientWidth;
        const [px, py] = eventToElementPixel(event, rendering.canvas);
        return [px * scale, py * scale];
    }

    rendering.canvas.addEventListener('pointerdown', (event) => {
        killEvent(event);
        const [x1, y1] = eventToPixel(event);
        draw(x1, y1);
        prevCursor = [x1, y1];
    });
    document.addEventListener('pointermove', (event) => {
        if (prevCursor === undefined) return;
        const [x0, y0] = prevCursor;
        const [x1, y1] = eventToPixel(event);
        lineplot(x0, y0, x1, y1, draw);
        prevCursor = [x1, y1];
    });
    document.addEventListener('pointerup', (event) => prevCursor = undefined);
}

const rendering = createRendering2D(128, 128);
function clearImage() {
    clearRendering2D(rendering);
}

/** @type {HTMLElement[]} */
const brushToggles = [];
const brushContainer = document.getElementById("brushes-container");
const brushEditor = /** @type {HTMLTextAreaElement} */ (document.getElementById("brush-editor"));
const brushes = [];

const paletteEditor = /** @type {HTMLTextAreaElement} */ (document.getElementById("palette-editor"));

/**
 * @param {Brush} brush
 */
function setActiveBrush(brush) {
    activeBrush = brush;
    brushes.forEach((brush) => {
        brush.toggle.classList.toggle("active", activeBrush === brush);
    });
    if (activeBrush)
        brushEditor.value = project.brushes[activeBrush.brushId];
}

/**
* @param {string} brushId
* @param {CanvasRenderingContext2D} rendering 
*/
function addBrush(brushId, rendering) {
    const toggle = copyRendering2D(rendering).canvas;
    toggle.classList.add("tool-toggle");
    brushToggles.push(toggle);
    brushContainer.appendChild(toggle);

    const brush = {
        brushId,
        toggle,
        context: rendering,
        canvas: rendering.canvas,
    };
    brushes.push(brush);

    toggle.addEventListener('click', (event) => setActiveBrush(brush));

    return brush;
}

function clearBrushes() {
    brushToggles.length = 0;
    brushContainer.innerHTML = "";
    brushes.length = 0;
}

function reloadAllBrushes() {
    clearBrushes();
    Object.entries(project.brushes).forEach(([id, text]) => {
        const brush = textToRendering2D(text, palette);
        addBrush(id, brush);
    });

    const brushId = activeBrush ? activeBrush.brushId : undefined;
    setActiveBrush(brushes.find((brush) => brush.brushId === brushId) || brushes[0]);
}

function duplicateBrush() {
    const brushId = (Object.keys(project.brushes).length+1).toString();
    project.brushes[brushId] = project.brushes[activeBrush.brushId];
    activeBrush = { brushId };
    reloadAllBrushes();
}

async function exportImage() {
    const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("drawing"));
    canvas.toBlob(blob => {
        if (blob) saveAs(blob, "image.png");
    });
}

function exportEditor() {
    const image = document.getElementById("image");
    const drawing = /** @type {HTMLCanvasElement} */ (document.getElementById("drawing"));
    image.src = drawing.toDataURL('image/png');

    const clone = /** @type {HTMLElement} */ (document.documentElement.cloneNode(true));
    const blob = new Blob([clone.outerHTML], {type: "text/html"});
    saveAs(blob, "exquisite-tool.html");
}
