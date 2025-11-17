const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const btnCapture = document.getElementById("btnCapture");
const btnFallback = document.getElementById("btnFallback");
const statusEl = document.getElementById("status");

let lat = null;
let lng = null;

// ---------------------------
// CÁMARA
// ---------------------------
async function initCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Este navegador no soporta cámara.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
    });
    video.srcObject = stream;
}

// ---------------------------
// GEOLOCALIZACIÓN (Promise)
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
                console.log("Ubicación:", lat, lng);
                resolve();
            },
            err => {
                reject(err);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });
}

// ---------------------------
// AUTO-INICIO AL CARGAR
// ---------------------------
async function autoStart() {
    statusEl.textContent = "Solicitando permisos de cámara y ubicación...";

    try {
        // Pedimos permisos casi al mismo tiempo
        await Promise.all([
            initCamera(),
            getLocationOnce()
        ]);

        // Si llegó aquí, todo OK
        btnCapture.disabled = false;
        statusEl.textContent = "Listo para capturar ✅";

    } catch (err) {
        console.error("Error en autoStart:", err);
        statusEl.textContent =
            "No se pudo activar automáticamente la cámara. En algunos iPhone es obligatorio tocar un botón.";

        // Mostramos botón de respaldo SOLO si falló
        btnFallback.style.display = "inline-block";
    }
}

// Arrancamos cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
    autoStart();
});

// ---------------------------
// BOTÓN DE RESPALDO (iOS)
// ---------------------------
btnFallback.addEventListener("click", async () => {
    statusEl.textContent = "Intentando activar cámara...";
    try {
        await initCamera();
        if (!lat || !lng) {
            await getLocationOnce();
        }
        btnCapture.disabled = false;
        btnFallback.style.display = "none";
        statusEl.textContent = "Cámara activa ✅";
    } catch (err) {
        console.error("Error en fallback:", err);
        alert("No se pudo activar la cámara. Revisa permisos en Ajustes.");
    }
});

// ---------------------------
// CAPTURAR FOTO + PR + COMPARTIR
// ---------------------------
btnCapture.addEventListener("click", async () => {
    if (!lat || !lng) {
        alert("Todavía no tengo la ubicación. Espera unos segundos e inténtalo de nuevo.");
        return;
    }

    // Aseguramos que las funciones existan
    if (typeof nearestTramo !== "function" || typeof findPR !== "function") {
        alert("Datos de tramo/PR aún no cargados. Espera unos segundos.");
        return;
    }

    const tramo = nearestTramo(lat, lng) || "SIN TRAMO";

    // TODO: aquí podrías poner la distancia real sobre la ruta densificada.
    const distancia = 0;
    const prInfo = findPR(tramo, distancia);

    const ctx = canvas.getContext("2d");
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;

    canvas.width = w;
    canvas.height = h;

    ctx.drawImage(video, 0, 0, w, h);

    const fechaStr = new Date().toLocaleString();

    const textLines = [
        `Fecha: ${fechaStr}`,
        `Lat: ${lat.toFixed(6)}`,
        `Lng: ${lng.toFixed(6)}`,
        `Tramo: ${tramo}`,
        `PR: ${prInfo.pr}+${prInfo.metros}m`
    ];

    // Fondo semitransparente para el texto
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    const boxWidth = w * 0.8;
    const boxHeight = 150;
    ctx.fillRect(10, 10, boxWidth, boxHeight);

    ctx.fillStyle = "yellow";
    ctx.font = "24px Arial";
    let y = 40;
    for (const line of textLines) {
        ctx.fillText(line, 20, y);
        y += 28;
    }

    canvas.toBlob(async blob => {
        if (!blob) {
            alert("No se pudo generar la imagen.");
            return;
        }

        const file = new File([blob], "foto_pr.jpg", { type: "image/jpeg" });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: "Foto PR",
                    text: "Foto con PR y coordenadas"
                });
            } catch (e) {
                console.error("Error al compartir:", e);
            }
        } else {
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
            alert("Tu dispositivo no soporta compartir archivos desde el navegador. Se abrió la imagen en otra pestaña.");
        }
    }, "image/jpeg");
});
