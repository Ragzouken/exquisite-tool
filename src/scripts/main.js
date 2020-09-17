let project;
let palette = { default: 0 };
/** @type {string} */
let activeBrushId;

function start() {
    const dataElement = document.getElementById("exquisite-tool-b-data");
    project = JSON.parse(dataElement.innerHTML);

    const sceneContainer = document.getElementById("scene-container");
    sceneContainer.innerHTML = "";

    sceneContainer.append(rendering.canvas);
    rendering.canvas.setAttribute("style", "width: 512px; height: 512px;");
    rendering.canvas.id = "drawing";
    makeDrawable(rendering);
    fillRendering2D(rendering);
    loadImage(project.image).then((image) => rendering.drawImage(image, 0, 0));

    const brushEditor = /** @type {HTMLTextAreaElement} */ (document.getElementById("brush-editor"));
    function updateBrushFromEditor() {
        project.brushes[activeBrushId] = brushEditor.value;
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

    const wheel = new ColorWheel({});
    document.body.appendChild(wheel.root);

    const importInput = html("input", { "type": "file", "hidden": "true", "accept": ".html" });
    document.body.appendChild(importInput);
    const importButton = document.getElementById("import-button");
    importButton.addEventListener("click", () => importInput.click());

    importInput.addEventListener("change", async () => {
        const files = Array.from((importInput.files || []));
        const existing = new Set(Object.values(project.brushes));

        async function importFile(file) {
            const text = await textFromFile(file);
            const html = await htmlFromText(text);
            const json = html.querySelector("#exquisite-tool-b-data").innerHTML;
            const data = JSON.parse(json);

            Object.entries(data.brushes).forEach(([id, brush]) => {
                if (!existing.has(brush)) project.brushes[nanoid()] = brush;
            });

            const palette = Object.assign(parsePalette(data.palette), parsePalette(project.palette));
            delete palette["default"];
            project.palette = Object.entries(palette).map(([char, number]) => `${char} ${numberToHex(number)}`).join("\n");
        }

        await Promise.all(files.map(importFile));
        paletteEditor.value = project.palette;
        updatePaletteFromEditor();
    });
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

/**
 * @param {CanvasRenderingContext2D} rendering 
 */
function makeDrawable(rendering) {
    let prevCursor = undefined;

    function draw(x, y) {
        const brush = getActiveBrush().canvas;
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
    fillRendering2D(rendering);
}

/** @type {HTMLElement[]} */
const brushToggles = [];
const brushContainer = document.getElementById("brushes-container");
const brushEditor = /** @type {HTMLTextAreaElement} */ (document.getElementById("brush-editor"));
const brushes = [];

const paletteEditor = /** @type {HTMLTextAreaElement} */ (document.getElementById("palette-editor"));

/**
 * @param {string} brushId
 */
function setActiveBrush(brushId) {
    activeBrushId = brushId;
    brushes.forEach((brush) => {
        brush.toggle.classList.toggle("active", activeBrushId === brush.brushId);
    });
    if (activeBrushId)
        brushEditor.value = project.brushes[activeBrushId];
}

function getActiveBrush() {
    return brushes.find((brush) => brush.brushId === activeBrushId);
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

    toggle.addEventListener('click', (event) => setActiveBrush(brushId));

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

    setActiveBrush((getActiveBrush() || brushes[0]).brushId);
}

function deleteBrush() {
    if (brushes.length === 0) return;

    delete project.brushes[activeBrushId];
    reloadAllBrushes();
}

function duplicateBrush() {
    const brushId = nanoid();
    project.brushes[brushId] = project.brushes[activeBrushId];
    activeBrushId = brushId;
    reloadAllBrushes();
}

async function exportImage() {
    const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("drawing"));
    canvas.toBlob(blob => {
        if (blob) saveAs(blob, "image.png");
    });
}

function exportEditor() {
    const dataElement = document.getElementById("exquisite-tool-b-data");
    const drawing = /** @type {HTMLCanvasElement} */ (document.getElementById("drawing"));
    project.image = drawing.toDataURL('image/png');
    dataElement.innerHTML = JSON.stringify(project);

    const clone = /** @type {HTMLElement} */ (document.documentElement.cloneNode(true));
    const blob = new Blob([clone.outerHTML], {type: "text/html"});
    saveAs(blob, "exquisite-tool.html");
}
