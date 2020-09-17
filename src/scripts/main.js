let project;
let palette = { default: 0 };
/** @type {string} */
let activeBrushId;

async function start() {
    const dataElement = document.getElementById("exquisite-tool-b-data");
    project = JSON.parse(dataElement.innerHTML);

    const sceneContainer = document.getElementById("scene-container");
    sceneContainer.innerHTML = "";

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

    const panel = getDrawingSettingsPanel();
    panel.drawingSelect.addEventListener("input", () => {
        setActiveDrawing(project.drawings[parseInt(panel.drawingSelect.value, 10)]);
    });
    panel.nameInput.addEventListener("input", () => {
        activeDrawing.name = panel.nameInput.value;
    });
    panel.resizeButton.addEventListener("click", () => {
        resizeRendering2D(
            drawingToRendering2d.get(activeDrawing),
            parseInt(panel.widthInput.value, 10),
            parseInt(panel.heightInput.value, 10),
        );
        setActiveDrawing(activeDrawing);
    });
    panel.cloneButton.addEventListener("click", () => {
        const clone = {...activeDrawing};
        clone.name += " copy";
        const rendering = copyRendering2D(getActiveRendering());
        makeDrawable(rendering);
        drawingToRendering2d.set(clone, rendering);
        project.drawings.push(clone);
        setActiveDrawing(clone);
        refreshDrawingSelect();
    });
    panel.clearButton.addEventListener("click", () => {
        fillRendering2D(getActiveRendering());
    });
    panel.deleteButton.addEventListener("click", () => {
        if (project.drawings.length === 0) return;

        const index = project.drawings.indexOf(activeDrawing);
        project.drawings.splice(index, 1);

        drawingToRendering2d.delete(activeDrawing);
        const first = Array.from(drawingToRendering2d.keys())[0];
        setActiveDrawing(first);
        refreshDrawingSelect();
    });

    await reloadAllDrawings();
    refreshDrawingSelect();
}

const drawingToRendering2d = new Map();

async function reloadAllDrawings() {
    drawingToRendering2d.clear();

    async function reload(drawing) {
        const image = await loadImage(drawing.image);
        const rendering = imageToRendering2D(image);

        makeDrawable(rendering);
        drawingToRendering2d.set(drawing, rendering);
    };

    await Promise.all(project.drawings.map(reload));

    const first = Array.from(drawingToRendering2d.keys())[0];
    setActiveDrawing(first);
}

function refreshDrawingSelect() {
    const panel = getDrawingSettingsPanel();
    
    while (panel.drawingSelect.children.length) 
        panel.drawingSelect.removeChild(panel.drawingSelect.children[0]);

    const options = project.drawings.map((drawing, i) => html("option", { value: i }, drawing.name));
    options.forEach((option) => panel.drawingSelect.appendChild(option));
    panel.drawingSelect.value = project.drawings.indexOf(activeDrawing);
}

function getDrawingSettingsPanel() {
    const drawingSelect = document.getElementById("drawing-select");
    const nameInput = document.getElementById("drawing-name");

    const widthInput = document.getElementById("resize-width");
    const heightInput = document.getElementById("resize-height");
    const resizeButton = document.getElementById("resize-submit");

    const cloneButton = document.getElementById("clone-button");
    const clearButton = document.getElementById("clear-button");
    const deleteButton = document.getElementById("delete-button");

    return { 
        drawingSelect, nameInput,
        widthInput, heightInput, resizeButton,
        cloneButton, clearButton, deleteButton,
    }
}

let activeDrawing;
function getActiveRendering() { return drawingToRendering2d.get(activeDrawing); }

const cursor = createRendering2D(8, 8);
cursor.canvas.setAttribute("id", "cursor");

function setActiveDrawing(drawing) {
    const container = document.getElementById("scene-container");
    const active = getActiveRendering();
    if (active) container.removeChild(active.canvas);
    activeDrawing = drawing;
    const rendering = drawingToRendering2d.get(drawing);
    container.appendChild(rendering.canvas);

    const [w, h] = [rendering.canvas.width, rendering.canvas.height];
    const zoom = Math.min(512/w, 512/h)|0;
    rendering.canvas.setAttribute("id", "drawing");
    rendering.canvas.setAttribute("style", `width: ${w*zoom}px; height: ${h*zoom}px`);

    resizeRendering2D(cursor, w, h);
    container.appendChild(cursor.canvas);
    cursor.canvas.setAttribute("style", `width: ${w*zoom}px; height: ${h*zoom}px`);

    const panel = getDrawingSettingsPanel();
    panel.widthInput.value = rendering.canvas.width.toString();
    panel.heightInput.value = rendering.canvas.height.toString();
    panel.nameInput.value = drawing.name;
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

    function draw(x, y, target = rendering) {
        const brush = getActiveBrush().canvas;
        const [ox, oy] = [brush.width / 2, brush.height / 2];
        target.drawImage(brush, x - ox|0, y - oy|0);
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
        const [x1, y1] = eventToPixel(event);
        fillRendering2D(cursor);
        draw(x1, y1, cursor);
        if (prevCursor === undefined) return;      
        const [x0, y0] = prevCursor;  
        lineplot(x0, y0, x1, y1, draw);
        prevCursor = [x1, y1];
    });
    document.addEventListener('pointerup', (event) => prevCursor = undefined);
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
    project.drawings.forEach((drawing) => {
        drawing.image = drawingToRendering2d.get(drawing).canvas.toDataURL("image/png");
    });

    const dataElement = document.getElementById("exquisite-tool-b-data");
    dataElement.innerHTML = JSON.stringify(project);

    const clone = /** @type {HTMLElement} */ (document.documentElement.cloneNode(true));
    const blob = new Blob([clone.outerHTML], {type: "text/html"});
    saveAs(blob, "exquisite-tool.html");
}
