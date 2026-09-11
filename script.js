"use strict";
/* 【修改背景图片/视频】默认不加载背景图，使用 CSS 奶油纸张背景。
   image / video 可填写本地相对路径，例如 assets/background.jpg。
   视频始终静音；减少动态效果、数据节省或播放失败时使用图片/纸张回退。 */
const BACKGROUND = { image: "", video: "" };
/* 【修改音乐】填写本地音频路径，例如 assets/music.mp3；留空时提示尚未添加。
   没有 autoplay、不保存开启状态、不合成音乐，只由访客明确点击开启。 */
const MUSIC_SRC = "";

/* 【修改照片】src 填缩略图/原图相对路径，full 可另填高清图路径。
   【修改日期】date 仅填写真实日期；caption / place 保留占位，直到你提供内容。
   图片建议 WebP/JPEG，长边 1800px 以内。没有 src 时不会请求不存在的文件。 */
const PHOTOS = [
  { src: "", full: "", caption: "[照片说明]", date: "[日期]", place: "[地点]" },
  { src: "", full: "", caption: "[照片说明]", date: "[日期]", place: "[地点]" },
  { src: "", full: "", caption: "[照片说明]", date: "[日期]", place: "[地点]" },
  { src: "", full: "", caption: "[照片说明]", date: "[日期]", place: "[地点]" },
  { src: "", full: "", caption: "[照片说明]", date: "[日期]", place: "[地点]" },
  { src: "", full: "", caption: "[照片说明]", date: "[日期]", place: "[地点]" }
];

const $ = selector => document.querySelector(selector);
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
let motionPaused = motionPreference.matches;
let framePending = false;
let pointerX = 0;
let pointerY = 0;
let messageTimer;
let backgroundVideo;

document.querySelectorAll(".ambient-image").forEach(el => {
  if (BACKGROUND.image) {
    // JSON.stringify 处理路径引号，不把路径拼成 HTML。
    el.style.backgroundImage = `url(${JSON.stringify(BACKGROUND.image)})`;
    el.classList.add("has-custom-image");
  }
});

function notify(message) {
  clearTimeout(messageTimer);
  const status = $("#status-message");
  status.textContent = message;
  status.classList.add("is-visible");
  messageTimer = setTimeout(() => status.classList.remove("is-visible"), 3600);
}

// 自然文档滚动：不拦截滚轮、不锁定触摸、不强制等待动画。
const scenes = [...document.querySelectorAll("main > .scene")];
const chapterLinks = [...document.querySelectorAll(".desktop-nav a, .scene-rail a")];
const progress = $(".reading-progress span");
const backgrounds = [...document.querySelectorAll(".scene-backdrop")];
let activeChapter = -1;

function updateScroll() {
  framePending = false;
  const height = window.innerHeight;
  const scrollTop = window.scrollY;
  const total = document.documentElement.scrollHeight - height;
  progress.style.transform = `scaleX(${total > 0 ? Math.min(1, scrollTop / total) : 0})`;
  document.body.classList.toggle("has-scrolled", scrollTop > 50);
  const marker = scrollTop + height * .42;
  let current = 0;
  scenes.forEach((scene, index) => { if (scene.offsetTop <= marker) current = index; });
  if (scrollTop + height >= document.documentElement.scrollHeight - 4) current = scenes.length - 1;
  if (current !== activeChapter) {
    activeChapter = current;
    const active = scenes[current];
    $("#chapter-number").textContent = String(current + 1).padStart(2, "0");
    $("#chapter-label").textContent = active.dataset.chapter;
    chapterLinks.forEach(link => {
      if (link.hash === `#${active.id}`) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }
  if (!motionPaused && !motionPreference.matches) {
    backgrounds.forEach(backdrop => {
      const bounds = backdrop.parentElement.getBoundingClientRect();
      if (bounds.bottom < 0 || bounds.top > height) return;
      const shift = Math.max(-25, Math.min(25, bounds.top * -.035));
      backdrop.style.setProperty("--scene-shift", `${shift.toFixed(2)}px`);
      backdrop.style.setProperty("--pointer-x", `${pointerX.toFixed(2)}px`);
      backdrop.style.setProperty("--pointer-y", `${pointerY.toFixed(2)}px`);
    });
  }
}
function requestFrame() {
  if (!framePending) { framePending = true; requestAnimationFrame(updateScroll); }
}
window.addEventListener("scroll", requestFrame, { passive: true });
window.addEventListener("resize", requestFrame, { passive: true });
document.addEventListener("pointermove", event => {
  if (!finePointer.matches || motionPaused || motionPreference.matches || document.body.classList.contains("modal-open")) return;
  pointerX = (event.clientX / window.innerWidth - .5) * 6;
  pointerY = (event.clientY / window.innerHeight - .5) * 4;
  requestFrame();
}, { passive: true });
document.documentElement.addEventListener("pointerleave", () => { pointerX = pointerY = 0; requestFrame(); });

// 渐进增强：JS 不可用时仍显示全部正文；只对进入视口的内容播放一次淡入。
if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -35px 0px", threshold: .04 });
  document.querySelectorAll(".reveal").forEach(element => revealObserver.observe(element));
  document.documentElement.classList.add("js-ready");
}

const motionButton = $("#motion-toggle");
function syncMotion() {
  const stopped = motionPaused || motionPreference.matches;
  document.body.classList.toggle("motion-paused", stopped);
  motionButton.setAttribute("aria-pressed", String(stopped));
  motionButton.setAttribute("aria-label", stopped ? "开启环境动效" : "暂停环境动效");
  $(".motion-label").textContent = stopped ? "动效关" : "动效开";
  $(".motion-symbol").textContent = stopped ? "▷" : "Ⅱ";
  syncVideo();
  requestFrame();
}
motionButton.addEventListener("click", () => {
  if (motionPreference.matches) { notify("已遵循系统的减少动态效果设置"); return; }
  motionPaused = !motionPaused;
  syncMotion();
});
motionPreference.addEventListener("change", () => {
  motionPaused = motionPreference.matches;
  syncMotion();
});

// 可选静音背景视频，仅在首页可见、页面活跃且动效开启时播放。
let heroVisible = true;
function syncVideo() {
  if (!backgroundVideo) return;
  if (motionPaused || motionPreference.matches || document.hidden || !heroVisible) backgroundVideo.pause();
  else backgroundVideo.play().catch(() => { backgroundVideo.hidden = true; });
}
if (BACKGROUND.video && !navigator.connection?.saveData) {
  backgroundVideo = document.createElement("video");
  backgroundVideo.className = "ambient-video";
  backgroundVideo.muted = true;
  backgroundVideo.defaultMuted = true;
  backgroundVideo.loop = true;
  backgroundVideo.playsInline = true;
  backgroundVideo.preload = "none";
  backgroundVideo.setAttribute("aria-hidden", "true");
  backgroundVideo.src = BACKGROUND.video;
  backgroundVideo.hidden = true;
  backgroundVideo.addEventListener("playing", () => { backgroundVideo.hidden = false; });
  backgroundVideo.addEventListener("error", () => { backgroundVideo.hidden = true; });
  $("#home .scene-backdrop").append(backgroundVideo);
  if ("IntersectionObserver" in window) new IntersectionObserver(entries => {
    heroVisible = entries[0].isIntersecting;
    syncVideo();
  }).observe($("#home"));
}

// 音乐默认关闭；未设置音源时显示真实空状态，不伪装播放。
const audio = $("#background-audio");
const musicButton = $("#music-toggle");
audio.volume = .35;
function syncAudio() {
  const playing = !audio.paused && !audio.ended;
  musicButton.setAttribute("aria-pressed", String(playing));
  musicButton.setAttribute("aria-label", playing ? "背景音乐，点击关闭" : "背景音乐，当前关闭");
  $(".music-label").textContent = playing ? "声音开" : "声音关";
}
musicButton.addEventListener("click", async () => {
  if (!MUSIC_SRC) { notify("尚未添加音乐"); return; }
  if (!audio.paused) { audio.pause(); return; }
  if (!audio.getAttribute("src")) audio.src = MUSIC_SRC;
  musicButton.disabled = true;
  try { await audio.play(); }
  catch { notify("音乐暂时无法播放"); }
  finally { musicButton.disabled = false; syncAudio(); }
});
audio.addEventListener("play", syncAudio);
audio.addEventListener("pause", syncAudio);
audio.addEventListener("error", () => { audio.pause(); syncAudio(); notify("音乐暂时无法播放"); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) audio.pause();
  syncVideo();
});

// 原生模态框：支持 Escape、焦点约束、点击背景关闭和关闭后返回原按钮。
const menu = $("#chapter-menu");
const menuToggle = $(".menu-toggle");
const dialogOpeners = new WeakMap();
function openDialog(dialog) {
  document.querySelectorAll("dialog[open]").forEach(open => open.close());
  dialogOpeners.set(dialog, document.activeElement);
  dialog.showModal();
  document.body.classList.add("modal-open");
}
document.querySelectorAll("dialog").forEach(dialog => {
  dialog.addEventListener("close", () => {
    if (!document.querySelector("dialog[open]")) document.body.classList.remove("modal-open");
    if (dialog === menu) menuToggle.setAttribute("aria-expanded", "false");
    const opener = dialogOpeners.get(dialog);
    if (opener instanceof HTMLElement && opener.isConnected && !document.querySelector("dialog[open]")) opener.focus({ preventScroll: true });
  });
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
});
menuToggle.addEventListener("click", () => {
  openDialog(menu);
  menuToggle.setAttribute("aria-expanded", "true");
});
$(".menu-close").addEventListener("click", () => menu.close());
menu.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
  menu.close();
  // 在浏览器计算锚点位置前同步恢复滚动，避免关闭目录后宽度重排导致落点偏移。
  document.body.classList.remove("modal-open");
}));

const lightbox = $("#lightbox");
const lightboxImage = $("#lightbox-image");
const lightboxPlaceholder = $("#lightbox-placeholder");
let photoIndex = 0;
let touchOrigin = null;
function renderPhoto(index) {
  photoIndex = Math.max(0, Math.min(PHOTOS.length - 1, index));
  const photo = PHOTOS[photoIndex];
  const source = photo.full || photo.src;
  $("#lightbox-stage").className = `lightbox-stage tone-${photoIndex + 1}`;
  lightboxImage.hidden = true;
  lightboxPlaceholder.hidden = false;
  lightboxPlaceholder.textContent = "[照片]";
  lightboxImage.removeAttribute("src");
  if (source) {
    lightboxImage.alt = photo.caption;
    lightboxImage.src = source;
  }
  $("#lightbox-counter").textContent = `${String(photoIndex + 1).padStart(2, "0")} / ${String(PHOTOS.length).padStart(2, "0")}`;
  $("#lightbox-caption").textContent = photo.caption;
  $("#lightbox-date").textContent = photo.date;
  $("#lightbox-place").textContent = photo.place;
  $("#lightbox-prev").disabled = photoIndex === 0;
  $("#lightbox-next").disabled = photoIndex === PHOTOS.length - 1;
  $("#lightbox-announcement").textContent = `第 ${photoIndex + 1} 张，共 ${PHOTOS.length} 张，${photo.caption}`;
}
lightboxImage.addEventListener("load", () => {
  lightboxImage.hidden = false;
  lightboxPlaceholder.hidden = true;
});
lightboxImage.addEventListener("error", () => {
  lightboxImage.hidden = true;
  lightboxPlaceholder.hidden = false;
  if (lightboxImage.getAttribute("src")) notify("图片暂时无法加载");
});
document.querySelectorAll("[data-photo]").forEach(button => {
  const index = Number(button.dataset.photo);
  const photo = PHOTOS[index];
  const caption = button.nextElementSibling;
  caption.children[0].textContent = photo.caption;
  caption.children[1].textContent = photo.date;
  if (photo.src) {
    const image = document.createElement("img");
    image.alt = photo.caption;
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("load", () => { button.querySelector(".photo-placeholder").hidden = true; });
    image.addEventListener("error", () => { image.hidden = true; button.querySelector(".photo-placeholder").hidden = false; });
    image.src = photo.src;
    button.prepend(image);
  }
  button.addEventListener("click", () => { renderPhoto(index); openDialog(lightbox); });
});
$("#lightbox-close").addEventListener("click", () => lightbox.close());
$("#lightbox-prev").addEventListener("click", () => renderPhoto(photoIndex - 1));
$("#lightbox-next").addEventListener("click", () => renderPhoto(photoIndex + 1));
lightbox.addEventListener("keydown", event => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    renderPhoto(photoIndex + (event.key === "ArrowRight" ? 1 : -1));
  }
});
$("#lightbox-stage").addEventListener("touchstart", event => {
  touchOrigin = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
}, { passive: true });
$("#lightbox-stage").addEventListener("touchend", event => {
  if (!touchOrigin) return;
  const dx = event.changedTouches[0].clientX - touchOrigin.x;
  const dy = event.changedTouches[0].clientY - touchOrigin.y;
  if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) renderPhoto(photoIndex + (dx < 0 ? 1 : -1));
  touchOrigin = null;
}, { passive: true });
$("#lightbox-stage").addEventListener("touchcancel", () => { touchOrigin = null; }, { passive: true });

// 首页相框与画廊共享照片来源；没有填写时保留真实空状态。
document.querySelectorAll("[data-cover-photo]").forEach(frame => {
  const photo = PHOTOS[Number(frame.dataset.coverPhoto)];
  if (!photo?.src) return;
  const image = document.createElement("img");
  image.alt = photo.caption;
  image.decoding = "async";
  image.addEventListener("load", () => { frame.classList.add("has-photo"); });
  image.addEventListener("error", () => { image.remove(); });
  image.src = photo.src;
  frame.append(image);
});

syncMotion();
syncAudio();
updateScroll();
