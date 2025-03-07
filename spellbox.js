let networkLog = [];
let networkLogObjectMap = {};
const proxy = document.getElementById("proxy");
const emptyState = document.getElementById("empty-state");
const networklogs = document.getElementById("network-logs");
const button = document.getElementById('modifyButton')
const clearNetworkLogs = document.getElementById('clear');
const filter = document.getElementById('filter');
const payloadAttributes = document.getElementById('attributes');
const closeRequestDetails = document.getElementById('close-request-details');
const requestUrlGeneral = document.getElementById('request-url');
const requestMethod = document.getElementById('request-method');
const requestStatusCode = document.getElementById('request-status-code');
const requestHeaders = document.getElementById('request-headers');
const responseHeaders = document.getElementById('response-headers');
const requestTab = document.getElementById('tab-headers');
const payloadTab = document.getElementById('tab-payload');
const responseTab = document.getElementById('tab-response');

const headerDetailsTab = document.getElementById('Headers');
const payloadDetailsTab = document.getElementById('Payload');
const responseDetailsTab = document.getElementById('Response');

const responseByUrl = {};

function toggleSelected(selectedTab, tabDetails) {
    // Remove 'selected' class from all tabs
    requestTab.classList.remove('selected');
    payloadTab.classList.remove('selected');
    responseTab.classList.remove('selected');

    // add none
    headerDetailsTab.classList.add('hide');
    payloadDetailsTab.classList.add('hide');
    responseDetailsTab.classList.add('hide');
  
    // Add 'selected' class to the clicked tab
    selectedTab.classList.add('selected');

    tabDetails.classList.remove('hide');
}
  
  // Add event listeners to each tab
  requestTab.addEventListener('click', () => toggleSelected(requestTab, headerDetailsTab));
  payloadTab.addEventListener('click', () => toggleSelected(payloadTab, payloadDetailsTab));
  responseTab.addEventListener('click', () => toggleSelected(responseTab, responseDetailsTab));

const buttons = document.querySelectorAll(".toggle-button"); // Fetch all buttons dynamically
let activeType = "";

buttons.forEach((button) => {
    button.addEventListener("click", function () {
        activeType = activeType === this.id ? "" : this.id;
        updateActiveButton();
        updateNetworkLog();
    });
});

function updateActiveButton() {
    buttons.forEach((btn) => btn.classList.toggle("selected", btn.id === activeType));
}

closeRequestDetails.addEventListener('click', function(event) {
    payloadAttributes.classList.add('hide');
});

function updateNetworkLog() {
    for (const requestId in networkLogObjectMap) {
        if (networkLogObjectMap.hasOwnProperty(requestId)) {
            const request = networkLogObjectMap[requestId];

            // Show all rows if no filter is selected
            if (!activeType) {
                request['row']?.classList.remove("hide");
                continue;
            }

            // Hide or show based on request type
            const shouldShow = request.type === activeType;
            request['row']?.classList.toggle("hide", !shouldShow);
        }
    }
}

filter.addEventListener('input', function(event) {
    const inputValue = event.target.value;
    filterInput(inputValue);
});

function filterInput(suffix) {
    for (let requestId in networkLogObjectMap) {
        if (networkLogObjectMap.hasOwnProperty(requestId)) {
            const request = networkLogObjectMap[requestId];

            if (!request || !request.row || !request.url) continue; // Ensure properties exist

            const shouldShow = suffix === "" || request.url.endsWith(suffix);
            request.row.classList.toggle("hide", !shouldShow);
        }
    }
}

clearNetworkLogs.addEventListener('click', function() {
    clearNetworkTab();
});


const fetchIntercepted = [];

chrome.tabs.onActivated.addListener(function(activeInfo) {
    // when ever tab activates clear the network log to make things easier unless preserve log is enabled
    networkLog = [];
    networkLogObjectMap = {};
    clearNetworkTab();
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    // Check if the URL has changed (often indicates a tab navigation)
    if (changeInfo.status === "complete" && changeInfo.url) { //check for complete to avoid multiple calls.
      // clear data here
      networkLog = [];
      networkLogObjectMap = {};
      clearNetworkTab();
    }
});

clearNetworkLogs.addEventListener('click', function() {
    clearNetworkTab();
});


function clearNetworkTabEmpty() {
    emptyState.classList.remove("hide");
}

function clearNetworkTab() {
    const classes = emptyState.classList;
    if(classes.contains("hide")) {
        classes.remove("hide")
    }
    networkLogObjectMap = {};
    networkLog = [];
    while (networklogs.children.length > 2) {
        networklogs.removeChild(networklogs.lastChild);
    }
}

function hideEmptyState() {
    const classes = emptyState.classList;
    if(!classes.contains("hide")) {
        classes.add("hide")
    }
}

chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs && tabs.length > 0 && details.tabId === tabs[0].id) {
                networkLog.push(details.requestId);

                if(networkLog.length == 1) {
                    hideEmptyState();
                }

                if (details.requestBody) {
                    if (details.requestBody.formData) {
                        networkLogObjectMap[details.requestId]['body'] = details.requestBody.formData;
                        networkLogObjectMap[details.requestId]['type'] = "form";
                    } else if (details.requestBody.raw) {
                        let rawBody = details.requestBody.raw;
                        try {
                            const json = arrayBufferToJson(rawBody[0].bytes);
                            networkLogObjectMap[details.requestId]['body'] = json;
                            networkLogObjectMap[details.requestId]['type'] = "json";
                        } catch(error) {
                            console.log('details for which we get error:- ', details, error);
                        }
                    }
                }

                networkLogObjectMap[details.requestId] = {slNumber: networkLog.length, method: details.method, url: details.url, type: details.type};
                networkLogObjectMap[details.requestId]['row'] = addNewNetworkLog(networkLogObjectMap[details.requestId]);

                responseByUrl['url'] = details.url;
            }
        });
        return {};
    },
    {urls: ["<all_urls>"]},
    ["requestBody"]
);

chrome.webRequest.onBeforeSendHeaders.addListener(
    function(details) {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs && tabs.length > 0 && details.tabId === tabs[0].id) {
                networkLogObjectMap[details.requestId]['requestHeaders'] = details.requestHeaders;
            }
        });
      return { requestHeaders: details.requestHeaders };
    },
    {
        urls: ["<all_urls>"],
        types: ["main_frame", "sub_frame", "stylesheet", "script", "image", "object", "xmlhttprequest", "other"] 
    },
    ["requestHeaders"]
);

chrome.webRequest.onSendHeaders.addListener(
    function(details) {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs && tabs.length > 0 && details.tabId === tabs[0].id) {
                networkLogObjectMap[details.requestId]['requestHeaders'] = details.requestHeaders;
            }
        });
      return {  };
    },
    { urls: ["<all_urls>"] }, // Or more specific URL patterns
    ["requestHeaders"]
);

chrome.webRequest.onHeadersReceived.addListener(
    function(details) {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs && tabs.length > 0 && details.tabId === tabs[0].id) {
                networkLogObjectMap[details.requestId]['responseHeaders'] = details.responseHeaders;
            }
        });
      return { };
    },
    { urls: ["<all_urls>"] }, // Or more specific URL patterns
    ["responseHeaders"]
);


chrome.webRequest.onCompleted.addListener(
    function(details) {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs && tabs.length > 0 && details.tabId === tabs[0].id) {
                try {
                    networkLogObjectMap[details.requestId]['statusCode'] = details.statusCode;
                } catch(error) {
                    console.log('details that created error:- ', details, error);
                }
                updatedStatusCodeInNetworkLog(networkLogObjectMap[details.requestId]['row'], details.statusCode);
            }
        });
      return {  };
    },
    { urls: ["<all_urls>"] }, // Or more specific URL patterns
    []
);

chrome.webRequest.onErrorOccurred.addListener(
    function(details) {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs && tabs.length > 0 && details.tabId === tabs[0].id) {
                console.log("Request Completed With Error", details);
                networkLogObjectMap[details.requestId]['error'] = details;
            }
        });
      return {  };
    },
    { urls: ["<all_urls>"] }, // Or more specific URL patterns
    []
);

function appendHeader(headers, node) {
    if(headers) {
        while (node && node.firstChild) {
            node.removeChild(node.firstChild);
        }
        for(let header of headers) {
            let parentDiv = document.createElement("div");
            parentDiv.classList.add("display-headers");
    
            let key = document.createElement("div");
            key.classList.add("left-header");
            key.textContent = header.name;
    
            let value = document.createElement("div");
            value.classList.add("left-header");
            value.textContent = header.value;
    
            parentDiv.appendChild(key);
            parentDiv.appendChild(value);
            node.appendChild(parentDiv);
        }
    }
}

function appendPayload(payload) {
    payloadDetailsTab.textContent = payload
}

function getMockSvg() {
    const svgString = `
        <svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9.74872 2.49415L18.1594 7.31987M9.74872 2.49415L8.91283 2M9.74872 2.49415L6.19982 8.61981M18.1594 7.31987L15.902 11.2163M18.1594 7.31987L19 7.80374M15.902 11.2163L14.1886 14.1738M15.902 11.2163L13.344 9.74451M14.1886 14.1738L12.5511 17.0003M14.1886 14.1738L9.98568 11.7556M12.5511 17.0003L11.0558 19.5813C9.7158 21.8942 6.74803 22.6867 4.42709 21.3513C2.10615 20.0159 1.31093 17.0584 2.65093 14.7455L3.95184 12.5M12.5511 17.0003L9.93838 15.4971" stroke="#1C274C" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M22 14.9166C22 16.0672 21.1046 16.9999 20 16.9999C18.8954 16.9999 18 16.0672 18 14.9166C18 14.1967 18.783 13.2358 19.3691 12.6174C19.7161 12.2512 20.2839 12.2512 20.6309 12.6174C21.217 13.2358 22 14.1967 22 14.9166Z" stroke="#1C274C" stroke-width="1.5"/>
        </svg>
    `;
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    return doc.documentElement;
}

function appendResponse(payload, url) {
    while (responseDetailsTab && responseDetailsTab.firstChild) {
        responseDetailsTab.removeChild(responseDetailsTab.firstChild);
    }

    let response = document.createElement("textarea");
    response.classList.add("response");
    response.value = payload

    let mockButtonDiv = document.createElement("div");
    mockButtonDiv.classList.add('mock-div');

    let button = document.createElement("button");
    button.classList.add("button");

    let icon = document.createElement("div");
    icon.classList.add("icon", "margin");
    icon.appendChild(getMockSvg());

    let text = document.createElement("div");
    text.textContent = "Mock";

    button.appendChild(icon);
    button.appendChild(text);
    button.addEventListener("click", (event) => mockResponse(response, url));

    mockButtonDiv.appendChild(button);
    responseDetailsTab.appendChild(mockButtonDiv);
    responseDetailsTab.appendChild(response);
}

function addNewNetworkLog(networkLog) {
    let newRow = document.createElement("div");
    newRow.classList.add("table-row");

    newRow.addEventListener("click", () => {
        payloadAttributes.classList.remove('hide');

        requestUrlGeneral.textContent = networkLog['url'];
        requestMethod.textContent = networkLog['method'];
        requestStatusCode.textContent = networkLog['statusCode'];

        // append request headers
        appendHeader(networkLog["requestHeaders"], requestHeaders);

        // append response headers
        appendHeader(networkLog["responseHeaders"], responseHeaders);

        if(networkLog["body"]) {
            appendPayload(networkLog["body"]);
        }

        if(responseByUrl[networkLog['url']]) {
            appendResponse(responseByUrl[networkLog['url']].response_body, networkLog['url']);
        }

        /*console.log('request headers:- ', networkLogObjectMap[requestId]["requestHeaders"]);
        console.log('response headers:- ', networkLogObjectMap[requestId]["responseHeaders"]);*/
    });

    // Create a new td
    let slNumber = document.createElement("div");
    slNumber.textContent = networkLog['slNumber'];
    slNumber.classList.add("small-width", "table-row-cell");
    newRow.appendChild(slNumber);

    let requestUrl = document.createElement("div");
    requestUrl.textContent = networkLog['url'];
    requestUrl.classList.add("network-rule", "table-row-cell");
    newRow.appendChild(requestUrl);

    let method = document.createElement("div");
    method.textContent = networkLog['method'];
    method.classList.add("medium-width", "table-row-cell");
    newRow.appendChild(method);

    let type = document.createElement("div");
    type.textContent = networkLog['type'];
    type.classList.add("large-width", "table-row-cell");
    newRow.appendChild(type);

    let statusCodeCell = document.createElement("div");
    statusCodeCell.textContent = "pending";
    statusCodeCell.classList.add("italic-text", "medium-width", "table-row-cell");
    newRow.appendChild(statusCodeCell);

    let copyButtonColumn = document.createElement("div");
    copyButtonColumn.classList.add("border", "small-width", "table-row-cell");
    let copyButton = document.createElement("div");
    copyButton.appendChild(getCopySvg());
    copyButton.classList.add("shadow-svg");
    const payload = {
        "method": networkLog['method'], 
        "url": networkLog['url'], 
        "body": networkLog['body'],
        "type": networkLog['type'],
        "requestHeaders": networkLog['requestHeaders']
    };
    const curl =  generateCurlCommand(payload.method, payload.url, payload.body, payload.type, payload.requestHeaders);
    copyButton.addEventListener("click", (event) => copyCurl(curl, event));
    copyButtonColumn.appendChild(copyButton);
    newRow.appendChild(copyButtonColumn);
    networklogs.appendChild(newRow);
    return newRow;
}

function updatedStatusCodeInNetworkLog(newRow, statusCode) {
    let cells = newRow.children; // Get all <divs> elements in the row
    if (cells.length >= 2) { // Ensure there are at least 2 columns
        cells[cells.length - 2].textContent = statusCode; // Update second last cell
    }
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "fetch") {
        fetchIntercepted.push(message.data.url);
        //updateLogs(message.data.url);
    }
});

function updateLogs(url) {
    let div = document.createElement("div");
    div.textContent = url;
    logs.appendChild(div);
}

function getCopySvg() {
    const svgString = `
        <svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
        <g id="SVGRepo_iconCarrier">
            <path d="M20.9983 10C20.9862 7.82497 20.8897 6.64706 20.1213 5.87868C19.2426 5 17.8284 5 15 5H12C9.17157 5 7.75736 5 6.87868 5.87868C6 6.75736 6 8.17157 6 11V16C6 18.8284 6 20.2426 6.87868 21.1213C7.75736 22 9.17157 22 12 22H15C17.8284 22 19.2426 22 20.1213 21.1213C21 20.2426 21 18.8284 21 16V15" stroke="#1C274B" stroke-width="1.5" stroke-linecap="round"></path>
            <path d="M3 10V16C3 17.6569 4.34315 19 6 19M18 5C18 3.34315 16.6569 2 15 2H11C7.22876 2 5.34315 2 4.17157 3.17157C3.51839 3.82475 3.22937 4.69989 3.10149 6" stroke="#1C274B" stroke-width="1.5" stroke-linecap="round"></path>
        </g>
        </svg>
    `;
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    return doc.documentElement;
  }

function generateCurlCommand(method, url, body = null, bodyType = null, headers = []) {
    let curlCommand = `curl -X ${method.toUpperCase()} "${url}"`;

    // Add headers
    for (let header of headers) {
        curlCommand += ` -H "${header.name}: ${header.value}"`;
    }

    // Add request body if present
    if (body) {
        if (bodyType === "json") {
            curlCommand += ` -H "Content-Type: application/json" -d '${JSON.stringify(body)}'`;
        } else if (bodyType === "form") {
            let formData = Object.entries(body)
                .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
                .join("&");
            curlCommand += ` -H "Content-Type: application/x-www-form-urlencoded" -d "${formData}"`;
        } else {
            curlCommand += ` -d '${body}'`; // Raw body
        }
    }

    return curlCommand;
}

function copyCurl(value, event) {
    event.stopPropagation();
    proxy.value = value;
    proxy.select();
    document.execCommand('copy'); // required as the clipboard api is not accessible to extensions yet
}

/*button.onclick = function() {
    const textarea = document.getElementById('myTextarea');
    chrome.runtime.sendMessage({ action: "message-to-inject", data: textarea.value });    
};*/


function mockResponse(textarea, url) {
    const mock = {
        url,
        response: textarea.value
    }
    chrome.runtime.sendMessage({ action: "message-to-inject", data: mock });    
}

// devtools.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('message:- ', message);
    if (message.action === "fetch-inject") {
        if(message.data) {
            if(message.data && message.data.type && message.data.type === "response") {
                responseByUrl[message.data.url] = message.data.payload;
            }
        }
        console.log("responseByUrl:", responseByUrl);
    }
});