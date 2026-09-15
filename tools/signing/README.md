# Clave de firma

`care360-release.keystore` es la clave con la que se firma el APK que se
distribuye a los equipos de campo. Se guarda en el repositorio para que todas las
versiones queden firmadas con la misma clave: así una actualización se instala
encima de la anterior y **no hay que desinstalar ni perder los datos guardados**.

Es una clave autofirmada de distribución interna, no una clave de Google Play.
Si el programa llega a publicarse en Play Store o el reparto deja de ser manual,
conviene generar una clave nueva, guardarla fuera del repositorio y pasarla al
guion de compilación:

```bash
CARE360_KEYSTORE=/ruta/segura/mi.keystore \
CARE360_KEYSTORE_PASS=... \
CARE360_KEY_ALIAS=... \
tools/build-apk.sh
```

La primera instalación encima de 1.1.0-rc.5 sí exige desinstalar la anterior,
porque el paquete original venía firmado con la clave de depuración del equipo
donde se compiló y esa clave no está disponible. Antes de desinstalar, crear un
respaldo completo desde *Inicio → Crear respaldo completo* y restaurarlo después.
