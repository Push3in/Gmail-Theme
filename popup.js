// Keep in sync with DEFAULTS in content.js.
const DEFAULTS = {
  enabled: true,
  dark: "off",
  hideSidePanels: true,
  dateGroups: true,
  floatingCompose: true,
  quietToolbar: false,
  quietControls: false,
  width: "normal",
  rowSpace: "comfy",
};

const options = document.getElementById("options");

function render(settings) {
  for (const input of document.querySelectorAll("input[data-key]")) {
    input.checked = !!settings[input.dataset.key];
  }
  for (const group of document.querySelectorAll(".segmented[data-key]")) {
    for (const button of group.querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(button.value === settings[group.dataset.key]));
    }
  }
  options.classList.toggle("off", !settings.enabled);
}

chrome.storage.sync.get(DEFAULTS, render);

document.addEventListener("change", (e) => {
  const key = e.target.dataset.key;
  if (key) chrome.storage.sync.set({ [key]: e.target.checked });
});

document.addEventListener("click", (e) => {
  const button = e.target.closest(".segmented button");
  if (!button) return;
  chrome.storage.sync.set({ [button.parentElement.dataset.key]: button.value });
});

chrome.storage.onChanged.addListener(() => chrome.storage.sync.get(DEFAULTS, render));
