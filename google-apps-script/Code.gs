/** Read-only catalog endpoint for the Direct Service order site.
 * Attach this script to the catalog spreadsheet through Extensions > Apps Script.
 * The web app returns the public catalog fields used by the order form; it never writes to the sheet.
 */
function doGet(e) {
  var callback = e && e.parameter ? String(e.parameter.callback || "") : "";
  var items = readCatalog_();
  var body = callback && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)
    ? callback + "(" + JSON.stringify(items) + ");"
    : JSON.stringify(items);
  var mimeType = callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON;
  return ContentService.createTextOutput(body).setMimeType(mimeType);
}

function readCatalog_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheets()[0];
  var values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];

  var headers = values[0].map(normalizeHeader_);
  var indexes = {
    code: headers.indexOf("code"),
    name: headers.indexOf("name"),
    category: headers.indexOf("category"),
    brand: headers.indexOf("brand"),
    unit: headers.indexOf("unit"),
    uom: headers.indexOf("uom"),
    price: headers.indexOf("price"),
  };

  return values.slice(1).map(function (row) {
    return {
      code: cell_(row, indexes.code),
      name: cell_(row, indexes.name),
      category: cell_(row, indexes.category),
      brand: cell_(row, indexes.brand),
      unit: cell_(row, indexes.unit),
      uom: cell_(row, indexes.uom),
      price: cell_(row, indexes.price),
    };
  }).filter(function (item) { return item.code || item.name; });
}

function cell_(row, index) {
  return index < 0 ? "" : String(row[index] || "").trim();
}

function normalizeHeader_(value) {
  var header = String(value || "").trim().toLowerCase();
  if (["code", "الكود", "كود", "رمز", "رقم الصنف", "كود الصنف", "sku", "barcode", "باركود"].indexOf(header) >= 0) return "code";
  if (["name", "الاسم", "اسم", "اسم الصنف", "product", "item"].indexOf(header) >= 0) return "name";
  if (["category", "الفئة", "التصنيف", "نوع", "group"].indexOf(header) >= 0) return "category";
  if (["brand", "العلامة", "الماركة", "البراند"].indexOf(header) >= 0) return "brand";
  if (["unit", "الوحدة"].indexOf(header) >= 0) return "unit";
  if (["uom", "unit of measure", "وحدة القياس"].indexOf(header) >= 0) return "uom";
  if (["price", "السعر", "سعر", "unit price", "price (sar)"].indexOf(header) >= 0) return "price";
  return header;
}
