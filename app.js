document.addEventListener('DOMContentLoaded', () => {
  const elements = {
    multiselect: document.getElementById('multiselect'),
    instruments: document.getElementById('instruments'),
    saveButton: document.getElementById('saveChanges'),
    resetButton: document.getElementById('resetButton'),
    apiForm: document.getElementById('apiForm'),
    songCard: document.getElementById('song-card'),
    submitButton: document.getElementById('submitButton'),
    submitLabel: document.getElementById('submitLabel'),
    dynamicInputContainer: document.getElementById('dynamic-input-container'),
    cover: document.getElementById('cover'),
    songTitle: document.getElementById('song-title'),
    tags: document.getElementById('tags'),
    lyricsContent: document.getElementById('lyricsContent'),
    vocals: document.getElementById('vocals'),
    autoplay: document.getElementById('autoplay'),
    customTags: document.getElementById('custom'),
    volume: document.getElementById('volume'),
    apiEndpoint: document.getElementById('api-endpoint'),
    authToken: document.getElementById('auth-token'),
    addInputBtn: document.getElementById('add-input-btn'),
    stopMusic: document.getElementById('stopMusic'),
    nextSong: document.getElementById('nextSong'),
  };

  const isDebugMode = true;

  const debugLog = (message, data) => {
    if (isDebugMode) {
      console.debug(message, data);
    }
  };

  const getStoredData = (keys, callback) => {
    chrome.storage.sync.get(keys, callback);
  };

  const setStoredData = (data, callback) => {
    chrome.storage.sync.set(data, callback);
  };

  const loadSettings = () => {
    getStoredData(
      ['selectedOptions', 'vocals', 'autoplay', 'customTags', 'instruments', 'volume', 'api', 'authToken', 'dynamicFields'],
      (data) => {
        fillSelectOptions(elements.multiselect, data.selectedOptions);
        fillSelectOptions(elements.instruments, data.instruments);
        elements.vocals.checked = data.vocals || false;
        elements.autoplay.checked = data.autoplay || false;
        elements.customTags.value = data.customTags || '';
        elements.volume.value = data.volume || '50';
        elements.apiEndpoint.value = data.api || '';
        elements.authToken.value = data.authToken || '';
        (data.dynamicFields ? JSON.parse(data.dynamicFields) : [{}]).forEach(field => addInputRow(field.url, field.selector));
      }
    );
  };

  const fillSelectOptions = (selectElement, values) => {
    if (values) {
      const options = JSON.parse(values);
      for (const option of options) {
        const opt = Array.from(selectElement.options).find(o => o.value === option);
        if (opt) opt.selected = true;
      }
    }
  };

  const setSongCard = () => {
    chrome.storage.local.get(['song'], (data) => {
      if (data.song) {
        debugLog('CURRENT_SONG_DATA', data.song);
        elements.cover.src = data.song.image_url;
        elements.songTitle.innerText = data.song.title;
        elements.tags.innerText = `Tags: ${data.song.tags}`;
        elements.lyricsContent.innerText = data.song.lyric;
        elements.songCard.classList.remove('d-none');
      }
    });
  };

  const syncSettings = () => {
    const selectedOptions = Array.from(elements.multiselect.selectedOptions).map(option => option.value);
    const selectedInstruments = Array.from(elements.instruments.selectedOptions).map(option => option.value);
    const dynamicFields = Array.from(elements.dynamicInputContainer.children).map(container => ({
      url: container.querySelector('.url-input').value,
      selector: container.querySelector('.selector-input').value
    }));

    const settings = {
      selectedOptions: JSON.stringify(selectedOptions),
      instruments: JSON.stringify(selectedInstruments),
      vocals: elements.vocals.checked,
      autoplay: elements.autoplay.checked,
      customTags: elements.customTags.value,
      volume: elements.volume.value,
      api: elements.apiEndpoint.value,
      authToken: elements.authToken.value,
      dynamicFields: JSON.stringify(dynamicFields)
    };

    setStoredData(settings, () => {
      debugLog('Settings saved.', settings);
      bootstrap.Modal.getInstance(document.getElementById('settingsModal')).hide();
    });
  };

  const resetSettings = () => {
    elements.multiselect.selectedIndex = -1;
    elements.instruments.selectedIndex = -1;
    elements.vocals.checked = false;
    elements.autoplay.checked = false;
    elements.customTags.value = '';
    elements.volume.value = '50';
    elements.apiEndpoint.value = 'http://localhost:3000/api/chatgpt';
    elements.authToken.value = '';

    chrome.storage.sync.clear();
    elements.dynamicInputContainer.innerHTML = '';
    addInputRow();
    syncSettings();
  };

  const toggleAccordion = (panel) => {
    panel.classList.toggle('expanded');
    panel.style.maxHeight = panel.classList.contains('expanded') ? `${panel.scrollHeight}px` : '0';
  };

  const updatePanelMaxHeight = (panel) => {
    if (panel.classList.contains('expanded')) {
      panel.style.maxHeight = `${panel.scrollHeight}px`;
    }
  };

  const createInput = (type, className, placeholder, value) => {
    const input = document.createElement('input');
    input.type = type;
    input.className = className;
    input.placeholder = placeholder;
    input.value = value;
    return input;
  };

  const createButton = (innerHTML, className, style) => {
    const button = document.createElement('button');
    button.innerHTML = innerHTML;
    button.className = className;
    button.style = style;
    return button;
  };

  const addInputRow = (url = '', selector = '') => {
    const inputsContainer = document.createElement('div');
    inputsContainer.className = 'inputs-container my-2';

    const urlInput = createInput('text', 'url-input', 'Enter URL', url);
    const selectorInput = createInput('text', 'selector-input mx-1', 'Enter targetSelector', selector);
    const removeBtn = createButton('-', 'btn btn-danger btn-sm', 'width: 35px; position: relative; top: -2px;');

    removeBtn.onclick = () => {
      elements.dynamicInputContainer.removeChild(inputsContainer);
      updatePanelMaxHeight(elements.dynamicInputContainer.parentElement);
    };

    inputsContainer.append(urlInput, selectorInput, removeBtn);
    elements.dynamicInputContainer.appendChild(inputsContainer);
    updatePanelMaxHeight(elements.dynamicInputContainer.parentElement);
  };

  const stopMusic = async () => {
    await chrome.runtime.sendMessage({ stop: true });
    elements.songCard.classList.add('d-none');
  };

  const skipSong = async () => {
    await chrome.runtime.sendMessage({ type: 'PLAYBACK_DONE' });
  };

  const togglePanels = () => {
    const acc = document.querySelectorAll(".accordion");
    acc.forEach(panel => {
      panel.addEventListener("click", function () {
        this.classList.toggle("active");
        toggleAccordion(this.nextElementSibling);
      });
    });
  };

  chrome.runtime.onMessage.addListener((message) => {
    if (message.generating === true) {
      elements.submitButton.disabled = true
      elements.submitLabel.classList.add("spinner-border", "spinner-border-sm");
    }

    if (message.generating === false) {
      elements.submitButton.disabled = false
      elements.submitLabel.classList.remove("spinner-border", "spinner-border-sm");
    }

    if (message.current_song === true) setSongCard();
  });

  elements.apiForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await chrome.runtime.sendMessage({ submit: true });
  });

  elements.addInputBtn.addEventListener('click', () => addInputRow());
  elements.saveButton.addEventListener('click', syncSettings);
  elements.resetButton.addEventListener('click', resetSettings);
  elements.stopMusic.addEventListener('click', stopMusic);
  elements.nextSong.addEventListener('click', skipSong);

  togglePanels();
  loadSettings();

  chrome.storage.local.get(['song'], (data) => {
    if (Object.keys(data.song).length) {
      setSongCard();
    }
  });
});