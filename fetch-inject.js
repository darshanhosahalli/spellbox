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

    function sendMessageToContentScript(data) {
        window.postMessage({ source: "fetch-inject", data }, "*");
    }

    //console.log('XMLHttpRequest:- ', window.XMLHttpRequest);
    window.addEventListener("message", (event) => {
        if (event.source !== window || !event.data || event.data.source !== "content-script") return;
        responsesToMock[event.data.data.url] = event.data.data.response;
    });
})();