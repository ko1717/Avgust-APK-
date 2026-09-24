# Clave de firma

`care360-release.keystore` es la clave con la que se firma el APK que se
distribuye a los equipos de campo. Sigue en el repositorio a propósito: cada
versión tiene que firmarse con **esta misma** clave para que la actualización
se instale encima y **no se borre el SQLite local**. Una clave nueva obliga a
desinstalar.

Es una clave autofirmada de distribución interna, no una clave de Google Play.
La contraseña no está en `tools/build-apk.sh` y el guion no la imprime. Hay
que pasarla por el entorno:

```bash
CARE360_KEYSTORE_PASS=... \
CARE360_KEY_PASS=... \
tools/build-apk.sh
```

| Variable | Uso |
| --- | --- |
| `CARE360_KEYSTORE_PASS` | Contraseña del almacén (`--ks-pass`). Obligatoria. |
| `CARE360_KEY_PASS` | Contraseña de la clave (`--key-pass`). Obligatoria. |
| `CARE360_KEYSTORE` | Ruta del almacén. Por defecto `tools/signing/care360-release.keystore`. |
| `CARE360_KEY_ALIAS` | Alias. Por defecto `care360`. |

En esta clave, la contraseña del almacén y la de la entrada son la misma.
Hay que definir las dos variables.

La semilla `tools/base/capacitor-seed.apk` (el paquete original 1.1.0-rc.5)
está firmada con otra clave. No se instala en campo. Quien aún tenga esa
versión de depuración debe desinstalarla, crear antes un respaldo desde
*Inicio → Crear respaldo completo* y restaurarlo después.
