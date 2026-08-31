const posts = {
  english: {
    title: "Come to me, all you\nwho are weary and\nburdened, and I will\ngive you rest",
    subtitle: "Matthew  11:28",
    caption: "I have personally experienced God when I was in trouble. He is a very presence help in trouble\n#All THINGS NEW",
    ui: {
      title: "Share test post",
      creating: "Creating the image...",
      ready: "The image is ready. Download it and copy the caption when you are ready.",
      captionLabel: "Caption and hashtag",
      copy: "Download image and copy caption",
      copied: "The image download started and the caption and hashtag were copied to your clipboard.",
      blocked: "Clipboard access was blocked. Allow clipboard permission, then try again.",
      imageAlt: "Generated test post image",
      error: "The test image could not be created."
    }
  },
  chinese: {
    title: "凡劳苦担重担的\n人，可以到我这里来，\n我就使你们得安息",
    subtitle: "马太福音 11:28",
    caption: "我曾亲身经历神在我患难时的帮助。祂是在患难中随时帮助我们的神。\n#All THINGS NEW",
    font: "'Noto Sans SC'",
    ui: {
      title: "分享测试帖子",
      creating: "正在生成图片...",
      ready: "图片已准备好。您可以下载图片并复制下方的文案。",
      captionLabel: "文案和标签",
      copy: "下载图片并复制文案",
      copied: "图片已开始下载，文案和标签已复制到剪贴板。",
      blocked: "剪贴板访问被阻止。请允许剪贴板权限后再试。",
      imageAlt: "生成的测试帖子图片",
      error: "无法创建测试图片。"
    }
  },
  malay: {
    title: "Marilah kepada-Ku,\nsemua yang letih lesu\ndan berbeban berat,\nAku akan memberi\nkelegaan kepadamu",
    subtitle: "Matius 11:28",
    caption: "Saya sendiri telah mengalami pertolongan Tuhan ketika saya dalam kesusahan. Dia adalah Penolong yang sentiasa hadir dalam kesusahan.\n#All THINGS NEW",
    ui: {
      title: "Catatan ujian perkongsian",
      creating: "Sedang mencipta imej...",
      ready: "Imej sudah sedia. Muat turun imej dan salin kapsyen apabila anda bersedia.",
      captionLabel: "Kapsyen dan hashtag",
      copy: "Muat turun imej dan salin kapsyen",
      copied: "Muat turun imej telah bermula dan kapsyen serta hashtag telah disalin ke papan klip.",
      blocked: "Akses papan klip telah disekat. Benarkan kebenaran papan klip, kemudian cuba lagi.",
      imageAlt: "Imej catatan ujian yang dijana",
      error: "Imej ujian tidak dapat dicipta."
    }
  }
};

const width = 940;
const height = 788;
let activePost = null;
let activeLanguage = null;
let createdImageBlob = null;
let createdImageUrl = null;
let creationVersion = 0;

function loadImage(source) {
  const image = new Image();
  image.src = source;
  return new Promise((resolve, reject) => { image.onload = () => resolve(image); image.onerror = reject; });
}

function drawCover(context, image) {
  const scale = Math.max(width / image.width, height / image.height);
  const imageWidth = image.width * scale;
  const imageHeight = image.height * scale;
  context.drawImage(image, (width - imageWidth) / 2, (height - imageHeight) / 2, imageWidth, imageHeight);
}

function drawWatermark(context) {
  const watermarkWidth = 199 * .882;
  const watermarkHeight = 32 * .882;
  context.save();
  context.textAlign = "center";
  context.fillStyle = "white";
  context.font = `italic 800 ${watermarkHeight * .55}px Montserrat, Arial, sans-serif`;
  context.fillText("ALL THINGS NEW", 90 + watermarkWidth / 2, 85 + watermarkHeight * .58);
  context.font = `300 ${watermarkHeight * .3}px Montserrat, Arial, sans-serif`;
  context.fillText("HOPE STARTS HERE", 90 + watermarkWidth / 2, 85 + watermarkHeight);
  context.restore();
}

function drawText(context, post) {
  const titleSize = 48.5;
  const subtitleSize = 35.7;
  const titleLines = post.title.split("\n");
  const subtitleLines = post.subtitle.split("\n");
  const titleHeight = titleSize + (titleLines.length - 1) * titleSize * 1.15;
  const titleY = Math.max(75 + titleSize, (height - titleHeight) / 2 + titleSize);
  const titleBottom = titleY + (titleLines.length - 1) * titleSize * 1.15 + titleSize * .2;
  const subtitleY = titleBottom + (height - 100 - titleBottom - subtitleSize) / 2 + subtitleSize;
  const fontFamily = post.font || "Montserrat, Arial, sans-serif";

  context.save();
  context.fillStyle = "white";
  context.textAlign = "center";
  context.font = `600 ${titleSize}px ${fontFamily}`;
  titleLines.forEach((line, index) => context.fillText(line, width / 2, titleY + index * titleSize * 1.15));
  context.font = `400 ${subtitleSize}px ${fontFamily}`;
  subtitleLines.forEach((line, index) => context.fillText(line, width / 2, subtitleY + index * subtitleSize * 1.25));
  context.restore();
}

function downloadImage(blob, language) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `all-things-new-facebook-${language}.png`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function updatePageText(post) {
  document.querySelector("#test-title").textContent = post.ui.title;
  document.querySelector("#caption-label").textContent = post.ui.captionLabel;
  document.querySelector("#copy-caption").textContent = post.ui.copy;
  document.querySelector("#image-preview").alt = post.ui.imageAlt;
}

async function copyCaption() {
  if (!activePost) return false;
  try {
    await navigator.clipboard.writeText(activePost.caption);
    return true;
  } catch {
    const input = document.querySelector("#caption");
    input.focus();
    input.select();
    return document.execCommand("copy");
  }
}

async function copyCaptionAgain() {
  const copied = await copyCaption();
  if (createdImageBlob) downloadImage(createdImageBlob, activeLanguage);
  document.querySelector("#status").textContent = copied ? activePost.ui.copied : activePost.ui.blocked;
}

async function createTestPost(language) {
  if (language === activeLanguage) return;
  const post = posts[language];
  const status = document.querySelector("#status");
  const version = ++creationVersion;
  activePost = post;
  activeLanguage = language;
  updatePageText(post);
  document.querySelector("#caption").value = post.caption;
  document.querySelector("#result").hidden = false;
  document.querySelectorAll("[data-language]").forEach((button) => button.classList.toggle("is-selected", button.dataset.language === language));
  status.textContent = post.ui.creating;
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    const [background, logo] = await Promise.all([
      loadImage("resources/images/facebook/background_04.png"),
      loadImage("resources/images/template_logo.png")
    ]);
    if (version !== creationVersion) return;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    drawCover(context, background);
    drawWatermark(context);
    const logoWidth = 76 * .63;
    context.globalAlpha = .7;
    context.drawImage(logo, width - 30 - logoWidth, height - 30 - logo.height / logo.width * logoWidth, logoWidth, logo.height / logo.width * logoWidth);
    context.globalAlpha = 1;
    drawText(context, post);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Image creation failed");
    if (version !== creationVersion) return;
    if (createdImageUrl) URL.revokeObjectURL(createdImageUrl);
    createdImageBlob = blob;
    createdImageUrl = URL.createObjectURL(blob);
    const preview = document.querySelector("#image-preview");
    preview.src = createdImageUrl;
    preview.hidden = false;
    status.textContent = post.ui.ready;
  } catch {
    status.textContent = post.ui.error;
  }
}

document.querySelectorAll("[data-language]").forEach((button) => button.addEventListener("click", () => createTestPost(button.dataset.language)));
document.querySelector("#copy-caption").addEventListener("click", copyCaptionAgain);
