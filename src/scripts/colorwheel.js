function HSVtoRGB(h, s, v) {
    var r, g, b, i, f, p, q, t;
    if (arguments.length === 1) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

class ColorWheel {
    get wheelCenter() { return this.options.wheelSize * .5; }
    get wheelRadius() { return this.wheelCenter - this.options.wheelCursorRadius - this.options.wheelCursorThickness; }
    get sliderHeight() { return this.options.wheelCursorThickness * 2 + this.options.wheelCursorRadius * 2 }

    constructor(options = {}) {
        this.options = Object.assign({}, {
            wheelSize: 200,
            wheelDivisions: 128,

            wheelCursorRadius: 10,
            wheelCursorThickness: 2,
        }, options);

        this.color = { h: 0, s: 1, v: 1 };

        this.hsWheelRenderering = createRendering2D(16, 16);
        this.vBarRendering = createRendering2D(16, 16);
        this.root = html("div", {}, this.hsWheelRenderering.canvas, this.vBarRendering.canvas);

        this.refresh();

        addPressListener(this.hsWheelRenderering.canvas, (x, y) => {
            const wc = this.wheelCenter;
            const dx = x - wc;
            const dy = y - wc;

            const a = Math.atan2(dy, dx) + Math.PI * 2;
            const d = Math.sqrt(dy*dy + dx*dx);

            this.color.h = a / (Math.PI * 2);
            this.color.s = Math.min(d / this.wheelRadius, 1);
            this.refresh();
        });

        addPressListener(this.vBarRendering.canvas, (x, y) => {
            this.color.v = Math.max(Math.min(x / this.options.wheelSize, 1), 0);
            this.refresh();
        });
    }

    refresh() {
        resizeRendering2D(this.hsWheelRenderering, this.options.wheelSize, this.options.wheelSize);
        resizeRendering2D(this.vBarRendering, this.options.wheelSize, this.sliderHeight);

        clearRendering2D(this.hsWheelRenderering);
        clearRendering2D(this.vBarRendering);

        const wc = this.wheelCenter;
        const wr = this.wheelRadius;
        
        const { r, g, b } = HSVtoRGB(this.color);
        const cssColor = `rgb(${r} ${g} ${b})`;

        // wheel
        {
            const divisions = this.options.wheelDivisions;
            const da = Math.PI * 2 / divisions;

            for (let i = 0; i <= divisions; ++i) {
                this.hsWheelRenderering.beginPath();
                this.hsWheelRenderering.moveTo(wc, wc);
                this.hsWheelRenderering.arc(wc, wc, wr, da * (i - 2), da * i, false);
                this.hsWheelRenderering.closePath();

                var inner = HSVtoRGB(i / divisions, 0, this.color.v);
                var outer = HSVtoRGB(i / divisions, 1, this.color.v);

                var gradient = this.hsWheelRenderering.createRadialGradient(wc, wc, 0, wc, wc, wr);
                gradient.addColorStop(0, `rgb(${inner.r} ${inner.g} ${inner.b})`);
                gradient.addColorStop(1, `rgb(${outer.r} ${outer.g} ${outer.b})`);

                this.hsWheelRenderering.fillStyle = gradient;
                this.hsWheelRenderering.fill();
            }
        }

        // wheel cursor
        {
            const angle = this.color.h * Math.PI * 2;
            const radius = this.color.s * wr;
            const cursorX = wc + Math.cos(angle) * radius;
            const cursorY = wc + Math.sin(angle) * radius;

            this.hsWheelRenderering.beginPath();
            this.hsWheelRenderering.arc(cursorX, cursorY, this.options.wheelCursorRadius, 0, Math.PI * 2, false);
            this.hsWheelRenderering.fillStyle = cssColor;
            this.hsWheelRenderering.fill();
            this.hsWheelRenderering.lineWidth = this.options.wheelCursorThickness;
            this.hsWheelRenderering.strokeStyle = this.color.v > 0.5 ? 'black' : 'white';
            this.hsWheelRenderering.stroke();
        }

        {
            this.vBarRendering.canvas.setAttribute("style", `background: linear-gradient(to left, ${cssColor}, black)`);

            const cursorX = this.options.wheelSize * this.color.v;
            const cursorY = this.sliderHeight * .5;

            this.vBarRendering.beginPath();
            this.vBarRendering.arc(cursorX, cursorY, this.options.wheelCursorRadius, 0, Math.PI * 2, false);
            this.vBarRendering.fillStyle = cssColor;
            this.vBarRendering.fill();
            this.vBarRendering.lineWidth = this.options.wheelCursorThickness;
            this.vBarRendering.strokeStyle = this.color.v > 0.5 ? 'black' : 'white';
            this.vBarRendering.stroke();
        }
    }
}
