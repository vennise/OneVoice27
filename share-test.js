const title = "Come to me, all you\nwho are weary and\nburdened, and I will\ngive you rest";
const subtitle = "Matthew  11:28";
const caption = "I have personally experienced God when I was in trouble. He is a very presence help in trouble\n\n#All THINGS NEW";
const width = 940;
const height = 788;

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
  context.font = `italic 800 ${watermarkHeight * .8}px Montserrat, Arial, sans-serif`;
  context.fillText("ALL THINGS NEW", 90 + watermarkWidth / 2, 85 + watermarkHeight * .7);
  context.font = `300 ${watermarkHeight * .459}px Montserrat, Arial, sans-serif`;
  context.fillText("HOPE STARTS HERE", 90 + watermarkWidth / 2, 85 + watermarkHeight);
  context.restore();
}

function drawText(context) {
  const titleSize = 48.5;
  const subtitleSize = 35.7;
  const titleLines = title.split("\n");
  const subtitleLines = subtitle.split("\n");
  const titleHeight = titleSize + (titleLines.length - 1) * titleSize * 1.15;
  const titleY = Math.max(75 + titleSize, (height - titleHeight) / 2 + titleSize);
  const titleBottom = titleY + (titleLines.length - 1) * titleSize * 1.15 + titleSize * .2;
  const subtitleY = titleBottom + (height - 100 - titleBottom - subtitleSize) / 2 + subtitleSize;

  context.save();
  context.fillStyle = "white";
  context.textAlign = "center";
  context.font = `600 ${titleSize}px Montserrat, Arial, sans-serif`;
  titleLines.forEach((line, index) => context.fillText(line, width / 2, titleY + index * titleSize * 1.15));
  context.font = `400 ${subtitleSize}px Montserrat, Arial, sans-serif`;
  subtitleLines.forEach((line, index) => context.fillText(line, width / 2, subtitleY + index * subtitleSize * 1.25));
  context.restore();
}

function downloadImage(blob) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "all-things-new-facebook.png";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function copyCaption() {
  try {
    await navigator.clipboard.writeText(caption);
    return true;
  } catch {
    const input = document.createElement("textarea");
    input.value = caption;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    const copied = document.execCommand("copy");
    input.remove();
    return copied;
  }
}

async function createTestPost() {
  const status = document.querySelector("#status");
  try {
    const [background, logo] = await Promise.all([
      loadImage("resources/images/facebook/background_04.png"),
      loadImage("resources/images/template_logo.png")
    ]);
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
    drawText(context);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Image creation failed");
    downloadImage(blob);
    const copied = await copyCaption();
    status.textContent = copied ? "The image download started and the caption was copied to your clipboard." : "The image download started. Your browser blocked clipboard access.";
  } catch {
    status.textContent = "The test image could not be created.";
  }
}

createTestPost();
