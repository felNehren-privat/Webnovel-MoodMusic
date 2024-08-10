document.addEventListener('DOMContentLoaded', function() {
  const multiselect = document.getElementById('multiselect');
  const instruments = document.getElementById('instruments');
  const saveButton = document.getElementById('saveChanges');
  const resetButton = document.getElementById('resetButton');
  const apiForm = document.getElementById('apiForm');
  const song_card = document.getElementById('song-card');

  // Load saved settings from Chrome storage
  chrome.storage.sync.get(['selectedOptions', 'vocals', 'autoplay', 'customTags', 'instruments', 'volume', 'api', 'authToken'], function(data) {
    if (data.selectedOptions) {
      const options = JSON.parse(data.selectedOptions);
      for (const option of options) {
        const opt = Array.from(multiselect.options).find(o => o.value === option);
        if (opt) {
          opt.selected = true;
        }
      }
    }
    if (data.instruments) {
      const options = JSON.parse(data.instruments);
      for (const option of options) {
        const opt = Array.from(instruments.options).find(o => o.value === option);
        if (opt) {
          opt.selected = true;
        }
      }
    }
    if (data.vocals) {
      document.getElementById('vocals').checked = data.vocals;
    }
    if (data.autoplay) {
      document.getElementById('autoplay').checked = data.autoplay;
    }
    if (data.customTags) {
      document.getElementById('custom').value = data.customTags;
    }
    if (data.volume) {
      document.getElementById('volume').value = data.volume;
    }
    if (data.api) {
      document.getElementById('api-endpoint').value = data.api;
    }
    if (data.authToken) {
      document.getElementById('auth-token').value = data.authToken;
    }
  });

  function setSongCard() {
    chrome.storage.local.get(['song'], function(data) {
      console.log('CURRENT_SONG_DATA', data.song);
      document.getElementById('cover').src = data.song.image_url;
      document.getElementById('song-title').innerText = data.song.title;
      document.getElementById('tags').innerText = `Tags: ${data.song.tags}`;
      document.getElementById('lyricsContent').innerText = data.song.lyric;
      song_card.classList.remove('d-none');
    });
  }

  // Set current song if playing
  chrome.storage.local.get(['song'], function(data) {
    if (Object.keys(data.song).length) {
      setSongCard();
    }
  });

  function syncSettings() {
    const selectedOptions = Array.from(multiselect.selectedOptions).map(option => option.value);
    const selectedInstruments = Array.from(instruments.selectedOptions).map(option => option.value);
    const vocals = document.getElementById('vocals').checked;
    const autoplay = document.getElementById('autoplay').checked;
    const customTags = document.getElementById('custom').value;
    const volume = document.getElementById('volume').value;
    const api = document.getElementById('api-endpoint').value;
    const authToken = document.getElementById('auth-token').value;

    // Save selections to Chrome storage
    chrome.storage.sync.set({
      selectedOptions: JSON.stringify(selectedOptions),
      instruments: JSON.stringify(selectedInstruments),
      vocals: vocals,
      autoplay: autoplay,
      customTags: customTags,
      volume: volume,
      api: api,
      authToken: authToken
    }, function() {
      console.log('Settings saved.');
      const modal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
      modal.hide();
    });
  }

  // Open SettingsAccordion
  var acc = document.getElementsByClassName("accordion");
  var i;
  
  for (i = 0; i < acc.length; i++) {
    acc[i].addEventListener("click", function() {
      this.classList.toggle("active");
      var panel = this.nextElementSibling;
      if (panel.style.maxHeight) {
        panel.style.maxHeight = null;
      } else {
        panel.style.maxHeight = panel.scrollHeight + "px";
      }
    });
  }

  // Handle Save Changes button
  saveButton.addEventListener('click', function() {
    syncSettings();
  });

  // Handle Reset Button
  resetButton.addEventListener('click', function() {
    for (let i = 0; i < multiselect.options.length; i++) {
      multiselect.options[i].selected = false;
    }
    for (let i = 0; i < instruments.options.length; i++) {
      instruments.options[i].selected = false;
    }
    document.getElementById('vocals').checked = false;
    document.getElementById('custom').value = '';
    document.getElementById('autoplay').checked = false;
    document.getElementById('volume').value = '50';
    document.getElementById('api-endpoint').value = 'http://localhost:3000/api/chatgpt';
    document.getElementById('auth-token').value = '';
    chrome.storage.sync.clear();

    syncSettings();
  });

  // Set Spinning Button
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const submitButton = document.getElementById('submitButton');
    const submitLabel = document.getElementById('submitLabel');

    if (message.generating === true) {
      submitButton.setAttribute("disabled", true);
      submitLabel.classList.add("spinner-border", "spinner-border-sm");
    }

    if (message.generating === false) {
      submitButton.removeAttribute("disabled");
      submitLabel.classList.remove("spinner-border", "spinner-border-sm");
    }

    if (message.current_song === true) {
      setSongCard();
    }
  });

  async function stopMusic() {
    await chrome.runtime.sendMessage({ stop: true });
    song_card.classList.add('d-none');
  }

  // Event listener for form submission
  document.getElementById('apiForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    await chrome.runtime.sendMessage({ submit: true });
  });

  document.getElementById('stopMusic').addEventListener('click', stopMusic);
});
