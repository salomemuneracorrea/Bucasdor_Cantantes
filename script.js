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
  // Cada función devuelve "null" (o una lista vacía) si falla,
  // así que una no rompe a la otra.
  // OJO: buscarEnWikipedia solo devuelve artículos de MÚSICOS o BANDAS;
  // si encuentra, por ejemplo, a un futbolista, lo descarta.
  const [wikipedia, canciones] = await Promise.all([
    buscarEnWikipedia(nombre),
    buscarCanciones(nombre),
  ]);

  // Si ninguna de las dos encontró algo, mostramos un mensaje amable.
  if (wikipedia === null && canciones.length === 0) {
    mensaje.textContent = "No encontramos a ese cantante, revisa cómo lo escribiste 🙂";
    return; // "return" termina la función aquí
  }

  // Los datos rápidos necesitan la información de Wikidata que ya trajimos.
  const datos = await buscarDatosRapidos(wikipedia);

  // Ya tenemos todo: quitamos "Buscando..." y dibujamos las tarjetas.
  // Si solo encontramos canciones (iTunes) pero no su artículo en Wikipedia,
  // dejamos un aviso corto en lugar de mostrar información equivocada.
  if (wikipedia === null) {
    mensaje.textContent = "ℹ️ No encontramos la biografía de este artista.";
  } else {
    mensaje.textContent = "";
  }
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
   Solo aceptamos artículos de músicos o bandas. El orden de búsqueda es:
     1. El artículo que mejor coincide con el nombre, en español.
     2. Búsquedas alternativas en español: "NOMBRE cantante", "NOMBRE rapero"...
     3. Lo mismo en inglés ("NOMBRE singer", "NOMBRE rapper"...).
   Nos quedamos con el PRIMER artículo que sí sea de música.
   Ejemplo: "Pirlo" encuentra primero al futbolista Andrea Pirlo; como no es
   músico, lo descartamos y seguimos buscando. */

// Palabras que usamos para buscar alternativas en cada idioma.
const PALABRAS_ALTERNATIVAS = {
  es: ["cantante", "rapero", "músico", "banda"],
  en: ["singer", "rapper", "musician", "band"],
};

async function buscarEnWikipedia(nombre) {
  const idiomas = ["es", "en"];

  for (const idioma of idiomas) {
    // "try / catch": si algo falla dentro del "try", saltamos al "catch"
    // en vez de que la página se rompa.
    try {
      // 1. El artículo que mejor coincide con lo escrito (así "shakira" encuentra "Shakira").
      const titulo = await buscarTituloWikipedia(nombre, idioma);
      if (titulo !== null) {
        const resumen = await probarArticulo(titulo, idioma, nombre);
        if (resumen !== null) {
          return resumen; // ¡encontramos un artículo de música!
        }
      }

      // 2. Si no era de música, probamos las búsquedas alternativas.
      const resumen = await buscarAlternativas(nombre, idioma);
      if (resumen !== null) {
        return resumen;
      }
    } catch (error) {
      console.log("Error con Wikipedia (" + idioma + "):", error);
    }
  }

  return null; // no encontramos ningún artículo de música en ningún idioma
}

/* Busca "NOMBRE cantante", "NOMBRE rapero", etc. con el buscador de Wikipedia
   y prueba cada resultado hasta encontrar uno que sea de música. */
async function buscarAlternativas(nombre, idioma) {
  const yaProbados = []; // para no revisar dos veces el mismo artículo

  for (const palabra of PALABRAS_ALTERNATIVAS[idioma]) {
    const url = "https://" + idioma + ".wikipedia.org/w/api.php" +
      "?action=query&list=search&srlimit=5&format=json&origin=*" +
      "&srsearch=" + encodeURIComponent(nombre + " " + palabra);
    const respuesta = await fetch(url);
    const datos = await respuesta.json();

    for (const resultado of datos.query.search) {
      const titulo = resultado.title;
      if (yaProbados.includes(titulo)) {
        continue;
      }
      yaProbados.push(titulo);

      const resumen = await probarArticulo(titulo, idioma, nombre);
      if (resumen !== null) {
        return resumen;
      }
    }
  }
  return null;
}

/* Revisa UN artículo: devuelve su resumen si es de un músico o banda,
   o "null" si no sirve. */
async function probarArticulo(titulo, idioma, nombre) {
  // El título debe contener el nombre buscado como PALABRA COMPLETA. Así:
  //  - al buscar "Pirlo rapero" no aceptamos el artículo de OTRO rapero ("Blessd");
  //  - al buscar "Messi" no aceptamos a la cantante "Danielle Messia".
  if (!contienePalabras(titulo, nombre)) {
    return null;
  }

  let resumen = await pedirResumen(titulo, idioma);

  // Si es una página de desambiguación ("Juanes puede referirse a..."),
  // probamos con el mismo nombre + "(cantante)" o "(singer)".
  if (resumen !== null && resumen.type === "disambiguation") {
    const extra = idioma === "es" ? " (cantante)" : " (singer)";
    resumen = await pedirResumen(titulo + extra, idioma);
  }

  // Tiene que ser un artículo normal y tener su código de Wikidata.
  if (resumen === null || resumen.type !== "standard" || !resumen.wikibase_item) {
    return null;
  }

  // Revisamos en Wikidata si es del mundo de la música.
  const propiedades = await pedirPropiedades(resumen.wikibase_item);
  if (!(await esArtistaMusical(propiedades))) {
    return null; // ej: un futbolista o un actor
  }

  resumen.idioma = idioma;           // recordamos en qué idioma lo encontramos
  resumen.propiedades = propiedades; // y guardamos sus datos de Wikidata para después
  return resumen;
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

    // Nos quedamos SOLO con las canciones de ese artista (o en las que colabora).
    // Si no queda ninguna, devolvemos una lista vacía: es mejor no mostrar
    // canciones que mostrar las de otro artista.
    const canciones = datos.results.filter(function (cancion) {
      return coincideArtista(cancion.artistName, nombre);
    });

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
    // Ya pedimos estos datos al revisar si era músico (en probarArticulo).
    const propiedades = wikipedia.propiedades;

    // En Wikidata cada dato tiene un código:
    //   P1477 = nombre real        P569 = fecha de nacimiento
    //   P19   = lugar de nacimiento P27  = país (nacionalidad; puede tener varios)
    //   P2031 = inicio de su carrera
    const nombreReal = leerValores(propiedades, "P1477")[0];
    const fecha = leerValores(propiedades, "P569")[0];
    const lugar = leerValores(propiedades, "P19")[0];
    // País: para personas es su nacionalidad (P27; Shakira es de Colombia y España).
    // Las bandas no tienen nacionalidad, sino "país de origen" (P495).
    let paises = leerValores(propiedades, "P27");
    if (paises.length === 0) {
      paises = leerValores(propiedades, "P495");
    }
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

/* Pide a Wikidata todos los datos ("propiedades") de un artista o banda.
   Ejemplo de código: "Q34424" es Shakira. */
async function pedirPropiedades(codigo) {
  const url = "https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims&format=json&origin=*" +
    "&ids=" + codigo;
  const respuesta = await fetch(url);
  const json = await respuesta.json();
  return json.entities[codigo].claims;
}

/* Palabras que indican que algo es del mundo de la música.
   Las escribimos sin tildes y en minúscula, en español y en inglés. */
const PALABRAS_MUSICALES = [
  "cantante", "cantautor", "cantautora", "singer", "songwriter", "vocalista", "vocalist",
  "musico", "musica", "musical", "musician", "music",
  "rapero", "rapera", "rapper", "trapero",
  "compositor", "compositora", "composer",
  "dj", "disc jockey", "productor discografico", "record producer",
  "banda", "band", "duo", "trio", "orquesta", "orchestra", "grupo de rock", "boy band", "girl group",
  "guitarrista", "guitarist", "pianista", "pianist", "baterista", "drummer", "bajista", "bassist",
];

/* ¿Es un artista musical? Revisamos dos datos de Wikidata:
     P106 = ocupación    (ej: "cantante", "rapero", "futbolista")
     P31  = qué tipo de cosa es (ej: "grupo de rock", "ser humano")
   Leemos el NOMBRE de cada ocupación/tipo y vemos si contiene alguna
   palabra musical. Así también funciona con "cantante de pop" o
   "grupo de rock", sin tener que conocer todos los códigos. */
async function esArtistaMusical(propiedades) {
  const codigos = [];
  for (const valor of leerValores(propiedades, "P106").concat(leerValores(propiedades, "P31"))) {
    codigos.push(valor.id);
  }
  if (codigos.length === 0) {
    return false;
  }

  // Pedimos los nombres en español y en inglés de esos códigos.
  const url = "https://www.wikidata.org/w/api.php?action=wbgetentities&props=labels&languages=es|en&format=json&origin=*" +
    "&ids=" + codigos.slice(0, 50).join("|"); // Wikidata acepta máximo 50 a la vez
  const respuesta = await fetch(url);
  const json = await respuesta.json();

  for (const codigo in json.entities) {
    const etiquetas = json.entities[codigo].labels || {};
    for (const idioma in etiquetas) {
      // Comparamos palabras completas: "band" no debe coincidir con "husband".
      for (const palabra of PALABRAS_MUSICALES) {
        if (contienePalabras(etiquetas[idioma].value, palabra)) {
          return true;
        }
      }
    }
  }
  return false;
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
  } else {
    // Sin Wikipedia, tomamos el nombre tal como lo escribe iTunes, pero solo
    // de una canción donde el artista esté SOLO (no "Feid & Pirlo").
    for (const cancion of canciones) {
      if (sinTildes(cancion.artistName) === sinTildes(nombreBuscado)) {
        nombre = cancion.artistName;
        break; // "break" sale del ciclo: ya lo encontramos
      }
    }
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

/* ¿El "texto" contiene la "búsqueda" como palabras completas?
   Ejemplos: ("Andrea Pirlo", "pirlo") -> sí
             ("Danielle Messia", "messi") -> no (es parte de otra palabra)
   Truco: dejamos solo letras y números separados por un espacio y
   ponemos espacios a los lados, así " messi " no aparece en " danielle messia ". */
function contienePalabras(texto, busqueda) {
  const limpiar = function (t) {
    return " " + sinTildes(t).replace(/[^a-z0-9]+/g, " ").trim() + " ";
  };
  return limpiar(texto).includes(limpiar(busqueda));
}

/* ¿El artista de una canción de iTunes es el que buscamos?
   iTunes escribe las colaboraciones así: "Feid, El Americano 4KT & Pirlo".
   Separamos por comas, "&", "feat", " x " e " y ", y el nombre buscado
   debe ser EXACTAMENTE uno de los artistas.
   Así "Queen" coincide con "Queen" pero NO con "Queen Latifah". */
function coincideArtista(nombreArtista, nombreBuscado) {
  const buscado = sinTildes(nombreBuscado).trim();
  const artistas = sinTildes(nombreArtista).split(/,|&|\bfeat\.?|\bft\.?|\sx\s|\sy\s|\sand\s/);
  for (const artista of artistas) {
    if (artista.trim() === buscado) {
      return true;
    }
  }
  return false;
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
