/**
 * @type {typeof Browser}
 */
let drive = null;

if (typeof chrome !== 'undefined') {
    drive = chrome;
}

if (typeof browser !== 'undefined') {
    drive = browser;
}

function throttle(func, delay) {
    let lastTime = 0;
    return function (...args) {
        const now = Date.now();
        if (now - lastTime >= delay) {
            try {
                func.apply(this, args);
            } catch (error) { }
            lastTime = now;
        }
    };
}

/**
 * @param {Array<HTMLElement>} selectElems 
 */
const highlight = (selectElems) => {
    selectElems.forEach((elem) => {
        elem.classList.add('x-path-css-selecter-tool-highlight');
    });
}

const clear = () => {
    const selectElems = Array.from(document.querySelectorAll('.x-path-css-selecter-tool-highlight'));
    selectElems.forEach((elem) => {
        elem.classList.remove('x-path-css-selecter-tool-highlight');
    });
}

const cssSelector = (query) => {
    let value = '';
    let count = 0;
    const selectElems = [];
    try {
        const elems = document.querySelectorAll(query);
        if (elems.length > 0) {
            for (let index = 0; index < elems.length; index++) {
                /**
                 * @type {HTMLElement }
                 */
                const elem = elems[index];
                if (elem.nodeType === 1) {
                    selectElems.push(elem);
                    if (value) {
                        value += '\n';
                    }
                    value += elem.textContent;
                    count++;
                }
            }
        }
    } catch (e2) {
        value = '[INVALID XPATH EXPRESSION]';
        count = 0;
    }
    if (count === 0) {
        value = '[NULL]';
    }
    highlight(selectElems);
    return { value, count };
}

const evaluate = (query) => {
    let value = '';
    let count = 0;
    const selectElems = [];
    try {
        const xpath = document.evaluate(query, document, null, XPathResult.ANY_TYPE, null);
        if (!xpath) {
            return cssSelector(query);
        }
        if (xpath.resultType === XPathResult.BOOLEAN_TYPE) {
            value = xpath.booleanValue ? '1' : '0';
            count = 1;
        } else if (xpath.resultType === XPathResult.NUMBER_TYPE) {
            value = xpath.numberValue.toString();
            count = 1;
        } else if (xpath.resultType === XPathResult.STRING_TYPE) {
            value = xpath.stringValue;
            count = 1;
        } else if (xpath.resultType === XPathResult.UNORDERED_NODE_ITERATOR_TYPE) {
            for (var node = xpath.iterateNext(); node; node = xpath.iterateNext()) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    selectElems.push(node);
                }
                const text = node.textContent;
                if (!!text) {
                    value = `${value}${!!value ? '\n' : ''}${text}`;
                }
                count++;
            }
        }
        if (count === 0 && !value) {
            return cssSelector(query);
        }
        highlight(selectElems);
        return { value, count };
    } catch (e1) {
        return cssSelector(query);
    }
}


const getElementXPath = function (el) {
    const isSub = function (primaryEl, siblingEl) {
        return (primaryEl.tagName === siblingEl.tagName &&
            (!primaryEl.className || primaryEl.className === siblingEl.className) &&
            (!primaryEl.id || primaryEl.id === siblingEl.id));
    };

    const getElementIndex = function (el) {
        const parent = el.parentNode;
        const siblings = Array.from(parent.children);
        let index = 1;
        for (let i = 0; i < siblings.length; i++) {
            if (siblings[i] === el) {
                break;
            }
            if (siblings[i].nodeType === Node.ELEMENT_NODE && isSub(el, siblings[i])) {
                index++;
            }
        }
        return index;
    };

    const xpaths = [];
    for (; el && el.nodeType === Node.ELEMENT_NODE; el = el.parentNode) {
        let pathSegment = el.tagName.toLowerCase();
        let index = getElementIndex(el);

        if (el.id) {
            pathSegment += '[@id=\'' + el.id + '\']';
        } else if (el.className) {
            pathSegment += '[@class=\'' + el.className + '\']';
        }
        if (index >= 1) {
            pathSegment += '[' + index + ']';
        }
        if (xpaths.length === 0 && el.tagName.toLowerCase() === 'img') {
            pathSegment += '/@src';
        }
        xpaths.splice(0, 0, pathSegment);
    }

    return xpaths.length > 0 ? '/' + xpaths.join('/') : '';
};


class XPath {

    /**
     * @private
     * @type {HTMLIFrameElement}
     */
    _iFrame;

    /**
     * @private
     * @type {Function}
     */
    _onMessage;

    /**
     * @private
     * @type {Function}
     */
    _onMouseMove;

    /**
     * @private
     * @type {Function}
     */
    _onMouseenter;

    /**
     * @private
     * @type {HTMLElement}
     */
    _currElem = null;

    /**
     * @private
     * @type {string}
     */
    _query = '';

    /**
     * @private
     * @type {boolean}
     */
    isSelector = false;

    /**
     * @private
     * @type {boolean}
     */
    isDom = false;

    constructor() {
        const iFrame = document.createElement('iframe');
        iFrame.src = chrome.runtime.getURL('iframe/xpath.html');
        iFrame.id = 'x-path-css-selecter-tool';
        iFrame.classList.add('hidden');
        this._iFrame = iFrame;

        this._onMouseMove = throttle((event) => {
            try {
                this.onMouseMove(event);
            } catch (error) { }
        }, 50);

        this._onMouseenter = throttle((event) => {
            try {
                this.onMouseenter(event);
            } catch (error) { }
        }, 50);

        document.addEventListener('keydown', (event) => {
            this.onKeyDown(event);
        });

        this._onMessage = this.onMessage.bind(this);
        chrome.runtime.onMessage.addListener(this._onMessage);

    }

    onMouseenter(event) {
        if (event.shiftKey) {
            this._iFrame.classList.toggle('bottom');
        }
    }

    onMessage(request, _, cb) {
        try {
            if (request.type === 'evaluate') {
                clear();
                this._query = request.query;
                const results = this._query ? evaluate(this._query) : { value: '[NULL]', count: 0 };
                drive.runtime.sendMessage({ type: 'results', results });
            } else if (request.type === 'hide') {
                this.hide();
                focus();
            } else if (request.type === 'action') {
                this.action();
            } else if (request.type === 'select') {
                this.isSelector = true;
            } else if (request.type === 'no-select') {
                this.isSelector = false;
            } else if (request.type === 'up') {
                this.up();
            } else if (request.type === 'down') {
                this.down();
            }
        } catch (error) { }
        cb();
    }

    down() {
        this._iFrame.classList.add('bottom');
    }

    up() {
        this._iFrame.classList.remove('bottom');
    }

    onKeyDown(event) {
        const ctrlKey = event.ctrlKey || event.metaKey;
        const xKey = event.keyCode === 88;
        const shiftKey = event.keyCode === 16;

        if (xKey && ctrlKey && event.shiftKey) {
            this.action();
            return
        }

        const upKey = event.keyCode === 38;
        const downKey = event.keyCode === 40;

        if (upKey && (event.shiftKey || ctrlKey)) {
            this.up();
        }
        if (downKey && (event.shiftKey || ctrlKey)) {
            this.down();
        }
        const escapeKey = event.keyCode === 27;
        if (escapeKey && !ctrlKey && !shiftKey) {
            this.isSelector = false;
            drive.runtime.sendMessage({
                type: 'quit-select'
            }).catch(() => { });
        }
    }

    onMouseMove(event) {
        if (this._currElem === event.toElement) {
            return;
        }
        this._currElem = event.toElement;
        if (this.isSelector) {
            clear();
            this._query = getElementXPath(this._currElem);
            this.update();
        }
    }

    isHidden() {
        return this._iFrame.classList.contains('hidden');
    }

    update() {
        const results = this._query ? evaluate(this._query) : { value: '[NULL]', count: 0 };
        drive.runtime.sendMessage({
            type: 'update',
            query: this._query,
            results
        }).catch(() => { });
    }

    hide() {
        setTimeout(() => {
            this._iFrame.classList.add('hidden');
            document.removeEventListener('mousemove', this._onMouseMove);
            this._iFrame.removeEventListener('mouseenter', this._onMouseenter);
            clear();
        }, 0);
    }

    show() {
        if (!this.isDom) {
            document.body.appendChild(this._iFrame);
            this.isDom = true;
        }
        setTimeout(() => {
            this._iFrame.classList.remove('hidden');
            document.addEventListener('mousemove', this._onMouseMove);
            this._iFrame.addEventListener('mouseenter', this._onMouseenter);
            this.update();
        }, 0);
    }

    action() {
        if (this.isHidden()) {
            this.show();
        } else {
            this.hide();
        }
    }
}

if (!!drive) {
    window.XPath = new XPath();
} else {
    console.log('浏览器不支持');
}