let audioQueue = [];
chrome.storage.local.set({ song: {} });

// Audio logic
async function playSound(source = 'assets/sounds/default.mp3', volume = 0.1) {
    console.log('playSound', source, volume);
    await setupOffscreenDocument('audio_player.html');
    await chrome.runtime.sendMessage({ play: { source, volume } });
}

async function playNextInQueue(submitted = false) {
    if (audioQueue.length > 0) {
        console.log('SUBMITTED', submitted);
        console.log('Play next in queue', audioQueue);
        const nextSound = audioQueue.shift();
        playSound(nextSound.item.audio_url, nextSound.volume);
        console.log('nextSong', nextSound.item);
        chrome.storage.local.set({ song: nextSound.item });

        if (submitted) {
            await chrome.runtime.sendMessage({ current_song: true });
            console.log('setNextSong');
        }
    } else {
        console.log('NO SONG IN QUEUE', audioQueue);
        chrome.storage.local.set({ song: {} });
    }
}

function addToQueue(item, volume) {
    console.log('addToQueue', item, volume);
    audioQueue.push({ item, volume });
}

let creating;
async function setupOffscreenDocument(path) {
    const offscreenUrl = chrome.runtime.getURL(path);
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
    });

    if (existingContexts.length > 0) {
        return;
    }

    if (creating) {
        await creating;
    } else {
        creating = chrome.offscreen.createDocument({
            url: path,
            reasons: ['AUDIO_PLAYBACK'],
            justification: 'Playing the received audio'
        });
        await creating;
        creating = null;
    }
}

async function handleFormSubmission(submitted = false) {
    if (submitted) {
        await chrome.runtime.sendMessage({ generating: true });
    }

    chrome.storage.sync.get(
        ['selectedOptions', 'vocals', 'autoplay', 'customTags', 'volume', 'instruments', 'api', 'authToken'],
        function (syncedData) {
            let { selectedOptions, vocals, autoplay, customTags, volume, instruments } = syncedData;
            let api = syncedData.api || 'http://localhost:3000/api/chatgpt';
            let authToken = syncedData.authToken || '';
            console.log('syncedData', syncedData);
            console.log('api', api);

            selectedOptions = selectedOptions ? selectedOptions.concat(', ', instruments) : undefined;

            chrome.storage.local.get(['content', 'title', 'url'], function (localData) {
                const { content, title, url } = localData;
                console.log('localData', localData);

                const jsonData = {
                    multiselect: selectedOptions,
                    vocals: vocals,
                    tags: customTags,
                    htmlContent: content,
                    title: title
                };

                if ((submitted && !autoplay) || autoplay) {
                    fetch(api, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'auth-token': authToken
                        },
                        body: JSON.stringify(jsonData),
                    })
                    .then(async response => {
                        if (response.ok) {
                            const jsonResponse = await response.json();
                            jsonResponse.forEach(item => addToQueue(item, (parseFloat(volume) / 100)));

                            playNextInQueue(submitted);

                            if (submitted) {
                                await chrome.runtime.sendMessage({ generating: false });
                            }
                        } else {
                            if (submitted) {
                                await chrome.runtime.sendMessage({ generating: false });
                            }
                            chrome.notifications.create(
                                "APIError",
                                {
                                    type: "basic",
                                    iconUrl: "error.png",
                                    title: 'Failed to submit.',
                                    message: 'Failed to submit the form. Check your API endpoint and auth token.'
                                }
                            );
                            chrome.notifications.clear("APIError");

                            throw new Error('Failed to submit the form. Possible issues with API endpoint or auth token.');
                        }
                    })
                    .catch(async error => {
                        console.error('Network error or API endpoint unreachable:', error);

                        if (submitted) {
                            await chrome.runtime.sendMessage({ generating: false });
                        }
                        chrome.notifications.create(
                            "NetworkError",
                            {
                                type: "basic",
                                iconUrl: "error.png",
                                title: 'Network Error',
                                message: 'Could not connect to the API. Please check your internet connection or API endpoint.'
                            }
                        );
                        chrome.notifications.clear("NetworkError");
                    });
                }
            });
        }
    );
}

// Add listener
chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
    console.log('request', request);
    if (request.setTabValue) {
        chrome.storage.local.set({
            content: request.setTabValue.content,
            title: request.setTabValue.title,
            url: request.setTabValue.url
        });
        handleFormSubmission();
    }

    if (request.submit) {
        handleFormSubmission(true);
    }

    if (request.type === 'PLAYBACK_DONE') {
        playNextInQueue();
    }
});
