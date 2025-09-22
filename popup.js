document.addEventListener("DOMContentLoaded", async () => {
  const timeList = document.getElementById("timeList");
  const siteInput = document.getElementById("siteInput");
  const timeSelect = document.getElementById("timeSelect");
  const addBtn = document.getElementById("addBtn");
  
  // Mevcut verileri yükle
  await loadTimeData();
  
  // Ekle butonu click event
  addBtn.addEventListener("click", addTimeEntry);
  
  // Enter tuşu ile ekleme
  siteInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      addTimeEntry();
    }
  });
  
  async function loadTimeData() {
    const data = await chrome.storage.local.get(null);
    timeList.innerHTML = "";
    
    // Sadece limit verilerini filtrele
    const limits = {};
    const timeData = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (key.endsWith('_limit')) {
        const siteName = key.replace('_limit', '');
        limits[siteName] = value;
      } else {
        timeData[key] = value;
      }
    }
    
    // Tüm siteleri göster (limit belirlenen ve belirlenmeyen)
    const allSites = new Set([...Object.keys(limits), ...Object.keys(timeData)]);
    
    for (const site of allSites) {
      const currentSeconds = timeData[site] || 0;
      const limitSeconds = limits[site];
      addRowToTable(site, currentSeconds, limitSeconds);
    }
  }
  
  function addRowToTable(site, seconds, limitSeconds) {
    const row = document.createElement("tr");
    
    const siteCell = document.createElement("td");
    siteCell.textContent = site;
    
    const timeCell = document.createElement("td");
    const currentTime = `${Math.floor(seconds / 60)} dk ${seconds % 60} sn`;
    
    if (limitSeconds) {
      const limitTime = `${Math.floor(limitSeconds / 60)} dk`;
      timeCell.innerHTML = `${currentTime} / ${limitTime}`;
      
      // Limit aşıldıysa satırı kırmızı yap
      if (seconds >= limitSeconds) {
        row.style.backgroundColor = "#ffebee";
        row.style.color = "#c62828";
        row.style.fontWeight = "bold";
      }
    } else {
      timeCell.innerHTML = currentTime;
    }
    
    const actionCell = document.createElement("td");
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Sil";
    deleteBtn.className = "delete-btn";
    deleteBtn.addEventListener("click", () => deleteSite(site));
    actionCell.appendChild(deleteBtn);
    
    row.appendChild(siteCell);
    row.appendChild(timeCell);
    row.appendChild(actionCell);
    
    timeList.appendChild(row);
  }
  
  async function addTimeEntry() {
    const siteName = siteInput.value.trim();
    const timeMinutes = parseInt(timeSelect.value);
    
    if (!siteName) {
      alert("Lütfen bir site adı girin!");
      return;
    }
    
    const timeSeconds = timeMinutes * 60;
    
    // Limit olarak kaydet (site + "_limit" formatında)
    await chrome.storage.local.set({
      [`${siteName}_limit`]: timeSeconds
    });
    
    // Input'u temizle
    siteInput.value = "";
    
    // Tabloyu yeniden yükle
    await loadTimeData();
  }
  
  async function deleteSite(siteName) {
    if (confirm(`${siteName} sitesini silmek istediğinizden emin misiniz?`)) {
      await chrome.storage.local.remove([siteName, `${siteName}_limit`]);
      await loadTimeData();
    }
  }
});
