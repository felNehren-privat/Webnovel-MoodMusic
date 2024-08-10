let targetSelector = '';

if (window.location.href.includes('royalroad.com')) {
    targetSelector = '.chapter-content';
} else if (window.location.href.includes('wanderinginn.com')) {
    targetSelector = '.entry-content';
} else if (window.location.href.includes('kemono')) {
    targetSelector = '.post__content';
}

const targetElement = targetSelector ? document.querySelector(targetSelector) : undefined;
const content = targetElement ? targetElement.textContent : '';
const title = document.title;
const url = window.location.href;

if (content !== '') {
    chrome.runtime.sendMessage({ setTabValue: { content, title, url } });
}