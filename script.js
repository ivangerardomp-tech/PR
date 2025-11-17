const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const btnStartCam = document.getElementById("btnStartCam");
const btnCapture = document.getElementById("btnCapture");
const statusEl = document.getElementById("status");

let lat = null, lng = null;

// ------------------------------------
// CÁMARA
// ------------------------------------
async function initCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Este navegador no soporta cámara.");
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" }
        });
        video.srcObject = stream;
        statusEl.textContent = "Cámara lista ✓";
    } catch (e) {
        console.error("Error cámara:", e);
        alert("No se pudo activar la cámara. Revisa los permisos en Ajustes.");
    }
}

// ------------------------------------
// GEOLOCALIZACIÓN
// ------------------------------------
function getLocation() {
    if (!navigator.geolocation) {
        statusEl.textContent = "Geolocalización no soportada.";
        return;
    }

    navigator.geolocation.getCurrentPosition(
        pos => {
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
            console.log("Ubicación:", lat, lng);
        },
        err => {
            console.error("Error GPS:", err);
            statusEl.textContent = "No se pudo obtener ubicación.";
        },
        { enableHighAccuracy: true }
    );
}

// ------------------------------------
// BOTÓN: ACTIVAR CÁMARA (GESTO iOS)
// ------------------------------------
btnStartCam.addEventListener("click", async () => {
    // iOS requiere que getUserMedia se llame dentro de un gesto del usuario
    await initCamera();
    getLocation();

    // Si todo fue bien, habilitamos Capturar y ocultamos este botón
    btnCapture.disabled = false;
    btnStartCam.style.display = "none";
});

// ------------------------------------
// BOTÓN: CAPTURAR FOTO + PR + COMPARTIR
// ------------------------------------
btnCapture.addEventListener("click", async () => {
    if (!lat || !lng) {
        alert("Todavía no tengo la ubicación. Espera unos segundos e inténtalo de nuevo.");
        return;
    }

    // Tramo más cercano según tus KML
    const tramo = nearestTramo(lat, lng) || "SIN TRAMO";

    // Aquí podrías calcular distancia real sobre la ruta densificada.
    // De momento lo dejamos como 0 para el ejemplo:
    const distancia = 0;
    const prInfo = findPR(tramo, distancia);

    const context = canvas.getContext("2d");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const fechaStr = new Date().toLocaleString();

    const textLines = [
        `Fecha: ${fechaStr}`,
        `Lat: ${lat.toFixed(6)}`,
        `Lng: ${lng.toFixed(6)}`,
        `Tramo: ${tramo}`,
        `PR: ${prInfo.pr}+${prInfo.metros}m`
    ];

    context.fillStyle = "rgba(0, 0, 0, 0.5)";
    context.fillRect(10, 10, 700, 150);

    context.fillStyle = "yellow";
    context.font = "24px Arial";
    let y = 40;
    for (const line of textLines) {
        context.fillText(line, 20, y);
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
            // Fallback: mostrar la imagen en otra pestaña
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
            alert("Tu dispositivo no soporta compartir con archivos. Se abrió la imagen en otra pestaña.");
        }
    }, "image/jpeg");
});
