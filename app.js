const defaults = { title: "Come to me, all you\nwho are weary and\nburdened, and I will\ngive you rest", subtitle: "Matthew  11:28" };
const limits = { title: 100, subtitle: 50 };
const state = { ...defaults };
let activeField = "title";
let activeFormat = "facebook";
let activeTemplateIndex = 3;
let uploadedPhotoUrl = null;
let createdImageBlob = null;
let createdImageUrl = null;
let createdImageDownloaded = false;
let shareActionChosen = false;
let sampleImageUrl = null;
let samplePreviewVersion = 0;
let captionTips = [];
let captionTipsShown = false;
let textExamples = {};
let captionTipIndex = 1;
let guideState = "idle";
let guideIdleTimer = null;
let guideCaptionWritten = false;

const $ = (selector) => document.querySelector(selector);
const words = (value) => value.trim() ? value.trim().split(/\s+/) : [];
const currentTemplate = () => window.POST_TEMPLATES[activeFormat][activeTemplateIndex];
const currentImageUrl = () => uploadedPhotoUrl || currentTemplate().background;

function supabaseConfig() {
  const config = window.SUPABASE_CONFIG || {};
  return config.url && config.anonKey ? config : null;
}

async function callCounterRpc(name) {
  const config = supabaseConfig();
  if (!config) return null;
  try {
    const response = await fetch(`${config.url.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, "Content-Type": "application/json" },
      body: "{}"
    });
    if (!response.ok) throw new Error("Counter request failed");
    return await response.json();
  } catch { return null; }
}

async function recordVisitor() {
  if (sessionStorage.getItem("all-things-new-visitor-counted")) return;
  const visitors = Number(await callCounterRpc("increment_visitors"));
  if (!Number.isFinite(visitors)) return;
  sessionStorage.setItem("all-things-new-visitor-counted", "true");
}

function recordSuccessfulShare() {
  void callCounterRpc("increment_shares").then(loadSiteStats);
}

async function loadSiteStats() {
  const stats = await callCounterRpc("get_site_stats");
  const visitors = Number(stats?.visitors);
  const shares = Number(stats?.shares);
  if (!Number.isFinite(visitors) || !Number.isFinite(shares)) return;
  $("#visitor-count").textContent = visitors.toLocaleString();
  $("#share-count").textContent = shares.toLocaleString();
  $("#site-stats").hidden = false;
}

async function initializeSiteStats() {
  await recordVisitor();
  await loadSiteStats();
}

async function loadCaptionTips() {
  try {
    const response = await fetch("templates/caption-tips.json");
    if (!response.ok) return;
    captionTips = await response.json();
    if (captionTips[0]) $("#caption-input").placeholder = captionTips[0].hint;
  } catch { captionTips = []; }
}

async function loadTextExamples() {
  try {
    const response = await fetch("templates/text-examples.json");
    if (!response.ok) throw new Error("Text examples could not be loaded");
    textExamples = await response.json();
    $("#generate-text-button").disabled = false;
  } catch {
    $("#generate-text-button").textContent = "Text examples unavailable";
  }
}

function showCaptionTip() {
  if (!captionTips.length) return;
  const tip = captionTips[captionTipIndex % captionTips.length];
  captionTipIndex += 1;
  $("#caption-input").placeholder = tip.hint;
  const tipElement = $("#caption-guide-tip");
  tipElement.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = tip.title;
  tipElement.append(title, ...tip.steps.map((step) => { const item = document.createElement("span"); item.textContent = step; return item; }));
  tipElement.hidden = false;
  captionTipsShown = true;
  $("#caption-guide-button").setAttribute("aria-expanded", "true");
}

function setupComposer() {
  $("#caption-guide-button").textContent = "💡 Show tips";
  const actions = $(".platform-actions");
  const shareButton = document.createElement("button");
  shareButton.type = "button";
  shareButton.innerHTML = '<i class="fa-solid fa-share-nodes" aria-hidden="true"></i><span>Share post</span>';
  shareButton.addEventListener("click", shareCreatedPost);
  const downloadButton = document.createElement("button");
  downloadButton.type = "button";
  downloadButton.className = "download-copy-button";
  downloadButton.innerHTML = '<i class="fa-solid fa-download" aria-hidden="true"></i><span>Download and copy</span>';
  downloadButton.addEventListener("click", downloadAndCopyPost);
  actions.replaceChildren(shareButton, downloadButton);
  actions.previousElementSibling.textContent = "Share your post";
  const fallback = document.createElement("p");
  fallback.className = "share-fallback-message";
  fallback.id = "share-fallback-message";
  fallback.hidden = true;
  fallback.textContent = "Your picture is downloaded. Open the app you want to use, choose the picture, then add the caption and hashtags shown above.";
  actions.after(fallback);
  const retry = document.createElement("div");
  retry.className = "redownload-help";
  retry.id = "redownload-help";
  retry.hidden = true;
  retry.innerHTML = "<p>If your image did not download, try again here.</p><button id=\"redownload-image\" type=\"button\">Download image again</button>";
  $("#created-image-preview").after(retry);
  $("#redownload-image").addEventListener("click", () => { if (createdImageBlob) downloadImage(createdImageBlob); });
}

function clearGuide() {
  $("#guide-layer").replaceChildren();
  $("#guide-layer").hidden = true;
  document.querySelectorAll(".guide-inline-callout").forEach((element) => element.remove());
  document.querySelectorAll(".guide-highlight").forEach((element) => element.classList.remove("guide-highlight"));
}

function addGuideCallout(target, message, step) {
  const rect = target.getBoundingClientRect();
  const isSmallScreen = window.matchMedia("(max-width: 600px)").matches;
  const callout = document.createElement("div");
  callout.className = "guide-callout";
  callout.textContent = `${step ? `${step}. ` : ""}${message}`;
  if (isSmallScreen) {
    callout.classList.add("guide-inline-callout");
    target.insertAdjacentElement("afterend", callout);
  } else {
    callout.style.left = `${Math.min(Math.max(12, rect.left), window.innerWidth - 292)}px`;
    callout.style.top = `${Math.min(rect.bottom + 12, window.innerHeight - 90)}px`;
    $("#guide-layer").append(callout);
  }
  target.classList.add("guide-highlight");
}

function showCreationGuide() {
  guideState = "creating";
  $("#guide-bulb").hidden = true;
  $(".editor-card").scrollIntoView({ behavior:"smooth", block:"center" });
  setTimeout(() => {
    const layer = $("#guide-layer");
    layer.hidden = false;
    layer.replaceChildren();
    const heading = document.createElement("p");
    heading.className = "guide-heading";
    heading.textContent = "Let's create our post image!";
    layer.append(heading);
    addGuideCallout($(".upload-button"), "Choose a photo for your background", 1);
    addGuideCallout($("[data-field='title']"), "Key in your title", 2);
    addGuideCallout($("[data-field='subtitle']"), "Add a subtitle", 3);
    addGuideCallout($("#share-button"), "When you are ready, make your picture", 4);
    setTimeout(() => document.addEventListener("click", dismissCreationGuide, { once:true }), 100);
  }, 400);
}

function dismissCreationGuide() {
  if (guideState !== "creating") return;
  clearGuide();
  guideState = "waiting-for-image";
}

function dismissGuideMessage(expectedState) {
  if (guideState === expectedState) clearGuide();
}

function showComposerGuide() {
  if (guideState !== "waiting-for-image") return;
  guideState = "writing-caption";
  guideCaptionWritten = false;
  if (window.matchMedia("(max-width: 600px)").matches) return;
  const layer = $("#guide-layer");
  layer.hidden = false;
  layer.replaceChildren();
  addGuideCallout($("#caption-input"), "Write your story about the picture!", "");
  setTimeout(() => document.addEventListener("click", () => dismissGuideMessage("writing-caption"), { once:true }), 100);
}

function showSharingGuide() {
  if (guideState !== "writing-caption" || !guideCaptionWritten) return;
  guideState = "sharing";
  clearGuide();
  if (window.matchMedia("(max-width: 600px)").matches) return;
  const layer = $("#guide-layer");
  layer.hidden = false;
  addGuideCallout($(".platform-actions"), "Your story is ready. Choose where to share it.", "");
  setTimeout(() => document.addEventListener("click", () => dismissGuideMessage("sharing"), { once:true }), 100);
}

function resetGuideIdleTimer() {
  if (guideState !== "idle") return;
  $("#guide-bulb").hidden = true;
  clearTimeout(guideIdleTimer);
  guideIdleTimer = setTimeout(() => { if (guideState === "idle") $("#guide-bulb").hidden = false; }, 5000);
}

function applyTemplateDefaults() {
  Object.assign(state, currentTemplate().defaults || defaults);
}

function updateTemplateControls() {
  const template = currentTemplate();
  $("#template").style.aspectRatio = `${template.width}/${template.height}`;
  $("#template-name").textContent = template.name;
  $("#template-size").textContent = `${template.width} x ${template.height}`;
  document.body.dataset.format = activeFormat;
  document.querySelectorAll("[data-format]").forEach((button) => button.classList.toggle("is-selected", button.dataset.format === activeFormat));
}

function updatePreview() {
  updateTemplateControls();
  $("#background-image").src = currentImageUrl();
  positionTemplateOverlays();
  ["title", "subtitle"].forEach((field) => {
    $(`#${field}-preview`).textContent = state[field] || (field === "title" ? "Your title" : "Your subtitle");
    $(`#${field}-summary`).textContent = state[field];
  });
  fitPreviewText();
  updateSocialPostPreview();
}

async function updateSocialPostPreview() {
  const version = ++samplePreviewVersion;
  const sample = $("#social-sample");
  sample.dataset.platform = activeFormat;
  $("#sample-user-name").textContent = activeFormat === "facebook" ? "All Things New" : "allthingsnew.hope";
  $("#sample-post-meta").textContent = activeFormat === "facebook" ? "Just now · Public" : "All Things New";
  try {
    const imageBlob = await createImage();
    if (!imageBlob || version !== samplePreviewVersion) return;
    if (sampleImageUrl) URL.revokeObjectURL(sampleImageUrl);
    sampleImageUrl = URL.createObjectURL(imageBlob);
    $("#sample-post-image").src = sampleImageUrl;
  } catch {
    if (version === samplePreviewVersion) $("#sample-post-image").src = currentImageUrl();
  }
}

function positionTemplateOverlays() {
  const template = currentTemplate();
  const templateElement = $("#template");
  const watermark = $("#template-watermark");
  const watermarkTitle = $("#watermark-title");
  const watermarkSubtitle = $("#watermark-subtitle");
  const logo = $("#template-logo");
  const scale = templateElement.clientWidth / template.width;
  const outputScale = template.width / 940;
  const isInstagram = activeFormat === "instagram";
  const isTemplateFour = template.id.endsWith("04");
  const watermarkScale = .882;
  const watermarkWidth = 199 * watermarkScale * outputScale * scale;
  const watermarkHeight = 32 * watermarkScale * outputScale * scale;
  const logoWidth = 76 * .63 * (isInstagram ? 1.3 : 1) * outputScale * scale;

  watermark.style.width = `${watermarkWidth}px`;
  watermark.style.height = `${watermarkHeight}px`;
  watermark.style.left = `${(template.id === "ig-03" ? 100 : isInstagram && !isTemplateFour ? 120 : isInstagram ? 110 : 90) * scale}px`;
  watermark.style.top = `${(isInstagram && !isTemplateFour ? 140 : isInstagram ? 160 : 85) * scale}px`;
  watermark.style.transform = "none";
  watermarkTitle.style.fontSize = `${watermarkHeight * .8}px`;
  watermarkSubtitle.style.fontSize = `${watermarkHeight * .459}px`;
  watermark.classList.toggle("has-gradient-title", template.id === "fb-02");
  watermark.classList.toggle("has-instagram-gradient-title", template.id === "ig-02");
  watermark.classList.toggle("has-dark-subtitle", template.id === "fb-02" || template.id === "ig-02");
  logo.style.width = `${logoWidth}px`;
  logo.style.opacity = ".7";
  logo.style.bottom = `${(isInstagram ? 50 : 30) * scale}px`;
  if (isInstagram && isTemplateFour) {
    watermark.style.left = "50%";
    watermark.style.transform = "translateX(-50%)";
    logo.style.left = "50%";
    logo.style.right = "auto";
    logo.style.transform = "translateX(-50%)";
  } else {
    logo.style.right = `${(isInstagram ? 40 : 30) * scale}px`;
    logo.style.left = "auto";
    logo.style.transform = "none";
  }
}

function fitPreviewText() {
  const templateElement = $("#template");
  const template = currentTemplate();
  const title = $("#title-preview");
  const subtitle = $("#subtitle-preview");
  const scaleToTemplate = templateElement.clientWidth / template.width;
  const padding = (activeFormat === "instagram" ? 100 : 75) * scaleToTemplate;
  const topPadding = (activeFormat === "instagram" ? 200 : 75) * scaleToTemplate;
  const bottomPadding = (activeFormat === "instagram" ? 200 : 100) * scaleToTemplate;
  const baseScale = template.width / 940;
  const isStackLayout = template.layout.startsWith("stack-center");
  let textScale = 1;

  do {
    const titleSize = (template.titleSize || 48.5) * baseScale * scaleToTemplate * textScale;
    const subtitleSize = (template.subtitleSize || 35.7) * baseScale * scaleToTemplate * textScale;
    [title, subtitle].forEach((text) => {
      text.style.left = isStackLayout ? "0" : `${padding}px`;
      text.style.width = isStackLayout ? "100%" : `${templateElement.clientWidth - padding * 2}px`;
      text.style.paddingInline = isStackLayout ? `${padding}px` : "0";
    });
    title.style.fontSize = `${titleSize}px`;
    title.style.fontWeight = template.titleWeight;
    title.style.color = template.textColor || "white";
    subtitle.style.fontSize = `${subtitleSize}px`;
    subtitle.style.fontWeight = "400";
    subtitle.style.color = template.textColor || "white";
    if (isStackLayout) {
      const gap = 24 * scaleToTemplate * textScale;
      title.style.textAlign = template.textAlign || "center";
      subtitle.style.textAlign = template.textAlign || "center";
      if (template.layout === "stack-center-reverse") {
        subtitle.style.top = `${Math.max(topPadding, (templateElement.clientHeight - title.offsetHeight - gap - subtitle.offsetHeight) / 2)}px`;
        title.style.top = `${subtitle.offsetTop + subtitle.offsetHeight + gap}px`;
      } else {
        title.style.top = `${Math.max(topPadding, (templateElement.clientHeight - title.offsetHeight - gap - subtitle.offsetHeight) / 2)}px`;
        subtitle.style.top = `${title.offsetTop + title.offsetHeight + gap}px`;
      }
    } else if (template.layout === "bottom-left") {
      title.style.textAlign = "left";
      subtitle.style.textAlign = "left";
      title.style.top = `${templateElement.clientHeight - bottomPadding - title.offsetHeight}px`;
      subtitle.style.top = `${title.offsetTop - 24 * scaleToTemplate - subtitle.offsetHeight}px`;
    } else {
      title.style.textAlign = template.layout === "left-center" ? "left" : "center";
      subtitle.style.textAlign = template.subtitleAlign || (template.layout === "left-center" ? "right" : "center");
      title.style.top = `${Math.max(topPadding, (templateElement.clientHeight - title.offsetHeight) / 2)}px`;
      subtitle.style.top = `${title.offsetTop + title.offsetHeight + (templateElement.clientHeight - bottomPadding - title.offsetTop - title.offsetHeight - subtitle.offsetHeight) / 2}px`;
    }
    textScale -= .02;
  } while ((title.scrollWidth > title.clientWidth || subtitle.scrollWidth > subtitle.clientWidth || title.offsetTop < topPadding || subtitle.offsetTop < topPadding || title.offsetTop + title.offsetHeight > templateElement.clientHeight - bottomPadding || subtitle.offsetTop + subtitle.offsetHeight > templateElement.clientHeight - bottomPadding) && textScale > .1);
}

function selectFormat(format) {
  activeFormat = format;
  activeTemplateIndex = 3;
  applyTemplateDefaults();
  updatePreview();
}

function changeTemplate(direction) {
  const templates = window.POST_TEMPLATES[activeFormat];
  activeTemplateIndex = (activeTemplateIndex + direction + templates.length) % templates.length;
  applyTemplateDefaults();
  updatePreview();
}

function generateText() {
  const examples = textExamples[currentTemplate().id];
  if (!examples?.length) return;
  Object.assign(state, examples[Math.floor(Math.random() * examples.length)]);
  updatePreview();
}

function replaceUploadedPhoto(file) {
  if (!file) return;
  if (uploadedPhotoUrl) URL.revokeObjectURL(uploadedPhotoUrl);
  uploadedPhotoUrl = URL.createObjectURL(file);
  $("#upload-note").textContent = `${file.name} is selected for this post only.`;
  updatePreview();
}

function openEditor(field) {
  activeField = field;
  $("#dialog-title").textContent = field === "title" ? "Edit title" : "Edit subtitle";
  $("#message-label").textContent = field === "title" ? "Title" : "Subtitle";
  $("#message-input").value = state[field];
  updateWordCount();
  $("#voice-status").textContent = "";
  $("#edit-dialog").showModal();
  $("#message-input").focus();
}

function updateWordCount() {
  const count = words($("#message-input").value).length;
  const max = limits[activeField];
  const preferred = activeField === "title" ? 20 : 30;
  $("#word-count").textContent = `${count} / ${max} words`;
  $("#word-count").style.color = count > max ? "#c84d3a" : "";
  $("#text-guidance").textContent = count > preferred ? `This ${activeField} is longer than the preferred ${preferred} words. Keep the picture clean, light, and minimal when you can.` : "";
}

$("#title-preview").addEventListener("click", () => openEditor("title"));
$("#subtitle-preview").addEventListener("click", () => openEditor("subtitle"));
document.querySelectorAll(".edit-row").forEach((button) => button.addEventListener("click", () => openEditor(button.dataset.field)));
$("#message-input").addEventListener("input", updateWordCount);
$("#edit-form").addEventListener("submit", (event) => {
  if (event.submitter?.value !== "save") return;
  const value = $("#message-input").value.trim();
  if (!value || words(value).length > limits[activeField]) { event.preventDefault(); $("#voice-status").textContent = `Please use 1 to ${limits[activeField]} words.`; return; }
  state[activeField] = value;
  updatePreview();
});

$("#speak-button").addEventListener("click", () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { $("#voice-status").textContent = "Voice input is not supported here. Please type instead."; return; }
  const recognition = new SpeechRecognition();
  recognition.lang = document.documentElement.lang || "en-US";
  recognition.onstart = () => { $("#voice-status").textContent = "Listening... speak now."; };
  recognition.onresult = (event) => { $("#message-input").value = event.results[0][0].transcript; updateWordCount(); };
  recognition.onerror = () => { $("#voice-status").textContent = "We could not hear that. Please try again or type instead."; };
  recognition.onend = () => { if ($("#voice-status").textContent === "Listening... speak now.") $("#voice-status").textContent = ""; };
  recognition.start();
});

function showShareDialog() {
  const dialog = $("#share-dialog");
  dialog.hidden = false;
  dialog.style.display = "grid";
  $("#processing-state").hidden = false;
  $("#post-composer").hidden = true;
}

function finishShareDialog() { const dialog = $("#share-dialog"); dialog.hidden = true; dialog.style.display = "none"; }

function drawCover(context, image, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function loadImage(source) {
  const image = new Image();
  image.src = source;
  return new Promise((resolve, reject) => { image.onload = () => resolve(image); image.onerror = reject; });
}

function drawTemplateOverlays(context, template, logo) {
  const scale = template.width / 940;
  const isInstagram = template.id.startsWith("ig-");
  const isTemplateFour = template.id.endsWith("04");
  const logoWidth = 76 * .63 * (isInstagram ? 1.3 : 1) * scale;
  const logoHeight = logo.height / logo.width * logoWidth;
  const logoX = isInstagram && isTemplateFour ? (template.width - logoWidth) / 2 : template.width - (isInstagram ? 40 : 30) * scale - logoWidth;
  const logoY = template.height - (isInstagram ? 50 : 30) * scale - logoHeight;
  drawWatermark(context, template, scale);
  context.save();
  context.globalAlpha = .7;
  context.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
  context.restore();
}

function drawWatermark(context, template, scale) {
  const watermarkScale = .882;
  const width = 199 * watermarkScale * scale;
  const height = 32 * watermarkScale * scale;
  const isInstagram = template.id.startsWith("ig-");
  const isTemplateFour = template.id.endsWith("04");
  const x = isInstagram && isTemplateFour ? (template.width - width) / 2 : (template.id === "ig-03" ? 100 : isInstagram ? 120 : 90) * scale;
  const y = (isInstagram && !isTemplateFour ? 140 : isInstagram ? 160 : 85) * scale;
  context.save();
  context.textAlign = "center";
  context.font = `italic 800 ${height * .8}px Montserrat, Arial, sans-serif`;
  if (template.id === "fb-02" || template.id === "ig-02") {
    const gradient = context.createLinearGradient(x, y, x + width, y);
    gradient.addColorStop(0, "#98348e");
    gradient.addColorStop(.5, "#3478d5");
    gradient.addColorStop(1, template.id === "ig-02" ? "#75e6cb" : "#70d7ef");
    context.fillStyle = gradient;
  } else context.fillStyle = "white";
  context.fillText("ALL THINGS NEW", x + width / 2, y + height * .7);
  context.font = `300 ${height * .459}px Montserrat, Arial, sans-serif`;
  context.fillStyle = template.id === "fb-02" || template.id === "ig-02" ? "black" : "white";
  context.fillText("HOPE STARTS HERE", x + width / 2, y + height);
  context.restore();
}

async function createImage() {
  const template = currentTemplate();
  const canvas = document.createElement("canvas");
  canvas.width = template.width;
  canvas.height = template.height;
  const context = canvas.getContext("2d");
  const [image, logo] = await Promise.all([loadImage(currentImageUrl()), loadImage("resources/images/template_logo.png")]);
  drawCover(context, image, template.width, template.height);
  drawTemplateOverlays(context, template, logo);
  context.textAlign = "center";
  context.fillStyle = template.textColor || "white";
  drawTemplateText(context, template);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function wrapText(context, value, maxWidth) {
  const lines = [];
  value.split("\n").forEach((paragraph) => {
    let line = "";
    paragraph.trim().split(/\s+/).forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next;
    });
    if (line) lines.push(line);
  });
  return lines;
}

function drawTemplateText(context, template) {
  const scale = template.width / 940;
  const padding = template.id.startsWith("ig-") ? 100 : 75;
  const topPadding = template.id.startsWith("ig-") ? 200 : 75;
  const bottomPadding = template.id.startsWith("ig-") ? 200 : 100;
  const maxWidth = template.width - padding * 2;
  let textScale = 1;
  let titleLines;
  let subtitleLines;
  let titleSize;
  let subtitleSize;
  let titleY;
  let titleBottom;
  let subtitleHeight;
  let subtitleY;
  let widestLine;

  do {
    titleSize = (template.titleSize || 48.5) * scale * textScale;
    subtitleSize = (template.subtitleSize || 35.7) * scale * textScale;
    context.font = `${template.titleWeight} ${titleSize}px Montserrat, Arial, sans-serif`;
    titleLines = wrapText(context, state.title, maxWidth);
    widestLine = Math.max(...titleLines.map((line) => context.measureText(line).width));
    context.font = `400 ${subtitleSize}px Montserrat, Arial, sans-serif`;
    subtitleLines = wrapText(context, state.subtitle, maxWidth);
    widestLine = Math.max(widestLine, ...subtitleLines.map((line) => context.measureText(line).width));
    subtitleHeight = subtitleSize + (subtitleLines.length - 1) * subtitleSize * 1.25;
    const titleHeight = titleSize + (titleLines.length - 1) * titleSize * 1.15;
    if (template.layout === "stack-center") {
      const gap = 24 * scale * textScale;
      titleY = Math.max(topPadding + titleSize, (template.height - titleHeight - gap - subtitleHeight) / 2 + titleSize);
      titleBottom = titleY + (titleLines.length - 1) * titleSize * 1.15 + titleSize * .2;
      subtitleY = titleBottom + gap + subtitleSize;
    } else if (template.layout === "stack-center-reverse") {
      const gap = 24 * scale * textScale;
      subtitleY = Math.max(topPadding + subtitleSize, (template.height - titleHeight - gap - subtitleHeight) / 2 + subtitleSize);
      titleY = subtitleY + (subtitleLines.length - 1) * subtitleSize * 1.25 + gap + titleSize;
      titleBottom = titleY + (titleLines.length - 1) * titleSize * 1.15 + titleSize * .2;
    } else if (template.layout === "bottom-left") {
      titleY = template.height - bottomPadding - (titleLines.length - 1) * titleSize * 1.15;
      titleBottom = titleY + titleSize * .2;
      subtitleY = titleY - 24 * scale - (subtitleLines.length - 1) * subtitleSize * 1.25;
    } else {
      titleY = Math.max(topPadding + titleSize, (template.height - titleHeight) / 2 + titleSize);
      titleBottom = titleY + (titleLines.length - 1) * titleSize * 1.15 + titleSize * .2;
      subtitleY = titleBottom + (template.height - bottomPadding - titleBottom - subtitleHeight) / 2 + subtitleSize;
    }
    textScale -= .02;
  } while ((widestLine > maxWidth || titleY - titleSize < topPadding || subtitleY - subtitleSize < topPadding || titleY + (titleLines.length - 1) * titleSize * 1.15 > template.height - bottomPadding || subtitleY + (subtitleLines.length - 1) * subtitleSize * 1.25 > template.height - bottomPadding) && textScale > .1);

  context.font = `${template.titleWeight} ${titleSize}px Montserrat, Arial, sans-serif`;
  const titleAlign = template.textAlign || (template.layout === "left-center" || template.layout === "bottom-left" ? "left" : "center");
  context.textAlign = titleAlign;
  titleLines.forEach((text, index) => context.fillText(text, titleAlign === "left" ? padding : titleAlign === "right" ? template.width - padding : template.width / 2, titleY + index * titleSize * 1.15));
  context.font = `400 ${subtitleSize}px Montserrat, Arial, sans-serif`;
  const subtitleAlign = template.subtitleAlign || template.textAlign || (template.layout === "left-center" ? "right" : template.layout === "bottom-left" ? "left" : "center");
  context.textAlign = subtitleAlign;
  subtitleLines.forEach((text, index) => context.fillText(text, subtitleAlign === "right" ? template.width - padding : subtitleAlign === "left" ? padding : template.width / 2, subtitleY + index * subtitleSize * 1.25));
}

function downloadImage(blob) {
  try {
    const link = document.createElement("a");
    link.download = `all-things-new-${activeFormat}.png`;
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    return true;
  } catch {
    return false;
  }
}

async function prepareImage() {
  try {
    const imageBlob = await createImage();
    if (!imageBlob) throw new Error("Image creation failed");
    createdImageBlob = imageBlob;
    shareActionChosen = false;
    createdImageDownloaded = downloadImage(imageBlob);
    $("#post-composer h2").textContent = createdImageDownloaded ? "Your image is ready" : "Your image is ready to download";
    if (createdImageUrl) URL.revokeObjectURL(createdImageUrl);
    createdImageUrl = URL.createObjectURL(createdImageBlob);
    $("#created-image-preview").src = createdImageUrl;
    $("#redownload-help").hidden = createdImageDownloaded;
    $("#share-fallback-message").hidden = true;
    $("#caption-guide-tip").hidden = !captionTipsShown;
    $("#caption-guide-button").setAttribute("aria-expanded", String(captionTipsShown));
    $("#processing-state").hidden = true;
    $("#post-composer").hidden = false;
    showComposerGuide();
  } catch { $("#upload-note").textContent = "The image could not be created. Please try another photo."; finishShareDialog(); }
}

function postText() {
  const caption = $("#caption-input").value.trim();
  const hashtags = $("#hashtag-input").value.trim();
  return [caption, hashtags].filter(Boolean).join("\n\n");
}

async function downloadAndCopyPost() {
  if (!createdImageBlob) return;
  clearGuide();
  createdImageDownloaded = downloadImage(createdImageBlob);
  $("#redownload-help").hidden = createdImageDownloaded;
  let copied = false;
  try {
    if (navigator.clipboard) { await navigator.clipboard.writeText(postText()); copied = true; }
  } catch { /* Clipboard access can be denied by a browser setting. */ }
  $("#share-fallback-message").textContent = copied ? "The image was downloaded and the caption and hashtags were copied to your clipboard." : "The image was downloaded. Copy the caption and hashtags above before posting.";
  $("#share-fallback-message").hidden = false;
  $("#share-status").textContent = "";
  shareActionChosen = true;
  recordSuccessfulShare();
}

async function shareCreatedPost() {
  if (!createdImageBlob) return;
  clearGuide();
  const text = postText();
  const file = new File([createdImageBlob], `all-things-new-${activeFormat}.png`, { type: "image/png" });
  const status = $("#share-status");

  if (!createdImageDownloaded) {
    createdImageDownloaded = downloadImage(createdImageBlob);
    $("#redownload-help").hidden = createdImageDownloaded;
  }

  if (navigator.share) {
    try {
      const shareData = navigator.canShare?.({ files: [file] })
        ? { title: "All Things New", text, files: [file] }
        : { title: "All Things New", text };
      await navigator.share(shareData);
      recordSuccessfulShare();
      shareActionChosen = true;
      status.textContent = "Shared successfully.";
      return;
    } catch { await downloadAndCopyPost(); return; }
  }

  await downloadAndCopyPost();
}

$("#share-button").addEventListener("click", () => { if (guideState === "waiting-for-image") clearGuide(); showShareDialog(); prepareImage(); });
$("#close-share").addEventListener("click", async () => {
  if (createdImageBlob && !shareActionChosen) await downloadAndCopyPost();
  finishShareDialog();
  clearGuide();
  guideState = "idle";
  resetGuideIdleTimer();
});
$("#caption-guide-button").addEventListener("click", showCaptionTip);
$("#caption-input").addEventListener("input", () => { if (guideState === "writing-caption") guideCaptionWritten = true; });
$("#caption-input").addEventListener("blur", showSharingGuide);
$("#guide-bulb").addEventListener("click", showCreationGuide);
[
  "pointermove", "keydown", "touchstart", "scroll"
].forEach((eventName) => window.addEventListener(eventName, resetGuideIdleTimer, { passive:true }));
$("#photo-upload").addEventListener("change", (event) => replaceUploadedPhoto(event.target.files[0]));
document.querySelectorAll("[data-format]").forEach((button) => button.addEventListener("click", () => selectFormat(button.dataset.format)));
$("#previous-template").addEventListener("click", () => changeTemplate(-1));
$("#next-template").addEventListener("click", () => changeTemplate(1));
$("#reset-button").addEventListener("click", () => {
  applyTemplateDefaults();
  if (uploadedPhotoUrl) URL.revokeObjectURL(uploadedPhotoUrl);
  uploadedPhotoUrl = null;
  $("#photo-upload").value = "";
  $("#upload-note").textContent = "Use a warm photo from your phone. Uploaded photos stay only in this browser.";
  updatePreview();
});
$("#generate-text-button").addEventListener("click", generateText);

$("#share-dialog").hidden = true;
$("#share-dialog").style.display = "none";
setupComposer();
loadCaptionTips();
loadTextExamples();
updatePreview();
resetGuideIdleTimer();
initializeSiteStats();
window.addEventListener("resize", fitPreviewText);
