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
        const xpathResult = document.evaluate(query, document, null, XPathResult.ANY_TYPE, null);
        if (!xpathResult) {
            return cssSelector(query);
        }
        if (xpathResult.resultType === XPathResult.BOOLEAN_TYPE) {
            value = xpathResult.booleanValue ? '1' : '0';
            count = 1;
        } else if (xpathResult.resultType === XPathResult.NUMBER_TYPE) {
            value = xpathResult.numberValue.toString();
            count = 1;
        } else if (xpathResult.resultType === XPathResult.STRING_TYPE) {
            value = xpathResult.stringValue;
            count = 1;
        } else if (xpathResult.resultType ===
            XPathResult.UNORDERED_NODE_ITERATOR_TYPE) {
            for (var node = xpathResult.iterateNext(); node;
                node = xpathResult.iterateNext()) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    selectElems.push(node);
                }
                if (value) {
                    value += '\n';
                }
                value += node.textContent;
                count++;
            }
        }

        if (count === 0 || !value) {
            return cssSelector(query);
        }
        highlight(selectElems);
        return { value, count };
    } catch (e1) {
        return cssSelector(query);
    }
}

const getElemIndex = (elem) => {
    const isSiblingOfSameType = (p, s) => {
        return p.tagName === s.tagName &&
            (!p.className || p.className === s.className) &&
            (!p.id || p.id === s.id);
    }

    let index = 1;
    for (let sib = elem.previousSibling; sib; sib = sib.previousSibling) {
        if (sib.nodeType === Node.ELEMENT_NODE && isSiblingOfSameType(elem, sib)) {
            index++;
        }
    }
    return index > 1 ? index : 1;
}

const queryForElems = (elem) => {
    let query = '';
    while (elem && elem.nodeType === Node.ELEMENT_NODE) {
        let component = elem.tagName.toLowerCase();
        const index = getElemIndex(elem);
        if (elem.id) {
            component += `[@id='${elem.id}']`;
        } else if (elem.className) {
            component += `[@class='${elem.className}']`;
        }
        if (index >= 1) component += `[${index}]`;
        if (!query && component === 'img') component += '/@src';

        query = `/${component}${query}`;
        elem = elem.parentNode;
    }
    return query;
}


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
        }, 100);

        document.addEventListener('keydown', (event) => {
            this.onKeyDown(event);
        });

        this._onMessage = this.onMessage.bind(this);
        chrome.runtime.onMessage.addListener(this._onMessage);
    }

    onMessage(request, _, cb) {
        try {
            if (request.type === 'evaluate') {
                clear();
                this._query = request.query;
                this.update(false);
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
        const xKey = event.key !== undefined ? event.key === 'X' : event.keyCode === 88;
        const shiftKey = event.key !== undefined ? event.key === 'Shift' : event.keyCode === 16;

        if (xKey && ctrlKey && event.shiftKey) {
            this.action();
            return
        }

        const escapeKey = event.key !== undefined ? event.key === 'Escape' : event.keyCode === 27;

        if (escapeKey && !ctrlKey && !shiftKey) {
            this.isSelector = false;
            drive.runtime.sendMessage({
                type: 'no-select'
            }).catch(() => { });
        }
    }

    onMouseMove(event) {
        if (this._currElem === event.toElement) {
            return;
        }
        this._currElem = event.toElement;
        if (this.isSelector) {
            this.updateQuery(this._currElem);
        }
    }

    updateQuery(elem) {
        clear();
        this._query = elem ? queryForElems(elem) : '';
        this.update(true);
    }

    isHidden() {
        return this._iFrame.classList.contains('hidden');
    }

    update(isUpdateQuery) {
        const results = this._query ? evaluate(this._query) : { value: '[NULL]', count: 0 };
        drive.runtime.sendMessage({
            type: 'update',
            query: isUpdateQuery ? this._query : null,
            results: results
        }).catch(() => { });
    }

    hide() {
        setTimeout(() => {
            this._iFrame.classList.add('hidden');
            document.removeEventListener('mousemove', this._onMouseMove);
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
            this.update(true);
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