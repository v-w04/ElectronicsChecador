// ============================================================================
// CONFIG_ALERTAS
// ============================================================================

/**
 * Los parámetros del motor de alertas, con su valor de arranque.
 * Si se agrega uno nuevo aquí, se le agrega solo a la hoja de quien ya la
 * tenía creada (ver _completarConfigAlertas_).
 */
var CONFIG_ALERTAS_DEF = [
  ['duracion_desayuno_min',          20, 'Minutos permitidos de desayuno'],
  ['duracion_comida_min',            60, 'Minutos permitidos de comida'],
  ['aviso_entrada_min_antes',        15, 'Avisar X min antes de la hora de entrada'],
  ['aviso_desayuno_min_antes',        5, 'Avisar X min antes del exceso de desayuno'],
  ['aviso_comida_min_antes',         10, 'Avisar X min antes del exceso de comida'],
  ['aviso_salida_min_antes',          5, 'Avisar X min antes de la hora de salida'],
  ['alertas_no_checo_cantidad',       2, 'Cuántos recordatorios si no registra su checada'],
  ['alertas_no_checo_intervalo_min',  5, 'Minutos entre esos recordatorios'],
  ['alertas_salida_insistir_min',    30, 'Cuántos minutos seguir recordando la salida si no la registra'],
  ['alertas_activas',              'SI', 'Interruptor general de alertas (SI/NO)']
];

function crearHojaConfigAlertas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('CONFIG_ALERTAS');
  if (sheet) return sheet;

  sheet = ss.insertSheet('CONFIG_ALERTAS');

  const filas = [['Parámetro', 'Valor', 'Descripción']].concat(CONFIG_ALERTAS_DEF);

  sheet.getRange(1, 1, filas.length, 3).setValues(filas);
  sheet.getRange(1, 1, 1, 3)
    .setBackground('#3f51b5').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setColumnWidth(1, 260);
  sheet.setColumnWidth(2, 90);
  sheet.setColumnWidth(3, 460);
  sheet.setFrozenRows(1);

  Logger.log('✅ Hoja CONFIG_ALERTAS creada con valores por defecto');
  return sheet;
}

/**
 * Le agrega a la hoja los parámetros que todavía no tenga. Así, cuando el
 * motor aprende algo nuevo, no hay que rehacer la hoja a mano ni se pierde
 * lo que ya estaba ajustado.
 */
function _completarConfigAlertas_(sheet) {
  try {
    const data = sheet.getDataRange().getValues();
    const hay = {};
    for (let i = 1; i < data.length; i++) {
      const k = (data[i][0] || '').toString().trim();
      if (k) hay[k] = true;
    }
    const faltan = CONFIG_ALERTAS_DEF.filter(function (f) { return !hay[f[0]]; });
    if (!faltan.length) return;

    sheet.getRange(sheet.getLastRow() + 1, 1, faltan.length, 3).setValues(faltan);
    Logger.log('✅ CONFIG_ALERTAS: agregué ' + faltan.length + ' parámetro(s) nuevo(s)');
  } catch (e) {
    Logger.log('⚠️ _completarConfigAlertas_: ' + e.message);
  }
}

function getConfigAlertas() {
  try {
    const sheet = crearHojaConfigAlertas();
    _completarConfigAlertas_(sheet);
    const data = sheet.getDataRange().getValues();
    const config = {};
    for (let i = 1; i < data.length; i++) {
      const clave = (data[i][0] || '').toString().trim();
      if (!clave) continue;
      let valor = data[i][1];
      if (typeof valor === 'string') {
        const num = parseFloat(valor);
        valor = isNaN(num) ? valor.trim().toUpperCase() : num;
      }
      config[clave] = valor;
    }
    return { ok: true, config: config };
  } catch (e) {
    Logger.log('❌ getConfigAlertas: ' + e.message);
    return { ok: false, message: e.message };
  }
}

// ── Registro de alertas enviadas (anti-duplicados) ──────────────────────────

function _yaSeEnvio(clave) {
  return PropertiesService.getScriptProperties().getProperty('alerta_' + clave) !== null;
}

function _marcarEnviada(clave) {
  PropertiesService.getScriptProperties().setProperty('alerta_' + clave, '1');
}

function _limpiarMarcasViejas() {
  const hoy = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  for (var k in all) {
    if (k.indexOf('alerta_') === 0 && k.indexOf(hoy) === -1) props.deleteProperty(k);
  }
}

// ============================================================================
// MOTOR DE ALERTAS — corre cada minuto vía trigger
// ============================================================================
// MOTOR DE ALERTAS — corre cada minuto vía trigger
// ============================================================================
//
// CAMBIOS DE FONDO (v700)
//
// 1. UMBRALES, NO MINUTOS EXACTOS. Antes había condiciones como
//    "faltan exactamente 100 min" o "trans === dur". Un trigger de Apps
//    Script no cae al segundo: si se saltaba ese minuto, esa alerta no salía
//    ese día y nadie se enteraba. Ahora se pregunta "¿ya pasó el umbral y no
//    se ha mandado?", apoyándose en las marcas anti-duplicado que ya existían.
//
// 2. RESPETA LOS DÍAS DE CADA TURNO. El fin de semana estaba escrito a mano y
//    la columna Días de CONFIG_TURNOS no se leía.
//
// 3. LOS TEXTOS VIVEN EN Mensajes.gs. Aquí queda la lógica; allá, las palabras.
//
// 4. CADA ENVÍO SE ANOTA EN PUSH_LOG con a quién iba y qué contestó FCM.
// ============================================================================

function revisarAlertas() {
  try {
    var ahora = new Date();
    var hAhora = parseInt(Utilities.formatDate(ahora, TIMEZONE, 'H'), 10);

    // ⛔ Fuera del horario laboral no hay nada que revisar.
    if (hAhora < ALERTAS_HORA_INICIO || hAhora >= ALERTAS_HORA_FIN) return;

    var cfgResp = getConfigAlertas();
    if (!cfgResp.ok) return;
    var cfg = cfgResp.config;
    if ((cfg.alertas_activas || 'SI') !== 'SI') return;

    // ⛔ Sin Firebase no hay nada que mandar: salir antes de leer seis hojas.
    if (!_firebaseSA_()) {
      Logger.log('⚠️ revisarAlertas: Firebase sin configurar. Ejecuta configurarFirebase()');
      return;
    }

    _limpiarMarcasViejas();

    var hoy = Utilities.formatDate(ahora, TIMEZONE, 'yyyy-MM-dd');
    var minAhora = parseInt(Utilities.formatDate(ahora, TIMEZONE, 'H'), 10) * 60 +
                   parseInt(Utilities.formatDate(ahora, TIMEZONE, 'm'), 10);

    // ⛔ Día festivo para todos (EXCEPCIONES_DIA con PIN 'TODOS')
    var excepciones = _leerExcepciones();
    if (excepciones[hoy + '|TODOS']) return;

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('CHECADOR_CHOFERES');
    if (!sheet || sheet.getLastRow() < 3) return;

    // ── Checadas de HOY agrupadas por empleado ────────────────────────────
    var data = sheet.getRange(3, 1, sheet.getLastRow() - 2, 10).getValues();
    var porUsuario = {};
    data.forEach(function (r) {
      if ((r[2] || '').toString() !== hoy) return;
      var id = _normId(r[0]);
      if (!id) return;
      if (!porUsuario[id]) porUsuario[id] = [];
      var hp = (r[3] || '').toString().match(/(\d{1,2}):(\d{2})/);
      porUsuario[id].push({
        tipo: (r[9] || '').toString().toUpperCase(),
        min: hp ? parseInt(hp[1], 10) * 60 + parseInt(hp[2], 10) : 0
      });
    });

    // ── Dispositivos por empleado ─────────────────────────────────────────
    var sheetTokens = crearHojaPushTokens();
    var tokensData = sheetTokens.getDataRange().getValues();
    var tokensPorId = {};
    for (var i = 1; i < tokensData.length; i++) {
      var idT = _normId(tokensData[i][1]);
      var tk = (tokensData[i][3] || '').toString();
      if (!idT || !tk) continue;
      if (!tokensPorId[idT]) tokensPorId[idT] = [];
      if (tokensPorId[idT].indexOf(tk) === -1) tokensPorId[idT].push(tk);
    }

    // ── Empleados, turno y PIN ────────────────────────────────────────────
    var usuarios = getTodosLosUsuarios();
    var turnoPorId = {}, pinPorId = {}, nombrePorId = {};
    (usuarios.usuarios || []).forEach(function (u) {
      var id = _normId(u.idUsuario);
      pinPorId[id] = u.pin;
      nombrePorId[id] = u.nombre;
      var m = (u.turnoHorario || '').match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
      if (m) {
        turnoPorId[id] = {
          inicioMin: parseInt(m[1], 10) * 60 + parseInt(m[2], 10),
          finMin:    parseInt(m[3], 10) * 60 + parseInt(m[4], 10)
        };
      }
    });

    // ── Preferencias ──────────────────────────────────────────────────────
    var sheetPrefs = crearHojaPrefsAlertas();
    var prefsData = sheetPrefs.getDataRange().getValues();
    var prefsPorId = {};
    for (var k = 1; k < prefsData.length; k++) {
      prefsPorId[_normId(prefsData[k][1])] = {
        entrada:        (prefsData[k][3] || 'SI').toString(),
        desayuno:       (prefsData[k][4] || 'SI').toString(),
        comida:         (prefsData[k][5] || 'SI').toString(),
        comida_nohecha: (prefsData[k][6] || 'SI').toString(),
        salida:         (prefsData[k][7] || 'SI').toString()
      };
    }
    function prefActiva(id, categoria) {
      var p = prefsPorId[id];
      return !p || (p[categoria] || 'SI') !== 'NO';
    }

    // ── Ausencias de hoy ──────────────────────────────────────────────────
    var ausentesHoy = {};
    try {
      var sa = ss.getSheetByName('AUSENCIAS');
      if (sa && sa.getLastRow() > 1) {
        sa.getRange(2, 1, sa.getLastRow() - 1, 5).getValues().forEach(function (r) {
          if ((r[3] || '').toString() === hoy) ausentesHoy[_normId(r[1])] = true;
        });
      }
    } catch (e) {}

    /**
     * Manda una alerta si toca y no se ha mandado.
     * @param clave  marca anti-duplicado: la misma alerta no sale dos veces.
     * @param msg    { titulo, cuerpo } de Mensajes.gs
     * @param alerta etiqueta corta para la bitácora
     */
    function alertar(id, categoria, clave, msg, alerta, urlAccion) {
      if (ausentesHoy[id]) return;
      var pin = pinPorId[_normId(id)];
      if (pin && _excepcionDe(excepciones, hoy, pin)) return;
      if (!prefActiva(id, categoria)) return;
      if (_yaSeEnvio(clave)) return;

      var tokens = tokensPorId[id] || [];
      // Sin dispositivo: se marca igual, para no recalcularlo cada minuto.
      if (!tokens.length) { _marcarEnviada(clave); return; }

      var meta = { idUsuario: id, nombre: nombrePorId[id] || '', alerta: alerta };
      var enviado = false;
      tokens.forEach(function (t) {
        if (_enviarPushFCM(t, msg.titulo, msg.cuerpo, urlAccion, meta)) enviado = true;
      });
      if (enviado) _marcarEnviada(clave);
    }

    var durDesGen = cfg.duracion_desayuno_min || 20;
    var durComGen = cfg.duracion_comida_min || 60;
    var avDes  = cfg.aviso_desayuno_min_antes || 5;
    var avCom  = cfg.aviso_comida_min_antes || 10;
    var avSal  = cfg.aviso_salida_min_antes || 5;
    var nRec   = cfg.alertas_no_checo_cantidad || 2;
    var intRec = cfg.alertas_no_checo_intervalo_min || 5;
    // Cuánto tiempo seguir insistiendo con la salida. Con 30 min y avisos
    // cada 5, son seis recordatorios y se acabó: ni uno solo ni toda la
    // noche.
    var insisteMin = cfg.alertas_salida_insistir_min;
    if (insisteMin === undefined || insisteMin === '') insisteMin = 30;
    var avEnt  = cfg.aviso_entrada_min_antes || 15;

    var URL_SALIDA_REMOTA = 'https://v-w04.github.io/ElectronicsChecador/checar.html?salidaRemota=';

    // ── Uno por uno, con turno y que hoy trabaje ──────────────────────────
    (usuarios.usuarios || []).forEach(function (u) {
      var id = _normId(u.idUsuario);
      var turno = turnoPorId[id];
      if (!turno) return;

      var cfgEmp = _cfgEmpleadoServ(id) || {};
      if (!_turnoTrabajaHoy_(cfgEmp, ahora)) return;   // su turno hoy descansa

      var checadas = porUsuario[id] || [];
      var semilla = parseInt(hoy.replace(/-/g, ''), 10) + parseInt(id, 10) * 13;
      var tieneEntrada = checadas.some(function (c) { return c.tipo === 'ENTRADA'; });
      var tieneSalida  = checadas.some(function (c) { return c.tipo === 'SALIDA'; });
      var ultima = checadas.length ? checadas[checadas.length - 1] : null;

      // ── ENTRADA ────────────────────────────────────────────────────────
      if (!tieneEntrada) {
        var tol = cfgEmp.tolerancia || 15;
        var cierreBono = turno.inicioMin + tol;
        var horaEntrada = _minAHora(turno.inicioMin);

        if (minAhora >= turno.inicioMin - avEnt && minAhora < turno.inicioMin) {
          alertar(id, 'entrada', hoy + '|' + id + '|entrada_previa',
                  msgEntradaPrevia(horaEntrada, turno.inicioMin - minAhora, semilla),
                  'entrada previa');
        }
        if (minAhora >= turno.inicioMin && minAhora < cierreBono) {
          alertar(id, 'entrada', hoy + '|' + id + '|entrada_hora',
                  msgEntradaEnPunto(_minAHora(cierreBono), semilla), 'entrada en punto');
        }
        // Hasta una hora después: pasado eso, el aviso ya no ayuda a nadie.
        if (minAhora >= cierreBono && minAhora < turno.inicioMin + 60) {
          alertar(id, 'entrada', hoy + '|' + id + '|entrada_cierre_bono',
                  msgEntradaToleranciaVencida(_minAHora(turno.inicioMin + 31), semilla),
                  'tolerancia vencida');
        }
        return; // sin entrada no hay descanso ni salida que vigilar
      }

      // ── DESAYUNO / COMIDA EN CURSO ─────────────────────────────────────
      if (ultima && (ultima.tipo === 'SALIDA_DESAYUNO' || ultima.tipo === 'SALIDA_COMIDA')) {
        var esDes = ultima.tipo === 'SALIDA_DESAYUNO';
        var dur   = esDes ? (cfgEmp.desDur || durDesGen) : (cfgEmp.comDur || durComGen);
        var aviso = esDes ? avDes : avCom;
        var nom   = esDes ? 'desayuno' : 'comida';
        var trans = minAhora - ultima.min;
        var limite = ultima.min + dur;

        // La marca lleva la hora de salida: un segundo descanso el mismo día
        // tiene sus propias alertas.
        var marca = hoy + '|' + id + '|' + nom + '@' + ultima.min;

        // Apenas empieza: deja una tarjeta en la pantalla bloqueada con la
        // hora de regreso. Todas las alertas del descanso comparten el mismo
        // aviso en el celular, así que esta se va reemplazando sola y
        // siempre hay UNA tarjeta con el dato de ahorita.
        if (trans <= 1) {
          alertar(id, nom, marca + '|inicio',
                  msgDescansoEmpezo(nom, dur, _minAHora(limite)),
                  nom + ' empezó');
        }

        // A la mitad, para que la tarjeta no se quede vieja.
        var mitad = Math.floor(dur / 2);
        if (mitad > 1 && mitad < dur - aviso && trans >= mitad && trans < dur - aviso) {
          alertar(id, nom, marca + '|mitad',
                  msgDescansoMitad(nom, dur - trans, _minAHora(limite)),
                  nom + ' a la mitad');
        }

        if (trans >= dur - aviso && trans < dur) {
          alertar(id, nom, marca + '|aviso',
                  msgDescansoPorTerminar(nom, dur - trans, _minAHora(limite), semilla),
                  nom + ' por terminar');
        }
        if (trans >= dur) {
          alertar(id, nom, marca + '|limite', msgDescansoTerminado(nom, dur), nom + ' terminado');
        }
        if (trans > dur) {
          // Solo el recordatorio que toca AHORA: los atrasados se marcan en
          // silencio para que no lleguen todos juntos en ráfaga.
          var nActual = Math.min(nRec, Math.floor((trans - dur) / intRec));
          if (nActual >= 1) {
            for (var n = 1; n < nActual; n++) _marcarEnviada(marca + '|exceso_' + n);
            alertar(id, nom, marca + '|exceso_' + nActual,
                    msgDescansoExcedido(nom, trans - dur, semilla + nActual * 7),
                    nom + ' excedido');
          }
        }
      }

      // ── COMIDA NO TOMADA ───────────────────────────────────────────────
      var salioComer = checadas.some(function (c) { return c.tipo === 'SALIDA_COMIDA'; });
      if (!salioComer) {
        var faltan = turno.finMin - minAhora;
        if (faltan <= 100 && faltan > 90) {
          alertar(id, 'comida_nohecha', hoy + '|' + id + '|comida_nohecha_1@' + turno.finMin,
                  msgComidaNoTomada(_minAHora(turno.finMin), faltan, semilla), 'comida no tomada');
        }
        if (faltan <= 90 && faltan > 0) {
          alertar(id, 'comida_nohecha', hoy + '|' + id + '|comida_nohecha_2@' + turno.finMin,
                  msgComidaNoTomada(_minAHora(turno.finMin), faltan, semilla + 1), 'comida no tomada 2');
        }
      }

      // ── SALIDA ─────────────────────────────────────────────────────────
      if (!tieneSalida) {
        var hFin = _minAHora(turno.finMin);
        if (minAhora >= turno.finMin - avSal && minAhora < turno.finMin) {
          alertar(id, 'salida', hoy + '|' + id + '|salida_aviso@' + turno.finMin,
                  msgSalidaProxima(hFin, turno.finMin - minAhora), 'salida próxima');
        }
        if (minAhora >= turno.finMin && minAhora < turno.finMin + intRec) {
          alertar(id, 'salida', hoy + '|' + id + '|salida_hora@' + turno.finMin,
                  msgSalidaEnPunto(hFin), 'salida en punto',
                  URL_SALIDA_REMOTA + encodeURIComponent(id));
        }
        if (minAhora > turno.finMin) {
          var extra = minAhora - turno.finMin;
          // Se recuerda cada intRec minutos, pero solo durante los primeros
          // insisteMin. Pasado eso, ya no se manda nada más.
          var dentro = Math.min(extra, insisteMin);
          var nAct = Math.floor(dentro / intRec);
          if (nAct >= 1) {
            for (var q = 1; q < nAct; q++) {
              _marcarEnviada(hoy + '|' + id + '|salida_no_checo@' + turno.finMin + '_' + q);
            }
            alertar(id, 'salida', hoy + '|' + id + '|salida_no_checo@' + turno.finMin + '_' + nAct,
                    msgSalidaSinChecar(hFin, extra, semilla + nAct * 7), 'salida sin checar',
                    URL_SALIDA_REMOTA + encodeURIComponent(id));
          }
        }
      }
    });

  } catch (e) {
    Logger.log('❌ revisarAlertas: ' + e.message);
  }
}

function instalarTriggerAlertas() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'revisarAlertas') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('revisarAlertas').timeBased().everyMinutes(1).create();
  Logger.log('✅ Trigger instalado: revisarAlertas cada 1 minuto (activo de ' +
             ALERTAS_HORA_INICIO + ':00 a ' + ALERTAS_HORA_FIN + ':00)');
  return { ok: true };
}

// ============================================================================
// PREFERENCIAS DE ALERTAS
// ============================================================================

function crearHojaPrefsAlertas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('PREFS_ALERTAS');
  if (sheet) {
    const h = sheet.getRange(1, 1, 1, Math.max(8, sheet.getLastColumn())).getValues()[0];
    if (h.indexOf('Comida no tomada') === -1) {
      sheet.insertColumnAfter(6);
      sheet.getRange(1, 7).setValue('Comida no tomada')
        .setBackground('#3f51b5').setFontColor('#fff').setFontWeight('bold');
    }
    return sheet;
  }
  sheet = ss.insertSheet('PREFS_ALERTAS');
  sheet.getRange(1, 1, 1, 9).setValues([[
    'PIN', 'ID Usuario', 'Nombre', 'Entrada', 'Desayuno', 'Comida', 'Comida no tomada', 'Salida', 'Actualizado'
  ]]).setBackground('#3f51b5').setFontColor('#fff').setFontWeight('bold');
  sheet.setFrozenRows(1);
  return sheet;
}

function getPrefsAlertas(pin) {
  try {
    const sheet = crearHojaPrefsAlertas();
    const data = sheet.getDataRange().getValues();
    // De abajo hacia arriba: si quedaron duplicados viejos, vale el reciente
    for (let i = data.length - 1; i >= 1; i--) {
      if (_normId(data[i][0]) === _normId(pin)) {
        return { ok: true, prefs: {
          entrada:        (data[i][3] || 'SI').toString(),
          desayuno:       (data[i][4] || 'SI').toString(),
          comida:         (data[i][5] || 'SI').toString(),
          comida_nohecha: (data[i][6] || 'SI').toString(),
          salida:         (data[i][7] || 'SI').toString()
        }};
      }
    }
    return { ok: true, prefs: { entrada: 'SI', desayuno: 'SI', comida: 'SI', comida_nohecha: 'SI', salida: 'SI' } };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

function guardarPrefsAlertas(pin, prefs) {
  try {
    if (!pin || !prefs) return { ok: false, message: 'pin y prefs requeridos' };
    const usuarios = getTodosLosUsuarios();
    let emp = null;
    (usuarios.usuarios || []).forEach(function(u) { if (_normId(u.pin) === _normId(pin)) emp = u; });
    if (!emp) return { ok: false, message: 'PIN no encontrado' };

    // ⭐ CANDADO: dos guardados simultáneos (toggle rápido) creaban filas
    // duplicadas del mismo PIN, una con SI y otra con NO.
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = crearHojaPrefsAlertas();
      const data = sheet.getDataRange().getValues();
      const fila = [
        emp.pin, emp.idUsuario, emp.nombre,
        prefs.entrada === 'NO' ? 'NO' : 'SI',
        prefs.desayuno === 'NO' ? 'NO' : 'SI',
        prefs.comida === 'NO' ? 'NO' : 'SI',
        prefs.comida_nohecha === 'NO' ? 'NO' : 'SI',
        prefs.salida === 'NO' ? 'NO' : 'SI',
        Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm')
      ];
      for (let i = data.length - 1; i >= 1; i--) {
        if (_normId(data[i][0]) === _normId(pin)) sheet.deleteRow(i + 1);
      }
      sheet.appendRow(fila);
      return { ok: true, message: 'Preferencias guardadas' };
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

// ============================================================================
// TEST DE NOTIFICACIONES
// ============================================================================

function testPushEmpleado(pin) {
  try {
    const saRaw = _firebaseSA_();
    if (!saRaw) {
      return { ok: false, paso: 'CONFIG',
               message: '❌ Firebase no está configurado en este proyecto. Usa el menú Checador › Configurar Firebase.' };
    }
    try { JSON.parse(saRaw); } catch (e) {
      return { ok: false, paso: 'CONFIG', message: '❌ El JSON del service account guardado está corrupto: ' + e.message };
    }

    const sheet = crearHojaPushTokens();
    const data = sheet.getDataRange().getValues();
    const tokens = [];
    for (let i = 1; i < data.length; i++) {
      if (_normId(data[i][0]) === _normId(pin)) {
        const tk = (data[i][3] || '').toString();
        if (tk && tokens.indexOf(tk) === -1) tokens.push(tk);
      }
    }
    if (tokens.length === 0) {
      return { ok: false, paso: 'TOKENS',
               message: '❌ Este PIN no tiene ningún dispositivo registrado. Activa las notificaciones desde el perfil primero.' };
    }

    const hora = Utilities.formatDate(new Date(), TIMEZONE, 'HH:mm:ss');
    const resultados = tokens.map(function(t) {
      return _enviarPushFCMDetallado(t, '🔔 Prueba de alertas · ' + hora,
        '¡Funciona! Si ves esto, tus notificaciones del Checador están activas.', '');
    });

    const okCount = resultados.filter(function(r) { return r.ok; }).length;
    if (okCount > 0) {
      return { ok: true, paso: 'ENVIADO',
               message: '✅ Notificación enviada a ' + okCount + ' de ' + tokens.length + ' dispositivo(s). Revisa tu celular AHORA.',
               dispositivos: tokens.length, enviados: okCount };
    }
    return { ok: false, paso: 'FCM',
             message: '❌ FCM rechazó el envío. HTTP ' + resultados[0].code + ' · ' + resultados[0].body,
             dispositivos: tokens.length };
  } catch (e) {
    return { ok: false, paso: 'EXCEPCION', message: '❌ ' + e.message };
  }
}

// ============================================================================
// DIAGNÓSTICO DE ALERTAS — "¿por qué no me llega nada?"
// ============================================================================

function diagnosticoAlertas(pin) {
  try {
    const usuarios = getTodosLosUsuarios();
    let emp = null;
    (usuarios.usuarios || []).forEach(function(u) { if (_normId(u.pin) === _normId(pin)) emp = u; });
    if (!emp) return { ok: false, message: 'PIN no encontrado' };

    const d = [];
    const ahora = new Date();
    const hoy = Utilities.formatDate(ahora, TIMEZONE, 'yyyy-MM-dd');
    const hAct = parseInt(Utilities.formatDate(ahora, TIMEZONE, 'H'), 10);
    const minAhora = hAct * 60 + parseInt(Utilities.formatDate(ahora, TIMEZONE, 'm'), 10);

    const cfg = (getConfigAlertas().config) || {};
    d.push(((cfg.alertas_activas || 'SI') === 'SI' ? '✅' : '❌') +
           ' Interruptor general (CONFIG_ALERTAS): ' + (cfg.alertas_activas || 'SI'));

    const dentroVentana = (hAct >= ALERTAS_HORA_INICIO && hAct < ALERTAS_HORA_FIN);
    d.push((dentroVentana ? '✅' : '❌') + ' Ventana del motor (' + ALERTAS_HORA_INICIO + ':00–' +
           ALERTAS_HORA_FIN + ':00): ' + (dentroVentana ? 'dentro' : 'FUERA, el motor no revisa a esta hora'));

    const nT = ScriptApp.getProjectTriggers().filter(function(t) { return t.getHandlerFunction() === 'revisarAlertas'; }).length;
    d.push((nT ? '✅' : '❌') + ' Motor corriendo cada minuto: ' + (nT ? 'sí' : 'NO — menú Checador › Activar alertas'));

    d.push((_firebaseSA_() ? '✅' : '❌') + ' Firebase configurado: ' +
           (_firebaseSA_() ? 'sí' : 'NO — menú Checador › Configurar Firebase'));

    const dow = parseInt(Utilities.formatDate(ahora, TIMEZONE, 'u'), 10);
    d.push((dow >= 6 ? '❌' : '✅') + ' Día hábil: ' + (dow >= 6 ? 'NO (fin de semana, sin alertas)' : 'sí'));

    const excs = _leerExcepciones();
    const exc = _excepcionDe(excs, hoy, emp.pin);
    d.push((exc ? '❌' : '✅') + ' Excepción hoy: ' + (exc ? exc + ' (por eso no hay alertas)' : 'ninguna'));

    const prefs = (getPrefsAlertas(emp.pin).prefs) || {};
    const off = Object.keys(prefs).filter(function(k) { return prefs[k] === 'NO'; });
    d.push((off.length ? '⚠️' : '✅') + ' Tus alertas: ' + (off.length ? 'APAGADAS → ' + off.join(', ') : 'todas encendidas'));

    const st = crearHojaPushTokens();
    let disp = 0;
    if (st.getLastRow() > 1) {
      st.getRange(2, 1, st.getLastRow() - 1, 5).getValues().forEach(function(r) {
        if (_normId(r[0]) === _normId(emp.pin)) disp++;
      });
    }
    d.push((disp ? '✅' : '❌') + ' Dispositivos vinculados: ' + disp);

    const cfgT = _cfgEmpleadoServ(emp.idUsuario) || {};
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CHECADOR_CHOFERES');
    const previas = [];
    if (sheet && sheet.getLastRow() >= 3) {
      sheet.getRange(3, 1, sheet.getLastRow() - 2, 10).getValues().forEach(function(r) {
        if (_normId(r[0]) !== _normId(emp.idUsuario)) return;
        if ((r[2] || '').toString() !== hoy) return;
        const hm = (r[3] || '').toString().match(/(\d{1,2}):(\d{2})/);
        previas.push({ tipo: (r[9] || '').toString().toUpperCase(),
                       min: hm ? parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10) : 0 });
      });
    }
    previas.sort(function(a, b) { return a.min - b.min; });
    const ult = previas.length ? previas[previas.length - 1] : null;
    d.push('📋 Checadas hoy: ' + (previas.length ? previas.map(function(c) { return c.tipo; }).join(' → ') : 'ninguna'));

    if (ult && (ult.tipo === 'SALIDA_DESAYUNO' || ult.tipo === 'SALIDA_COMIDA')) {
      const esDes = ult.tipo === 'SALIDA_DESAYUNO';
      const dur = esDes ? (cfgT.desDur || cfg.duracion_desayuno_min || 20) : (cfgT.comDur || cfg.duracion_comida_min || 60);
      const aviso = esDes ? (cfg.aviso_desayuno_min_antes || 5) : (cfg.aviso_comida_min_antes || 10);
      const trans = minAhora - ult.min;
      const avisoEn = ult.min + dur - aviso;
      d.push('⏱️ ' + (esDes ? 'Desayuno' : 'Comida') + ' iniciado a las ' + _minAHora(ult.min) +
             ' · límite ' + dur + ' min (' + _minAHora(ult.min + dur) + ')');
      d.push('🔔 El aviso se manda a las ' + _minAHora(avisoEn) +
             (trans >= dur - aviso ? ' — ya debió llegar' : ' — faltan ' + (avisoEn - minAhora) + ' min'));
    } else if (ult) {
      d.push('ℹ️ Tu última checada es ' + ult.tipo + ': no hay descanso en curso.');
    }

    const turnoD = (cfgT.inicioMin != null && cfgT.finMin != null)
      ? { inicioMin: cfgT.inicioMin, finMin: cfgT.finMin } : _obtenerTurnoServ(emp.idUsuario);
    if (turnoD) {
      const tieneEnt = previas.some(function(c) { return c.tipo === 'ENTRADA'; });
      const tieneSal = previas.some(function(c) { return c.tipo === 'SALIDA'; });
      d.push('🏠 Tu salida hoy: ' + _minAHora(turnoD.finMin) +
             ' · entrada registrada: ' + (tieneEnt ? 'sí' : '❌ NO (sin entrada NO hay alertas de salida)') +
             ' · salida checada: ' + (tieneSal ? 'sí (ya no hay alertas)' : 'no'));
      if (tieneEnt && !tieneSal) {
        const avisoSal = (cfg.aviso_salida_min_antes || 5);
        const marcaAviso = PropertiesService.getScriptProperties()
          .getProperty('alerta_' + hoy + '|' + emp.idUsuario + '|salida_aviso@' + turnoD.finMin);
        d.push('🔔 Aviso previo (' + _minAHora(turnoD.finMin - avisoSal) + '): ' +
               (marcaAviso ? 'ya enviado ✅'
                           : (minAhora < turnoD.finMin - avisoSal ? 'pendiente — llegará a esa hora'
                                                                  : '⚠️ no enviado y la ventana ya pasó (revisa Ejecuciones)')));
      }
    } else {
      d.push('❌ Sin turno detectado en TURNOS_DEFAULT — sin turno no hay alertas de salida.');
    }
    d.push('🕐 Hora del servidor: ' + Utilities.formatDate(ahora, TIMEZONE, 'HH:mm:ss'));

    return { ok: true, lineas: d };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}
