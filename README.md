# 🎤 Buscador de Cantantes

Página web para buscar cualquier cantante y ver, en un solo lugar:

- **Foto, nombre y descripción corta.**
- **Biografía** (resumen de Wikipedia) con enlace para leer el artículo completo.
- **Datos rápidos:** nombre real, género musical, país, lugar y fecha de nacimiento y desde qué año está activo.
- **Canciones populares:** 5 canciones con la portada del álbum, el nombre del álbum, el año y una vista previa de audio de 30 segundos.

Se puede buscar con el botón **Buscar** o presionando **Enter**. Si una de las fuentes de información falla, la página muestra lo que sí encontró.

👉 **Página publicada:** https://samuelalvaradoc.github.io/Salome-buscador/

También se puede abrir una búsqueda directamente con un enlace, por ejemplo:
https://samuelalvaradoc.github.io/Salome-buscador/?q=Shakira

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
| [Wikipedia](https://es.wikipedia.org/api/rest_v1/) (en español y, si no lo encuentra, en inglés) | Foto, descripción corta y biografía. |
| [Wikidata](https://www.wikidata.org/w/api.php) | Nombre real, país, lugar y fecha de nacimiento, año de inicio. |
| [iTunes Search API](https://performance-partners.apple.com/search-api) | Canciones, portadas, álbum, año, género y vista previa de audio. |
