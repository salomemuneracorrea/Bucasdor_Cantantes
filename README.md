# 🎤 Buscador de Cantantes

Página web para buscar cualquier cantante y ver, en un solo lugar:

- **Foto, nombre y descripción corta.**
- **Biografía:** la introducción completa del artículo de Wikipedia (varios párrafos), con enlace para leer el artículo completo.
- **Datos personales:** nombre real, fecha de nacimiento con su edad, lugar de nacimiento, fecha de fallecimiento (si aplica) y nacionalidad.
- **Carrera:** géneros musicales, instrumentos, discográficas y desde qué año está activo.
- **Premios:** hasta 5, primero los más conocidos (Grammy, Billboard, MTV…), con el año.
- **Redes:** botones a Instagram, YouTube y Spotify.
- **Canciones populares:** 5 canciones con la portada del álbum, el nombre del álbum, el año y una vista previa de audio de 30 segundos.
- **Álbumes:** unos 6 álbumes con portada, nombre y año.

Cada sección aparece **solo si hay datos** para ese artista. Se puede buscar con el botón **Buscar** o presionando **Enter**, con o sin tildes y en mayúsculas o minúsculas ("dario gomez" encuentra a "Darío Gómez"). Si una de las fuentes de información falla, la página muestra lo que sí encontró.

**Géneros musicales:** se toman de Wikidata, que es más preciso que iTunes (por ejemplo, iTunes pone a Darío Gómez en "Música Mexicana", pero Wikidata dice "música popular colombiana"). Solo si Wikidata no tiene ninguno se usa el género de iTunes, y la página lo indica con "(según iTunes)".

**Solo muestra artistas musicales** (cantantes, raperos, músicos, DJ, bandas…). Antes de usar un artículo de Wikipedia, revisa en Wikidata su ocupación o tipo; si no es de la música (por ejemplo, el futbolista Andrea Pirlo), busca alternativas como "NOMBRE cantante" o "NOMBRE rapero". Si solo iTunes conoce al artista, muestra sus canciones y álbumes con el aviso "No encontramos la biografía de este artista". Las canciones y los álbumes siempre son del artista buscado.

👉 **Página publicada:** https://salomemuneracorrea.github.io/Bucasdor_Cantantes/

También se puede abrir una búsqueda directamente con un enlace, por ejemplo:
https://salomemuneracorrea.github.io/Bucasdor_Cantantes/?q=Shakira

## Tecnologías

Solo **HTML, CSS y JavaScript puro**: sin frameworks y sin instalar nada. Basta con abrir `index.html` en el navegador.

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Estructura de la página (título, buscador y tarjetas). |
| `style.css` | Diseño: colores, tarjetas y adaptación a celular, tablet y computador. |
| `script.js` | Lógica: consulta las APIs y muestra los resultados. Está comentado paso a paso. |

## APIs que usa (gratuitas y sin clave)

| API | Qué aporta |
|---|---|
| [Wikipedia](https://es.wikipedia.org/w/api.php) (en español y, si no lo encuentra, en inglés) | Foto, descripción corta y la introducción completa del artículo. |
| [Wikidata](https://www.wikidata.org/w/api.php) | Datos personales, géneros, instrumentos, discográficas, año de inicio, premios y redes (con los nombres en español). |
| [iTunes Search API](https://performance-partners.apple.com/search-api) | Canciones, álbumes, portadas, año y vista previa de audio. |
