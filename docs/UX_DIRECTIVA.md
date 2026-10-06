# AVGUST CARE 360
## Directiva Maestra de UX/UI — Enterprise Experience
### 1. Objetivo
La evolución visual de AVGUST CARE 360 debe centrarse exclusivamente en **UX/UI, presentación, claridad, interacción y percepción de producto**.
No se debe rediseñar la lógica funcional existente ni modificar los flujos de negocio establecidos.
El objetivo es que AVGUST CARE 360 transmita la sensación de un **producto empresarial desarrollado por un equipo senior de una compañía multinacional**:
* serio;
* confiable;
* moderno;
* preciso;
* elegante;
* fácil de aprender;
* rápido de utilizar;
* visualmente consistente;
* orientado a productividad;
* apropiado para operaciones profesionales en campo y oficina.
La interfaz no debe parecer una plantilla administrativa, un CRUD genérico ni un dashboard construido a base de tarjetas.
Debe sentirse como un **producto empresarial especializado**, diseñado alrededor del trabajo real del usuario.
---
# 2. Principio rector
### "Menos interfaz. Más claridad."
Cada elemento visual debe tener un propósito.
La interfaz debe ayudar al usuario a responder rápidamente:
1. ¿Dónde estoy?
2. ¿Qué estoy haciendo?
3. ¿Qué información necesito?
4. ¿Qué falta?
5. ¿Qué puedo hacer ahora?
6. ¿Se guardaron mis cambios?
7. ¿Qué ocurrirá si continúo?
Nunca se debe añadir decoración únicamente para hacer una pantalla "más bonita".
La sofisticación de AVGUST CARE 360 debe provenir de:
* jerarquía visual;
* excelente tipografía;
* espaciado consistente;
* información bien agrupada;
* estados claros;
* microinteracciones;
* navegación predecible;
* feedback inmediato;
* densidad adecuada;
* componentes consistentes.
---
# 3. Alcance de este rediseño
Este trabajo corresponde exclusivamente a la **capa de experiencia y presentación**.
### Se puede mejorar
* layout;
* jerarquía visual;
* tipografía;
* espaciado;
* tamaños;
* estados;
* botones;
* formularios;
* tablas;
* filtros;
* tarjetas;
* navegación;
* feedback;
* mensajes;
* indicadores;
* estados vacíos;
* estados de carga;
* confirmaciones;
* toasts;
* responsive;
* microinteracciones;
* accesibilidad;
* densidad visual;
* consistencia entre módulos.
### No se debe modificar
* reglas de negocio;
* estructura funcional;
* modelo de datos;
* API;
* permisos;
* procesamiento;
* flujo operativo;
* arquitectura de módulos;
* límites existentes;
* comportamiento funcional establecido.
La UI **representa y facilita las funciones existentes**. No debe convertirse en una segunda capa de lógica de negocio.
---
# 4. Personalidad visual
AVGUST CARE 360 debe proyectar:
### Profesional
La interfaz debe transmitir control y confianza.
### Tecnológica
Debe sentirse como software empresarial contemporáneo, no como software administrativo antiguo.
### Humana
Aunque sea enterprise, no debe resultar fría, complicada ni intimidante.
### Operativa
El usuario debe poder trabajar rápidamente sin luchar contra la interfaz.
### Premium
Los detalles deben sentirse cuidadosamente diseñados.
### Sobria
Evitar efectos visuales exagerados, gradientes innecesarios, animaciones llamativas y decoración excesiva.
---
# 5. Regla de oro para todas las pantallas
Cada pantalla debe tener una jerarquía clara:
**Contexto → objetivo → información → acción → estado**
El usuario debe identificar visualmente en pocos segundos:
* nombre del módulo;
* ubicación actual;
* tarea principal;
* información relevante;
* acción principal;
* estado actual.
No esconder acciones importantes en menús innecesarios.
No utilizar iconos sin contexto cuando una etiqueta pueda evitar ambigüedad.
No crear múltiples botones primarios compitiendo entre sí.
---
# 6. Sistema visual
La UI existente basada en:
* `globals.css`
* `mobile.css`
* `public/enhance/`
debe evolucionar mediante una capa visual coherente.
La carpeta `public/enhance/` representa la capa de **experiencia/presentación**, no una nueva arquitectura funcional.
Las mejoras deben incluir, entre otras:
* filtros en listas;
* estados de guardado;
* briefing de inicio;
* confirmaciones;
* feedback visual;
* estados vacíos;
* mensajes contextuales;
* indicadores de progreso;
* mejoras responsive;
* microinteracciones.
### Identidad
AVGUST mantiene su identidad institucional.
El producto actual utiliza:
* teal/celeste;
* verde;
* amarillo;
* gris;
* azul para acciones principales.
El tema "verde agro" solamente debe utilizarse cuando corresponda al contexto `c360-debrand`.
No reemplazar la identidad actual de AVGUST por una estética agrícola genérica.
---
# 7. Tipografía
Mantener **Manrope** como tipografía principal.
La tipografía debe utilizarse para construir una jerarquía clara:
### Títulos
Fuertes, limpios y fácilmente escaneables.
### Subtítulos
Utilizados para organizar contenido.
### Texto principal
Alta legibilidad y contraste.
### Metadata
Más discreta, pero nunca ilegible.
### Estados
Debe existir diferencia visual clara entre:
* activo;
* pendiente;
* completado;
* advertencia;
* error;
* bloqueado.
No utilizar tamaños pequeños únicamente para conseguir una apariencia "premium".
---
# 8. Botones
## Primario
Color:
`#007FA3`
Texto:
Blanco.
Forma:
Píldora con aproximadamente `24px` de radius.
Debe utilizarse para la acción principal de la pantalla.
Ejemplos:
* Guardar visita
* Guardar avance
* Crear
* Continuar
* Confirmar
No utilizar múltiples botones primarios cuando exista una acción claramente dominante.
---
## Secundario
* borde;
* fondo blanco;
* fondo oscuro cuando corresponda al dark mode.
Debe representar una acción alternativa.
---
## Tamaños
Interacción general:
**mínimo 44px de altura.**
Desktop denso ≥1024px:
aproximadamente **34px**, cuando el contexto requiera mayor densidad.
Nunca sacrificar accesibilidad por estética.
---
## Focus
Controles base:
`#00B5E2`
Con un contorno visible de aproximadamente `3px`.
Navegación de módulos:
`#F2A900`
El focus debe ser visible tanto con teclado como con interacción accesible.
---
# 9. Tarjetas y paneles
Las tarjetas deben utilizarse para **agrupar información relacionada**, no para decorar.
Radius:
aproximadamente `12–14px`.
Evitar:
* exceso de tarjetas;
* tarjetas anidadas innecesariamente;
* sombras fuertes;
* paneles flotantes sin función.
### Franja superior
Cuando corresponda, utilizar una franja superior de aproximadamente `3–4px`.
Puede representar:
* celeste;
* verde;
* azul;
según el contexto del módulo.
Debe existir una lógica consistente para el uso del color.
---
# 10. Function Cards
Las `function-card` deben comunicar rápidamente:
* qué hace;
* para quién;
* cuál es su estado;
* qué acción está disponible.
Hover:
* borde celeste;
* sombra ligera;
* transición rápida y discreta.
Evitar transformaciones exageradas.
No utilizar zoom, rebotes o animaciones que distraigan del contenido.
---
# 11. Editor de visita
El editor de visita es una de las interfaces más importantes del producto.
Debe priorizar productividad.
### Desktop
Mantener:
**Formulario + resumen/aside**
No convertir el editor en una única columna gigantesca.
El aside concentra:
* guardado;
* progreso;
* estado;
* información contextual.
### Principio
El usuario debe poder editar información y comprobar el estado de su visita **sin abandonar el contexto actual**.
---
# 12. Navegación principal
La arquitectura existente de los **7 módulos** debe mantenerse.
No convertir los siete módulos en un menú hamburguesa únicamente para conseguir una apariencia minimalista.
La navegación de módulos debe permanecer visible:
* barra superior;
* barra inferior;
* o solución equivalente según plataforma.
El usuario siempre debe saber:
**qué módulo está activo y dónde puede ir después.**
El módulo activo debe tener una diferenciación visual evidente.
---
# 13. Formularios
Los formularios deben sentirse organizados, no burocráticos.
### Desktop
2 columnas.
### ≤900px
1 columna.
### ≥1200px
Se pueden utilizar 3 columnas cuando el contenido realmente lo justifique.
No utilizar 3 columnas simplemente porque existe espacio disponible.
---
## Inputs
Base:
aproximadamente `44px`.
Desktop denso ≥1024px:
aproximadamente `36px`.
Los labels deben estar claramente asociados con los campos.
Los errores deben aparecer cerca del campo correspondiente.
No utilizar únicamente color para comunicar errores.
---
# 14. Capítulos
Los capítulos deben utilizar `chapter-grid`.
Cada capítulo debe funcionar como una unidad visual seleccionable.
### Estado seleccionado
* borde celeste;
* fondo aproximado `#f0f9fc`.
Debe existir una diferencia clara entre:
* disponible;
* seleccionado;
* completado;
* pendiente.
---
# 15. Listas
Aplicar el mismo lenguaje visual a:
* visitas;
* solicitudes;
* compromisos;
* registros similares.
### Paginación
8 elementos por página.
No utilizar scroll infinito.
El usuario debe conocer:
* cuántos elementos existen;
* en qué página está;
* cómo avanzar;
* cómo retroceder.
---
# 16. Tablas
Las tablas deben priorizar información crítica.
No comprimir columnas hasta hacer ilegible el contenido.
Cuando sea necesario:
`table-scroll`
Debe utilizarse scroll horizontal en lugar de destruir la legibilidad.
Las acciones importantes deben permanecer fácilmente localizables.
Los encabezados deben tener suficiente contraste y jerarquía.
---
# 17. Métricas y consulta
La interfaz de métricas debe sentirse como una herramienta analítica empresarial, no como una colección de números.
### Filtros
Utilizar una rejilla organizada.
Los filtros deben indicar claramente:
* qué están filtrando;
* qué valor está activo;
* cómo limpiar el filtro.
### KPI
Utilizar resumen de:
**4 KPI principales**
Cada KPI debe comunicar:
* nombre;
* valor;
* contexto;
* periodo cuando corresponda.
No llenar la pantalla con decenas de números.
---
# 18. Gráficas
Las gráficas deben priorizar:
**lectura > decoración.**
No utilizar visualizaciones complejas cuando una gráfica simple comunique mejor la información.
Si el contenido requiere desplazamiento:
scroll horizontal.
El thumb puede utilizar el verde correspondiente al sistema visual.
No utilizar colores arbitrarios por gráfica.
Los colores deben representar significado consistente.
---
# 19. Consulta de finca
La consulta de finca debe tener una experiencia especialmente cuidada.
### Inicio
Hero de búsqueda.
Debe comunicar inmediatamente:
**"¿Qué finca desea consultar?"**
Después:
rejillas de historial.
El dossier debe organizarse como una línea temporal.
La timeline diferencia visualmente:
* solicitud;
* informe;
* fotografía;
* seguimiento.
El color debe servir para **comprender información**, no simplemente decorar.
---
# 20. Inicio / briefing
El Inicio debe funcionar como un **centro operativo**.
No debe ser simplemente un dashboard lleno de tarjetas.
Debe responder:
### ¿Qué está pasando?
### ¿Qué requiere atención?
### ¿Qué tengo pendiente?
### ¿Qué cambió?
### ¿Qué debo hacer ahora?
El briefing debe priorizar información accionable.
---
# 21. Guardado
El guardado debe ser uno de los elementos más transparentes del producto.
El usuario nunca debe preguntarse:
**"¿Se guardó?"**
Debe existir feedback claro.
### Estados
* Guardado.
* Guardando.
* Cambios sin guardar.
* Error al guardar.
* Último guardado.
Mostrar:
**"Hay cambios sin guardar"**
y la hora del último guardado cuando corresponda.
En Visitas:
punto amarillo para indicar borrador/cambios pendientes.
---
# 22. Guardado automático Windows
Mantener el comportamiento existente:
borrador local aproximadamente `700ms` después de editar.
Esto no reemplaza el guardado manual.
La interfaz debe diferenciar:
**borrador automático**
de
**guardado explícito.**
---
# 23. Navegación con cambios pendientes
Si el usuario intenta cambiar de visita con cambios sin guardar:
la interfaz debe advertirlo y gestionar el guardado antes de continuar según el flujo existente.
Nunca perder silenciosamente información introducida.
Restaurar un `.care360` debe estar bloqueado cuando exista una visita sucia sin guardar.
La razón debe explicarse claramente al usuario.
---
# 24. Confirmaciones destructivas
Eliminar información requiere una experiencia de confirmación clara.
Aplicar al menos a:
* visita;
* solicitud;
* versión;
* informe;
* acciones destructivas equivalentes.
El diálogo debe indicar:
1. qué se eliminará;
2. consecuencias;
3. si afecta elementos relacionados;
4. si la acción es irreversible;
5. acción para cancelar;
6. acción para confirmar.
Evitar textos genéricos como:
> "¿Está seguro?"
Preferir lenguaje contextual.
Ejemplo:
> "Eliminar esta visita también eliminará los informes asociados. Esta acción no se puede deshacer."
---
# 25. Informe y ciclo documental
El ciclo documental debe ser visualmente inequívoco.
Estados como:
* borrador;
* revisión;
* aprobado;
* publicado;
deben diferenciarse mediante:
* etiqueta;
* icono;
* color semántico;
* texto.
Nunca depender únicamente del color.
---
## Marcar revisado
Marcar un informe como revisado requiere criterios completos y:
* hallazgo;
* recomendación;
para cada respuesta "No".
La UI debe comunicar qué requisito falta.
No limitarse a mostrar un error genérico.
---
# 26. Cancelar informe
Cancelar una versión documental requiere confirmación.
La interfaz debe dejar claro:
**La visita técnica se conserva.**
**La versión documental será eliminada.**
Esto evita que el usuario confunda:
* eliminar versión;
* eliminar visita.
---
# 27. Fotos
Formatos:
* JPG;
* PNG;
* WebP.
Límite:
**8 MB por archivo.**
Máximo:
**60 fotos por informe.**
Mostrar permanentemente:
**X de 60 en este informe**
cuando el usuario esté trabajando con fotografías.
---
# 28. Experiencia de fotografías
Antes de adjuntar fotografías debe existir nombre de finca.
Si es necesario guardar primero:
la interfaz debe explicarlo.
Cada fotografía puede tener:
* capítulo;
* subcapítulo/criterio;
* general;
* descripción;
* opción para quitar del informe.
La galería debe permitir comprender rápidamente:
* qué fotografía es;
* a qué pertenece;
* qué información tiene;
* si está incluida.
---
# 29. Cámara y galería
Mantener las diferencias funcionales actuales.
Cámara:
`accept="image/*"`
Galería:
tipos explícitos.
En Android, la cámara depende del comportamiento asociado a `image/*`.
La interfaz debe explicar claramente qué opción está utilizando el usuario.
---
# 30. Android
Android debe sentirse como una versión diseñada específicamente para interacción táctil.
No debe ser simplemente "desktop reducido".
### Targets
Evaluación y fotografías:
**mínimo 44px.**
Preferiblemente suficiente espacio táctil para evitar pulsaciones accidentales.
---
# 31. Botón Atrás Android
Mantener el orden funcional:
**Informe → Fotos → Evaluación → Datos → lista de visitas → Inicio → salida de la aplicación**
La navegación debe sentirse natural.
El usuario no debe perder accidentalmente el contexto.
---
# 32. Teclado Android
Mantener:
`adjustResize`
Al enfocar:
* input;
* textarea;
el elemento debe utilizar `scrollIntoView` y quedar centrado dentro del área visible.
El teclado no debe ocultar el campo activo.
---
# 33. Barra móvil de guardado
En móvil debe existir una acción de guardado claramente accesible.
Debe permanecer disponible durante la edición cuando corresponda.
No obligar al usuario a volver arriba de la pantalla para guardar.
---
# 34. Exportación
La experiencia de exportación debe explicar claramente qué ocurrirá.
### Word
Descarga / share sheet en Android.
### PDF / impresión
Solo fuera de Android.
En APK:
mostrar mensaje claro indicando que debe utilizar Word o PC.
### Excel / CSV / respaldo
Menú del sistema en Android.
Descarga directa en Windows.
---
# 35. Preparar correo
"Preparar correo" debe abrir el cliente local.
El usuario adjunta manualmente el Word/PDF.
La UI debe explicar la transición:
**AVGUST CARE 360 prepara la información → el usuario completa el envío desde su cliente de correo.**
---
# 36. Toasts y feedback
Los toasts deben ser:
* breves;
* contextuales;
* no invasivos;
* fáciles de entender.
Ejemplos:
**Guardado correctamente**
**Cambios guardados**
**Fotografía agregada**
**Informe actualizado**
**No fue posible guardar los cambios**
Nunca utilizar mensajes técnicos para usuarios finales.
---
# 37. Estados de carga
Toda operación que pueda tardar debe comunicar que está ocurriendo.
Ejemplos:
* Guardando...
* Cargando visita...
* Preparando informe...
* Generando archivo...
* Restaurando respaldo...
No utilizar pantallas completamente congeladas sin explicación.
---
# 38. Estados vacíos
Un estado vacío no debe parecer un error.
Debe explicar:
1. qué está vacío;
2. por qué;
3. qué puede hacer el usuario.
Ejemplo conceptual:
**No hay visitas pendientes**
"Las nuevas visitas aparecerán aquí cuando estén disponibles."
Cuando exista una acción posible:
**Crear visita**
---
# 39. Errores
Los errores deben ser humanos y accionables.
Evitar:
> Error 500.
Preferir:
> No fue posible guardar la visita.
Después:
> Compruebe la conexión o inténtelo nuevamente.
Y ofrecer la acción correspondiente.
Los detalles técnicos pueden existir en herramientas internas, pero no deben dominar la experiencia del usuario.
---
# 40. Microinteracciones
Las animaciones deben ser discretas.
Utilizar transiciones para:
* cambio de estado;
* apertura;
* cierre;
* selección;
* guardado;
* hover;
* navegación.
Evitar:
* rebotes;
* zoom excesivo;
* animaciones permanentes;
* elementos flotando sin propósito.
La interfaz debe sentirse viva, no juguetona.
---
# 41. Responsive
El responsive debe adaptar la interfaz al contexto.
No significa simplemente:
**desktop → todo apilado.**
Cada breakpoint debe preservar:
* jerarquía;
* productividad;
* accesibilidad;
* navegación;
* contexto.
En desktop se aprovecha el espacio para productividad.
En móvil se prioriza:
* lectura;
* interacción táctil;
* acciones frecuentes;
* navegación sencilla.
---
# 42. Densidad Enterprise
En ≥1024px debe mantenerse el pase de densidad **1.5.32**.
No revertir a grandes márgenes o espacios vacíos únicamente porque visualmente "se vea más moderno".
AVGUST CARE 360 es una herramienta de productividad.
El espacio debe utilizarse para:
* información;
* controles;
* contexto;
* comparación;
* trabajo.
No para crear vacío decorativo.
---
# 43. Dark Mode
Si existe dark mode:
No debe ser simplemente invertir colores.
Debe diseñarse específicamente.
Debe mantener:
* jerarquía;
* contraste;
* estados;
* colores semánticos;
* legibilidad;
* identidad AVGUST.
Evitar negro absoluto cuando perjudique la lectura.
Los paneles deben tener niveles visuales claramente diferenciados.
---
# 44. Accesibilidad
La accesibilidad debe formar parte del diseño, no ser una fase posterior.
Garantizar:
* contraste suficiente;
* focus visible;
* targets táctiles adecuados;
* labels claros;
* estados no dependientes exclusivamente del color;
* navegación mediante teclado;
* mensajes comprensibles;
* textos legibles.
---
# 45. Consistencia global
Un botón debe comportarse y verse como un botón en todo el producto.
Un estado de éxito debe mantener el mismo lenguaje visual.
Un error debe utilizar el mismo patrón.
Una tabla debe mantener patrones consistentes.
Un modal destructivo debe utilizar el mismo comportamiento.
El usuario debe aprender el sistema una sola vez.
---
# 46. Prohibiciones de diseño
No introducir:
* dashboards genéricos;
* exceso de tarjetas;
* exceso de sombras;
* gradientes decorativos;
* glassmorphism innecesario;
* animaciones exageradas;
* botones gigantes;
* espacios vacíos artificiales;
* iconos ambiguos;
* textos diminutos;
* tablas comprimidas;
* menús ocultos sin necesidad;
* colores arbitrarios;
* componentes visualmente inconsistentes.
No intentar hacer que AVGUST CARE 360 parezca una aplicación de moda.
Debe parecer una **herramienta empresarial madura**.
---
# 47. Qué NO cambiar sin acuerdo
Debe preservarse:
### Identidad
* logo;
* lockup CARE 360;
* Manrope;
* paleta institucional;
* celeste;
* verde;
* amarillo;
* gris;
* azul del botón.
### Arquitectura
Los 7 módulos y sus nombres en español, incluyendo:
**Consulta de finca**
### Flujo de visita
**Datos → Evaluación → Fotos → Informe**
### Modelo local
Windows continúa siendo local.
No introducir sincronización Windows ↔ Android como parte de este trabajo visual.
### Respaldo
`.care360` continúa siendo una pieza central de Inicio.
### Fotografías
8 MB × 60.
Contador visible.
### Guardado
Mantener guardado explícito y semántica de borrador/revisado.
### Android
Mantener:
* botón Atrás;
* navegación inferior;
* barra de guardar;
* share sheet;
* ausencia de PDF.
### Desktop
Mantener la densidad 1.5.32 en ≥1024px.
---
# 48. Criterio de aceptación visual
Una pantalla no debe considerarse terminada simplemente porque:
* funciona;
* compila;
* tiene buen CSS;
* es responsive.
Debe superar también una evaluación de experiencia.
### Preguntas obligatorias
**¿El usuario sabe dónde está?**
**¿Sabe qué debe hacer?**
**¿La acción principal destaca?**
**¿Entiende el estado actual?**
**¿Sabe si sus cambios están guardados?**
**¿Puede detectar errores rápidamente?**
**¿Puede trabajar sin sentirse perdido?**
**¿La interfaz mantiene consistencia con el resto del producto?**
**¿Se siente como software empresarial profesional?**
**¿La interfaz ayuda a trabajar o simplemente ocupa espacio?**
---
# 49. Principio final
AVGUST CARE 360 no debe buscar impresionar al usuario durante los primeros cinco segundos.
Debe conseguir algo más importante:
### Que después de usarlo durante una hora el usuario sienta que trabajar con él es fácil.
La interfaz debe desaparecer detrás del trabajo.
El usuario no debería pensar:
> "Qué bonita aplicación."
Debería pensar:
> **"Sé exactamente qué hacer."**
Ese es el estándar UX objetivo para AVGUST CARE 360.
---
## Restricción fundamental
**Este documento modifica exclusivamente la experiencia visual y de interacción.**
No autoriza cambios en:
* backend;
* API;
* base de datos;
* reglas de negocio;
* permisos;
* modelo de datos;
* flujos funcionales;
* arquitectura;
* límites establecidos;
* sincronización;
* comportamiento funcional existente.
Cualquier cambio funcional detectado durante el trabajo de UX/UI debe tratarse como una propuesta independiente y requerir aprobación antes de implementarse.
