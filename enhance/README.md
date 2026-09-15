# Capa de interfaz y experiencia

Estos cuatro archivos se copian dentro del APK en `assets/public/enhance/` y se
enlazan desde `index.html` después del paquete de la aplicación. Se cargan
siempre al final, de modo que las reglas de igual especificidad definidas aquí
ganan a las del paquete compilado, y todo el JavaScript es aditivo: no se
modifica ni una línea del código original.

| Archivo | Responsabilidad |
| --- | --- |
| `care360-enhance.css` | Interfaz: barra de módulos arriba en el teléfono, barra superior fija, pasos de la visita fijos, objetivos táctiles, foco visible, superficies, modo oscuro e impresión. |
| `care360-presentation.css` | Estilos de la presentación de bienvenida. |
| `care360-presentation.js` | Contenido y comportamiento de la presentación, el botón **Guía** de la barra superior y la API `window.Care360Intro`. |
| `care360-experience.js` | Botón físico de atrás, teclado en pantalla, aviso de cambios sin guardar, estado de conexión, recuperación ante errores y medidas de las barras fijas. |

## Variables publicadas en tiempo de ejecución

`care360-experience.js` mide las barras fijas y las publica en `:root` para que
el CSS pueda apoyarse en valores reales en lugar de constantes:

- `--c360-nav-h`: alto de la barra de módulos cuando está fija (0 en escritorio
  o con el teclado abierto).
- `--c360-topbar-h`: alto de la barra superior.
- `--c360-save-h`: alto de la barra de guardado de la visita, si está visible.

## API pública

```js
window.Care360Intro.open(indice);   // abre la presentación en una sección
window.Care360Intro.close(marcar);  // la cierra; con `true` no vuelve a salir sola
window.Care360Intro.isOpen();
window.Care360Experience.toast(mensaje, tono, duracion);
```

## Al editar

La versión se sella en el momento de compilar: `tools/build-apk.sh` sustituye el
marcador `__C360_VERSION__` de `care360-presentation.js` por el `versionName` del
paquete. En la vista previa local el valor queda como `preview`.
