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



const notSelect = () => {
  selectorElem.classList.remove('select');
  selectorElem.classList.add('no-select');
  drive.runtime.sendMessage({
    type: 'no-select'
  }).catch(() => { });
}


function debounce(func, delay) {
  let timeoutId;  // timeoutId 在 debounce 内部定义

  return function (...args) {
    clearTimeout(timeoutId);  // 清除之前的计时器
    timeoutId = setTimeout(() => {
      func.apply(this, args);  // 在 delay 时间后执行目标函数
    }, delay);
  };
}

const query = () => {
  drive.runtime.sendMessage({
    type: 'evaluate',
    query: queryElem.value
  }).catch(() => { });
};

queryElem.addEventListener('input', debounce(query, 300));


selectorElem.addEventListener('click', () => {
  if (selectorElem.classList.contains('no-select')) {
    selectorElem.classList.remove('no-select');
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
  const xKey = event.keyCode === 88;
  const escapeKey = event.keyCode === 27;

  const upKey = event.keyCode === 38;
  const downKey = event.keyCode === 40;

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
    if (request.type === 'results') {
      if (request.results !== null) {
        resultsElem.value = request.results.value;
        countText.nodeValue = request.results.count;
      }
    } else if (request.type === 'update') {
      if (request.query !== null) {
        queryElem.value = request.query;
      }
      if (request.results !== null) {
        resultsElem.value = request.results.value;
        countText.nodeValue = request.results.count;
      }
    } else if (request.type === 'quit-select') {
      notSelect();
    }
  } catch (error) { }
  cb();
});
