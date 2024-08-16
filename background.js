let audioQueue = [];
chrome.storage.local.set({ song: {} });

const isDebugMode = true;

const debugLog = (message, data) => {
  if (isDebugMode) {
    console.debug(message, data);
  }
};

// Audio logic
async function playSound(source = 'assets/sounds/default.mp3', volume = 0.1) {
  debugLog('playSound', { source, volume });
  await setupOffscreenDocument('audio_player.html');
  await chrome.runtime.sendMessage({ play: { source, volume } });
}

async function playNextInQueue(submitted = false) {
  if (audioQueue.length > 0) {
    const nextSound = audioQueue.shift();
    debugLog('Playing next in queue', { nextSound, submitted });
    playSound(nextSound.item.audio_url, nextSound.volume);
    chrome.storage.local.set({ song: nextSound.item });

    if (submitted) {
      await chrome.runtime.sendMessage({ current_song: true });
    }
  } else {
    debugLog('No song in queue', audioQueue);
    chrome.storage.local.set({ song: {} });
  }
}

function addToQueue(item, volume) {
  debugLog('addToQueue', { item, volume });
  audioQueue.push({ item, volume });
}

async function playSongs(api, authToken, volume) {
  debugLog('Fetching songs from /get route', { api });

  try {
    const response = await fetch(`${api}/get`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'auth-token': authToken
      }
    });

    if (response.ok) {
      const songs = await response.json();
      debugLog('Fetched songs', { songs });
      songs.forEach(song => addToQueue(song, parseFloat(volume) / 100));

      playNextInQueue();
    } else {
      await setError(false, 'Failed to Fetch Songs', 'Failed to fetch songs from the /get route.');
    }
  } catch (error) {
    debugLog('Network error while fetching songs', error);
    await setError(false, 'Network Error', 'Could not connect to the API. Please check your internet connection or API endpoint.');
  }
}

let creating;
async function setupOffscreenDocument(path) {
  const offscreenUrl = chrome.runtime.getURL(path);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) return;

  if (!creating) {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Playing the received audio'
    });
    await creating;
    creating = null;
  }
}

async function setError(submitted = false, title = 'Error', message = 'An error occurred.') {
  if (submitted) {
    await chrome.runtime.sendMessage({ generating: false });
  }

  chrome.notifications.create("errorNotification", {
    type: "basic",
    iconUrl: "error.png",
    title,
    message
  });
  chrome.notifications.clear("errorNotification");

  throw new Error(message);
}

async function handleFormSubmission(submitted = false) {
  const syncedData = await chrome.storage.sync.get([
    'selectedOptions', 'vocals', 'autoplay', 'customTags', 'volume', 'instruments', 'api', 'authToken'
  ]);
  let { selectedOptions, vocals, autoplay, customTags, volume, instruments } = syncedData;
  const api = `${syncedData.api}/chatgpt` || 'http://localhost:3000/api/chatgpt';
  const authToken = syncedData.authToken || '';

  debugLog('Synced data', syncedData);

  selectedOptions = selectedOptions ? selectedOptions.concat(', ', instruments) : undefined;

  const localData = await chrome.storage.local.get(['content', 'title', 'url']);
  const { content, title } = localData;

  debugLog('Local data', localData);

  const jsonData = {
    multiselect: selectedOptions,
    vocals,
    tags: customTags,
    htmlContent: content,
    title
  };

  if (submitted && !content) {
    await setError(submitted, 'No Content', 'No content found. Check your targetSelector.');
    return;
  }

  if ((submitted && !autoplay) || (autoplay && content && !submitted)) {
    if (submitted) await chrome.runtime.sendMessage({ generating: true });

    if (!content) {
      await setError(submitted, 'No Content', 'No content found. Check your targetSelector.');
      return;
    }

    try {
      const response = await fetch(api, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'auth-token': authToken
        },
        body: JSON.stringify(jsonData),
      });

      if (response.ok) {
        audioQueue = [];
        const jsonResponse = await response.json();
        jsonResponse.forEach(item => addToQueue(item, parseFloat(volume) / 100));
        playNextInQueue(submitted);

        if (submitted) await chrome.runtime.sendMessage({ generating: false });
      } else {
        await setError(submitted, 'Failed to Submit', 'Failed to submit the form. Check your API endpoint and auth token.');
      }
    } catch (error) {
      debugLog('Network error or API endpoint unreachable', error);
      await setError(
        submitted,
        'Network Error',
        'Could not connect to the API. Please check your internet connection or API endpoint.'
      );
    }
  }
}

// Add listener
chrome.runtime.onMessage.addListener(async function (request) {
  debugLog('Request received', request);

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

  if (request.play === true) {
    const syncedData = await chrome.storage.sync.get(['api', 'authToken', 'volume']);
    const api = syncedData.api || 'http://localhost:3000/api';
    const authToken = syncedData.authToken || '';
    const volume = syncedData.volume || 25;

    playSongs(api, authToken, volume);
  }
});