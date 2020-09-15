/**
 * @param {MouseEvent | Touch} event 
 * @param {HTMLElement} element 
 */
function eventToElementPixel(event, element) {
    const rect = element.getBoundingClientRect();
    return [event.clientX - rect.x, event.clientY - rect.y];
}

/**
 * @param {Event} event
 */
function killEvent(event) {
    event.stopPropagation();
    event.preventDefault();
}

/**
 * @param {string} src 
 */
async function loadImage(src) {
    return new Promise((resolve, reject) => {
        const image = document.createElement("img");
        image.addEventListener("load", () => resolve(image));
        image.src = src;
    });
}

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tagName 
 * @param {*} attributes 
 * @param  {...HTMLElement} children 
 * @returns {HTMLElementTagNameMap[K]}
 */
function html(tagName, attributes = {}, ...children) {
    const element = /** @type {HTMLElementTagNameMap[K]} */ (document.createElement(tagName)); 
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
    children.forEach((child) => element.appendChild(child));
    return element;
}

/**
 * 
 * @param {HTMLElement} element 
 * @param {(x: number, y: number) => void} callback
 */
function listenPressPositions(element, callback) {
    let held = false;
    element.addEventListener('pointerdown', (event) => {
        killEvent(event);
        const [x, y] = eventToElementPixel(event, element);
        callback(x, y);
        held = true;
    });
    document.addEventListener('pointermove', (event) => {
        if (!held) return;
        const [x, y] = eventToElementPixel(event, element);
        callback(x, y);
    });
    document.addEventListener('pointerup', (event) => held = false);
}
