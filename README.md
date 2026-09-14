# ElectronicsChecador

Checador de asistencia de Electronics México: los empleados checan desde el
celular (PWA), el registro cae en un Google Sheet, y el celular les avisa
cuando les toca checar.

**Objetivo principal: que las alertas lleguen al celular de cada empleado.**

---

## Las tres piezas

```
GitHub Pages (público)        Apps Script (privado)          Firebase (FCM)
docs/ del repo           ->   /exec  (JSON)             ->   push al celular
PWA del checador              guarda checadas en el Sheet
sin secretos                  motor de alertas (trigger)
```

---

## Coordenadas

| Qué | Dónde |
|---|---|
| Carpeta local | `C:\Users\CIBER\Documents\GitHub\ElectronicsChecador` |
| Sheet | `Checador Electronics Mexico 7.0` · `1VlaQA8cRJ8QzJbUVQ1bJsXIHX4L0k2XsLBORP4pG4rA` |
| Apps Script | `12p_pzT0P0XEA7RIT46wO3NH8YyB_YStjU25l5a7Jt4YTKdkIp5uMxGYw` |
| Repo | `github.com/v-w04/ElectronicsChecador` (público) |
| PWA | `v-w04.github.io/ElectronicsChecador/` |
| QR de checada | `electronicsmexico.site/checador` |
| Firebase | proyecto `checador-electronics` |

## Las dos cuentas

| Cuenta | Rol |
|---|---|
| `victor.walmart.04` | Dueña del Sheet y del código: `clasp login`, editor, publicar versión |
| Soporte inventario | Dueña de los triggers (`revisarAlertas`): ahí se gasta la cuota |

---

## Estructura

```
ElectronicsChecador/
├── docs/                         ← GitHub Pages sirve esta carpeta
├── apps-script/                  ← backend (clasp)
├── .clasp.json                   ← solo el scriptId, no es secreto
├── _config.bat                   ← usuario / repo / rama
├── _seguro.bat + _seguro.ps1     ← frena commits con credenciales
├── 0-ACTUALIZAR.bat              ← git pull, al llegar a una compu
├── 1-INSTALAR-CLASP.bat          ← una vez por compu
├── 2-SUBIR-A-APPSCRIPT.bat       ← solo backend
├── 3-VERIFICAR.bat               ← diagnóstico del entorno
├── 4-SUBIR-A-GITHUB.bat          ← solo git
├── 5-SUBIR-TODO.bat              ← los dos (el de diario)
├── UNA-VEZ-1-BAJAR-DE-APPSCRIPT.bat
└── UNA-VEZ-2-MOVER-FRONTEND-A-DOCS.bat
```

## Migración (una sola vez, en orden)

1. `1-INSTALAR-CLASP.bat`, solo si esta compu no tiene clasp con la sesión de `victor.walmart.04`
2. `UNA-VEZ-1-BAJAR-DE-APPSCRIPT.bat`: baja el backend real a `apps-script/`
3. `UNA-VEZ-2-MOVER-FRONTEND-A-DOCS.bat`: mueve la PWA a `docs/`, hace el commit y lo sube
4. **En ese momento**, en GitHub → Settings → Pages: *Branch `main`, carpeta `/docs`* → Save.
   La URL no cambia. Mientras no lo cambies, la PWA no carga.

`2-` y `5-` se niegan a subir si `apps-script/` está vacía: `clasp push --force`
dejaría el proyecto en línea igual a una carpeta vacía.

---

## Reglas

- **Ninguna credencial en archivos.** La cuenta de servicio de Firebase vive en
  `ScriptProperties` (`configurarFirebase()` desde el editor). El repo es público.
- La `apiKey` web de Firebase (`AIza…`) sí va en el frontend: es un identificador
  público. Se protege restringiéndola en Google Cloud al dominio `github.io`.
- `openById`, nunca `getActiveSpreadsheet()`: en triggers y en el web app puede
  regresar `null`.
- **Publicar versión.** `clasp push` no actualiza la URL `/exec`: *Implementar →
  Administrar implementaciones → ✏️ → Nueva versión*. "Nueva implementación" crea
  otra URL y deja huérfana la que tienen los celulares.
- El script escribe datos, no formato.
