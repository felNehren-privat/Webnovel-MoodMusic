let audio = null;

chrome.runtime.onMessage.addListener(message => {
    if ('play' in message) {
        playAudio(message.play);
    }
    if ('stop' in message) {
        stopAudio();
    }
});

function playAudio({ source, volume }) {
    console.log('new audio source', source);

    if (audio) {
        audio.pause();
        audio.currentTime = 0;
    }

    audio = new Audio(source);
    audio.volume = volume; 
    audio.play();

    audio.addEventListener('ended', () => {
        console.log('Playback ended');
        chrome.runtime.sendMessage({ type: 'PLAYBACK_DONE' });
    });
}
function stopAudio() {
    if (audio) {
        console.log('Stopping audio playback');
        audio.pause();
        audio.currentTime = 0;
        audio = null;
    }
}