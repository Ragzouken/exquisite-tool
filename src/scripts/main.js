/** @type {{ drawings: any[], [key: string]: any }} */
let project;
let palette = { default: 0 };
/** @type {string} */
let activeBrushId;

const wheel = new ColorWheel({});

async function start() {
    const dataElement = document.getElementById("exquisite-tool-c-data");
    project = JSON.parse(dataElement.innerHTML);

    const sceneContainer = document.getElementById("scene-container");
    sceneContainer.innerHTML = "";

    document.getElementById("color-container").appendChild(wheel.root);
    wheel.root.addEventListener("input", () => refreshSpecialBrush());

    const importInput = html("input", { "type": "file", "hidden": "true", "accept": ".html" });
    const importDrawingInput = html("input", { "type": "file", "hidden": "true", "accept": "image/*" });
    document.body.appendChild(importInput);
    document.body.appendChild(importDrawingInput);
    const importButton = document.getElementById("import-button");
    importButton.addEventListener("click", () => importInput.click());

    importInput.addEventListener("change", async () => {
        const files = Array.from((importInput.files || []));

        async function importFile(file) {
            const text = await textFromFile(file);
            const html = await htmlFromText(text);
            const json = html.querySelector("#exquisite-tool-c-data").innerHTML;
            const data = JSON.parse(json);

            const existing = new Set(project.drawings.map((drawing) => drawing.image));
            const extra = data.drawings.filter((drawing) => !existing.has(drawing.image));

            project.drawings.push(...extra);
        }

        await Promise.all(files.map(importFile));
        reloadAllDrawings();
    });

    importDrawingInput.addEventListener("change", async () => {
        const files = Array.from((importDrawingInput.files || []));

        async function importFile(file) {
            const drawing = {
                id: nanoid(),
                name: file.name,
                image: await dataURLFromFile(file),
            };
            project.drawings.push(drawing);
            return drawing;
        }

        const [drawing] = await Promise.all(files.map(importFile));
        await reloadAllDrawings();
        setActiveDrawing(drawing);
    });

    const panel = getDrawingSettingsPanel();
    panel.drawingSelect.addEventListener("input", () => {
        setActiveDrawing(project.drawings[parseInt(panel.drawingSelect.value, 10)]);
    });
    panel.importButton.addEventListener("click", () => {
        importDrawingInput.click();
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
    panel.exportButton.addEventListener("click", () => {
        getActiveRendering().canvas.toBlob(blob => {
            if (blob) saveAs(blob, `${activeDrawing.name}.png`);
        });
    });
    panel.clearButton.addEventListener("click", () => {
        fillRendering2D(getActiveRendering());
    });
    panel.deleteButton.addEventListener("click", () => {
        if (project.drawings.length === 0) return;

        const index = project.drawings.indexOf(activeDrawing);
        project.drawings.splice(index, 1);

        const container = document.getElementById("scene-container");
        container.removeChild(getActiveRendering().canvas);
        drawingToRendering2d.delete(activeDrawing);
        const first = Array.from(drawingToRendering2d.keys())[0];
        setActiveDrawing(first);
        refreshDrawingSelect();
    });

    await reloadAllDrawings();
}

/** @type { Map<any, CanvasRenderingContext2D> } */
const drawingToRendering2d = new Map();

async function reloadAllDrawings() {
    const container = document.getElementById("scene-container");
    const active = getActiveRendering();
    if (active) container.removeChild(active.canvas);
    activeDrawing = undefined;
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
    activeBrush = first;

    refreshDrawingSelect();
}

const specialRendering = createRendering2D(1, 1);
const specialToggle = specialRendering.canvas;
const specialBrush = {
    id: "",
    name: "color brush",
    image: "",
}
specialToggle.setAttribute("title", "color brush");
specialToggle.classList.add("brush-toggle")
function refreshSpecialBrush() {
    drawingToRendering2d.set(specialBrush, specialRendering);
    const { r, g, b } = HSVtoRGB(wheel.color);
    fillRendering2D(specialRendering, `rgb(${r} ${g} ${b})`);
}

const colorContainer = document.getElementById("color-container");

function refreshDrawingSelect() {
    const panel = getDrawingSettingsPanel();

    removeAllChildren(panel.drawingSelect);

    const options = project.drawings.map((drawing, i) => html("option", { value: i }, drawing.name));
    options.forEach((option) => panel.drawingSelect.appendChild(option));
    panel.drawingSelect.value = project.drawings.indexOf(activeDrawing);

    const brushesContainer = document.getElementById("brushes-container");
    const brushToggles = /** @type {Map<any, HTMLElement>} */ (new Map());
    removeAllChildren(brushesContainer);

    brushesContainer.appendChild(specialToggle);
    refreshSpecialBrush();

    specialToggle.onclick = function() {
        activeBrush = specialBrush;
        colorContainer.hidden = false;
        specialToggle.classList.toggle("active", true);
        brushToggles.forEach((toggle, drawing_) => toggle.classList.toggle("active", false));
    };

    project.drawings.forEach((drawing) => {
        const toggle = copyRendering2D(drawingToRendering2d.get(drawing)).canvas;
        toggle.setAttribute("title", drawing.name);
        toggle.classList.add("brush-toggle");
        toggle.classList.toggle("active", drawing === brushToggles);
        brushToggles.set(drawing, toggle);
        toggle.addEventListener("click", () => {
            activeBrush = drawing;
            colorContainer.hidden = true;
            specialToggle.classList.toggle("active", false);
            brushToggles.forEach((toggle, drawing_) => toggle.classList.toggle("active", drawing === drawing_));
        });
        brushesContainer.appendChild(toggle);
    });
}

function getDrawingSettingsPanel() {
    const drawingSelect = document.getElementById("drawing-select");
    const importButton = document.getElementById("import-drawing");
    const nameInput = document.getElementById("drawing-name");

    const widthInput = document.getElementById("resize-width");
    const heightInput = document.getElementById("resize-height");
    const resizeButton = document.getElementById("resize-submit");

    const cloneButton = document.getElementById("clone-button");
    const exportButton = document.getElementById("export-drawing");
    const clearButton = document.getElementById("clear-button");
    const deleteButton = document.getElementById("delete-button");

    return { 
        drawingSelect, importButton, nameInput,
        widthInput, heightInput, resizeButton,
        cloneButton, exportButton,
        clearButton, deleteButton,
    }
}

let activeDrawing, activeBrush;
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
    const zoom = Math.max(Math.min(512/w, 512/h)|0, 1);
    rendering.canvas.setAttribute("id", "drawing");
    rendering.canvas.setAttribute("style", `width: ${w*zoom}px; height: ${h*zoom}px`);

    resizeRendering2D(cursor, w, h);
    container.appendChild(cursor.canvas);
    cursor.canvas.setAttribute("style", `width: ${w*zoom}px; height: ${h*zoom}px`);

    const panel = getDrawingSettingsPanel();
    panel.widthInput.value = rendering.canvas.width.toString();
    panel.heightInput.value = rendering.canvas.height.toString();
    panel.nameInput.value = drawing.name;
    
    panel.drawingSelect.value = project.drawings.indexOf(drawing);
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

const eraseToggle = document.getElementById("erase-toggle");

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
        target.globalCompositeOperation = (eraseToggle.checked && target === rendering ) ? "destination-out" : "source-over";
        target.drawImage(brush, Math.round(x - ox), Math.round(y - oy));
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
        if (rendering.canvas.parentElement) {
            fillRendering2D(cursor);
            const inside = x1 >= 0 && y1 >= 0 && x1 < rendering.canvas.width && y1 < rendering.canvas.height;
            if (prevCursor || inside) draw(x1, y1, cursor);
        }
        if (prevCursor === undefined) return;      
        const [x0, y0] = prevCursor;  
        lineplot(x0, y0, x1, y1, draw);
        prevCursor = [x1, y1];
    });
    document.addEventListener('pointerup', (event) => prevCursor = undefined);
}

function getActiveBrush() {
    return drawingToRendering2d.get(activeBrush);
}

function exportEditor() {
    project.drawings.forEach((drawing) => {
        drawing.image = drawingToRendering2d.get(drawing).canvas.toDataURL("image/png");
    });

    const dataElement = document.getElementById("exquisite-tool-c-data");
    dataElement.innerHTML = JSON.stringify(project);

    const clone = /** @type {HTMLElement} */ (document.documentElement.cloneNode(true));
    const blob = new Blob([clone.outerHTML], {type: "text/html"});
    saveAs(blob, "exquisite-tool.html");
}
