// Professional PDF builder for BANSANG HOSPITAL.
//
// Generates styled A4 PDFs with:
//   - Helvetica for titles/body text
//   - Courier-Bold for table headers, Courier for table rows (monospace alignment)
//   - Navy header bar with white text, properly covering the text
//   - Alternating row shading
//   - Column separator lines and row borders
//   - Page numbers (Page X of Y) in footer
//
// buildPdf options:
//   title   - array of { t, b?, s?, color? }
//   sections- array of { title?, header, rows, headerBg?, columns? }
//             columns: array of integers — character widths per column (Courier chars)
//   footer  - left-side footer text

var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function padCol(str, len) {
  str = str == null ? '' : String(str);
  if (str.length > len) str = str.slice(0, Math.max(1, len - 1)) + '~';
  while (str.length < len) str += ' ';
  return str;
}

function shortDate(str) {
  var p = String(str).split('-');
  if (p.length !== 3) return str;
  return parseInt(p[2], 10) + ' ' + MONTHS[parseInt(p[1], 10) - 1];
}

function escapePdf(s) {
  s = s == null ? '' : String(s).replace(/[^\x20-\x7E]/g, '?');
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildPdf(opts) {
  var W = opts.width || 595.28;
  var H = opts.height || 841.89;
  var marginX = opts.marginX != null ? opts.marginX : 42;
  var marginTop = opts.marginTop != null ? opts.marginTop : 48;
  var marginBottom = opts.marginBottom != null ? opts.marginBottom : 52;
  var title = opts.title || [];
  var sections = opts.sections || [];
  var footer = opts.footer || '';

  // --- Color palette ---
  var navyRGB      = [20, 50, 120];
  var darkRGB      = [30, 30, 30];
  var mutedRGB     = [110, 115, 120];
  var headerBgRGB  = [20, 50, 120];
  var altRowRGB    = [245, 247, 250];
  var borderRGB    = [200, 205, 212];

  var pages = [];
  var page = [];
  var y = H - marginTop;

  function fontRef(name) { return '/' + name + ' '; }

  function adv(t, b, s, color, font) {
    font = font || (b ? 'Helvetica-Bold' : 'Helvetica');
    page.push({ type: 'text', t: t, font: font, s: s || 10, y: y, color: color || darkRGB });
    y -= s * 1.5;
  }

  function drawHLine(yy, x1, x2, r, g, b, w) {
    page.push({ type: 'line', x1: x1, y1: yy, x2: x2, y2: yy, r: r, g: g, b: b, w: w || 0.5 });
  }

  function drawVLine(xx, y1, y2, r, g, b, w) {
    page.push({ type: 'line', x1: xx, y1: y1, x2: xx, y2: y2, r: r, g: g, b: b, w: w || 0.4 });
  }

  function drawRect(x, yy, w, h, r, g, b) {
    page.push({ type: 'rect', x: x, y: yy, w: w, h: h, r: r, g: g, b: b });
  }

  function closePage() {
    pages.push(page);
    page = [];
    y = H - marginTop;
  }

  function ensurePageSpace(needed) {
    if (y - needed < marginBottom) {
      drawFooterOnPage();
      closePage();
      return true;
    }
    return false;
  }

  function drawFooterOnPage() {
    var footerY = 28;
    page.push({ type: 'line', x1: marginX, y1: footerY + 12, x2: W - marginX, y2: footerY + 12, r: borderRGB[0], g: borderRGB[1], b: borderRGB[2], w: 0.4 });
    page.push({ type: 'text', t: footer, font: 'Helvetica', s: 7, y: footerY + 3, color: mutedRGB });
    page.push({ type: 'pageNum', y: footerY + 3, right: true });
  }

  // --- Top accent bar (subtle) ---
  drawRect(0, H - 3, W, 3, navyRGB[0], navyRGB[1], navyRGB[2]);

  // --- Title block ---
  y -= 2;
  title.forEach(function (ln) {
    var font = ln.b ? 'Helvetica-Bold' : 'Helvetica';
    adv(ln.t, ln.b, ln.s || 10, ln.color || darkRGB, font);
  });

  y -= 2;
  drawHLine(y, marginX, W - marginX, navyRGB[0], navyRGB[1], navyRGB[2], 0.8);
  y -= 12;

  // --- Sections ---
  sections.forEach(function (sec, secIdx) {
    if (secIdx > 0) {
      if (!ensurePageSpace(40)) y -= 12;
    }

    // Section title
    if (sec.title) {
      ensurePageSpace(30);
      adv(sec.title, true, 10, navyRGB, 'Helvetica-Bold');
      y -= 1;
      drawHLine(y, marginX, W - marginX, navyRGB[0], navyRGB[1], navyRGB[2], 0.5);
      y -= 10;
    }

    // --- Table rendering ---
    var hdrLines = sec.header || [];
    var rowsData = sec.rows || [];
    var colWidths = sec.columns || null;

    if (hdrLines.length === 0 && rowsData.length === 0) return;

    // Determine the Courier font size from the first header or first row
    var tableSz = 8.5;
    if (hdrLines.length > 0) tableSz = hdrLines[0].s || 8.5;
    else if (rowsData.length > 0) tableSz = rowsData[0].s || 8.5;

    // Courier character width: exactly 0.6 * fontSize for the standard Courier font
    var cw = tableSz * 0.6;

    // Compute column x-positions from character widths
    var colX = [marginX];
    if (colWidths) {
      var cumulative = marginX;
      for (var ci = 0; ci < colWidths.length; ci++) {
        cumulative += colWidths[ci] * cw;
        colX.push(cumulative);
      }
    }

    // Total table width (right edge)
    var tableRight = colX.length > 1 ? colX[colX.length - 1] : W - marginX;

    // --- Header row ---
    var hdrH = tableSz + 10; // 5pt padding top + 5pt padding bottom

    if (ensurePageSpace(hdrH + tableSz + 8)) {} // ensure header + at least one row

    var hdrBg = sec.headerBg || headerBgRGB;
    // Draw the navy background rect: from y (top) down to y - hdrH (bottom)
    drawRect(marginX - 4, y - hdrH, tableRight - marginX + 8, hdrH, hdrBg[0], hdrBg[1], hdrBg[2]);

    // Draw header text centered vertically inside the rect
    // Text baseline = rect_bottom + (rect_height - capHeight) / 2 + descent
    // For Courier capHeight ≈ 0.68 * fontSize, descent ≈ 0.28 * fontSize
    var capH = tableSz * 0.68;
    var descent = tableSz * 0.28;
    var hdrTextY = (y - hdrH) + (hdrH - capH) / 2 + descent;

    hdrLines.forEach(function (ln) {
      var lineSz = ln.s || tableSz;
      page.push({ type: 'text', t: ln.t, font: 'Courier-Bold', s: lineSz, y: hdrTextY, color: [255, 255, 255], xOff: 3 });
      hdrTextY -= lineSz + 2;
    });

    // Column separator lines through the header
    if (colX.length > 1) {
      for (var vi = 1; vi < colX.length - 1; vi++) {
        drawVLine(colX[vi], y, y - hdrH, borderRGB[0], borderRGB[1], borderRGB[2], 0.35);
      }
    }

    y -= hdrH;

    // Bottom border of header (thin line separating header from body)
    drawHLine(y, marginX - 4, tableRight + 4, borderRGB[0], borderRGB[1], borderRGB[2], 0.4);

    // --- Data rows ---
    var rowH = tableSz + 6; // consistent row height: 3pt padding top + 3pt padding bottom

    rowsData.forEach(function (ln, idx) {
      if (ensurePageSpace(rowH)) {}

      var rowTop = y;
      y -= rowH;

      // Alternating row background
      if (idx % 2 !== 0) {
        drawRect(marginX - 4, y, tableRight - marginX + 8, rowH, altRowRGB[0], altRowRGB[1], altRowRGB[2]);
      }

      // Row text centered vertically
      var capH2 = tableSz * 0.68;
      var descent2 = tableSz * 0.28;
      var rowTextY = y + (rowH - capH2) / 2 + descent2;

      page.push({
        type: 'text',
        t: ln.t,
        font: 'Courier',
        s: ln.s || tableSz,
        y: rowTextY,
        color: ln.color || darkRGB,
        xOff: 3
      });

      // Column separator lines through this row
      if (colX.length > 1) {
        for (var vi2 = 1; vi2 < colX.length - 1; vi2++) {
          drawVLine(colX[vi2], rowTop, y, borderRGB[0], borderRGB[1], borderRGB[2], 0.3);
        }
      }

      // Row top border
      drawHLine(rowTop, marginX - 4, tableRight + 4, borderRGB[0], borderRGB[1], borderRGB[2], 0.3);
    });

    // Bottom border of last row
    drawHLine(y, marginX - 4, tableRight + 4, borderRGB[0], borderRGB[1], borderRGB[2], 0.4);
  });

  drawFooterOnPage();
  pages.push(page);

  // --- Render content streams ---
  var totalPages = pages.length;

  var contents = pages.map(function (pg, pIdx) {
    var c = '';
    pg.forEach(function (item) {
      if (item.type === 'text') {
        var cr = item.color[0] / 255;
        var cg = item.color[1] / 255;
        var cb = item.color[2] / 255;
        c += cr.toFixed(4) + ' ' + cg.toFixed(4) + ' ' + cb.toFixed(4) + ' rg\n';
        c += 'BT\n' + fontRef(item.font) + item.s + ' Tf\n';
        var tx = marginX + (item.xOff || 0);
        c += tx.toFixed(2) + ' ' + item.y.toFixed(2) + ' Td\n';
        c += '(' + escapePdf(item.t) + ') Tj\nET\n';
        c += '0 0 0 rg\n';
      } else if (item.type === 'line') {
        var lr = item.r / 255;
        var lg = item.g / 255;
        var lb = item.b / 255;
        c += lr.toFixed(4) + ' ' + lg.toFixed(4) + ' ' + lb.toFixed(4) + ' RG\n';
        c += item.w.toFixed(2) + ' w\n';
        c += item.x1.toFixed(2) + ' ' + item.y1.toFixed(2) + ' m ' + item.x2.toFixed(2) + ' ' + item.y2.toFixed(2) + ' l S\n';
        c += '0 0 0 RG\n';
      } else if (item.type === 'rect') {
        var rr = item.r / 255;
        var rg = item.g / 255;
        var rb = item.b / 255;
        c += rr.toFixed(4) + ' ' + rg.toFixed(4) + ' ' + rb.toFixed(4) + ' rg\n';
        c += item.x.toFixed(2) + ' ' + item.y.toFixed(2) + ' ' + item.w.toFixed(2) + ' ' + item.h.toFixed(2) + ' re f\n';
        c += '0 0 0 rg\n';
      } else if (item.type === 'pageNum') {
        var pageNumText = 'Page ' + (pIdx + 1) + ' of ' + totalPages;
        var tw = pageNumText.length * 4.2;
        var px = W - marginX - tw;
        c += '0.4314 0.4588 0.4706 rg\n';
        c += 'BT\n' + fontRef('Helvetica') + ' 7 Tf\n';
        c += px.toFixed(2) + ' ' + item.y.toFixed(2) + ' Td\n';
        c += '(' + escapePdf(pageNumText) + ') Tj\nET\n';
        c += '0 0 0 rg\n';
      }
    });
    return c;
  });

  // --- Build PDF objects ---
  var nPages = pages.length;
  var pageStart = 7;
  var streamStart = 7 + nPages;
  var objs = [];

  objs.push({ type: 'dict', dict: '<< /Type /Catalog /Pages 2 0 R >>' });

  var kids = [];
  for (var k = 0; k < nPages; k++) kids.push((pageStart + k) + ' 0 R');
  objs.push({ type: 'dict', dict: '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + nPages + ' >>' });

  objs.push({ type: 'dict', dict: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>' });
  objs.push({ type: 'dict', dict: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>' });
  objs.push({ type: 'dict', dict: '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>' });
  objs.push({ type: 'dict', dict: '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>' });

  for (var k2 = 0; k2 < nPages; k2++) {
    var sNum = streamStart + k2;
    objs.push({ type: 'dict', dict: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /Helvetica 3 0 R /Helvetica-Bold 4 0 R /Courier 5 0 R /Courier-Bold 6 0 R >> >> /Contents ' + sNum + ' 0 R >>' });
  }

  for (var ci2 = 0; ci2 < nPages; ci2++) {
    objs.push({ type: 'stream', data: contents[ci2] });
  }

  // --- Serialize ---
  var out = '%PDF-1.4\n';
  var offsets = [];

  for (var oi = 0; oi < objs.length; oi++) {
    offsets.push(out.length);
    var objNum = oi + 1;
    if (objs[oi].type === 'stream') {
      var sd = objs[oi].data;
      if (sd.charAt(sd.length - 1) === '\n') sd = sd.substring(0, sd.length - 1);
      out += objNum + ' 0 obj\n<< /Length ' + sd.length + ' >>\nstream\n' + sd + '\nendstream\nendobj\n';
    } else {
      out += objNum + ' 0 obj\n' + objs[oi].dict + '\nendobj\n';
    }
  }

  var xref = out.length;
  out += 'xref\r\n0 ' + (objs.length + 1) + '\r\n';
  out += '0000000000 65535 f\r\n';
  offsets.forEach(function (o) {
    var s = String(o);
    while (s.length < 10) s = '0' + s;
    out += s + ' 00000 n\r\n';
  });

  out += 'trailer\r\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\r\nstartxref\r\n' + xref + '\r\n%%EOF';
  return out;
}

if (typeof window !== 'undefined') {
  window.PDFExport = { buildPdf: buildPdf, padCol: padCol, shortDate: shortDate };
  console.log('[PDF] pdf-export.js loaded, window.PDFExport set');
}
