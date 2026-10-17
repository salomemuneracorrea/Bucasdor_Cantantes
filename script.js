/* ===========================================================
   BUSCADOR DE CANTANTES - Lógica (script.js)

   ¿Qué hace este archivo?
   1. Espera a que la persona escriba un nombre y presione "Buscar" (o Enter).
   2. Pide información a internet usando 3 "APIs" gratuitas:
        - Wikipedia: foto, descripción y biografía.
        - Wikidata:  datos rápidos (país, fecha y lugar de nacimiento).
        - iTunes:    canciones, portadas, género y vista previa de audio.
   3. Muestra todo en la página en forma de tarjetas.

   Una API es como un "mesero": le pedimos algo con una dirección (URL)
   y nos devuelve la información en formato JSON (texto organizado).
   =========================================================== */


/* -----------------------------------------------------------
   1. TOMAR LOS ELEMENTOS DE LA PÁGINA
   Guardamos en variables las partes del HTML que vamos a usar.
   document.getElementById("x") busca el elemento que tiene id="x".
   ----------------------------------------------------------- */
const formulario = document.getElementById("formulario");
const cajaBusqueda = document.getElementById("caja-busqueda");
const mensaje = document.getElementById("mensaje");
const resultados = document.getElementById("resultados");
const tarjetaPerfil = document.getElementById("tarjeta-perfil");
const tarjetaBiografia = document.getElementById("tarjeta-biografia");
const tarjetaDatos = document.getElementById("tarjeta-datos");
const tarjetaCanciones = document.getElementById("tarjeta-canciones");


/* -----------------------------------------------------------
   2. CUANDO SE ENVÍA EL FORMULARIO (clic en "Buscar" o Enter)
   ----------------------------------------------------------- */
formulario.addEventListener("submit", function (evento) {
  // Por defecto un formulario recarga la página; esto lo evita.
  evento.preventDefault();

  // .trim() quita los espacios sobrantes al inicio y al final.
  const nombre = cajaBusqueda.value.trim();

  if (nombre !== "") {
    buscarCantante(nombre);
  }
});


/* -----------------------------------------------------------
   3. FUNCIÓN PRINCIPAL: buscar un cantante
   "async" significa que la función espera respuestas de internet
   usando "await" sin congelar la página.
   ----------------------------------------------------------- */
async function buscarCantante(nombre) {
  // Mostramos "Buscando..." y escondemos los resultados anteriores.
  mensaje.textContent = "Buscando...";
  resultados.hidden = true;
  limpiarTarjetas();

  // Guardamos el nombre en la dirección de la página (?q=Shakira)
  // para que se pueda compartir el enlace de la búsqueda.
  history.replaceState(null, "", "?q=" + encodeURIComponent(nombre));

  // Pedimos Wikipedia e iTunes AL MISMO TIEMPO (así es más rápido).
  // Cada función devuelve "null" si falla, así que una no rompe a la otra.
  const [wikipedia, canciones] = await Promise.all([
    buscarEnWikipedia(nombre),
    buscarCanciones(nombre),
  ]);

  // Si ninguna de las dos encontró algo, mostramos un mensaje amable.
  if (wikipedia === null && canciones.length === 0) {
    mensaje.textContent = "No encontramos a ese cantante, revisa cómo lo escribiste 🙂";
    return; // "return" termina la función aquí
  }

  // Los datos rápidos necesitan el código de Wikidata que trae Wikipedia.
  const datos = await buscarDatosRapidos(wikipedia);

  // Ya tenemos todo: borramos "Buscando..." y dibujamos las tarjetas.
  mensaje.textContent = "";
  mostrarPerfil(nombre, wikipedia, canciones);
  mostrarBiografia(wikipedia);
  mostrarDatos(datos, canciones);
  mostrarCanciones(canciones);
  resultados.hidden = false;
}


/* ===========================================================
   4. FUNCIONES QUE PIDEN INFORMACIÓN A INTERNET (APIs)
   =========================================================== */

/* --- Wikipedia: foto, descripción y resumen ---
   Primero probamos en español; si no aparece, en inglés. */
async function buscarEnWikipedia(nombre) {
  const idiomas = ["es", "en"];

  for (const idioma of idiomas) {
    // "try / catch": si algo falla dentro del "try", saltamos al "catch"
    // en vez de que la página se rompa.
    try {
      // a) Buscamos el título exacto del artículo (así "shakira" encuentra "Shakira").
      const titulo = await buscarTituloWikipedia(nombre, idioma);
      if (titulo === null) {
        continue; // "continue" pasa al siguiente idioma
      }

      // b) Pedimos el resumen del artículo.
      let resumen = await pedirResumen(titulo, idioma);

      // c) Si es una página de desambiguación ("Juanes puede referirse a..."),
      //    probamos con el mismo nombre + "(cantante)" o "(singer)".
      if (resumen !== null && resumen.type === "disambiguation") {
        const extra = idioma === "es" ? " (cantante)" : " (singer)";
        resumen = await pedirResumen(titulo + extra, idioma);
      }

      if (resumen !== null && resumen.type === "standard") {
        resumen.idioma = idioma; // recordamos en qué idioma lo encontramos
        return resumen;
      }
    } catch (error) {
      console.log("Error con Wikipedia (" + idioma + "):", error);
    }
  }

  return null; // no se encontró en ningún idioma
}

/* Busca el título del artículo que mejor coincide con lo escrito. */
async function buscarTituloWikipedia(nombre, idioma) {
  // "origin=*" es necesario para que Wikipedia permita la consulta desde el navegador.
  const url = "https://" + idioma + ".wikipedia.org/w/api.php" +
    "?action=opensearch&limit=1&namespace=0&format=json&origin=*" +
    "&search=" + encodeURIComponent(nombre);

  const respuesta = await fetch(url);       // pedimos la información
  const datos = await respuesta.json();     // la convertimos de JSON a objeto

  // La respuesta es una lista: [lo que buscamos, [títulos encontrados], ...]
  const titulos = datos[1];
  return titulos.length > 0 ? titulos[0] : null;
}

/* Pide el resumen de un artículo (texto, descripción y foto). */
async function pedirResumen(titulo, idioma) {
  const url = "https://" + idioma + ".wikipedia.org/api/rest_v1/page/summary/" +
    encodeURIComponent(titulo.replaceAll(" ", "_"));

  const respuesta = await fetch(url);
  // .ok es "true" si la respuesta llegó bien (código 200)
  if (!respuesta.ok) {
    return null;
  }
  return await respuesta.json();
}

/* --- iTunes: canciones populares ---
   Devuelve una lista (array) de canciones. Si falla, devuelve una lista vacía. */
async function buscarCanciones(nombre) {
  try {
    // "attribute=artistTerm" busca por nombre de artista.
    // Pedimos 25 para poder quitar repetidas y quedarnos con 5.
    const url = "https://itunes.apple.com/search?entity=song&attribute=artistTerm&limit=25" +
      "&term=" + encodeURIComponent(nombre);

    const respuesta = await fetch(url);
    const datos = await respuesta.json();

    // Nos quedamos solo con las canciones cuyo artista se parece a lo buscado.
    let canciones = datos.results.filter(function (cancion) {
      return sinTildes(cancion.artistName).includes(sinTildes(nombre));
    });

    // Si el filtro dejó la lista vacía, usamos los resultados tal cual.
    if (canciones.length === 0) {
      canciones = datos.results;
    }

    // Quitamos canciones repetidas (a veces aparece la misma en varios álbumes).
    const nombresVistos = [];
    const unicas = [];
    for (const cancion of canciones) {
      const clave = sinTildes(cancion.trackName);
      if (!nombresVistos.includes(clave)) {
        nombresVistos.push(clave);
        unicas.push(cancion);
      }
    }

    // .slice(0, 5) toma solo las primeras 5.
    return unicas.slice(0, 5);
  } catch (error) {
    console.log("Error con iTunes:", error);
    return [];
  }
}

/* --- Wikidata: datos rápidos (país, nacimiento) ---
   Wikipedia nos da un código como "Q34424" (wikibase_item) que
   identifica al cantante en Wikidata, una enorme base de datos libre. */
async function buscarDatosRapidos(wikipedia) {
  const datos = {}; // aquí guardaremos lo que encontremos

  if (wikipedia === null || !wikipedia.wikibase_item) {
    return datos;
  }

  try {
    const id = wikipedia.wikibase_item;
    const url = "https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims&format=json&origin=*" +
      "&ids=" + id;
    const respuesta = await fetch(url);
    const json = await respuesta.json();
    const propiedades = json.entities[id].claims;

    // En Wikidata cada dato tiene un código:
    //   P1477 = nombre real        P569 = fecha de nacimiento
    //   P19   = lugar de nacimiento P27  = país (nacionalidad; puede tener varios)
    //   P2031 = inicio de su carrera
    const nombreReal = leerValores(propiedades, "P1477")[0];
    const fecha = leerValores(propiedades, "P569")[0];
    const lugar = leerValores(propiedades, "P19")[0];
    const paises = leerValores(propiedades, "P27"); // ej: Shakira es de Colombia y España
    const inicio = leerValores(propiedades, "P2031")[0];

    if (nombreReal) {
      datos.nombreReal = nombreReal.text;
    }
    if (fecha) {
      // La fecha llega así: "+1977-02-02T00:00:00Z". Tomamos "1977-02-02".
      datos.nacimiento = formatearFecha(fecha.time.substring(1, 11));
    }
    if (inicio) {
      // Solo nos interesa el año: "+1990-01-01T..." -> "1990"
      datos.activoDesde = inicio.time.substring(1, 5);
    }

    // El lugar y los países llegan como códigos (ej: "Q2979"); hay que pedir sus nombres.
    const codigos = [];
    if (lugar) codigos.push(lugar.id);
    for (const pais of paises) {
      codigos.push(pais.id);
    }
    const nombres = await pedirNombres(codigos);

    if (lugar) {
      datos.lugar = nombres[lugar.id];
    }
    if (paises.length > 0) {
      // Unimos los nombres con coma: "Colombia, España"
      datos.pais = paises.map(function (pais) { return nombres[pais.id]; }).join(", ");
    }
  } catch (error) {
    console.log("Error con Wikidata:", error);
  }

  return datos;
}

/* Lee todos los valores de una propiedad de Wikidata.
   Devuelve una lista; si el dato no existe, la lista queda vacía. */
function leerValores(propiedades, codigo) {
  const lista = propiedades[codigo] || [];
  const valores = [];
  for (const dato of lista) {
    // Algunos datos están marcados como "desconocidos" y no traen valor.
    if (dato.mainsnak.datavalue) {
      valores.push(dato.mainsnak.datavalue.value);
    }
  }
  return valores;
}

/* Convierte códigos de Wikidata (Q2979...) en nombres en español ("Barranquilla"). */
async function pedirNombres(codigos) {
  const nombres = {};
  if (codigos.length === 0) {
    return nombres;
  }

  const url = "https://www.wikidata.org/w/api.php?action=wbgetentities&props=labels&languages=es|en&format=json&origin=*" +
    "&ids=" + codigos.join("|");
  const respuesta = await fetch(url);
  const json = await respuesta.json();

  for (const codigo of codigos) {
    const etiquetas = json.entities[codigo].labels;
    // Preferimos el nombre en español; si no hay, en inglés.
    const etiqueta = etiquetas.es || etiquetas.en;
    nombres[codigo] = etiqueta ? etiqueta.value : null;
  }
  return nombres;
}


/* ===========================================================
   5. FUNCIONES QUE DIBUJAN LAS TARJETAS EN LA PÁGINA
   Usamos "plantillas de texto" (texto entre comillas invertidas `...`)
   donde ${variable} se reemplaza por su valor.
   =========================================================== */

/* Tarjeta 1: foto grande, nombre y descripción corta */
function mostrarPerfil(nombreBuscado, wikipedia, canciones) {
  // Nombre: el de Wikipedia, o el de iTunes, o lo que escribió la persona.
  let nombre = nombreBuscado;
  if (wikipedia !== null) {
    nombre = wikipedia.title;
  } else if (canciones.length > 0) {
    nombre = canciones[0].artistName;
  }

  // Descripción corta (ej: "cantante colombiana").
  let descripcion = "";
  if (wikipedia !== null && wikipedia.description) {
    descripcion = wikipedia.description;
  }

  // Foto: la de Wikipedia; si no hay, la portada de su primera canción.
  let foto = "";
  if (wikipedia !== null && wikipedia.thumbnail) {
    foto = fotoGrande(wikipedia);
  } else if (canciones.length > 0) {
    foto = portadaGrande(canciones[0].artworkUrl100, 600);
  }

  let html = "";
  if (foto !== "") {
    html += `<img class="foto-cantante" src="${foto}" alt="Foto de ${escapar(nombre)}">`;
  }
  html += `
    <div>
      <h2 class="nombre-cantante">${escapar(nombre)}</h2>
      <p class="descripcion-cantante">${escapar(primeraMayuscula(descripcion))}</p>
    </div>`;

  tarjetaPerfil.innerHTML = html;
}

/* Tarjeta 2: biografía de Wikipedia con enlace al artículo completo */
function mostrarBiografia(wikipedia) {
  if (wikipedia === null) {
    return; // sin Wikipedia no hay biografía (la tarjeta queda oculta)
  }

  const enlace = wikipedia.content_urls.desktop.page;
  const aviso = wikipedia.idioma === "en"
    ? `<p class="sin-vista-previa">No encontramos el artículo en español; este resumen está en inglés.</p>`
    : "";

  tarjetaBiografia.innerHTML = `
    <h2>📖 Biografía</h2>
    <p>${escapar(wikipedia.extract)}</p>
    ${aviso}
    <a class="enlace-boton" href="${enlace}" target="_blank" rel="noopener">Ver más en Wikipedia</a>`;
}

/* Tarjeta 3: datos rápidos (solo los que existan) */
function mostrarDatos(datos, canciones) {
  // Armamos una lista de [nombre del dato, valor].
  const filas = [];

  const genero = generoPrincipal(canciones);
  if (datos.nombreReal) filas.push(["🪪 Nombre real", datos.nombreReal]);
  if (genero) filas.push(["🎵 Género musical", genero]);
  if (datos.pais) filas.push(["🌎 País", datos.pais]);
  if (datos.lugar) filas.push(["📍 Lugar de nacimiento", datos.lugar]);
  if (datos.nacimiento) filas.push(["🎂 Fecha de nacimiento", datos.nacimiento]);
  if (datos.activoDesde) filas.push(["🎤 Activo desde", datos.activoDesde]);

  if (filas.length === 0) {
    return; // nada que mostrar
  }

  let html = `<h2>⚡ Datos rápidos</h2><ul class="lista-datos">`;
  for (const fila of filas) {
    html += `<li><strong>${fila[0]}</strong><span>${escapar(String(fila[1]))}</span></li>`;
  }
  html += `</ul>`;

  tarjetaDatos.innerHTML = html;
}

/* Tarjeta 4: canciones populares con portada y vista previa */
function mostrarCanciones(canciones) {
  if (canciones.length === 0) {
    tarjetaCanciones.innerHTML = `
      <h2>🎧 Canciones populares</h2>
      <p class="sin-vista-previa">No pudimos cargar sus canciones en este momento.</p>`;
    return;
  }

  let html = `<h2>🎧 Canciones populares <small>(según iTunes)</small></h2><div class="lista-canciones">`;

  for (const cancion of canciones) {
    const anio = cancion.releaseDate ? cancion.releaseDate.substring(0, 4) : "";

    // Si iTunes tiene un fragmento de 30 segundos, ponemos un reproductor.
    // preload="none" evita descargar el audio hasta que se presione "play".
    const reproductor = cancion.previewUrl
      ? `<audio controls preload="none" src="${cancion.previewUrl}"></audio>`
      : `<p class="sin-vista-previa">Vista previa no disponible</p>`;

    html += `
      <div class="cancion">
        <img class="portada" src="${portadaGrande(cancion.artworkUrl100, 200)}"
             alt="Portada de ${escapar(cancion.collectionName)}" loading="lazy">
        <div class="info-cancion">
          <p class="nombre-cancion">${escapar(cancion.trackName)}</p>
          <p class="detalle-cancion">${escapar(cancion.collectionName)} · ${anio}</p>
          ${reproductor}
        </div>
      </div>`;
  }

  html += `</div>`;
  tarjetaCanciones.innerHTML = html;
}


/* ===========================================================
   6. FUNCIONES DE AYUDA (pequeñas tareas que se repiten)
   =========================================================== */

/* Vacía las 4 tarjetas antes de una nueva búsqueda. */
function limpiarTarjetas() {
  tarjetaPerfil.innerHTML = "";
  tarjetaBiografia.innerHTML = "";
  tarjetaDatos.innerHTML = "";
  tarjetaCanciones.innerHTML = "";
}

/* Por seguridad, convierte símbolos como < y > en texto normal,
   para que lo que llega de internet nunca se ejecute como código. */
function escapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto || "";
  return div.innerHTML;
}

/* Quita tildes y pasa a minúsculas: "Óscar" -> "oscar". Sirve para comparar nombres. */
function sinTildes(texto) {
  return (texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/* Pone la primera letra en mayúscula: "cantante colombiana" -> "Cantante colombiana". */
function primeraMayuscula(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/* Convierte "1977-02-02" en "2 de febrero de 1977". */
function formatearFecha(textoFecha) {
  const fecha = new Date(textoFecha + "T00:00:00Z");
  return fecha.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/* iTunes da portadas de 100x100; cambiando el número en la dirección
   pedimos una versión más grande y nítida. */
function portadaGrande(urlPortada, tamano) {
  return urlPortada.replace("100x100", tamano + "x" + tamano);
}

/* Wikipedia da una foto pequeña (330 px); pedimos una de 500 px de ancho
   para que se vea nítida (o la original si es más pequeña).
   OJO: Wikimedia solo acepta ciertos anchos (330, 500, 960...);
   con otros números, como 800, la imagen no carga. */
function fotoGrande(wikipedia) {
  const anchoOriginal = wikipedia.originalimage ? wikipedia.originalimage.width : 0;
  if (anchoOriginal > 0 && anchoOriginal <= 500) {
    return wikipedia.originalimage.source;
  }
  // La miniatura tiene en su dirección algo como "/330px-"; lo cambiamos por "/500px-".
  return wikipedia.thumbnail.source.replace(/\/\d+px-/, "/500px-");
}

/* El género que más se repite entre sus canciones. */
function generoPrincipal(canciones) {
  const conteo = {}; // ej: { "Pop Latino": 3, "Pop": 2 }
  let mejor = null;
  for (const cancion of canciones) {
    const genero = cancion.primaryGenreName;
    if (!genero) continue;
    conteo[genero] = (conteo[genero] || 0) + 1;
    if (mejor === null || conteo[genero] > conteo[mejor]) {
      mejor = genero;
    }
  }
  return mejor;
}


/* ===========================================================
   7. DETALLES FINALES
   =========================================================== */

/* Si un audio empieza a sonar, pausamos los demás para que no suenen al tiempo. */
document.addEventListener("play", function (evento) {
  const audios = document.querySelectorAll("audio");
  for (const audio of audios) {
    if (audio !== evento.target) {
      audio.pause();
    }
  }
}, true);

/* Si la página se abre con un nombre en la dirección (ej: ...?q=Shakira),
   buscamos automáticamente. Así se pueden compartir enlaces de búsqueda. */
const parametros = new URLSearchParams(window.location.search);
const busquedaInicial = parametros.get("q");
if (busquedaInicial) {
  cajaBusqueda.value = busquedaInicial;
  buscarCantante(busquedaInicial);
}
