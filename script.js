/* =====================================================
   GENERADOR DE TEST INTERACTIVO
   script.js — versión corregida
   Fixes aplicados:
   - Eliminado texto basura al final del archivo (causaba ReferenceError)
   - Eliminada función finalizarExamen() duplicada
   - Escapado de HTML en todo contenido inyectado (evita romper el render / XSS)
   - Persistencia con localStorage (banco de preguntas + configuración)
   - Cierre de modal (✕ / clic fuera) durante examen activo ahora pide
     confirmación y detiene el temporizador correctamente
   - Validación de título/curso antes de generar o exportar
   - Confirmación al finalizar examen con preguntas sin responder
   - Validación básica de estructura al importar JSON
===================================================== */

// =========================================
// VARIABLES GLOBALES
// =========================================
let preguntas = [];

let configuracion = {
  titulo: "",
  curso: "",
  tiempo: 30,
  aleatorio: false,
  retroalimentacion: false
};

let examenActivo = false; // controla si hay un examen en curso (para proteger el cierre del modal)

const CLAVE_PREGUNTAS = "testInteractivo_preguntas";
const CLAVE_CONFIG = "testInteractivo_configuracion";

// =========================================
// UTILIDAD: ESCAPAR HTML
// (evita que el enunciado/alternativas rompan el render o inyecten HTML)
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
// PERSISTENCIA (localStorage)
// =========================================
function guardarEnLocalStorage() {
  try {
    localStorage.setItem(CLAVE_PREGUNTAS, JSON.stringify(preguntas));
    localStorage.setItem(CLAVE_CONFIG, JSON.stringify(configuracion));
  } catch (e) {
    console.warn("No se pudo guardar en localStorage:", e);
  }
}

function cargarDesdeLocalStorage() {
  try {
    const preguntasGuardadas = localStorage.getItem(CLAVE_PREGUNTAS);
    const configGuardada = localStorage.getItem(CLAVE_CONFIG);
    if (preguntasGuardadas) {
      preguntas = JSON.parse(preguntasGuardadas);
    }
    if (configGuardada) {
      configuracion = JSON.parse(configGuardada);
    }
    return preguntas.length > 0;
  } catch (e) {
    console.warn("No se pudo leer localStorage:", e);
    return false;
  }
}

// =========================================
// CREAR PREGUNTA
// =========================================
function crearPregunta() {
  const pregunta = {
    id: Date.now(),
    enunciado: "",
    opciones: ["", "", "", ""],
    correcta: 0,
    retroalimentacion: ""
  };
  preguntas.push(pregunta);
  renderizarPreguntas();
  guardarEnLocalStorage();
}

// =========================================
// ELIMINAR PREGUNTA
// =========================================
function eliminarPregunta(id) {
  if (!confirm("¿Eliminar esta pregunta?")) return;
  preguntas = preguntas.filter((p) => p.id !== id);
  renderizarPreguntas();
  guardarEnLocalStorage();
}

// =========================================
// ACTUALIZAR DATOS
// =========================================
function actualizarPregunta(id, campo, valor) {
  const pregunta = preguntas.find((p) => p.id === id);
  if (!pregunta) return;
  pregunta[campo] = valor;
  guardarEnLocalStorage();
}

function actualizarOpcion(id, indice, valor) {
  const pregunta = preguntas.find((p) => p.id === id);
  if (!pregunta) return;
  pregunta.opciones[indice] = valor;
  guardarEnLocalStorage();
}

// =========================================
// DIBUJAR PREGUNTAS
// =========================================
function renderizarPreguntas() {
  const contenedor = document.getElementById("listaPreguntas");
  contenedor.innerHTML = "";

  preguntas.forEach((pregunta, index) => {
    const tarjeta = document.createElement("div");
    tarjeta.className = "tarjeta";
    tarjeta.innerHTML = `
      <h3>Pregunta ${index + 1}</h3>

      <label>Enunciado</label>
      <textarea oninput="actualizarPregunta(${pregunta.id},'enunciado',this.value)">${escapeHTML(pregunta.enunciado)}</textarea>

      <div class="alternativas">
        <div>
          <label>Alternativa A</label>
          <input type="text" value="${escapeHTML(pregunta.opciones[0])}"
            oninput="actualizarOpcion(${pregunta.id},0,this.value)">
        </div>
        <div>
          <label>Alternativa B</label>
          <input type="text" value="${escapeHTML(pregunta.opciones[1])}"
            oninput="actualizarOpcion(${pregunta.id},1,this.value)">
        </div>
        <div>
          <label>Alternativa C</label>
          <input type="text" value="${escapeHTML(pregunta.opciones[2])}"
            oninput="actualizarOpcion(${pregunta.id},2,this.value)">
        </div>
        <div>
          <label>Alternativa D</label>
          <input type="text" value="${escapeHTML(pregunta.opciones[3])}"
            oninput="actualizarOpcion(${pregunta.id},3,this.value)">
        </div>
      </div>

      <label>Respuesta correcta</label>
      <select onchange="actualizarPregunta(${pregunta.id},'correcta',Number(this.value))">
        <option value="0" ${pregunta.correcta === 0 ? "selected" : ""}>A</option>
        <option value="1" ${pregunta.correcta === 1 ? "selected" : ""}>B</option>
        <option value="2" ${pregunta.correcta === 2 ? "selected" : ""}>C</option>
        <option value="3" ${pregunta.correcta === 3 ? "selected" : ""}>D</option>
      </select>

      <label>Retroalimentación</label>
      <textarea oninput="actualizarPregunta(${pregunta.id},'retroalimentacion',this.value)">${escapeHTML(pregunta.retroalimentacion)}</textarea>

      <br><br>
      <button class="rojo" onclick="eliminarPregunta(${pregunta.id})">Eliminar pregunta</button>
      <button onclick="duplicarPregunta(${pregunta.id})">Duplicar pregunta</button>
    `;
    contenedor.appendChild(tarjeta);
  });
}

// =========================================
// LEER CONFIGURACIÓN
// =========================================
function leerConfiguracion() {
  configuracion.titulo = document.getElementById("titulo").value;
  configuracion.curso = document.getElementById("curso").value;
  configuracion.tiempo = parseInt(document.getElementById("tiempo").value) || 0;
  configuracion.aleatorio = document.getElementById("aleatorio").checked;
  configuracion.retroalimentacion = document.getElementById("retro").checked;
  guardarEnLocalStorage();
}

// =========================================
// VALIDACIONES
// =========================================
function validarConfiguracion() {
  if (configuracion.titulo.trim() === "") {
    alert("El test debe tener un título.");
    return false;
  }
  if (configuracion.curso.trim() === "") {
    alert("Debes indicar el curso.");
    return false;
  }
  if (!configuracion.tiempo || configuracion.tiempo <= 0) {
    alert("El tiempo del test debe ser mayor a 0 minutos.");
    return false;
  }
  return true;
}

function validarPreguntas() {
  if (preguntas.length === 0) {
    alert("Debe existir al menos una pregunta.");
    return false;
  }
  for (let i = 0; i < preguntas.length; i++) {
    const p = preguntas[i];
    if (p.enunciado.trim() === "") {
      alert("La pregunta " + (i + 1) + " no tiene enunciado.");
      return false;
    }
    for (let j = 0; j < 4; j++) {
      if (p.opciones[j].trim() === "") {
        alert("La pregunta " + (i + 1) + " tiene alternativas vacías.");
        return false;
      }
    }
  }
  return true;
}

// =========================================
// MODAL
// =========================================
function cerrarModal() {
  if (examenActivo) {
    const salir = confirm(
      "Hay un examen en curso. Si cierras ahora se perderá el progreso. ¿Deseas salir?"
    );
    if (!salir) return;
    volverEditor();
    return;
  }
  document.getElementById("modal").style.display = "none";
}

window.onclick = function (e) {
  const modal = document.getElementById("modal");
  if (e.target === modal) {
    cerrarModal();
  }
};

// =========================================
// INICIALIZACIÓN
// =========================================
window.onload = function () {
  document.getElementById("archivoJSON").addEventListener("change", manejarCargaArchivo);
  document.getElementById("archivoWord").addEventListener("change", manejarCargaWord);

  const habiaDatosGuardados = cargarDesdeLocalStorage();

  if (habiaDatosGuardados) {
    document.getElementById("titulo").value = configuracion.titulo || "";
    document.getElementById("curso").value = configuracion.curso || "";
    document.getElementById("tiempo").value = configuracion.tiempo || 30;
    document.getElementById("aleatorio").checked = !!configuracion.aleatorio;
    document.getElementById("retro").checked = !!configuracion.retroalimentacion;
    renderizarPreguntas();
  } else {
    crearPregunta();
  }
};

// =========================================
// EXPORTAR BANCO DE PREGUNTAS
// =========================================
function guardarJSON() {
  leerConfiguracion();
  if (!validarConfiguracion() || !validarPreguntas()) return;

  const datos = { configuracion: configuracion, preguntas: preguntas };
  const contenido = JSON.stringify(datos, null, 4);
  const blob = new Blob([contenido], { type: "application/json" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = "preguntas.json";
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

// =========================================
// IMPORTAR BANCO
// =========================================
function cargarJSON() {
  document.getElementById("archivoJSON").click();
}

function manejarCargaArchivo(e) {
  const archivo = e.target.files[0];
  if (!archivo) return;

  const lector = new FileReader();
  lector.onload = function (event) {
    try {
      const datos = JSON.parse(event.target.result);

      if (!datos || !Array.isArray(datos.preguntas)) {
        alert("El archivo no tiene el formato esperado (falta la lista de preguntas).");
        return;
      }

      const preguntasValidas = datos.preguntas.every(
        (p) => p && typeof p.enunciado === "string" && Array.isArray(p.opciones) && p.opciones.length === 4
      );
      if (!preguntasValidas) {
        alert("El archivo contiene preguntas con formato inválido.");
        return;
      }

      preguntas = datos.preguntas;
      configuracion = Object.assign(
        { titulo: "", curso: "", tiempo: 30, aleatorio: false, retroalimentacion: false },
        datos.configuracion || {}
      );

      document.getElementById("titulo").value = configuracion.titulo;
      document.getElementById("curso").value = configuracion.curso;
      document.getElementById("tiempo").value = configuracion.tiempo;
      document.getElementById("aleatorio").checked = configuracion.aleatorio;
      document.getElementById("retro").checked = configuracion.retroalimentacion;

      renderizarPreguntas();
      guardarEnLocalStorage();
      alert("Banco cargado correctamente.");
    } catch (error) {
      alert("El archivo no es un JSON válido.");
    } finally {
      e.target.value = ""; // permite volver a cargar el mismo archivo si es necesario
    }
  };
  lector.readAsText(archivo);
}

// =========================================
// IMPORTAR DESDE WORD (.docx)
// Plantilla estándar esperada por pregunta:
//   1. Enunciado de la pregunta
//   A) alternativa
//   B) alternativa
//   C) alternativa
//   D) alternativa
//   Respuesta correcta: B
//   Retroalimentación: texto explicativo
//   (línea en blanco antes de la siguiente pregunta)
// =========================================
function importarDesdeWord() {
  if (typeof mammoth === "undefined") {
    alert("No se pudo cargar el lector de Word (sin conexión a internet). Verifica tu conexión e intenta de nuevo.");
    return;
  }
  document.getElementById("archivoWord").click();
}

function manejarCargaWord(e) {
  const archivo = e.target.files[0];
  if (!archivo) return;

  const lector = new FileReader();
  lector.onload = function (event) {
    mammoth
      .extractRawText({ arrayBuffer: event.target.result })
      .then(function (resultado) {
        const { preguntasImportadas, errores } = parsearPreguntasWord(resultado.value);

        if (preguntasImportadas.length === 0) {
          alert(
            "No se encontró ninguna pregunta con el formato esperado.\n\n" +
            "Revisa que cada pregunta tenga: número + enunciado, alternativas A) B) C) D), " +
            "una línea 'Respuesta correcta: <letra>' y una línea 'Retroalimentación: <texto>'."
          );
          return;
        }

        let mensaje = `Se encontraron ${preguntasImportadas.length} pregunta(s) válida(s).`;
        if (errores.length > 0) {
          mensaje += `\n\n${errores.length} pregunta(s) se omitieron por errores de formato:\n- ` + errores.join("\n- ");
        }
        mensaje += "\n\n¿Deseas AGREGARLAS al banco actual? (Cancelar = reemplazar el banco actual por estas)";

        const agregar = confirm(mensaje);
        if (agregar) {
          preguntas = preguntas.concat(preguntasImportadas);
        } else {
          const reemplazar = confirm("¿Confirmas reemplazar TODO el banco actual por las preguntas importadas? Esta acción no se puede deshacer.");
          if (!reemplazar) return;
          preguntas = preguntasImportadas;
        }

        renderizarPreguntas();
        guardarEnLocalStorage();
      })
      .catch(function (error) {
        console.error(error);
        alert("No se pudo leer el archivo Word. Verifica que sea un .docx válido.");
      });
  };
  lector.onerror = function () {
    alert("No se pudo leer el archivo.");
  };
  lector.readAsArrayBuffer(archivo);
  e.target.value = ""; // permite volver a cargar el mismo archivo si es necesario
}

function parsearPreguntasWord(textoPlano) {
  const lineas = textoPlano
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Los prefijos manuales ("1.", "A)") son OPCIONALES y se limpian si existen,
  // pero el parser no depende de ellos: la numeración automática de Word no
  // aparece como texto real, así que la posición se determina anclando en
  // la línea fija "Respuesta correcta: <letra>".
  const regexNumeroPregunta = /^\d+[\.\)]\s*(.+)$/;
  const regexOpcionConLetra = /^([A-Da-d])[\.\)]\s*(.*)$/;
  const regexCorrecta = /^respuesta\s*correcta\s*:\s*([A-Da-d])/i;
  const regexRetro = /^retroalimentaci[oó]n\s*:\s*(.*)$/i;

  const idxCorrectas = [];
  lineas.forEach((l, i) => {
    if (regexCorrecta.test(l)) idxCorrectas.push(i);
  });

  const preguntasImportadas = [];
  const errores = [];

  idxCorrectas.forEach((idxCorrecta, n) => {
    const numeroVisible = n + 1;
    const letraCorrecta = lineas[idxCorrecta].match(regexCorrecta)[1].toLowerCase();
    const indiceCorrecta = "abcd".indexOf(letraCorrecta);

    const idxOpciones = [idxCorrecta - 4, idxCorrecta - 3, idxCorrecta - 2, idxCorrecta - 1];
    const idxEnunciado = idxCorrecta - 5;
    const idxCorrectaAnterior = n > 0 ? idxCorrectas[n - 1] : -1;

    if (idxEnunciado < 0 || idxOpciones[0] <= idxCorrectaAnterior) {
      errores.push(
        `Pregunta ${numeroVisible}: no se encontró un enunciado + 4 alternativas completas justo antes de "Respuesta correcta:".`
      );
      return;
    }

    let enunciado = lineas[idxEnunciado];
    const mEnun = enunciado.match(regexNumeroPregunta);
    if (mEnun) enunciado = mEnun[1];

    const opciones = idxOpciones.map((idx) => {
      const texto = lineas[idx];
      const mOp = texto.match(regexOpcionConLetra);
      return (mOp ? mOp[2] : texto).trim();
    });

    let retro = "";
    if (idxCorrecta + 1 < lineas.length) {
      const mRetro = lineas[idxCorrecta + 1].match(regexRetro);
      if (mRetro) retro = mRetro[1].trim();
    }

    const opcionesCompletas = opciones.every((o) => o !== "");
    if (!opcionesCompletas || indiceCorrecta === -1 || enunciado.trim() === "") {
      errores.push(
        `Pregunta ${numeroVisible} ("${enunciado.slice(0, 40)}..."): faltan alternativas, enunciado o la letra de respuesta correcta no es válida.`
      );
      return;
    }

    preguntasImportadas.push({
      id: Date.now() + Math.floor(Math.random() * 100000) + n,
      enunciado: enunciado.trim(),
      opciones: opciones,
      correcta: indiceCorrecta,
      retroalimentacion: retro
    });
  });

  return { preguntasImportadas, errores };
}


function totalPreguntas() {
  return preguntas.length;
}

function limpiarTodo() {
  if (!confirm("¿Eliminar todas las preguntas?")) return;
  preguntas = [];
  renderizarPreguntas();
  guardarEnLocalStorage();
}

function duplicarPregunta(id) {
  const original = preguntas.find((p) => p.id === id);
  if (!original) return;
  const copia = JSON.parse(JSON.stringify(original));
  copia.id = Date.now() + Math.floor(Math.random() * 1000);
  preguntas.push(copia);
  renderizarPreguntas();
  guardarEnLocalStorage();
}

function ordenarPreguntas() {
  preguntas.sort((a, b) => a.id - b.id);
  renderizarPreguntas();
  guardarEnLocalStorage();
}

function mostrarResumen() {
  console.log("Preguntas:", preguntas.length);
  console.log(configuracion);
}

// =========================================
// MOTOR DEL EXAMEN — VARIABLES
// =========================================
let examen = [];
let respuestas = [];
let indiceActual = 0;
let tiempoRestante = 0;
let temporizador = null;

// =========================================
// GENERAR EXAMEN
// =========================================
function generarTest() {
  leerConfiguracion();
  if (!validarConfiguracion() || !validarPreguntas()) return;

  examen = JSON.parse(JSON.stringify(preguntas));
  if (configuracion.aleatorio) {
    examen.sort(() => Math.random() - 0.5);
  }

  respuestas = new Array(examen.length).fill(null);
  indiceActual = 0;
  tiempoRestante = configuracion.tiempo * 60;
  examenActivo = true;

  mostrarPantallaExamen();
  iniciarTemporizador();
}

// =========================================
// PANTALLA DEL EXAMEN
// =========================================
function mostrarPantallaExamen() {
  const modal = document.getElementById("modal");
  modal.style.display = "block";
  dibujarPregunta();
}

// =========================================
// DIBUJAR PREGUNTA
// =========================================
function dibujarPregunta() {
  const p = examen[indiceActual];
  let html = `
    <h2>${escapeHTML(configuracion.titulo)}</h2>
    <div style="margin-bottom:15px">Pregunta ${indiceActual + 1} de ${examen.length}</div>
    <div id="barraContenedor" style="background:#ddd;height:12px;border-radius:10px">
      <div id="barra" style="width:${((indiceActual + 1) / examen.length) * 100}%;height:12px;background:#1E88E5;border-radius:10px"></div>
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

  document.getElementById("vistaPrevia").innerHTML = html;
  actualizarReloj();
}

// =========================================
// GUARDAR RESPUESTA
// =========================================
function guardarRespuesta(indice) {
  respuestas[indiceActual] = indice;
}

// =========================================
// NAVEGACIÓN
// =========================================
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
// MOSTRAR RESULTADOS
// (resumen + desglose por pregunta, con retroalimentación si el
// checkbox "Mostrar retroalimentación" está activo, todo en una sola pantalla)
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
    <h2>Resultado del Test</h2>
    <hr>
    <h1 style="font-size:60px;color:${color}">${porcentaje}%</h1>
    <h3>${aciertos} de ${examen.length} respuestas correctas</h3>
    <p>${mensaje}</p>
    <br>
    <div style="background:#DDD;height:22px;border-radius:20px;overflow:hidden">
      <div style="width:${porcentaje}%;height:22px;background:${color}"></div>
    </div>
    <br>
    <button onclick="exportarResultado()">Exportar resultado (.txt)</button>
    <button onclick="volverEditor()">Volver al editor</button>
    <br><hr><br>
    <h2>Revisión por pregunta</h2>
    <br>
  `;

  html += generarHTMLRevision();

  document.getElementById("vistaPrevia").innerHTML = html;
  // Asegura que el modal esté visible incluso si el temporizador terminó
  // mientras el modal estaba cerrado.
  document.getElementById("modal").style.display = "block";
}

// =========================================
// REVISIÓN DETALLADA (por pregunta, correcta e incorrecta)
// =========================================
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

    // La retroalimentación se muestra siempre (correcta o incorrecta),
    // controlada únicamente por el checkbox "Mostrar retroalimentación".
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
// CALCULAR ACIERTOS
// =========================================
function calcularAciertos() {
  let total = 0;
  examen.forEach((pregunta, i) => {
    if (respuestas[i] === pregunta.correcta) total++;
  });
  return total;
}

// =========================================
// VOLVER AL EDITOR
// =========================================
function volverEditor() {
  clearInterval(temporizador);
  examenActivo = false;
  document.getElementById("modal").style.display = "none";
  respuestas = [];
  indiceActual = 0;
}

// =========================================
// ESTADÍSTICAS
// =========================================
function obtenerEstadisticas() {
  const correctas = calcularAciertos();
  const incorrectas = examen.length - correctas;
  return {
    preguntas: examen.length,
    correctas: correctas,
    incorrectas: incorrectas,
    porcentaje: Math.round((correctas * 100) / examen.length)
  };
}

// =========================================
// EXPORTAR RESULTADO
// =========================================
function exportarResultado() {
  const datos = obtenerEstadisticas();
  const texto = `RESULTADO DEL TEST
Preguntas : ${datos.preguntas}
Correctas : ${datos.correctas}
Incorrectas : ${datos.incorrectas}
Porcentaje : ${datos.porcentaje}%`;

  const blob = new Blob([texto], { type: "text/plain" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = "resultado.txt";
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

// =========================================
// PREVISUALIZACIÓN (modo docente, sin temporizador)
// =========================================
function previsualizar() {
  leerConfiguracion();
  if (!validarConfiguracion() || !validarPreguntas()) return;

  let html = `
    <h2>${escapeHTML(configuracion.titulo)}</h2>
    <p><strong>Curso:</strong> ${escapeHTML(configuracion.curso)}</p>
    <p><strong>Tiempo:</strong> ${configuracion.tiempo} minutos</p>
    <hr><br>
  `;

  preguntas.forEach((p, i) => {
    html += `
      <div class="pregunta-preview">
        <h4>Pregunta ${i + 1}</h4>
        <p>${escapeHTML(p.enunciado)}</p>
        <div class="opcion">A. ${escapeHTML(p.opciones[0])}</div>
        <div class="opcion">B. ${escapeHTML(p.opciones[1])}</div>
        <div class="opcion">C. ${escapeHTML(p.opciones[2])}</div>
        <div class="opcion">D. ${escapeHTML(p.opciones[3])}</div>
      </div>
    `;
  });

  document.getElementById("vistaPrevia").innerHTML = html;
  document.getElementById("modal").style.display = "block";
}

// =========================================
// ATAJOS DE TECLADO (solo durante el examen)
// =========================================
document.addEventListener("keydown", function (e) {
  if (examenActivo && document.getElementById("modal").style.display === "block") {
    if (e.key === "ArrowRight" && indiceActual < examen.length - 1) {
      siguientePregunta();
    }
    if (e.key === "ArrowLeft" && indiceActual > 0) {
      anteriorPregunta();
    }
  }
});
