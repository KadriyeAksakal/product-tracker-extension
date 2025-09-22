let activeTab = null;
let startTime = null;
let trackingInterval = null;
let shownWarnings = new Set(); // Gösterilen uyarıları takip et
let lastSaveTime = null; // Son kayıt zamanı

// Extension başlatıldığında mevcut sekmeyi al
chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension başlatıldı');
  await initializeTracking();
});

chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension yüklendi');
  await initializeTracking();
});

// Service worker yaşam döngüsü için
self.addEventListener('activate', async () => {
  console.log('Service worker aktifleşti');
  await initializeTracking();
});

// Mevcut aktif sekmeyi başlat
async function initializeTracking() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0] && tabs[0].url && !tabs[0].url.startsWith('chrome://')) {
      activeTab = new URL(tabs[0].url).hostname;
      startTime = Date.now();
      lastSaveTime = Date.now();
      console.log(`Takip başlatıldı: ${activeTab}`);
      startTracking();
    }
  } catch (error) {
    console.log('Initialize tracking error:', error);
  }
}

// Sürekli takip başlat
function startTracking() {
  // Mevcut interval'ı temizle
  if (trackingInterval) {
    clearInterval(trackingInterval);
  }
  
  // Her 1 saniyede bir süreyi kaydet (daha sık kayıt)
  trackingInterval = setInterval(async () => {
    if (activeTab && startTime) {
      await trackTime();
      // Start time'ı güncelle
      startTime = Date.now();
      lastSaveTime = Date.now();
    }
  }, 1000); // 1 saniye
  
  console.log('Tracking interval başlatıldı');
}

// Sekme değiştiğinde tetiklenir
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  console.log('Sekme değişti');
  await saveCurrentSession(); // Mevcut oturumu kaydet
  
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('moz-extension://')) {
      activeTab = new URL(tab.url).hostname;
      startTime = Date.now();
      lastSaveTime = Date.now();
      console.log(`Yeni sekme: ${activeTab}`);
      startTracking();
    } else {
      console.log('Chrome sayfası, takip yapılmıyor');
      activeTab = null;
      startTime = null;
      if (trackingInterval) {
        clearInterval(trackingInterval);
        trackingInterval = null;
      }
    }
  } catch (error) {
    console.log('Sekme değişim hatası:', error);
  }
});

// Sekme güncellendiğinde (örneğin yeni siteye geçiş)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active && tab.url && !tab.url.startsWith('chrome://')) {
    console.log('Sekme güncellendi:', tab.url);
    await saveCurrentSession(); // Mevcut oturumu kaydet
    
    activeTab = new URL(tab.url).hostname;
    startTime = Date.now();
    lastSaveTime = Date.now();
    console.log(`Güncellenen sekme: ${activeTab}`);
    startTracking();
  }
});

// Zamanı kaydet
async function trackTime() {
  if (activeTab && startTime) {
    const currentTime = Date.now();
    const duration = Math.floor((currentTime - startTime) / 1000); // saniye
    
    if (duration > 0 && duration < 120) { // 2 dakikadan uzun süreleri atla (service worker kapanması)
      try {
        let data = await chrome.storage.local.get([activeTab]);
        let total = data[activeTab] || 0;
        total += duration;
        await chrome.storage.local.set({ [activeTab]: total });
        
        console.log(`${activeTab}: +${duration}s (Toplam: ${Math.floor(total/60)}dk ${total%60}s)`);
        
        // Limit kontrolü yap
        await checkTimeLimit(activeTab, total);
      } catch (error) {
        console.log('TrackTime error:', error);
      }
    } else if (duration >= 120) {
      console.log(`Çok uzun süre atlandı: ${duration}s (muhtemelen service worker kapanmış)`);
    }
  }
}

// Sekme değişiminde daha güvenilir kayıt
async function saveCurrentSession() {
  if (activeTab && startTime) {
    const currentTime = Date.now();
    const duration = Math.floor((currentTime - startTime) / 1000);
    
    if (duration > 0 && duration < 3600) { // 1 saatten uzun süreleri atla
      try {
        let data = await chrome.storage.local.get([activeTab]);
        let total = data[activeTab] || 0;
        total += duration;
        await chrome.storage.local.set({ [activeTab]: total });
        console.log(`Oturum kaydedildi - ${activeTab}: +${duration}s (Toplam: ${Math.floor(total/60)}dk ${total%60}s)`);
      } catch (error) {
        console.log('SaveSession error:', error);
      }
    }
  }
}

// Pencere odağını kaybettiğinde
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Pencere odağı kaybedildi
    console.log('Pencere odağı kaybedildi');
    await saveCurrentSession();
    if (trackingInterval) {
      clearInterval(trackingInterval);
      trackingInterval = null;
    }
    activeTab = null;
    startTime = null;
  } else {
    // Pencere odağı geri geldi
    console.log('Pencere odağı geri geldi');
    setTimeout(async () => {
      await initializeTracking();
    }, 1000); // 1 saniye bekle
  }
});

// Süre limiti kontrolü ve uyarı
async function checkTimeLimit(siteName, currentTime) {
  try {
    const limitData = await chrome.storage.local.get([`${siteName}_limit`]);
    const timeLimit = limitData[`${siteName}_limit`];
    
    console.log(`Limit kontrolü: ${siteName}, Mevcut: ${currentTime}s, Limit: ${timeLimit}s`);
    
    if (timeLimit && currentTime >= timeLimit) {
      const warningKey = `${siteName}_${Math.floor(currentTime / timeLimit)}`;
      
      // Bu uyarı daha önce gösterildi mi kontrol et
      if (shownWarnings.has(warningKey)) {
        return;
      }
      
      const limitMinutes = Math.floor(timeLimit / 60);
      const currentMinutes = Math.floor(currentTime / 60);
      
      console.log(`🚨 UYARI: ${siteName} için süre limiti aşıldı!`);
      
      // Aktif sekmeye alert göster
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && tabs[0].id) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: showAlert,
            args: [siteName, limitMinutes, currentMinutes]
          });
          console.log('Alert gönderildi');
          shownWarnings.add(warningKey); // Uyarı gösterildi olarak işaretle
        } catch (error) {
          console.log('Alert gösterme hatası:', error);
          
          // Eğer script injection çalışmıyorsa notification dene
          try {
            await chrome.notifications.create(`warning-${Date.now()}`, {
              type: 'basic',
              iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAFtetAEVAAAAABJRU5ErkJggg==',
              title: '⚠️ Süre Limiti Aşıldı!',
              message: `${siteName}: ${limitMinutes} dk limit aşıldı! (${currentMinutes} dk)`
            });
            shownWarnings.add(warningKey);
          } catch (notifError) {
            console.log('Notification hatası:', notifError);
          }
        }
      }
    }
  } catch (error) {
    console.log('checkTimeLimit hatası:', error);
  }
}

// Alert gösterecek fonksiyon
function showAlert(siteName, limitMinutes, currentMinutes) {
  alert(`⚠️ SÜRE LİMİTİ AŞILDI!\n\n${siteName} için belirlediğiniz ${limitMinutes} dakikalık süreyi aştınız!\n\nŞu an ${currentMinutes} dakika geçirdiniz.`);
}
