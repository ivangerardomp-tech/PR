const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const btnCapture = document.getElementById("btnCapture");
const btnGallery = document.getElementById("btnGallery");
const btnConfig = document.getElementById("btnConfig");
const hudText = document.getElementById("hud-text");
const toastEl = document.getElementById("toast");

const galleryOverlay = document.getElementById("galleryOverlay");
const btnCloseGallery = document.getElementById("btnCloseGallery");
const galleryGrid = document.getElementById("galleryGrid");
const galleryPreviewImg = document.getElementById("galleryPreviewImg");

const settingsOverlay = document.getElementById("settingsOverlay");
const btnCloseSettings = document.getElementById("btnCloseSettings");
const settingsForm = document.getElementById("settingsForm");
const chkDate = document.getElementById("chkDate");
const chkLatLng = document.getElementById("chkLatLng");
const chkTramo = document.getElementById("chkTramo");
const chkPR = document.getElementById("chkPR");
const txtCustom = document.getElementById("txtCustom");

let lat = null;
let lng = null;
let currentTramo = null;
let currentPR = null;
let hudLines = []; // mismas líneas para HUD y captura
let capturedPhotos = []; // { url, timestamp }

const hudConfig = {
    showDate: true,
    showLatLng: true,
    showTramo: true,
    showPR: true,
    customText: ""
};

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
// Obtener coordenadas continuamente
// ---------------------------
function startTrackingLocation() {
    if (!navigator.geolocation) {
        console.error("Geolocalización no soportada.");
        return;
    }

    // Usamos `watchPosition` para obtener actualizaciones automáticas
    navigator.geolocation.watchPosition(
        (pos) => {
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
            updatePRFromLocation(); // Actualiza el PR y el tramo
        },
        (err) => {
            console.error("Error geolocalización:", err);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 } // config
    );
}

// ---------------------------
// Calcular tramo + PR
// ---------------------------
function updatePRFromLocation() {
    if (lat == null || lng == null) return;
    if (typeof nearestTramo !== "function" ||
        typeof distanciaDesdeOrigenTramo !== "function") {
        return;
    }

    const tramo = nearestTramo(lat, lng);
    currentTramo = tramo;

    if (!tramo) {
        currentPR = null;
        return;
    }

    const dist = distanciaDesdeOrigenTramo(tramo, lat, lng);
    if (dist == null || Number.isNaN(dist)) {
        currentPR = null;
        return;
    }

    if (typeof findPR === "function") {
        currentPR = findPR(tramo, dist); // { pr, metros }
    }

    updateHUD(); // Actualizamos HUD cuando cambia el PR y el tramo
}

// ---------------------------
// Actualizar HUD en vivo
// ---------------------------
function updateHUD() {
    const now = new Date();
    const fechaStr = now.toLocaleString();

    const lines = [];

    if (hudConfig.showDate) {
        // Sin "Fecha:", solo el valor
        lines.push(fechaStr);
    }

    if (hudConfig.showLatLng) {
        if (lat != null && lng != null) {
            // Una sola línea: lat, lon
            lines.push(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        } else {
            lines.push("Coordenadas: obteniendo…");
        }
    }

    // RN + PR en una sola línea cuando ambos estén activos
    const tramoOn = hudConfig.showTramo;
    const prOn = hudConfig.showPR;
    if (tramoOn || prOn) {
        let rnPart = "";
        let prPart = "";

        if (tramoOn) {
            if (currentTramo) {
                rnPart = `RN ${currentTramo}`;
            } else {
                rnPart = "RN calculando…";
            }
        }

        if (prOn) {
            if (!currentTramo) {
                prPart = "PR calculando…";
            } else if (currentPR) {
                prPart = `PR ${currentPR.pr}+${currentPR.metros}m`;
            } else {
                prPart = "PR calculando…";
            }
        }

        let line = "";
        if (rnPart && prPart) line = `${rnPart}   ${prPart}`;
        else if (rnPart) line = rnPart;
        else if (prPart) line = prPart;

        if (line) lines.push(line);
    }

    if (hudConfig.customText && hudConfig.customText.trim() !== "") {
        lines.push(hudConfig.customText.trim());
    }

    if (lines.length === 0) {
        lines.push("HUD desactivado.");
    }

    hudLines = lines;
    hudText.innerHTML = lines.join("<br>");
}

// ---------------------------
// Actualizar la información cada 250ms
// ---------------------------
const updateInterval = setInterval(() => {
    if (lat && lng) {
        updatePRFromLocation(); // Recalcular PR y tramo
        updateHUD(); // Actualizar el HUD cada 250ms
    }
}, 250); // Actualiza cada 250ms

// ---------------------------
// Auto-inicio
// ---------------------------
async function autoStart() {
    try {
        await Promise.all([
            initCamera(),
            startTrackingLocation() // Iniciar el seguimiento de ubicación
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

    // Asegurar hudLines si estuviera vacío (misma lógica que HUD)
    if (!hudLines || hudLines.length === 0) {
        const now = new Date();
        const fechaStr = now.toLocaleString();
        const lines = [];

        if (hudConfig.showDate) {
            lines.push(fechaStr);
        }

        if (hudConfig.showLatLng && lat != null && lng != null) {
            lines.push(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        }

        const tramoOn = hudConfig.showTramo;
        const prOn = hudConfig.showPR;
        if (tramoOn || prOn) {
            let rnPart = "";
            let prPart = "";

            if (tramoOn) rnPart = `RN ${tramo}`;
            if (prOn) prPart = `PR ${prInfo.pr}+${prInfo.metros}m`;

            let line = "";
            if (rnPart && prPart) line = `${rnPart}   ${prPart}`;
            else if (rnPart) line = rnPart;
            else if (prPart) line = prPart;

            if (line) lines.push(line);
        }

        if (hudConfig.customText && hudConfig.customText.trim() !== "") {
            lines.push(hudConfig.customText.trim());
        }

        hudLines = lines.length ? lines : ["HUD desactivado."];
    }

    // Barra inferior multilínea igual al HUD (18px)
    ctx.font = "18px Arial";
    const lineHeight = 24;
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

// ---------------------------
// Configuración HUD
// ---------------------------
function openSettings() {
    // cargar estado actual
    chkDate.checked = hudConfig.showDate;
    chkLatLng.checked = hudConfig.showLatLng;
    chkTramo.checked = hudConfig.showTramo;
    chkPR.checked = hudConfig.showPR;
    txtCustom.value = hudConfig.customText;
    settingsOverlay.classList.add("show");
}

function closeSettings() {
    settingsOverlay.classList.remove("show");
}

btnConfig.addEventListener("click", openSettings);
btnCloseSettings.addEventListener("click", closeSettings);

// cerrar tocando fuera del cuadro
settingsOverlay.addEventListener("click", (e) => {
    if (e.target === settingsOverlay) {
        closeSettings();
    }
});

// guardar configuración
settingsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    hudConfig.showDate = chkDate.checked;
    hudConfig.showLatLng = chkLatLng.checked;
    hudConfig.showTramo = chkTramo.checked;
    hudConfig.showPR = chkPR.checked;
    hudConfig.customText = (txtCustom.value || "").slice(0, 40); // 40 caracteres

    closeSettings();
    updateHUD(); // aplicar de inmediato
});
