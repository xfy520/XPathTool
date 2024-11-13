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

const queryElem = document.getElementById('query');
const resultsElem = document.getElementById('results');
const countElem = document.getElementById('node-count');
const selectorElem = document.getElementById('selector');

const countText = document.createTextNode('0');
countElem.appendChild(countText);

const query = () => {
  drive.runtime.sendMessage({
    type: 'evaluate',
    query: queryElem.value
  }).catch(() => { });
};

function debounce(func, delay) {
  let timer;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        func(args);
      } catch (error) { }
    }, delay);
  };
}

const notSelect = () => {
  selectorElem.classList.remove('select');
  selectorElem.classList.add('not-select');
  drive.runtime.sendMessage({
    type: 'no-select'
  }).catch(() => { });
}

const queryDebounce = debounce(query, 100);


queryElem.addEventListener('keyup', queryDebounce);
queryElem.addEventListener('mouseup', queryDebounce);

selectorElem.addEventListener('click', () => {
  if (selectorElem.classList.contains('not-select')) {
    selectorElem.classList.remove('not-select');
    selectorElem.classList.add('select');
    drive.runtime.sendMessage({
      type: 'select'
    }).catch(() => { });
  } else {
    notSelect();
  }
});

document.addEventListener('keydown', (event) => {
  const ctrlKey = event.ctrlKey || event.metaKey;
  const shiftKey = event.shiftKey;
  const xKey = event.key !== undefined ? event.key === 'X' : event.keyCode === 88;
  const escapeKey = event.key !== undefined ? event.key === 'Escape' : event.keyCode === 27;

  const upKey = event.key !== undefined ? event.key === 'ArrowUp' : event.keyCode === 38;
  const downKey = event.key !== undefined ? event.key === 'ArrowDown' : event.keyCode === 40;

  if (xKey && ctrlKey && shiftKey) {
    drive.runtime.sendMessage({ type: 'hide' }).catch(() => { });
  }

  if (escapeKey) {
    notSelect();
  }

  if (upKey && (shiftKey || ctrlKey)) {
    drive.runtime.sendMessage({ type: 'up' }).catch(() => { });
  }
  if (downKey && (shiftKey || ctrlKey)) {
    drive.runtime.sendMessage({ type: 'down' }).catch(() => { });
  }
});

drive.runtime.onMessage.addListener((request, _, cb) => {
  try {
    if (request.type === 'update') {
      if (request.query !== null) {
        queryElem.value = request.query;
      }
      if (request.results !== null) {
        resultsElem.value = request.results.value;
        countText.nodeValue = request.results.count;
      }
    } else if (request.type === 'no-select') {
      notSelect();
    }
  } catch (error) { }
  cb();
});