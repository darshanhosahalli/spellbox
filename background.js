chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "fetch-inject") {
        chrome.runtime.sendMessage({ action: "fetch-inject", data: message.data });
    }
    if (message.action === "message-to-inject") {
        // Forward message to content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0 && tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, message);
            }
        });
    }
});