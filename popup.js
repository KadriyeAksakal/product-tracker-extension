document.addEventListener("DOMContentLoaded", async () => {
  const timeList = document.getElementById("timeList");
  const data = await chrome.storage.local.get(null);

  // Site bazlı süreleri listele
  for (const [site, seconds] of Object.entries(data)) {
    const li = document.createElement("li");
    li.textContent = `${site}: ${Math.floor(seconds / 60)} dk ${seconds % 60} sn`;
    timeList.appendChild(li);
  }
});
