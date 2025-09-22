let activeTab = null;
let startTime = null;

// Sekme değiştiğinde tetiklenir
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await trackTime();
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    activeTab = new URL(tab.url).hostname;
    startTime = Date.now();
  }
});

// Sekme güncellendiğinde (örneğin yeni siteye geçiş)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
    await trackTime();
    if (tab.url) {
      activeTab = new URL(tab.url).hostname;
      startTime = Date.now();
    }
  }
});

// Zamanı kaydet
async function trackTime() {
  if (activeTab && startTime) {
    const duration = Math.floor((Date.now() - startTime) / 1000); // saniye
    let data = (await chrome.storage.local.get([activeTab])) || {};
    let total = data[activeTab] || 0;
    total += duration;
    await chrome.storage.local.set({ [activeTab]: total });
  }
}
