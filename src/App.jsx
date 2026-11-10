import React, { useMemo, useRef, useState, useEffect } from "react";

// After deploying the read-only Google Apps Script endpoint, paste its /exec URL here.
const SHEETS_CATALOG_API_URL = "https://script.google.com/macros/s/AKfycby77XnhHUEwNjiif6StSnThsoa64Y_BYFWVY63HQjzF_4LPA3t6Fa55XAqd7OM6lEY0qA/exec";

const loadGoogleCatalog = (url) => new Promise((resolve, reject) => {
  const callbackName = `__directServiceCatalog_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const script = document.createElement("script");
  const cleanup = () => {
    delete window[callbackName];
    script.remove();
    window.clearTimeout(timeout);
  };
  const timeout = window.setTimeout(() => { cleanup(); reject(new Error("انتهت مهلة الاتصال بالشيت")); }, 15000);
  window[callbackName] = (data) => { cleanup(); resolve(data); };
  script.onerror = () => { cleanup(); reject(new Error("تعذر الاتصال بكتالوج Google Sheets")); };
  const endpoint = new URL(url);
  endpoint.searchParams.set("callback", callbackName);
  endpoint.searchParams.set("_", String(Date.now()));
  script.src = endpoint.toString();
  document.head.appendChild(script);
});

// --- Utility helpers ---
const todayISO = () => new Date().toISOString().slice(0, 10);
const makeOrderNumber = () => {
  const d = new Date();
  const y = d.getFullYear().toString().slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 900 + 100); // 3 digits
  return `ORD-${y}${m}${day}-${rand}`;
};

// Normalize incoming header names (Arabic/English variants)
const normalizeHeader = (k) => {
  const s = String(k ?? "").trim().toLowerCase();
  if ([
    "code", "الكود", "رمز", "رقم الصنف", "كود", "كود الصنف",
    "sku", "barcode", "باركود", "رقم", "product code"
  ].includes(s)) return "code";
  if (["name", "الاسم", "اسم", "اسم الصنف", "product", "item"].includes(s)) return "name";
  if (["unit", "الوحدة"].includes(s)) return "unit";
  if (["category", "الفئة", "التصنيف", "نوع", "group"].includes(s)) return "category";
  if (["brand", "العلامة", "الماركة", "البراند"].includes(s)) return "brand";
  if (["price", "السعر", "سعر", "unit price", "price (sar)"].includes(s)) return "price";
  return s;
};

const getKey = (it) => `${(it.code || "NA").trim()}|${(it.name || "").trim()}|${(it.unit || "").trim()}`;
const updateCart = (prevCart, item, qtyVal) => {
  const key = getKey(item);
  const qty = Number(qtyVal) || 0;
  const next = { ...prevCart };
  if (qty <= 0) delete next[key];
  else next[key] = {
    code: item.code, name: item.name, category: item.category || "", brand: item.brand || "",
    unit: item.unit, price: item.price || 0, qty,
  };
  return next;
};

// Extracted for testability: same logic used by the UI filter
const filterItems = (items, search, category) => {
  const s = (search || "").trim().toLowerCase();
  return (items || []).filter((x) => {
    const okCat = category === "all" || x.category === category;
    const codeStr = (x.code ?? "").toString().toLowerCase();
    const nameStr = (x.name ?? "").toString().toLowerCase();
    const brandStr = (x.brand ?? "").toString().toLowerCase();
    const okSearch = !s || codeStr.includes(s) || nameStr.includes(s) || brandStr.includes(s);
    return okCat && okSearch;
  });
};

function MainApp() {
  const [items, setItems] = useState([]);
  const [catalogStatus, setCatalogStatus] = useState(
    SHEETS_CATALOG_API_URL.startsWith("https://") ? "جارٍ تحميل الأصناف من Google Sheets…" : "الشيت غير مربوط بعد"
  );
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState({});
  const [client, setClient] = useState({ name: "", phone: "", branch: "" });
  const [notes, setNotes] = useState("");
  const [orderNo, setOrderNo] = useState(makeOrderNumber());
  const [err, setErr] = useState("");
  const fileRef = useRef(null);

  const refreshCatalog = async () => {
    if (!SHEETS_CATALOG_API_URL.startsWith("https://")) {
      setCatalogStatus("أضف رابط Apps Script في إعدادات التطبيق لربط الشيت");
      return;
    }
    try {
      const response = await loadGoogleCatalog(SHEETS_CATALOG_API_URL);
      const rows = Array.isArray(response) ? response : response?.items;
      if (!Array.isArray(rows)) throw new Error("صيغة بيانات الشيت غير صحيحة");
      const mapped = rows.map((row) => ({
        code: String(row.code ?? "").trim(),
        name: String(row.name ?? "").trim(),
        category: String(row.category ?? "غير مصنف").trim() || "غير مصنف",
        brand: String(row.brand ?? "").trim(),
        unit: String(row.unit ?? "").trim(),
        price: Number(row.price ?? 0) || 0,
      })).filter((item) => item.code || item.name);
      setItems(mapped);
      setErr("");
      setCatalogStatus(`تم تحديث ${mapped.length} صنف من Google Sheets`);
    } catch (ex) {
      console.error(ex);
      setCatalogStatus("تعذر تحديث الأصناف من الشيت؛ تحقق من رابط Apps Script وإتاحته للقراءة");
    }
  };

  useEffect(() => {
    if (!SHEETS_CATALOG_API_URL.startsWith("https://")) return;
    refreshCatalog();
    const timer = window.setInterval(refreshCatalog, 60000);
    return () => window.clearInterval(timer);
  }, []);

  // --- Load sample (fast try) ---
  const loadSample = () => {
    const sample = [
      { code: "DS0001", name: "صنف تجريبي 1", unit: "قطعة", category: "مستلزمات", brand: "دايركت سيرفس", price: 0 },
      { code: "DS0002", name: "صنف تجريبي 2", unit: "كرتون", category: "مستلزمات", brand: "دايركت سيرفس", price: 0 },
      { code: "DS0003", name: "صنف تجريبي 3", unit: "حبة", category: "معدات", brand: "دايركت سيرفس", price: 0 },
    ];
    setItems(sample);
  };

  // --- Import items from Excel/CSV (dynamic import to avoid SSR issues) ---
  const onUpload = async (e) => {
    try {
      const f = e.target.files?.[0];
      if (!f) return;
      const XLSXmod = await import("xlsx");
      const XLSX = XLSXmod?.default || XLSXmod;
      const data = await f.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

      // Single mapping block
      const mapped = rows.map((r) => {
        const o = {};
        Object.keys(r).forEach((k) => (o[normalizeHeader(k)] = r[k]));
        const code = (o.code == null) ? "" : String(o.code).trim();
        const name = (o.name == null) ? "" : String(o.name).trim();
        const unit = (o.unit == null) ? "" : String(o.unit).trim();
        const category = (o.category == null ? "" : String(o.category).trim()) || "غير مصنف";
        const brand = (o.brand == null) ? "" : String(o.brand).trim();
        const price = Number(o.price ?? 0) || 0;
        return { code, name, unit, category, brand, price };
      });

      setItems(mapped.filter((x) => x.code || x.name));
      setErr("");
    } catch (ex) {
      console.error(ex);
      setErr("تعذّر قراءة ملف الأصناف. جرّب ملفًا آخر بصيغة xlsx/csv.");
    }
  };

  // --- Derived values ---
  const categories = useMemo(() => {
    const set = new Set(items.map((x) => x.category || "غير مصنف"));
    return ["all", ...Array.from(set)];
  }, [items]);

  const filtered = useMemo(() => filterItems(items, search, category), [items, category, search]);

  // --- Cart operations ---
  const setQty = (item, q) => setCart((p) => updateCart(p, item, q));

  const totalLines = Object.values(cart).length;
  const totalQty = Object.values(cart).reduce((a, c) => a + Number(c.qty || 0), 0);
  const totalAmount = Object.values(cart).reduce((a, c) => a + (Number(c.price || 0) * Number(c.qty || 0)), 0);

  // --- Export to Excel ---
  const exportExcel = async () => {
    try {
      if (!Object.keys(cart).length) return alert("لا توجد بيانات للتصدير");
      const XLSXmod = await import("xlsx");
      const XLSX = XLSXmod?.default || XLSXmod;

      // Build data rows
      const cartRows = Object.values(cart).map((x, i) => [
        i + 1,
        x.code,
        x.name,
        x.category || "",
        x.unit,
        x.brand || "",
        Number(x.qty) || 0,
        Number(x.price) || 0,
        (Number(x.price) || 0) * (Number(x.qty) || 0),
      ]);

      const header = [
        ["نموذج طلب بضائع"],
        ["رقم الطلب", orderNo],
        ["التاريخ", todayISO()],
        ["العميل/الفرع", client.name],
        ["الجوال", client.phone],
        ["الفرع", client.branch],
        ["ملاحظات", notes || "-"],
        [],
      ];

      const tableHeader = [["#", "كود الصنف", "اسم الصنف", "الفئة", "الوحدة", "العلامة", "الكمية", "السعر", "الإجمالي"]];
      const footer = [
        [],
        ["إجمالي الأصناف", cartRows.length],
        ["إجمالي الكميات", cartRows.reduce((a, r) => a + r[6], 0)],
        ["إجمالي المبلغ", cartRows.reduce((a, r) => a + r[8], 0)],
      ];

      const rows = [...header, ...tableHeader, ...cartRows, ...footer];

      const ws = XLSX.utils.aoa_to_sheet(rows);
      // Basic column widths
      ws['!cols'] = [
        { wch: 4 },  // #
        { wch: 14 }, // code
        { wch: 40 }, // name
        { wch: 16 }, // category
        { wch: 10 }, // unit
        { wch: 14 }, // brand
        { wch: 10 }, // qty
        { wch: 12 }, // price
        { wch: 14 }, // amount
      ];

      // Add AutoFilter on the table range (header row + data rows)
      const startRow = header.length + 1; // table header row index (1-based)
      const endRow = startRow + cartRows.length; // last data row index
      ws['!autofilter'] = { ref: `A${startRow}:I${endRow}` };

      // Number formats for qty/price/amount
      for (let r = startRow + 1; r <= endRow; r++) { // data rows only
        const qtyCell = `G${r}`;
        const priceCell = `H${r}`;
        const amtCell = `I${r}`;
        if (ws[qtyCell]) ws[qtyCell].t = 'n';
        if (ws[priceCell]) { ws[priceCell].t = 'n'; ws[priceCell].z = '#,##0.00'; }
        if (ws[amtCell]) { ws[amtCell].t = 'n'; ws[amtCell].z = '#,##0.00'; }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "ملخص الطلب");

      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${orderNo}.xlsx`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
    } catch (ex) {
      console.error(ex);
      alert("تعذّر إنشاء ملف Excel – تأكد من عدم حظر المتصفح للتنزيلات المنبثقة.");
    }
  };

  // --- Lightweight self-tests to guard regressions ---
  useEffect(() => {
    try {
      // mapping: should treat Arabic/English headers correctly
      console.assert(normalizeHeader("كود الصنف") === "code", "normalizeHeader must map 'كود الصنف' -> 'code'");
      console.assert(normalizeHeader("السعر") === "price", "normalizeHeader must map Arabic 'السعر' -> 'price'");
      console.assert(normalizeHeader("UNIT PRICE") === "price", "normalizeHeader must be case-insensitive for 'UNIT PRICE' -> 'price'");

      // getKey uniqueness by unit
      const a = { code: "A", name: "X", unit: "حبة" };
      const b = { code: "A", name: "X", unit: "علبة" };
      console.assert(getKey(a) !== getKey(b), "getKey should differ for different units");

      // updateCart add/update/remove
      let c1 = updateCart({}, a, 2);
      console.assert(Object.keys(c1).length === 1 && Object.values(c1)[0].qty === 2, "add failed");
      let c2 = updateCart(c1, a, 7);
      console.assert(Object.values(c2)[0].qty === 7, "update qty failed");
      let c3 = updateCart(c2, a, 0);
      console.assert(Object.keys(c3).length === 0, "remove on zero failed");

      // extra: non-numeric qty should be treated as 0 and remove
      let c4 = updateCart(c2, a, "");
      console.assert(Object.keys(c4).length === 0, "non-numeric qty should remove line");

      // filterItems tests (brand and category filtering)
      const sample = [
        { code: "1", name: "A", brand: "X", unit: "حبة", category: "Cat1" },
        { code: "2", name: "B", brand: "Y", unit: "حبة", category: "Cat2" },
      ];
      console.assert(filterItems(sample, "x", "all").length === 1, "brand search should work");
      console.assert(filterItems(sample, "", "Cat2").length === 1, "category filter should work");
    } catch (e) { /* noop */ }
  }, [items]);

  // --- Full "واجهة الطلب" UI ---
  const whatsappText = [
    "طلب بضائع - شركة دايركت سيرفس",
    "رقم الطلب: " + orderNo,
    client.name && "العميل/المؤسسة: " + client.name,
    client.phone && "الجوال: " + client.phone,
    client.branch && "الفرع: " + client.branch,
    "",
    ...Object.values(cart).map((x) => "• " + x.code + " - " + x.name + " | " + x.unit + " | الكمية: " + x.qty),
    "",
    "إجمالي الكميات: " + totalQty,
    notes && "ملاحظات: " + notes,
  ].filter(Boolean).join("\n");

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-2xl bg-yellow-400" />
            <div>
              <h1 className="text-xl font-bold">شركة دايركت سيرفس — نموذج طلب بضائع</h1>
              <p className="text-sm text-gray-500">{catalogStatus} · اختَر الأصناف وأدخل الكميات ثم صدِّر الطلب إلى Excel</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <button onClick={refreshCatalog} className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700">تحديث الأصناف</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid md:grid-cols-3 gap-6">
        <section className="md:col-span-2 space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm mb-1">بحث حسب الاسم، الكود أو الفئة</label>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="اكتب كلمة البحث هنا" className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="block text-sm mb-1">الفئة</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200">
                {categories.map((c) => <option key={c} value={c}>{c === "all" ? "كل الفئات" : c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">رقم الطلب</label>
              <input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
            <div><label className="block text-sm mb-1">اسم العميل / المؤسسة</label><input value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200" /></div>
            <div><label className="block text-sm mb-1">رقم الجوال</label><input value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200" /></div>
            <div><label className="block text-sm mb-1">الفرع</label><input value={client.branch} onChange={(e) => setClient({ ...client, branch: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200" /></div>
            <div className="md:col-span-3"><label className="block text-sm mb-1">ملاحظات</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="اكتب أي تعليمات خاصة بالطلبية (اختياري)" /></div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between"><h2 className="font-semibold">الأصناف ({filtered.length})</h2><p className="text-sm text-gray-500">انقر في خانة الكمية لإضافة الصنف</p></div>
            <div className="overflow-auto max-h-[60vh]"><table className="w-full text-sm"><thead className="bg-gray-50 sticky top-0 z-10"><tr>
              <th className="text-right p-2">الكود</th><th className="text-right p-2">الاسم</th><th className="text-right p-2">الفئة</th><th className="text-right p-2">الوحدة</th><th className="text-right p-2">الكمية</th>
            </tr></thead><tbody>
              {filtered.map((it) => { const key = getKey(it); const current = cart[key]?.qty || ""; return (
                <tr key={key} className="border-t border-gray-200"><td className="p-2 whitespace-nowrap">{it.code}</td><td className="p-2">{it.name}</td><td className="p-2 whitespace-nowrap">{it.category}</td><td className="p-2 whitespace-nowrap">{it.unit}</td><td className="p-2 w-[120px]"><input type="number" min={0} value={current} onChange={(e) => setQty(it, e.target.value)} className="w-full px-2 py-1 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200" /></td></tr>
              );})}
            </tbody></table></div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-semibold text-center mb-4">ملخص الطلب</h3>
            <div className="flex items-center justify-between text-sm mb-2"><span className="text-gray-600">عدد الأصناف</span><span className="font-semibold">{totalLines}</span></div>
            <div className="flex items-center justify-between text-sm mb-4"><span className="text-gray-600">إجمالي الكميات</span><span className="font-semibold">{totalQty}</span></div>
            <div className="flex gap-2 mb-2"><button onClick={exportExcel} disabled={!totalLines} className="flex-1 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50">تصدير الطلبية إلى Excel</button><button onClick={() => { setCart({}); setOrderNo(makeOrderNumber()); }} className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200">مسح</button></div>
            <button onClick={() => { if (!totalLines) return alert("أضف أصنافًا للطلب أولًا"); window.open("https://wa.me/?text=" + encodeURIComponent(whatsappText), "_blank", "noopener,noreferrer"); }} className="w-full px-3 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-500 text-white">مشاركة عبر واتساب</button>
            <p className="text-xs text-gray-500 mt-2 text-center">ستفتح رسالة الطلب في واتساب لمراجعتها وإرسالها.</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200"><h4 className="font-semibold">الأصناف المختارة</h4><span className="text-xs text-gray-500">يمكن تعديل الكميات من الجدول</span></div>
            <div className="max-h-[40vh] overflow-auto"><table className="w-full text-sm"><thead className="bg-gray-50 sticky top-0 z-10"><tr><th className="text-right p-2">الكمية</th><th className="text-right p-2">الوحدة</th><th className="text-right p-2">الصنف</th><th className="text-right p-2">الكود</th></tr></thead><tbody>
              {Object.values(cart).length === 0 && <tr><td className="p-4 text-center text-gray-500" colSpan={4}>لا توجد أصناف مختارة حتى الآن</td></tr>}
              {Object.values(cart).map((x, idx) => <tr key={idx} className="border-t border-gray-200"><td className="p-2 whitespace-nowrap">{x.qty}</td><td className="p-2 whitespace-nowrap">{x.unit}</td><td className="p-2">{x.name}</td><td className="p-2 whitespace-nowrap">{x.code}</td></tr>)}
            </tbody></table></div>
          </div>
        </aside>
      </main>
    </div>
  );
}

// Simple error boundary to surface runtime errors (helps when site "doesn't open")
class ErrorBoundary extends React.Component { 
  constructor(props){
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(err){
    return { hasError: true, error: err };
  }
  componentDidCatch(err, info){
    console.error("App error:", err, info);
  }
  render(){
    if(this.state.hasError){
      return (
        <div className="p-6">
          <h1 className="text-lg font-bold text-red-600 mb-2">حدث خطأ غير متوقّع</h1>
          <pre className="bg-red-50 text-red-700 p-3 rounded overflow-auto text-xs">{String(this.state.error)}</pre>
          <p className="text-sm text-gray-600 mt-2">لو أمكن، انسخ رسالة الخطأ من Console وأرسلها لي.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App(){
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

