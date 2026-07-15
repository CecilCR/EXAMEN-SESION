/* =====================================================
   VISTA DE EXAMEN — SOLO ALUMNOS
   examen.js
   - Sin panel de edición, sin banco visible, sin importación.
   - Carga el banco de preguntas desde un archivo JSON externo
     (el mismo que exporta el generador con "Guardar Banco").
   - Soporta ?banco=nombre.json en la URL para reutilizar este
     archivo con distintos exámenes.
===================================================== */

let configuracion = {
  titulo: "Examen",
  curso: "",
  tiempo: 30,
  aleatorio: false,
  retroalimentacion: false
};

let examen = [];
let respuestas = [];
let indiceActual = 0;
let tiempoRestante = 0;
let temporizador = null;
let examenActivo = false;
let nombreAlumno = "";
let horaInicio = null;

// =========================================
// UTILIDAD: ESCAPAR HTML
// =========================================
function escapeHTML(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

// =========================================
// MEZCLA ALEATORIA (Fisher-Yates, distribución uniforme real)
// =========================================
function mezclarArray(arr) {
  const copia = arr.slice();
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// =========================================
// CARGA DEL BANCO DE PREGUNTAS
// =========================================
async function cargarBanco() {
  const params = new URLSearchParams(window.location.search);
  const archivo = params.get("banco") || "preguntas.json";
  // Se agrega un parámetro con la hora actual para evitar que el CDN de
  // GitHub Pages (Fastly) sirva una versión cacheada y desactualizada del
  // banco de preguntas tras subir un archivo nuevo.
  const urlSinCache = archivo + (archivo.includes("?") ? "&" : "?") + "_=" + Date.now();

  try {
    const resp = await fetch(urlSinCache, { cache: "no-store" });
    if (!resp.ok) throw new Error("HTTP " + resp.status);

    const datos = await resp.json();

    if (!datos || !Array.isArray(datos.preguntas) || datos.preguntas.length === 0) {
      throw new Error("El archivo no contiene una lista de preguntas válida.");
    }

    const preguntasValidas = datos.preguntas.filter(
      (p) => p && typeof p.enunciado === "string" && Array.isArray(p.opciones) && p.opciones.length === 4
    );

    if (preguntasValidas.length === 0) {
      throw new Error("Ninguna pregunta tiene el formato esperado (enunciado + 4 alternativas).");
    }

    configuracion = Object.assign(
      { titulo: "Examen", curso: "", tiempo: 30, aleatorio: false, retroalimentacion: false },
      datos.configuracion || {}
    );

    examen = preguntasValidas;
    mostrarPantallaInicio(archivo);
  } catch (err) {
    mostrarErrorCarga(archivo, err);
  }
}

function mostrarErrorCarga(archivo, err) {
  document.getElementById("pantallaCarga").innerHTML = `
    <h2>No se pudo cargar el examen</h2>
    <p>No se encontró o no se pudo leer <strong>${escapeHTML(archivo)}</strong>.</p>
    <p style="color:#777;font-size:14px;margin-top:10px">Detalle técnico: ${escapeHTML(err.message)}</p>
    <hr style="margin:20px 0">
    <p style="font-size:14px;color:#555">
      Si eres el/la docente: verifica que el archivo esté en el mismo repositorio y con el mismo nombre
      que aparece arriba, y que estés accediendo por el enlace de GitHub Pages
      (no abriendo el archivo .html directamente desde tu computadora, ya que la carga del banco
      requiere un servidor HTTP real).
    </p>
  `;
}

// =========================================
// PANTALLA DE INICIO
// =========================================
function mostrarPantallaInicio(archivo) {
  document.getElementById("pantallaCarga").style.display = "none";
  document.getElementById("tituloExamenHeader").textContent = "🎓 " + configuracion.titulo;
  document.getElementById("cursoExamenHeader").textContent = configuracion.curso;

  const pantalla = document.getElementById("pantallaInicio");
  pantalla.style.display = "block";
  pantalla.innerHTML = `
    <h2>${escapeHTML(configuracion.titulo)}</h2>
    <p><strong>Curso:</strong> ${escapeHTML(configuracion.curso)}</p>
    <p><strong>Número de preguntas:</strong> ${examen.length}</p>
    <p><strong>Tiempo disponible:</strong> ${configuracion.tiempo} minutos</p>

    <label for="nombreAlumno">Nombre y apellido</label>
    <input type="text" id="nombreAlumno" placeholder="Escribe tu nombre completo">

    <p style="color:#777;font-size:13px;margin-top:15px">
      Al hacer clic en "Comenzar examen" se activará el cronómetro. El tiempo sigue corriendo
      aunque cierres o recargues esta ventana, así que resuélvelo de corrido.
    </p>

    <button class="verde" onclick="comenzarExamen()">▶ Comenzar examen</button>
  `;
}

// =========================================
// INICIO DEL EXAMEN
// =========================================
function comenzarExamen() {
  const nombre = document.getElementById("nombreAlumno").value.trim();
  if (nombre === "") {
    alert("Por favor escribe tu nombre antes de comenzar.");
    return;
  }
  nombreAlumno = nombre;
  horaInicio = new Date();

  examen = JSON.parse(JSON.stringify(examen));
  if (configuracion.aleatorio) {
    examen = mezclarArray(examen);
  }

  respuestas = new Array(examen.length).fill(null);
  indiceActual = 0;
  tiempoRestante = configuracion.tiempo * 60;
  examenActivo = true;

  document.getElementById("pantallaInicio").style.display = "none";
  document.getElementById("pantallaExamen").style.display = "block";

  dibujarPregunta();
  iniciarTemporizador();
}

// =========================================
// DIBUJAR PREGUNTA
// =========================================
function dibujarPregunta() {
  const p = examen[indiceActual];
  let html = `
    <div style="margin-bottom:15px">Pregunta ${indiceActual + 1} de ${examen.length}</div>
    <div style="background:#ddd;height:12px;border-radius:10px">
      <div style="width:${((indiceActual + 1) / examen.length) * 100}%;height:12px;background:#1E88E5;border-radius:10px"></div>
    </div>
    <div style="margin-top:15px">
      <strong>Tiempo restante:</strong> <span id="reloj"></span>
    </div>
    <hr><br>
    <fieldset style="border:none;padding:0;margin:0">
      <legend style="font-size:1.1em;font-weight:600;margin-bottom:10px">${escapeHTML(p.enunciado)}</legend>
  `;

  const letras = ["A", "B", "C", "D"];
  p.opciones.forEach((opcion, i) => {
    const marcada = respuestas[indiceActual] === i ? "checked" : "";
    html += `
      <label class="opcion">
        <input type="radio" name="respuesta" value="${i}" ${marcada} onchange="guardarRespuesta(${i})">
        <strong>${letras[i]}.</strong> ${escapeHTML(opcion)}
      </label>
    `;
  });

  html += `</fieldset><br><br>`;
  html += `<button onclick="anteriorPregunta()" ${indiceActual === 0 ? "disabled" : ""}>◀ Anterior</button>`;

  if (indiceActual < examen.length - 1) {
    html += `<button onclick="siguientePregunta()">Siguiente ▶</button>`;
  } else {
    html += `<button class="verde" onclick="intentarFinalizar()">Finalizar examen</button>`;
  }

  document.getElementById("contenidoExamen").innerHTML = html;
  actualizarReloj();
}

// =========================================
// GUARDAR RESPUESTA Y NAVEGACIÓN
// =========================================
function guardarRespuesta(indice) {
  respuestas[indiceActual] = indice;
}

function siguientePregunta() {
  if (indiceActual < examen.length - 1) {
    indiceActual++;
    dibujarPregunta();
  }
}

function anteriorPregunta() {
  if (indiceActual > 0) {
    indiceActual--;
    dibujarPregunta();
  }
}

// =========================================
// TEMPORIZADOR
// =========================================
function iniciarTemporizador() {
  if (temporizador) clearInterval(temporizador);

  temporizador = setInterval(function () {
    tiempoRestante--;
    actualizarReloj();
    if (tiempoRestante <= 0) {
      clearInterval(temporizador);
      alert("Tiempo finalizado.");
      finalizarExamen();
    }
  }, 1000);
}

function actualizarReloj() {
  const min = Math.floor(tiempoRestante / 60);
  const seg = tiempoRestante % 60;
  const texto = String(min).padStart(2, "0") + ":" + String(seg).padStart(2, "0");
  const reloj = document.getElementById("reloj");
  if (reloj) reloj.innerHTML = texto;
}

// =========================================
// FINALIZAR EXAMEN
// =========================================
function intentarFinalizar() {
  const sinResponder = respuestas.filter((r) => r === null).length;
  if (sinResponder > 0) {
    const continuar = confirm(
      `Tienes ${sinResponder} pregunta(s) sin responder. ¿Deseas finalizar de todas formas?`
    );
    if (!continuar) return;
  }
  finalizarExamen();
}

function finalizarExamen() {
  clearInterval(temporizador);
  examenActivo = false;

  let aciertos = 0;
  examen.forEach((pregunta, indice) => {
    if (respuestas[indice] === pregunta.correcta) aciertos++;
  });

  mostrarResultados(aciertos);
}

// =========================================
// RESULTADOS
// =========================================
function mostrarResultados(aciertos) {
  const porcentaje = Math.round((aciertos / examen.length) * 100);

  let mensaje = "";
  let color = "#43A047";

  if (porcentaje >= 90) {
    mensaje = "Excelente desempeño";
  } else if (porcentaje >= 70) {
    mensaje = "Buen desempeño";
    color = "#1976D2";
  } else if (porcentaje >= 50) {
    mensaje = "Desempeño aceptable";
    color = "#FB8C00";
  } else {
    mensaje = "Necesita reforzar los contenidos";
    color = "#E53935";
  }

  let html = `
    <h2>Resultado del Examen</h2>
    <p><strong>Alumno/a:</strong> ${escapeHTML(nombreAlumno)}</p>
    <hr>
    <h1 style="font-size:60px;color:${color}">${porcentaje}%</h1>
    <h3>${aciertos} de ${examen.length} respuestas correctas</h3>
    <p>${mensaje}</p>
    <br>
    <div style="background:#DDD;height:22px;border-radius:20px;overflow:hidden">
      <div style="width:${porcentaje}%;height:22px;background:${color}"></div>
    </div>
    <br>
    <button onclick="exportarResultado(${porcentaje},${aciertos})">Exportar resultado (.txt)</button>
    <p style="color:#777;font-size:13px;margin-top:15px">Ya puedes cerrar esta ventana. Se recomienda exportar y enviar tu resultado al/a la docente.</p>
    <br><hr><br>
    <h2>Revisión por pregunta</h2>
    <br>
  `;

  html += generarHTMLRevision();

  document.getElementById("contenidoExamen").innerHTML = html;
}

function generarHTMLRevision() {
  let html = "";

  examen.forEach((pregunta, indice) => {
    const correcta = respuestas[indice] === pregunta.correcta;
    html += `
      <div class="pregunta-preview">
        <h3>Pregunta ${indice + 1}</h3>
        <p>${escapeHTML(pregunta.enunciado)}</p>
    `;

    pregunta.opciones.forEach((texto, i) => {
      let estilo = "";
      if (i === pregunta.correcta) {
        estilo = "background:#C8E6C9;border:2px solid #2E7D32;";
      }
      if (respuestas[indice] === i && respuestas[indice] !== pregunta.correcta) {
        estilo = "background:#FFCDD2;border:2px solid #C62828;";
      }
      html += `<div class="opcion" style="${estilo}">${String.fromCharCode(65 + i)}. ${escapeHTML(texto)}</div>`;
    });

    html += `<p><strong>Resultado:</strong> ${correcta ? "✅ Correcta" : "❌ Incorrecta"}</p>`;

    if (configuracion.retroalimentacion) {
      html += `
        <div style="margin-top:12px;padding:12px;background:#FFF8E1;border-left:5px solid #F9A825">
          <strong>Retroalimentación</strong><br><br>
          ${escapeHTML(pregunta.retroalimentacion) || "Sin retroalimentación."}
        </div>
      `;
    }

    html += "</div><br>";
  });

  return html;
}

// =========================================
// EXPORTAR RESULTADO
// =========================================
function exportarResultado(porcentaje, aciertos) {
  const ahora = new Date();
  const texto = `RESULTADO DEL EXAMEN
Alumno/a   : ${nombreAlumno}
Examen     : ${configuracion.titulo}
Curso      : ${configuracion.curso}
Fecha      : ${ahora.toLocaleString("es-PE", { timeZone: "America/Lima" })}
Preguntas  : ${examen.length}
Correctas  : ${aciertos}
Incorrectas: ${examen.length - aciertos}
Porcentaje : ${porcentaje}%`;

  const blob = new Blob([texto], { type: "text/plain" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  const nombreArchivo = "resultado_" + nombreAlumno.replace(/\s+/g, "_").toLowerCase() + ".txt";
  enlace.download = nombreArchivo;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

// =========================================
// ATAJOS DE TECLADO (solo durante el examen)
// =========================================
document.addEventListener("keydown", function (e) {
  if (examenActivo && document.getElementById("pantallaExamen").style.display === "block") {
    if (e.key === "ArrowRight" && indiceActual < examen.length - 1) {
      siguientePregunta();
    }
    if (e.key === "ArrowLeft" && indiceActual > 0) {
      anteriorPregunta();
    }
  }
});

// Advierte antes de cerrar/recargar si hay un examen en curso, para evitar
// pérdidas accidentales de progreso (no puede impedir el cierre, solo avisar).
window.addEventListener("beforeunload", function (e) {
  if (examenActivo) {
    e.preventDefault();
    e.returnValue = "";
  }
});

// =========================================
// INICIALIZACIÓN
// =========================================
window.onload = cargarBanco;
