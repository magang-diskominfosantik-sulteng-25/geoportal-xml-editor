import "./App.css";
import { useState, useEffect, useRef, useCallback } from "react";

function App() {
  const [template, setTemplate] = useState("");
  const [placeholders, setPlaceholders] = useState([]);
  const [values, setValues] = useState({});
  const [keepBrackets, setKeepBrackets] = useState(false);
  const [preview, setPreview] = useState("");
  const [status, setStatus] = useState({ text: "Siap", ok: true });
  const [leftoverPlaceholders, setLeftoverPlaceholders] = useState([]);
  const [filename, setFilename] = useState("");

  const fileInputRef = useRef(null);

  const unique = (arr) => Array.from(new Set(arr));

  const updateStatus = (text, ok = true) => {
    setStatus({ text, ok });
  };

  const scanPlaceholders = useCallback(() => {
    if (!template.trim()) {
      updateStatus("Template kosong", false);
      setPlaceholders([]);
      setPreview("");
      return;
    }

    // Regex yang lebih robust untuk mendeteksi placeholder
    // Menangani [PLACEHOLDER], [[PLACEHOLDER]], dan placeholder dengan karakter khusus
    const regex = /\[+([^\]]+)\]+/g;
    const found = [];
    for (const m of template.matchAll(regex)) {
      // Clean up double brackets atau leading/trailing whitespace
      const placeholder = m[1].trim();
      if (placeholder) {
        found.push(placeholder);
      }
    }

    const uniquePlaceholders = unique(found);
    setPlaceholders(uniquePlaceholders);

    // Preserve existing values, add empty values for new placeholders
    const newValues = { ...values };
    uniquePlaceholders.forEach((key) => {
      if (!(key in newValues)) {
        newValues[key] = "";
      }
    });
    setValues(newValues);

    updateStatus("Placeholder dipindai");
  }, [template, values]);

  const liveRender = (currentTemplate = template, currentValues = values, currentKeepBrackets = keepBrackets) => {
    let output = currentTemplate;

    placeholders.forEach((key) => {
      const val = (currentValues[key] || "").toString();
      const escapedKey = key.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");

      // Replace berbagai format bracket: [KEY], [[KEY]], dll
      const singleBracketRegex = new RegExp("\\[" + escapedKey + "\\]", "g");
      const doubleBracketRegex = new RegExp("\\[\\[" + escapedKey + "\\]\\]", "g");

      const replacement = val ? val : currentKeepBrackets ? "[" + key + "]" : "";

      output = output.replace(doubleBracketRegex, replacement);
      output = output.replace(singleBracketRegex, replacement);
    });

    setPreview(output);
    scanLeftovers(output);
  };

  const scanLeftovers = (text) => {
    // Deteksi sisa placeholder dengan berbagai format bracket
    const remaining = Array.from(text.matchAll(/\[+([^\]]+)\]+/g)).map((m) => m[1].trim());
    setLeftoverPlaceholders(unique(remaining));
  };

  const handleValueChange = (key, newValue) => {
    const newValues = { ...values, [key]: newValue };
    setValues(newValues);
    liveRender(template, newValues, keepBrackets);
  };

  const handleKeepBracketsChange = (checked) => {
    setKeepBrackets(checked);
    liveRender(template, values, checked);
  };

  const downloadFile = (customFilename, text) => {
    const blob = new Blob([text], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Ensure filename has .xml extension
    const finalFilename = customFilename.endsWith(".xml") ? customFilename : `${customFilename}.xml`;
    a.download = finalFilename || "metadata.xml";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownload = () => {
    if (!preview.trim()) {
      updateStatus("Tidak ada konten untuk diunduh", false);
      return;
    }

    const stillRemaining = (preview.match(/\[[^\]]+\]/g) || []).length;
    if (stillRemaining > 0) {
      updateStatus(`Peringatan: masih ada ${stillRemaining} placeholder`, false);
    } else {
      updateStatus("Siap diunduh");
    }

    // Gunakan nama default jika filename kosong
    const finalFilename = filename.trim() || "metadata";
    downloadFile(finalFilename, preview);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(preview);
      updateStatus("Disalin ke clipboard");
    } catch {
      updateStatus("Gagal menyalin", false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setTemplate(reader.result);
    };
    reader.readAsText(file);
  };

  const clearAll = () => {
    setTemplate("");
    setPlaceholders([]);
    setValues({});
    setPreview("");
    setLeftoverPlaceholders([]);
    updateStatus("Bersih");
  };

  // Auto-scan when template changes and contains placeholders
  useEffect(() => {
    if (template && template.includes("[") && placeholders.length === 0) {
      scanPlaceholders();
    }
  }, [template, placeholders.length, scanPlaceholders]);

  // Re-render when dependencies change
  useEffect(() => {
    if (placeholders.length > 0) {
      let output = template;

      placeholders.forEach((key) => {
        const val = (values[key] || "").toString();
        const escapedKey = key.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");

        // Replace berbagai format bracket: [KEY], [[KEY]], dll
        const singleBracketRegex = new RegExp("\\[" + escapedKey + "\\]", "g");
        const doubleBracketRegex = new RegExp("\\[\\[" + escapedKey + "\\]\\]", "g");

        const replacement = val ? val : keepBrackets ? "[" + key + "]" : "";

        output = output.replace(doubleBracketRegex, replacement);
        output = output.replace(singleBracketRegex, replacement);
      });

      setPreview(output);

      // Scan leftovers dengan regex yang konsisten
      const remaining = Array.from(output.matchAll(/\[+([^\]]+)\]+/g)).map((m) => m[1].trim());
      setLeftoverPlaceholders(unique(remaining));
    }
  }, [values, keepBrackets, placeholders, template]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-white">Geoportal XML Editor</h1>
            <div className="flex items-center gap-4">
              <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium border ${status.ok ? "bg-green-900 text-green-300 border-green-700" : "bg-red-900 text-red-300 border-red-700"}`}>{status.text}</span>
            </div>
          </div>

          {/* Filename Input Section */}
          <div className="mt-6 bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-4">
              <label htmlFor="filename" className="text-gray-200 font-medium whitespace-nowrap">
                Nama File XML:
              </label>
              <div className="flex-1 flex items-center gap-2">
                <input
                  id="filename"
                  type="text"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="metadata (default)"
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="text-gray-400 text-sm">.xml</span>
              </div>
            </div>
          </div>
        </header>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Template Input Section */}
            <section className="bg-gray-800 border border-gray-700 rounded-lg p-6 shadow-lg">
              <div className="space-y-4">
                <a href="/metadata_acuan.xml" download className="text-blue-400 hover:text-blue-300 underline text-sm font-medium">
                  📥 Unduh Template XML
                </a>
                <br />
                <a
                  href="https://obtainable-cemetery-11e.notion.site/Panduan-Pengisian-XML-1f9d84c0d0ff8059837ac379697eddda"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline text-sm font-medium"
                >
                  📖 Panduan Pengisian
                </a>
              </div>
            </section>
            <section className="bg-gray-800 border border-gray-700 rounded-lg p-6 shadow-lg">
              <h2 className="text-xl font-semibold mb-4">Masukkan Template XML</h2>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xml,.txt"
                    onChange={handleFileUpload}
                    className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-700 file:text-gray-300 hover:file:bg-gray-600"
                  />
                  <button onClick={clearAll} className="px-4 py-2 bg-transparent hover:bg-gray-700 text-gray-300 border border-gray-600 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500">
                    Bersihkan
                  </button>
                </div>

                <textarea
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  placeholder="Tempelkan isi template XML di sini…"
                  className="w-full h-40 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                />

                <div className="space-y-2">
                  <button onClick={scanPlaceholders} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                    Pindai Placeholder [ ... ]
                  </button>
                </div>
              </div>
            </section>

            {/* Placeholders Form Section */}
            {placeholders.length > 0 && (
              <section className="bg-gray-800 border border-gray-700 rounded-lg p-6 shadow-lg">
                <h2 className="text-xl font-semibold mb-4">Isi Nilai untuk Placeholder</h2>

                <div className="text-gray-400 text-sm mb-4">{placeholders.length} placeholder terdeteksi.</div>

                <div className="grid grid-cols-1 gap-4 mb-6">
                  {placeholders.map((key) => (
                    <div key={key} className="space-y-2">
                      <label className="block text-gray-200 font-medium">{key}</label>
                      <input
                        type="text"
                        placeholder={`[${key}]`}
                        value={values[key] || ""}
                        onChange={(e) => handleValueChange(key, e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  ))}
                </div>

                <hr className="border-gray-700 my-4" />

                <div className="space-y-4">
                  <label className="flex items-center justify-between">
                    <span className="text-gray-200">Sisakan tanda siku jika kosong?</span>
                    <input type="checkbox" checked={keepBrackets} onChange={(e) => handleKeepBracketsChange(e.target.checked)} className="text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500" />
                  </label>

                  <div className="flex items-center gap-3">
                    <button onClick={() => liveRender()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                      Terapkan ke XML
                    </button>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Preview Section */}
            <section className="bg-gray-800 border border-gray-700 rounded-lg p-6 shadow-lg">
              <h2 className="text-xl font-semibold mb-4">Pratinjau XML Hasil</h2>

              <pre className="bg-gray-900 border border-gray-600 rounded-md p-4 text-gray-100 font-mono text-sm whitespace-pre-wrap overflow-auto max-h-96 mb-4">{preview || "Belum ada preview..."}</pre>

              <div className="flex gap-3 pt-4 border-t border-gray-700">
                <button onClick={handleCopy} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500">
                  Salin XML
                </button>
                <button onClick={handleDownload} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                  Unduh XML
                </button>
              </div>

              <div className="text-gray-400 text-sm mt-4">
                Tips: gunakan tombol <strong>Pindai Placeholder</strong> setiap kali kamu mengganti template.
              </div>
            </section>

            {/* Validation Section */}
            <section className="bg-gray-800 border border-gray-700 rounded-lg p-6 shadow-lg">
              <h2 className="text-xl font-semibold mb-4">Validasi cepat</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Sisa placeholder tak terisi:</span>
                  <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-gray-700 text-gray-300">{leftoverPlaceholders.length}</span>
                </div>

                {leftoverPlaceholders.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {leftoverPlaceholders.map((placeholder) => (
                      <span key={placeholder} className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-gray-700 text-gray-300">
                        [{placeholder}]
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
