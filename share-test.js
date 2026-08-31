const posts = {
  english: {
    title: "Come to me, all you\nwho are weary and\nburdened, and I will\ngive you rest",
    subtitle: "Matthew  11:28",
    caption: "I have personally experienced God when I was in trouble. He is a very presence help in trouble\n#All THINGS NEW"
  },
  chinese: {
    title: "凡劳苦担重担的\n人，可以到我这里来，\n我就使你们得安息",
    subtitle: "马太福音 11:28",
    caption: "我曾亲身经历神在我患难时的帮助。祂是在患难中随时帮助我们的神。\n#All THINGS NEW",
    font: "'Noto Sans SC'"
  },
  malay: {
    title: "Marilah kepada-Ku,\nsemua yang letih lesu\ndan berbeban berat,\nAku akan memberi\nkelegaan kepadamu",
    subtitle: "Matius 11:28",
    caption: "Saya sendiri telah mengalami pertolongan Tuhan ketika saya dalam kesusahan. Dia adalah Penolong yang sentiasa hadir dalam kesusahan.\n#All THINGS NEW"
  }
};

const width = 940;
const height = 788;
let activePost = null;
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
  document.querySelector("#status").textContent = copied ? "Caption and hashtag copied to your clipboard." : "Clipboard access was blocked. Allow clipboard permission, then try again.";
}

async function createTestPost(language) {
  const post = posts[language];
  const status = document.querySelector("#status");
  const version = ++creationVersion;
  activePost = post;
  document.querySelector("#caption").value = post.caption;
  document.querySelector("#result").hidden = false;
  document.querySelectorAll("[data-language]").forEach((button) => button.classList.toggle("is-selected", button.dataset.language === language));
  status.textContent = "Creating the image...";
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
    downloadImage(blob, language);
    status.textContent = "The image download started. Copy the caption below when you are ready.";
  } catch {
    status.textContent = "The test image could not be created.";
  }
}

document.querySelectorAll("[data-language]").forEach((button) => button.addEventListener("click", () => createTestPost(button.dataset.language)));
document.querySelector("#copy-caption").addEventListener("click", copyCaptionAgain);
