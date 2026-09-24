/**
 * ============================================================================
 *  Mensajes.gs — TEXTOS DE LAS ALERTAS
 * ============================================================================
 *
 *  Todo lo que el empleado lee en su celular vive aquí y en ningún otro lado.
 *  Para cambiar el tono, la redacción o una regla que se menciona, se edita
 *  este archivo: el motor de alertas (revisarAlertas) solo pide el texto.
 *
 *  CRITERIOS DE REDACCIÓN
 *
 *  1. Un dato duro por mensaje: la hora, los minutos que faltan o los que
 *     lleva de más. Sin el dato, el aviso es ruido.
 *  2. La consecuencia se dice una vez y con la regla real ("una hora de
 *     descuento", "pierdes el bono"), nunca con adjetivos.
 *  3. Se habla de la regla, no de la persona: "el exceso se descuenta",
 *     no "serás castigado". Dice lo mismo y no se siente regaño, que es
 *     justo lo que hace que la gente silencie las notificaciones.
 *  4. Frases cortas. El aviso se lee en la pantalla bloqueada, de reojo.
 *  5. Las variantes existen para que el quinto recordatorio del día no sea
 *     idéntico al primero, no para adornar. Todas dicen lo mismo.
 *
 *  REGLAS QUE SE CITAN (si cambian en la empresa, hay que cambiarlas aquí)
 *   · Pasarse del desayuno o de la comida: una hora de descuento.
 *   · Entrar después de la tolerancia: se pierde el bono de puntualidad.
 *   · 3 retardos en la quincena: medio día · 6: un día · 9: día y medio.
 *   · La hora de comida no es tiempo pagado: si no se toma, no se repone.
 * ============================================================================
 */

/** Elige una variante de forma estable: el mismo día y la misma persona ven
 *  siempre la misma. Así el mensaje no cambia si el motor reintenta. */
function _variante_(lista, semilla) {
  if (!lista || !lista.length) return '';
  var s = Math.abs(parseInt(semilla, 10) || 0);
  return lista[s % lista.length];
}

/** Hora en formato 08:05 a partir de minutos desde medianoche. */
function _hora_(totalMin) {
  var h = Math.floor(totalMin / 60) % 24;
  var m = totalMin % 60;
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}

// ============================================================================
// ENTRADA
// ============================================================================

/** Antes de la hora de entrada. */
function msgEntradaPrevia(horaEntrada, minutosFaltan, semilla) {
  return {
    titulo: '⏳ Entras a las ' + horaEntrada,
    cuerpo: _variante_([
      'Faltan ' + minutosFaltan + ' min. Llegando a tiempo conservas el bono.',
      'Te quedan ' + minutosFaltan + ' min para checar sin perder el bono.',
      'Faltan ' + minutosFaltan + ' min. Checa al llegar, no al acomodarte.',
      'En ' + minutosFaltan + ' min empieza tu turno. El bono se conserva checando a tiempo.',
      'Quedan ' + minutosFaltan + ' min para tu entrada.'
    ], semilla)
  };
}

/** Ya es la hora y aún no checa; sigue dentro de la tolerancia. */
function msgEntradaEnPunto(horaCierreBono, semilla) {
  return {
    titulo: '🕐 Es tu hora de entrada',
    cuerpo: _variante_([
      'Todavía puedes checar sin perder el bono: tienes hasta las ' + horaCierreBono + '.',
      'Aún estás a tiempo. El bono se pierde después de las ' + horaCierreBono + '.',
      'Checa ahora. La tolerancia termina a las ' + horaCierreBono + '.',
      'Tienes hasta las ' + horaCierreBono + ' para checar con bono.',
      'Registra tu entrada antes de las ' + horaCierreBono + ' y conservas el bono.'
    ], semilla)
  };
}

/** Se acabó la tolerancia y sigue sin checar. */
function msgEntradaToleranciaVencida(horaRetardo, semilla) {
  return {
    titulo: '⚠️ Entrada sin registrar',
    cuerpo: _variante_([
      'Se acabó la tolerancia: el bono de hoy ya se perdió. A partir de las ' + horaRetardo + ' cuenta como retardo.',
      'El bono de hoy ya no aplica. Si checas después de las ' + horaRetardo + ', se registra retardo.',
      'Pasó la tolerancia. Checa antes de las ' + horaRetardo + ' para que no cuente como retardo.',
      'Sin bono por hoy. El retardo empieza a las ' + horaRetardo + '.',
      'Aún no registras tu entrada. Desde las ' + horaRetardo + ' se cuenta retardo, y 3 retardos en la quincena son medio día.'
    ], semilla)
  };
}

/**
 * El recordatorio que insiste cuando ya pasó media hora y sigue sin entrada.
 *
 * ESTE NO ES UN REGAÑO, ES UN INTERRUPTOR. Si la persona hoy no viene, el
 * aviso le sirve para decirlo y apagar todo lo del día de un toque. Por eso
 * la salida va PRIMERO y la consecuencia ni se menciona: a alguien de
 * vacaciones o enfermo no le importa el bono, le importa dejar de recibir
 * avisos. Lo del retardo ya se dijo en el aviso de tolerancia vencida, que
 * es donde sí viene al caso.
 *
 * Al tocarlo se abre la app en la hoja de marcar el día.
 */
function msgEntradaSinRegistrar(semilla) {
  return {
    titulo: '¿Hoy no vienes?',
    cuerpo: _variante_([
      'Sigue sin registrarse tu entrada. Si hoy no trabajas, toca este aviso y márcalo: dejan de llegarte avisos el resto del día.',
      'Toca este aviso para marcar el día —vacaciones, permiso, incapacidad— y no te llega nada más hoy. Si ya llegaste, registra tu entrada.',
      'Si hoy no vienes, márcalo desde aquí y se apagan los avisos del día. Si sí, checa tu entrada y también dejan de llegar.',
      'No veo tu entrada. Toca este aviso para marcar el día y apagar los recordatorios.'
    ], semilla)
  };
}

// ============================================================================
// DESAYUNO Y COMIDA EN CURSO
// ============================================================================

/** Falta poco para que se acabe el descanso. nombre = 'desayuno' | 'comida'. */
/**
 * Al empezar el descanso. Esta es la que se queda en la pantalla bloqueada
 * del celular: dice a qué hora hay que estar de vuelta, para consultarla de
 * un vistazo sin abrir nada.
 */
function msgDescansoEmpezo(nombre, duracionMin, horaLimite) {
  return {
    titulo: '⏱️ ' + duracionMin + ' min de ' + nombre,
    cuerpo: 'Termina a las ' + horaLimite + '. Deja este aviso en tu pantalla para verlo rápido.'
  };
}

/** A media hora del descanso, para refrescar la tarjeta. */
function msgDescansoMitad(nombre, minutosRestantes, horaLimite) {
  return {
    titulo: '⏱️ Te quedan ' + minutosRestantes + ' min de ' + nombre,
    cuerpo: 'Termina a las ' + horaLimite + '.'
  };
}

function msgDescansoPorTerminar(nombre, minutosRestantes, horaLimite, semilla) {
  return {
    titulo: '⏰ Te quedan ' + minutosRestantes + ' min de ' + nombre,
    cuerpo: _variante_([
      'Tu ' + nombre + ' termina a las ' + horaLimite + '. Pasarse un minuto son 60 de descuento.',
      'Regresa y checa antes de las ' + horaLimite + '. El exceso se descuenta por hora completa.',
      'Quedan ' + minutosRestantes + ' min. Después de las ' + horaLimite + ', cada minuto cuesta una hora.',
      'Cierra tu ' + nombre + ' antes de las ' + horaLimite + '.',
      'Te quedan ' + minutosRestantes + ' min antes de que empiece a contar el descuento.'
    ], semilla)
  };
}

/** Justo cuando se acabó el tiempo del descanso. */
function msgDescansoTerminado(nombre, duracionMin) {
  return {
    titulo: '⏰ Se acabó tu ' + nombre,
    cuerpo: 'Eran ' + duracionMin + ' min. Registra tu regreso: a partir de ahora el exceso se descuenta por hora completa.'
  };
}

/** Ya se pasó del tiempo y sigue sin registrar el regreso. */
function msgDescansoExcedido(nombre, minutosExceso, semilla) {
  return {
    titulo: '❌ ' + minutosExceso + ' min de más en tu ' + nombre,
    cuerpo: _variante_([
      'El exceso se descuenta por hora completa. Registra tu regreso.',
      'Llevas ' + minutosExceso + ' min de más. Checa tu regreso para que no siga creciendo.',
      'Cada minuto de más cuenta como una hora de descuento. Van ' + minutosExceso + '.',
      'Tu ' + nombre + ' terminó hace ' + minutosExceso + ' min. Registra tu regreso.',
      'Regresa y checa: el descuento es por hora completa, no por minuto.',
      'Llevas ' + minutosExceso + ' min de exceso. Ciérralo ya.',
      'Checa tu regreso. El exceso de hoy va en ' + minutosExceso + ' min.',
      'Van ' + minutosExceso + ' min sobre el límite de tu ' + nombre + '.'
    ], semilla)
  };
}

// ============================================================================
// COMIDA NO TOMADA
// ============================================================================

function msgComidaNoTomada(horaSalida, minutosParaSalir, semilla) {
  return {
    titulo: '🍽️ Todavía no sales a comer',
    cuerpo: _variante_([
      'Faltan ' + minutosParaSalir + ' min para tu salida (' + horaSalida + '). La hora de comida no se paga ni se repone.',
      'Sales a las ' + horaSalida + '. Si no tomas tu comida, ese tiempo se pierde.',
      'Te quedan ' + minutosParaSalir + ' min de jornada. Tu hora de comida sigue sin usarse.',
      'Última ventana para comer antes de las ' + horaSalida + '.'
    ], semilla)
  };
}

// ============================================================================
// SALIDA
// ============================================================================

/** Falta poco para la hora de salida. */
function msgSalidaProxima(horaSalida, minutosFaltan) {
  return {
    titulo: '🏠 Sales a las ' + horaSalida,
    cuerpo: 'Faltan ' + minutosFaltan + ' min. No olvides checar tu salida.'
  };
}

/** Justo a la hora de salida. */
function msgSalidaEnPunto(horaSalida) {
  return {
    titulo: '🏠 Es tu hora de salida',
    cuerpo: 'Son las ' + horaSalida + '. Registra tu salida. Si ya no estás en la oficina, toca este aviso para checarla desde aquí.'
  };
}

/** Pasó su hora y no ha checado salida. */
function msgSalidaSinChecar(horaSalida, minutosExtra, semilla) {
  var base = _variante_([
    'Tu turno terminó a las ' + horaSalida + ' y llevas ' + minutosExtra + ' min sin registrar la salida.',
    'Van ' + minutosExtra + ' min después de tu hora. Sin la checada, ese tiempo no queda registrado.',
    'No has checado tu salida. Tu jornada cerró a las ' + horaSalida + '.',
    'Llevas ' + minutosExtra + ' min sobre tu horario. Registra tu salida para cerrar el día.',
    'Tu salida era a las ' + horaSalida + '. Sin checar, el día queda incompleto.',
    'Van ' + minutosExtra + ' min extra. Ciérralos con tu checada de salida.'
  ], semilla);
  return {
    titulo: '⏱️ Salida sin registrar · ' + minutosExtra + ' min',
    cuerpo: base + ' Toca este aviso para registrarla desde el celular.'
  };
}

// ============================================================================
// CONFIRMACIONES (lo que ve al checar, no son push)
// ============================================================================

function msgVeredictoPuntual()        { return 'Llegaste a tiempo. Bono a salvo.'; }
function msgVeredictoTolerancia(min)  { return min + ' min de tolerancia usados. El bono sigue a salvo.'; }
function msgVeredictoSinBono(min)     { return min + ' min tarde: se pierde el bono de hoy. Todavía no cuenta como retardo.'; }
function msgVeredictoRetardo(min)     { return min + ' min tarde: cuenta como retardo. 3 retardos en la quincena son medio día.'; }
