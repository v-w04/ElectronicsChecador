/* ============================================================================
   AVATARES — la misma lógica que ya usaba la app
   ============================================================================
   Los avatares son de DiceBear (estilo avataaars) y se arman con el NOMBRE
   como semilla, así que cada quien siempre sale igual. Si alguien ya se
   personalizó el suyo, ese "override" viene del servidor y manda sobre la
   semilla: es el mismo que se guardó desde el editor de avatares.

   Este archivo es el recorte de Avatares.js que necesitan las pantallas
   nuevas: solo construir la URL. El editor completo sigue en el panel.
   ========================================================================== */

var AV_ESTILO = 'avataaars';

// Color de fondo por área. Los mismos de siempre.
var AV_AREA_HEX = {
  'CHOFER':'f59e0b', 'COMPRAS':'10b981', 'DEVOLUCIONES':'ef4444',
  'KAM':'8b5cf6', 'OPERACIONES':'3b82f6', 'PACKING':'06b6d4',
  'PICKING':'ec4899', 'RRHH':'84cc16', 'SEGURIDAD':'f97316'
};
var AV_FALLBACK = ['3b82f6','8b5cf6','ec4899','10b981','f59e0b','ef4444','06b6d4','84cc16'];

var AV_OPC = {
  skinColor: ['edb98a','d08b5b','ae5d29','614335'],
  hairColor: ['2c1b18','4a312c','724133','a55728','b58143','c93305','d6b370'],
  topM: ['shortCurly','shortFlat','shortRound','shortWaved','sides','theCaesar',
         'theCaesarAndSidePart','shavedSides','frizzle','bun','dreads01','dreads02'],
  topF: ['straight01','straight02','straightAndStrand','bigHair','bob','bun','curly',
         'curvy','longButNotTooLong','miaWallace','shaggy','shaggyMullet'],
  eyebrows: ['default','defaultNatural','flatNatural','raisedExcited','raisedExcitedNatural'],
  eyes: ['default','happy','squint','wink'],
  mouth: ['default','smile','twinkle','serious'],
  clothes: ['blazerAndShirt','blazerAndSweater','collarAndSweater','graphicShirt',
            'hoodie','overall','shirtCrewNeck','shirtScoopNeck','shirtVNeck'],
  clothesColor: ['3c4f5c','262e33','65c9ff','5199e4','25557c','929598','a7ffc4',
                 'b1e2ff','ff488e','ff5c5c','ffafb9','ffffb1','ffffff'],
  accessoriesColor: ['262e33','3c4f5c','65c9ff','929598','ffffff'],
  facialHairColor: ['2c1b18','4a312c','724133','a55728','b58143','d6b370']
};

var AV_NOMBRES_F = ['samantha','ximena','maria','maría','ana','laura','sofia','sofía',
  'andrea','paola','karla','diana','alejandra','fernanda','guadalupe','jimena',
  'valeria','daniela','carmen','rosa','lucia','lucía','elena','patricia','gabriela',
  'monica','mónica','veronica','verónica','claudia','adriana','leticia','brenda',
  'itzel','yare','yaretzi','abril','citlali','nayeli','dulce','esmeralda'];

function avEsFem(nombre) {
  var p = (nombre || '').toLowerCase().trim().split(/\s+/)[0];
  if (AV_NOMBRES_F.indexOf(p) !== -1) return true;
  return p.charAt(p.length - 1) === 'a' &&
         p.slice(-2) !== 'ia' && p.slice(-2) !== 'ua';
}

function avHash(s) {
  var h = 5381;
  for (var i = 0; i < s.length; i++) { h = ((h << 5) + h) ^ s.charCodeAt(i); h = h >>> 0; }
  return h;
}

function avFondo(nombre, area) {
  var k = (area || '').toString().trim().toUpperCase();
  if (AV_AREA_HEX[k]) return AV_AREA_HEX[k];
  return AV_FALLBACK[avHash(nombre || '') % AV_FALLBACK.length];
}

/**
 * URL del avatar de una persona.
 *   nombre  — la semilla; siempre da el mismo dibujo
 *   area    — color de fondo
 *   ov      — personalización guardada (opcional)
 */
function avatarUrl(nombre, area, ov) {
  nombre = (nombre || '').trim();
  ov = ov || {};
  var fem = avEsFem(nombre);
  var top = fem ? AV_OPC.topF : AV_OPC.topM;
  var p = [];

  p.push('seed=' + encodeURIComponent(nombre || 'user'));
  p.push('radius=50');
  p.push('backgroundColor=' + avFondo(nombre, area));
  p.push('backgroundType=solid');
  p.push('skinColor='    + (ov.skinColor    || AV_OPC.skinColor.join(',')));
  p.push('hairColor='    + (ov.hairColor    || AV_OPC.hairColor.join(',')));
  p.push('top='          + (ov.top          || top.join(',')));
  p.push('eyebrows='     + (ov.eyebrows     || AV_OPC.eyebrows.join(',')));
  p.push('eyes='         + (ov.eyes         || AV_OPC.eyes.join(',')));
  p.push('mouth='        + (ov.mouth        || AV_OPC.mouth.join(',')));
  p.push('clothes='      + (ov.clothes      || AV_OPC.clothes.join(',')));
  p.push('clothesColor=' + (ov.clothesColor || AV_OPC.clothesColor.join(',')));

  if (ov.accessories && ov.accessories !== 'Blank') {
    p.push('accessories=' + ov.accessories);
    p.push('accessoriesProbability=100');
    p.push('accessoriesColor=' + (ov.accessoriesColor || AV_OPC.accessoriesColor.join(',')));
  } else {
    p.push('accessoriesProbability=0');
  }

  if (ov.facialHair && ov.facialHair !== 'Blank') {
    p.push('facialHair=' + ov.facialHair);
    p.push('facialHairProbability=100');
    p.push('facialHairColor=' + (ov.facialHairColor || ov.hairColor || AV_OPC.facialHairColor.join(',')));
  } else {
    p.push('facialHairProbability=0');
  }

  return 'https://api.dicebear.com/9.x/' + AV_ESTILO + '/svg?' + p.join('&');
}

/** Iniciales, por si el avatar no carga (sin señal la primera vez). */
function avIniciales(n) {
  var p = (n || '').trim().split(/\s+/);
  return (((p[0] || '')[0] || '') + ((p[1] || '')[0] || '')).toUpperCase();
}
