const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const btnCapture = document.getElementById("btnCapture");
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

    console.log("initCamera: solicitando getUserMedia...");
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } }
    });

    console.log("initCamera: stream obtenido", stream);
    video.srcObject = stream;

    // Estas líneas ayudan mucho en iOS
    video.setAttribute("playsinline", "true");
    video.setAttribute("autoplay", "true");
    video.muted = true;

    video.onloadedmetadata = () => {
        console.log("video.onloadedmetadata: videoWidth=", video.videoWidth, "videoHeight=", video.videoHeight);
        statusEl.textContent = `Cámara lista ( ${video.videoWidth} x ${video.videoHeight} )`;
        video.play().catch(err => {
            console.error("Error al hacer video.play():", err);
        });
    };
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
        // Disparamos cámara y GPS al cargar
        await Promise.all([
            initCamera(),
            getLocationOnce()
        ]);

        btnCapture.disabled = false;
        statusEl.textContent = "Listo para capturar ✅";

    } catch (err) {
        console.error("Error en autoStart:", err);
        statusEl.textContent =
            "No se pudo activar automáticamente la cámara. Revisa los permisos del navegador o del sistema.";
        // Aquí ya NO hay botón de respaldo, como pediste.
    }
}

// Arrancamos cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
    autoStart();
});

// ---------------------------
// CAPTURAR FOTO + PR + COMPARTIR
// ---------------------------
btnCapture.addEventListener("click", async () => {
    if (!lat || !lng) {
        alert("Todavía no tengo la ubicación. Espera unos segundos e inténtalo de nuevo.");
        return;
    }

    if (typeof nearestTramo !== "function" || typeof findPR !== "function") {
        alert("Datos de tramo/PR aún no cargados. Espera unos segundos.");
        return;
    }

    const tramo = nearestTramo(lat, lng) || "SIN TRAMO";

    // TODO: aquí pondremos tu distancia real sobre la ruta densificada.
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
