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

drive.runtime.onMessage.addListener((request, sender, cb) => {
    if (!!sender && !!sender.tab && !!sender.tab.id) {
        drive.tabs.sendMessage(sender.tab.id, request, cb);
    }
});

drive.action.onClicked.addListener(({ id }) => {
    drive.tabs.sendMessage(id, { type: 'action' }).catch(() => { });
});
