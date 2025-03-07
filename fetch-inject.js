(function() {

    let responsesToMock = {};
    const originalFetch = window.fetch;

    window.fetch = async function(url, ...rest) {

        try {
            sendMessageToContentScript({
                type: 'payload',
                url,
                payload: rest
            });

            if(responsesToMock[url]) {
                return new Response(responsesToMock[url], {
                    status: 200, // Adjust the status as needed
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const response = await originalFetch(url, ...rest);
            const clonedResponse = response.clone(); // Clone response to read it

            clonedResponse.text().then((body) => {
                const json = {};
                json['status'] = response.status;
                json['headers'] = [...response.headers.entries()];
                json['response_body'] = body;

                sendMessageToContentScript({
                    type: 'response',
                    url,
                    payload: json
                });
            });

            return response;
        } catch (error) {
            console.error("Fetch error:", error);
            throw error;
        }
    };

    const OriginalXHR = window.XMLHttpRequest;

    class MockXHR extends OriginalXHR {

        constructor() {
            super();
            this._url = null;
        }

        open(method, url, async = true, user = null, password = null) {
            this._url = url; // Store the request URL
            super.open(method, url, async, user, password);
        }

        send() {
            if (responsesToMock[this._url]) {
                setTimeout(() => {
                    // Define properties instead of directly assigning values
                    Object.defineProperty(this, "readyState", { value: 4, configurable: true }); // Set readyState to DONE
                    Object.defineProperty(this, "status", { value: 200, configurable: true }); // Mock successful status
                    Object.defineProperty(this, "responseText", {
                        value: responsesToMock[this._url],
                        configurable: true
                    });
    
                    // Trigger the event handler if defined
                    if (typeof this.onreadystatechange === "function") {
                        this.onreadystatechange();
                    }
                    if (typeof this.onload === "function") {
                        this.onload();
                    }
    
                }, 100); // Simulating async delay
    
                return; // Prevent actual request from being sent
            }
            const eventCallback = this.onreadystatechange;
            this.onreadystatechange = function () {
                if (this.readyState === 4) {
                    if (this.status >= 200 && this.status < 300) {
                        try {
                            const data = JSON.parse(this.responseText);
                            const json = {};
                            json['status'] = this.status;
                            json['response_body'] = JSON.stringify(data);
                            sendMessageToContentScript({
                                type: 'response',
                                url: this.responseURL,
                                payload: json
                            });
                            eventCallback();
                        } catch (error) {
                            console.error('Error parsing JSON:', error);
                            eventCallback();
                        }
                    }
                }
                eventCallback();
            };
            super.send();
        }
    }

    window.XMLHttpRequest = MockXHR;

    function sendMessageToContentScript(data) {
        try {
            window.postMessage({ source: "fetch-inject", data }, "*");
        } catch(error) {
            console.log('data:- '+ data+ 'error:- '+error);
        }
    }

    //console.log('XMLHttpRequest:- ', window.XMLHttpRequest);
    window.addEventListener("message", (event) => {
        if (event.source !== window || !event.data || event.data.source !== "content-script") return;
        responsesToMock[event.data.data.url] = event.data.data.response;
    });
})();