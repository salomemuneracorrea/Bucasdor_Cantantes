/* ===========================================================
   BUSCADOR DE CANTANTES - Lógica (script.js)

   ¿Qué hace este archivo?
   1. Espera a que la persona escriba un nombre y presione "Buscar" (o Enter).
   2. Pide información a internet usando 3 "APIs" gratuitas:
        - Wikipedia: foto, descripción y biografía (introducción completa).
        - Wikidata:  datos personales, carrera (géneros, instrumentos,
                     discográficas), premios y redes sociales.
        - iTunes:    canciones, álbumes, portadas y vista previa de audio.
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
const tarjetaCarrera = document.getElementById("tarjeta-carrera");
const tarjetaPremios = document.getElementById("tarjeta-premios");
const tarjetaRedes = document.getElementById("tarjeta-redes");
const tarjetaCanciones = document.getElementById("tarjeta-canciones");
const tarjetaAlbumes = document.getElementById("tarjeta-albumes");


/* -----------------------------------------------------------
   2. CUANDO SE ENVÍA EL FORMULARIO (clic en "Buscar" o Enter)
   ----------------------------------------------------------- */
formulario.addEventListener("submit", function (evento) {
  // Por defecto un formulario recarga la página; esto lo evita.
  evento.preventDefault();

  // .trim() quita los espacios sobrantes al inicio y al final, y
  // .replace deja un solo espacio entre palabras ("dario   gomez" -> "dario gomez").
  // Las tildes y las mayúsculas no importan: al comparar nombres usamos
  // sinTildes(), así "dario gomez" encuentra a "Darío Gómez".
  const nombre = cajaBusqueda.value.trim().replace(/\s+/g, " ");

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

  // Con lo anterior pedimos, otra vez al mismo tiempo, el resto:
  //  - los datos de Wikidata (personales, carrera, premios y redes),
  //  - la introducción completa de Wikipedia (varios párrafos),
  //  - los álbumes de iTunes.
  const [datos, introduccion, albumes] = await Promise.all([
    buscarDatosWikidata(wikipedia),
    buscarIntroduccion(wikipedia),
    buscarAlbumes(nombre),
  ]);

  // Ya tenemos todo: quitamos "Buscando..." y dibujamos las tarjetas.
  // Si solo encontramos canciones (iTunes) pero no su artículo en Wikipedia,
  // dejamos un aviso corto en lugar de mostrar información equivocada.
  if (wikipedia === null) {
    mensaje.textContent = "ℹ️ No encontramos la biografía de este artista.";
  } else {
    mensaje.textContent = "";
  }
  mostrarPerfil(nombre, wikipedia, canciones);
  mostrarBiografia(wikipedia, introduccion);
  mostrarDatosPersonales(datos);
  mostrarCarrera(datos, canciones);
  mostrarPremios(datos);
  mostrarRedes(datos);
  mostrarCanciones(canciones);
  mostrarAlbumes(albumes);
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

/* --- Wikidata: datos personales, carrera, premios y redes ---
   Wikipedia nos da un código como "Q34424" (wikibase_item) que
   identifica al cantante en Wikidata, una enorme base de datos libre.
   Cada dato tiene su propio código ("propiedad"):
     P1477 = nombre real             P569 = fecha de nacimiento
     P19   = lugar de nacimiento     P570 = fecha de fallecimiento
     P27   = nacionalidad (puede tener varias)
     P495  = país de origen (para bandas, que no tienen nacionalidad)
     P136  = géneros musicales       P1303 = instrumentos
     P264  = discográficas           P2031 = año en que empezó su carrera
     P166  = premios recibidos
     P2003 = Instagram  P2397 = YouTube  P1902 = Spotify               */
async function buscarDatosWikidata(wikipedia) {
  const datos = {}; // aquí guardaremos lo que encontremos

  if (wikipedia === null || !wikipedia.wikibase_item) {
    return datos;
  }

  try {
    // Ya pedimos estos datos al revisar si era músico (en probarArticulo).
    const propiedades = wikipedia.propiedades;

    // --- Datos que son texto o fechas (se leen directamente) ---
    const nombreReal = leerValores(propiedades, "P1477")[0];
    if (nombreReal) {
      // Un nombre no lleva números. Wikidata a veces trae datos de más
      // (por ejemplo, un número de teléfono pegado al nombre): los quitamos.
      const limpio = nombreReal.text.replace(/[0-9]+/g, "").replace(/\s+/g, " ").trim();
      if (limpio !== "") {
        datos.nombreReal = limpio;
      }
    }

    const nacimiento = leerFecha(leerValores(propiedades, "P569")[0]);
    const fallecimiento = leerFecha(leerValores(propiedades, "P570")[0]);
    if (nacimiento) {
      datos.nacimiento = nacimiento.texto;
      // Edad: hasta hoy, o hasta la fecha en que falleció.
      const edad = calcularEdad(nacimiento, fallecimiento);
      if (edad !== null) {
        datos.edad = edad;
      }
    }
    if (fallecimiento) {
      datos.fallecimiento = fallecimiento.texto;
    }

    const inicio = leerValores(propiedades, "P2031")[0];
    if (inicio) {
      // Solo nos interesa el año: "+1990-01-01T..." -> "1990"
      datos.activoDesde = inicio.time.substring(1, 5);
    }

    // --- Redes sociales: Wikidata guarda el usuario o el código; armamos el enlace ---
    datos.redes = [];
    const instagram = leerValores(propiedades, "P2003")[0];
    const youtube = leerValores(propiedades, "P2397")[0];
    const spotify = leerValores(propiedades, "P1902")[0];
    if (instagram) datos.redes.push({ nombre: "Instagram", icono: "📸", url: "https://www.instagram.com/" + instagram + "/" });
    if (youtube) datos.redes.push({ nombre: "YouTube", icono: "▶️", url: "https://www.youtube.com/channel/" + youtube });
    if (spotify) datos.redes.push({ nombre: "Spotify", icono: "🎧", url: "https://open.spotify.com/artist/" + spotify });

    // --- Datos que son OTROS elementos de Wikidata (llegan como códigos Q) ---
    // Primero juntamos todos los códigos y pedimos sus nombres en español
    // de una sola vez; después los usamos para cada dato.
    const lugar = leerValores(propiedades, "P19")[0];
    let paises = leerValores(propiedades, "P27");
    datos.etiquetaPais = "🌎 Nacionalidad";
    if (paises.length === 0) {
      paises = leerValores(propiedades, "P495"); // bandas: país de origen
      datos.etiquetaPais = "🌎 País de origen";
    }
    const generos = leerValores(propiedades, "P136");
    const instrumentos = leerValores(propiedades, "P1303");
    const discograficas = leerValores(propiedades, "P264");
    const premios = leerPremios(propiedades);

    const codigos = [];
    for (const valor of [lugar].concat(paises, generos, instrumentos, discograficas)) {
      if (valor && valor.id) codigos.push(valor.id);
    }
    for (const premio of premios) {
      codigos.push(premio.id);
    }
    const nombres = await pedirNombres(codigos);

    // Convierte una lista de valores en una lista de nombres, sin vacíos ni repetidos.
    const aNombres = function (valores) {
      const lista = [];
      for (const valor of valores) {
        const texto = nombres[valor.id];
        if (texto && !lista.includes(texto)) {
          lista.push(texto);
        }
      }
      return lista;
    };

    if (lugar) {
      datos.lugar = nombres[lugar.id];
    }
    datos.paises = aNombres(paises);
    datos.generos = aNombres(generos).map(primeraMayuscula);
    datos.instrumentos = aNombres(instrumentos).map(primeraMayuscula);
    datos.discograficas = aNombres(discograficas);
    datos.premios = elegirPremios(premios, nombres);
  } catch (error) {
    console.log("Error con Wikidata:", error);
  }

  return datos;
}

/* Lee los premios (P166) con el año en que los recibió, si Wikidata lo tiene
   (dato extra "P585 = fecha" dentro de cada premio). */
function leerPremios(propiedades) {
  const premios = [];
  for (const dato of propiedades.P166 || []) {
    if (!dato.mainsnak.datavalue) continue;
    const premio = { id: dato.mainsnak.datavalue.value.id, anio: null };
    const fechas = (dato.qualifiers && dato.qualifiers.P585) || [];
    if (fechas[0] && fechas[0].datavalue) {
      premio.anio = fechas[0].datavalue.value.time.substring(1, 5);
    }
    premios.push(premio);
  }
  return premios;
}

/* Palabras de los premios más conocidos: estos se muestran primero. */
const PREMIOS_IMPORTANTES = ["grammy", "billboard", "mtv", "lo nuestro", "american music", "globo de oro", "oscar", "salon de la fama"];

/* Escoge hasta 5 premios: primero los más conocidos (Grammy, Billboard...),
   luego el resto. Si un premio se repite en varios años, sale una sola vez
   con sus años juntos: "Premio Grammy (2001, 2006)". */
function elegirPremios(premios, nombres) {
  const porNombre = {}; // ej: { "Premio Grammy": ["2001", "2006"] }
  const orden = [];
  for (const premio of premios) {
    // Algunos nombres vienen de páginas de listas ("Anexo:Premio Grammy...")
    // o en minúscula ("premio Grammy..."): los dejamos limpios.
    let nombre = nombres[premio.id];
    if (!nombre) continue;
    nombre = primeraMayuscula(nombre.replace(/^(Anexo|Annex):/, "").trim());
    if (!porNombre[nombre]) {
      porNombre[nombre] = [];
      orden.push(nombre);
    }
    if (premio.anio && !porNombre[nombre].includes(premio.anio)) {
      porNombre[nombre].push(premio.anio);
    }
  }

  const esImportante = function (nombre) {
    return PREMIOS_IMPORTANTES.some(function (palabra) { return sinTildes(nombre).includes(palabra); });
  };
  const ordenados = orden.filter(esImportante).concat(orden.filter(function (n) { return !esImportante(n); }));

  return ordenados.slice(0, 5).map(function (nombre) {
    const anios = porNombre[nombre].sort();
    return anios.length > 0 ? nombre + " (" + anios.join(", ") + ")" : nombre;
  });
}

/* Convierte una fecha de Wikidata en texto. Llega así:
   { time: "+1977-02-02T00:00:00Z", precision: 11 }
   "precision" dice qué tan exacta es: 11 = día, 10 = mes, 9 = solo el año. */
function leerFecha(valor) {
  if (!valor || !valor.time) {
    return null;
  }
  const anio = Number(valor.time.substring(1, 5));
  const mes = Number(valor.time.substring(6, 8));
  const dia = Number(valor.time.substring(9, 11));

  if (valor.precision >= 11) {
    return { anio: anio, mes: mes, dia: dia, texto: formatearFecha(valor.time.substring(1, 11)) };
  }
  // Si solo se sabe el año, mostramos solo el año.
  return { anio: anio, mes: null, dia: null, texto: String(anio) };
}

/* Edad en años: hasta hoy, o hasta la fecha de fallecimiento.
   Solo la calculamos si sabemos el día exacto de nacimiento. */
function calcularEdad(nacimiento, fallecimiento) {
  if (nacimiento.dia === null) {
    return null;
  }
  let hasta;
  if (fallecimiento) {
    if (fallecimiento.dia === null) return null;
    hasta = fallecimiento;
  } else {
    const hoy = new Date();
    hasta = { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1, dia: hoy.getDate() };
  }
  let edad = hasta.anio - nacimiento.anio;
  // Si este año todavía no ha llegado su cumpleaños, restamos uno.
  if (hasta.mes < nacimiento.mes || (hasta.mes === nacimiento.mes && hasta.dia < nacimiento.dia)) {
    edad = edad - 1;
  }
  return edad;
}

/* --- Wikipedia: introducción completa (varios párrafos) ---
   El resumen corto solo trae un párrafo. Con "prop=extracts&exintro"
   Wikipedia devuelve TODA la introducción del artículo, y con
   "explaintext" la devuelve como texto normal (sin código HTML).
   Devuelve una lista de párrafos, o una lista vacía si falla. */
async function buscarIntroduccion(wikipedia) {
  if (wikipedia === null) {
    return [];
  }
  try {
    const titulo = wikipedia.titles ? wikipedia.titles.canonical : wikipedia.title;
    const url = "https://" + wikipedia.idioma + ".wikipedia.org/w/api.php" +
      "?action=query&prop=extracts&exintro&explaintext&redirects=1&format=json&origin=*" +
      "&titles=" + encodeURIComponent(titulo.replaceAll("_", " "));
    const respuesta = await fetch(url);
    const datos = await respuesta.json();

    // La respuesta trae las páginas con su número como clave: { "4715": { extract: "..." } }
    const paginas = Object.values(datos.query.pages);
    const texto = paginas[0].extract || "";

    // Cada salto de línea separa un párrafo. Quitamos los vacíos y los
    // caracteres invisibles que a veces deja Wikipedia ("​").
    return texto.split("\n")
      .map(function (parrafo) { return parrafo.replace(/​/g, "").trim(); })
      .filter(function (parrafo) { return parrafo !== ""; });
  } catch (error) {
    console.log("Error con la introducción de Wikipedia:", error);
    return [];
  }
}

/* --- iTunes: álbumes del artista ---
   1. Buscamos al artista en iTunes y nos quedamos con el que se llama
      EXACTAMENTE igual (sin importar tildes ni mayúsculas).
   2. Con su número de artista (artistId) pedimos sus álbumes.
   Así no salen álbumes de otro artista con un nombre parecido. */
async function buscarAlbumes(nombre) {
  try {
    const urlArtista = "https://itunes.apple.com/search?entity=musicArtist&limit=10" +
      "&term=" + encodeURIComponent(nombre);
    const artistas = (await (await fetch(urlArtista)).json()).results;
    const artista = artistas.find(function (a) { return sinTildes(a.artistName) === sinTildes(nombre); });
    if (!artista) {
      return [];
    }

    const urlAlbumes = "https://itunes.apple.com/lookup?entity=album&limit=60&id=" + artista.artistId;
    const resultados = (await (await fetch(urlAlbumes)).json()).results;

    // El primer resultado es el artista; los demás, sus álbumes.
    // Quitamos los sencillos (" - Single") y los álbumes repetidos
    // (ej: "Fijación Oral, Vol. 1" y "Fijación Oral, Vol. 1 (Deluxe)").
    const vistos = [];
    const albumes = [];
    for (const album of resultados) {
      if (album.wrapperType !== "collection" || / - Single$/.test(album.collectionName)) {
        continue;
      }
      const clave = sinTildes(album.collectionName.replace(/\(.*?\)|\[.*?\]| - EP$/g, "")).trim();
      if (!vistos.includes(clave)) {
        vistos.push(clave);
        albumes.push(album);
      }
    }

    // Del más nuevo al más antiguo, y solo 6.
    albumes.sort(function (a, b) { return (b.releaseDate || "").localeCompare(a.releaseDate || ""); });
    return albumes.slice(0, 6);
  } catch (error) {
    console.log("Error con los álbumes de iTunes:", error);
    return [];
  }
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

  // Quitamos códigos repetidos. Wikidata acepta máximo 50 por consulta,
  // así que si hay más (ej: muchos premios) los pedimos por grupos.
  const unicos = [...new Set(codigos)];
  for (let i = 0; i < unicos.length; i += 50) {
    const grupo = unicos.slice(i, i + 50);
    const url = "https://www.wikidata.org/w/api.php?action=wbgetentities&props=labels&languages=es|en&format=json&origin=*" +
      "&ids=" + grupo.join("|");
    const respuesta = await fetch(url);
    const json = await respuesta.json();

    for (const codigo of grupo) {
      const etiquetas = (json.entities[codigo] && json.entities[codigo].labels) || {};
      // Preferimos el nombre en español; si no hay, en inglés.
      const etiqueta = etiquetas.es || etiquetas.en;
      nombres[codigo] = etiqueta ? etiqueta.value : null;
    }
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

/* Tarjeta 2: biografía (introducción completa de Wikipedia) con enlace al artículo */
function mostrarBiografia(wikipedia, introduccion) {
  if (wikipedia === null) {
    return; // sin Wikipedia no hay biografía (la tarjeta queda oculta)
  }

  // Si no llegó la introducción completa, usamos el resumen corto.
  const parrafos = introduccion.length > 0 ? introduccion : [wikipedia.extract];

  const enlace = wikipedia.content_urls.desktop.page;
  const aviso = wikipedia.idioma === "en"
    ? `<p class="sin-vista-previa">No encontramos el artículo en español; esta biografía está en inglés.</p>`
    : "";

  // Para que no quede tan larga, mostramos solo los primeros párrafos.
  // El resto queda escondido y aparece con el botón "Leer más".
  const PARRAFOS_VISIBLES = 2;
  const visibles = parrafos.slice(0, PARRAFOS_VISIBLES);
  const ocultos = parrafos.slice(PARRAFOS_VISIBLES);

  let html = `<h2>📖 Biografía</h2>`;
  for (const parrafo of visibles) {
    html += `<p>${escapar(parrafo)}</p>`;
  }
  if (ocultos.length > 0) {
    html += `<div id="biografia-resto" hidden>`;
    for (const parrafo of ocultos) {
      html += `<p>${escapar(parrafo)}</p>`;
    }
    html += `</div>
      <button type="button" id="boton-leer-mas" class="boton-leer-mas">Leer más ▾</button>`;
  }
  html += `${aviso}
    <a class="enlace-boton" href="${enlace}" target="_blank" rel="noopener">Ver más en Wikipedia</a>`;

  tarjetaBiografia.innerHTML = html;

  // El botón muestra u oculta los párrafos escondidos.
  const boton = document.getElementById("boton-leer-mas");
  if (boton) {
    boton.addEventListener("click", function () {
      const resto = document.getElementById("biografia-resto");
      resto.hidden = !resto.hidden;
      boton.textContent = resto.hidden ? "Leer más ▾" : "Leer menos ▴";
    });
  }
}

/* Tarjeta 3: datos personales (solo los que existan) */
function mostrarDatosPersonales(datos) {
  // Armamos una lista de [nombre del dato, valor].
  const filas = [];

  if (datos.nombreReal) filas.push(["🪪 Nombre real", datos.nombreReal]);
  if (datos.nacimiento) {
    // Si sigue vivo, mostramos su edad junto a la fecha.
    const edad = datos.edad !== undefined && !datos.fallecimiento ? " (" + datos.edad + " años)" : "";
    filas.push(["🎂 Fecha de nacimiento", datos.nacimiento + edad]);
  }
  if (datos.lugar) filas.push(["📍 Lugar de nacimiento", datos.lugar]);
  if (datos.fallecimiento) {
    const edad = datos.edad !== undefined ? " (a los " + datos.edad + " años)" : "";
    filas.push(["🕊️ Fecha de fallecimiento", datos.fallecimiento + edad]);
  }
  if (datos.paises && datos.paises.length > 0) filas.push([datos.etiquetaPais, datos.paises.join(", ")]);

  dibujarLista(tarjetaDatos, "👤 Datos personales", filas);
}

/* Tarjeta 4: carrera musical.
   El género sale de Wikidata (P136), que es más preciso: por ejemplo,
   iTunes pone a Darío Gómez en "Música Mexicana", pero Wikidata dice
   "música popular colombiana". Solo si Wikidata no tiene ningún género
   usamos el de iTunes (el que más se repite entre sus canciones). */
function mostrarCarrera(datos, canciones) {
  const filas = [];

  let generos = datos.generos || [];
  let fuenteGenero = "";
  if (generos.length === 0) {
    const generoITunes = generoPrincipal(canciones);
    if (generoITunes) {
      generos = [generoITunes];
      fuenteGenero = " (según iTunes)";
    }
  }

  if (generos.length > 0) filas.push(["🎵 Géneros" + fuenteGenero, generos.join(", ")]);
  if (datos.instrumentos && datos.instrumentos.length > 0) filas.push(["🎸 Instrumentos", datos.instrumentos.join(", ")]);
  if (datos.discograficas && datos.discograficas.length > 0) filas.push(["💿 Discográficas", datos.discograficas.join(", ")]);
  if (datos.activoDesde) filas.push(["🎤 Activo desde", datos.activoDesde]);

  dibujarLista(tarjetaCarrera, "🎼 Carrera", filas);
}

/* Tarjeta 5: hasta 5 premios */
function mostrarPremios(datos) {
  if (!datos.premios || datos.premios.length === 0) {
    return;
  }
  let html = `<h2>🏆 Premios</h2><ul class="lista-premios">`;
  for (const premio of datos.premios) {
    html += `<li>🏅 ${escapar(premio)}</li>`;
  }
  html += `</ul>`;
  tarjetaPremios.innerHTML = html;
}

/* Tarjeta 6: botones a sus redes (se abren en otra pestaña) */
function mostrarRedes(datos) {
  if (!datos.redes || datos.redes.length === 0) {
    return;
  }
  let html = `<h2>🔗 Redes</h2><div class="lista-redes">`;
  for (const red of datos.redes) {
    html += `<a class="boton-red" href="${escapar(red.url)}" target="_blank" rel="noopener">${red.icono} ${red.nombre}</a>`;
  }
  html += `</div>`;
  tarjetaRedes.innerHTML = html;
}

/* Dibuja una tarjeta con una lista de "dato: valor".
   Si no hay ninguna fila, la tarjeta queda vacía (y oculta). */
function dibujarLista(tarjeta, titulo, filas) {
  if (filas.length === 0) {
    return; // nada que mostrar
  }
  let html = `<h2>${titulo}</h2><ul class="lista-datos">`;
  for (const fila of filas) {
    html += `<li><strong>${fila[0]}</strong><span>${escapar(String(fila[1]))}</span></li>`;
  }
  html += `</ul>`;
  tarjeta.innerHTML = html;
}

/* Tarjeta 7: canciones populares con portada y vista previa */
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

/* Tarjeta 8: álbumes (portada, nombre y año) en cuadrícula */
function mostrarAlbumes(albumes) {
  if (albumes.length === 0) {
    return;
  }
  let html = `<h2>💿 Álbumes <small>(según iTunes)</small></h2><div class="lista-albumes">`;
  for (const album of albumes) {
    const anio = album.releaseDate ? album.releaseDate.substring(0, 4) : "";
    html += `
      <div class="album">
        <img class="portada-album" src="${portadaGrande(album.artworkUrl100, 300)}"
             alt="Portada de ${escapar(album.collectionName)}" loading="lazy">
        <p class="nombre-album">${escapar(album.collectionName)}</p>
        <p class="detalle-cancion">${anio}</p>
      </div>`;
  }
  html += `</div>`;
  tarjetaAlbumes.innerHTML = html;
}


/* ===========================================================
   6. FUNCIONES DE AYUDA (pequeñas tareas que se repiten)
   =========================================================== */

/* Vacía todas las tarjetas antes de una nueva búsqueda. */
function limpiarTarjetas() {
  const tarjetas = [tarjetaPerfil, tarjetaBiografia, tarjetaDatos, tarjetaCarrera,
    tarjetaPremios, tarjetaRedes, tarjetaCanciones, tarjetaAlbumes];
  for (const tarjeta of tarjetas) {
    tarjeta.innerHTML = "";
  }
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
