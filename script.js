const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const btnCapture = document.getElementById("btnCapture");
const btnGallery = document.getElementById("btnGallery");
const hudText = document.getElementById("hud-text");
const toastEl = document.getElementById("toast");

const galleryOverlay = document.getElementById("galleryOverlay");
const btnCloseGallery = document.getElementById("btnCloseGallery");
const galleryGrid = document.getElementById("galleryGrid");
const galleryPreviewImg = document.getElementById("galleryPreviewImg");

let lat = null;
let lng = null;
let currentTramo = null;
let currentPR = null;
let hudLines = []; // mismas líneas para HUD y captura
let capturedPhotos = []; // { url, timestamp }

// ---------------------------
// Toast / notificación
// ---------------------------
function showToast(message) {
    if (!toastEl) {
        alert(message);
        return;
    }
    toastEl.textContent = message;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 2500);
}

// ---------------------------
// Activar cámara
// ---------------------------
async function initCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Este navegador no soporta acceso a la cámara.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
    });
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;
}

// ---------------------------
// Ubicación
// ---------------------------
function getLocationOnce() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            return reject(new Error("Geolocalización no soportada."));
        }

        navigator.geolocation.getCurrentPosition(
            pos => {
                lat = pos.coords.latitude;
                lng = pos.coords.longitude;
                updatePRFromLocation();
                resolve();
            },
            err => {
                console.error("Error geolocalización:", err);
                reject(err);
            },
            { enableHighAccuracy: true }
        );
    });
}

// ---------------------------
// Calcular tramo + PR
// ---------------------------
function updatePRFromLocation() {
    if (lat == null || lng == null) return;
    if (typeof nearestTramo !== "function") return;

    currentTramo = nearestTramo(lat, lng);

    if (!currentTramo) {
        currentPR = null;
        return;
    }

    if (typeof findPR === "function") {
        const distancia = 0; // luego se puede cambiar por distancia real
        currentPR = findPR(currentTramo, distancia);
    }
}

// ---------------------------
// Actualizar HUD en vivo
// ---------------------------
function updateHUD() {
    const now = new Date();
    const fechaStr = now.toLocaleString();

    const lines = [];
    lines.push(`Fecha: ${fechaStr}`);

    if (lat != null && lng != null) {
        lines.push(`Lat: ${lat.toFixed(6)}`);
        lines.push(`Lng: ${lng.toFixed(6)}`);
    } else {
        lines.push("Ubicación: obteniendo…");
    }

    if (currentTramo) {
        const prStr = currentPR ? `${currentPR.pr}+${currentPR.metros}m` : "calculando…";
        lines.push(`Tramo: ${currentTramo}`);
        lines.push(`PR: ${prStr}`);
    } else {
        lines.push("Tramo/PR: calculando…");
    }

    hudLines = lines;
    hudText.innerHTML = lines.join("<br>");
}
setInterval(updateHUD, 1000);

// ---------------------------
// Auto-inicio
// ---------------------------
async function autoStart() {
    try {
        await Promise.all([
            initCamera(),
            getLocationOnce()
        ]);

        await new Promise(resolve => {
            if (video.readyState >= 1 && video.videoWidth > 0) {
                resolve();
            } else {
                video.onloadedmetadata = () => resolve();
            }
        });

        btnCapture.disabled = false;
    } catch (err) {
        console.error("Error al iniciar:", err);
        showToast(err.message || "No se pudo activar la cámara o ubicación.");
    }
}

document.addEventListener("DOMContentLoaded", autoStart);

// ---------------------------
// TAP EN VIDEO: reintentar cámara si algo falla
// ---------------------------
video.addEventListener("click", async () => {
    if (video.videoWidth && video.videoHeight) {
        return; // ya está funcionando
    }

    try {
        await initCamera();
        await new Promise(resolve => {
            if (video.readyState >= 1 && video.videoWidth > 0) resolve();
            else video.onloadedmetadata = () => resolve();
        });
        btnCapture.disabled = false;
    } catch (err) {
        console.error("Error reintentando cámara:", err);
        showToast(err.message || "No se pudo activar la cámara.");
    }
});

// ---------------------------
// Capturar imagen con MISMO estilo que el HUD
// ---------------------------
btnCapture.addEventListener("click", async () => {
    if (!lat || !lng) {
        alert("Ubicación no disponible aún.");
        return;
    }

    if (typeof nearestTramo !== "function" || typeof findPR !== "function") {
        alert("Datos de tramo/PR aún no cargados. Espera unos segundos.");
        return;
    }

    const tramo = currentTramo || nearestTramo(lat, lng) || "SIN TRAMO";
    const distancia = 0;
    const prInfo = currentPR || findPR(tramo, distancia);

    const ctx = canvas.getContext("2d");
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;

    canvas.width = w;
    canvas.height = h;

    // Dibujar cámara
    ctx.drawImage(video, 0, 0, w, h);

    // Asegurar hudLines si estuviera vacío
    if (!hudLines || hudLines.length === 0) {
        const now = new Date();
        const fechaStr = now.toLocaleString();
        hudLines = [
            `Fecha: ${fechaStr}`,
            lat != null && lng != null ? `Lat: ${lat.toFixed(6)}` : "Ubicación no disponible",
            lat != null && lng != null ? `Lng: ${lng.toFixed(6)}` : "",
            `Tramo: ${tramo}`,
            `PR: ${prInfo.pr}+${prInfo.metros}m`
        ].filter(Boolean);
    }

    // Barra inferior multilínea igual al HUD
    ctx.font = "12px Arial";
    const lineHeight = 16;
    const paddingY = 6;
    const paddingX = 8;

    const numLines = hudLines.length;
    const barHeight = numLines * lineHeight + paddingY * 2;

    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, h - barHeight, w, barHeight);

    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "top";

    let y = h - barHeight + paddingY;
    for (const line of hudLines) {
        ctx.fillText(line, paddingX, y);
        y += lineHeight;
    }

    canvas.toBlob(async blob => {
        if (!blob) {
            alert("No se pudo generar la imagen.");
            return;
        }

        // Guardar en galería interna
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toLocaleString();
        capturedPhotos.push({ url, timestamp });
        btnGallery.disabled = capturedPhotos.length === 0 ? true : false;

        const file = new File([blob], "foto_pr.jpg", { type: "image/jpeg" });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: "Foto PR",
                    text: "Foto con PR y coordenadas"
                });
                showToast("Foto guardada/enviada");
            } catch (e) {
                console.error("Error al compartir:", e);
                showToast("Compartir cancelado");
            }
        } else {
            const urlView = URL.createObjectURL(blob);
            window.open(urlView, "_blank");
            showToast("Imagen generada");
        }
    }, "image/jpeg");
});

// ---------------------------
// Galería interna
// ---------------------------
function openGallery() {
    if (!capturedPhotos.length) {
        showToast("Aún no has tomado fotos.");
        return;
    }
    galleryOverlay.classList.add("show");
    renderGallery();
}

function closeGallery() {
    galleryOverlay.classList.remove("show");
}

function renderGallery() {
    galleryGrid.innerHTML = "";
    let first = true;

    capturedPhotos.forEach((photo, index) => {
        const img = document.createElement("img");
        img.src = photo.url;
        img.alt = `Foto ${index + 1}`;
        img.addEventListener("click", () => {
            document
                .querySelectorAll("#galleryGrid img")
                .forEach(el => el.classList.remove("selected"));
            img.classList.add("selected");
            galleryPreviewImg.src = photo.url;
        });

        galleryGrid.appendChild(img);

        if (first) {
            img.classList.add("selected");
            galleryPreviewImg.src = photo.url;
            first = false;
        }
    });
}

btnGallery.addEventListener("click", openGallery);
btnCloseGallery.addEventListener("click", closeGallery);

// Cerrar galería tocando fuera del contenido
galleryOverlay.addEventListener("click", (e) => {
    if (e.target === galleryOverlay) {
        closeGallery();
    }
});
