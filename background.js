// Keyboard shortcut (Alt+Shift+S by default): flip the master switch.
// Content scripts listen to storage changes, so every open Gmail tab updates.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-simplify") return;
  const { enabled = true } = await chrome.storage.sync.get("enabled");
  await chrome.storage.sync.set({ enabled: !enabled });
});
