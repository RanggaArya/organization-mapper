'use client';

import { useState, useRef, useEffect } from 'react';

const STEPS = [
  { id: 1, icon: '📁', label: 'Upload File' },
  { id: 2, icon: '📊', label: 'Konfigurasi Tabel' },
  { id: 3, icon: '🏷️', label: 'Konfigurasi Kode' },
  { id: 4, icon: '📶', label: 'Urutan Level' },
  { id: 5, icon: '✅', label: 'Hasil Mapping' }
];

// Helper Component for Number Input with +/-
const NumberInput = ({ label, value, onChange, min=0, max=99999 }) => (
  <div className="form-group">
    {label && <label className="form-label">{label}</label>}
    <div className="number-input-group">
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value))} min={min} max={max} />
      <div style={{display:'flex', flexDirection:'column', width:'32px'}}>
        <button className="number-btn" onClick={() => onChange(Math.max(min, value - 1))} style={{borderBottom:'1px solid var(--border)', height:'50%'}}>-</button>
        <button className="number-btn" onClick={() => onChange(Math.min(max, value + 1))} style={{height:'50%'}}>+</button>
      </div>
    </div>
  </div>
);

export default function Home() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState(null);
  
  // Step 1 & 2 State
  const [sheetsData, setSheetsData] = useState({});
  const [selectedSheet, setSelectedSheet] = useState('');
  const [headerRow, setHeaderRow] = useState(2);
  const [dataStartRow, setDataStartRow] = useState(3);
  const [colStart, setColStart] = useState(1);
  const [colEnd, setColEnd] = useState(0);
  const targetFields = ["Company", "Directorate", "Division", "Department", "Section", "Location", "Level", "Job Title", "Position"];
  const [columnMapping, setColumnMapping] = useState({});
  
  // Extracted Data (Between Step 2 and 3)
  const [companies, setCompanies] = useState([]);
  const [levels, setLevels] = useState([]);
  const [levelCounts, setLevelCounts] = useState({});
  const [locations, setLocations] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [previewColumns, setPreviewColumns] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [totalCols, setTotalCols] = useState(0);
  
  // Step 3 State
  const [codeMode, setCodeMode] = useState('default'); 
  const [startNumber, setStartNumber] = useState(1);
  const [digitCount, setDigitCount] = useState(4);
  const [ascending, setAscending] = useState(true);
  const [usePrefix, setUsePrefix] = useState(true);
  const [companyPrefixes, setCompanyPrefixes] = useState({});
  const [companyCodes, setCompanyCodes] = useState({});
  const [locationCodes, setLocationCodes] = useState({});
  const [activeTab, setActiveTab] = useState('default');
  const [showLocationExpander, setShowLocationExpander] = useState(false);
  
  // Step 4 State
  const [levelOrder, setLevelOrder] = useState({});
  
  // Step 5 State
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [resultStats, setResultStats] = useState({});
  const [resultPreviewData, setResultPreviewData] = useState([]);
  const [resultPreviewCols, setResultPreviewCols] = useState([]);
  
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setLoading(true);
    setLoadingMsg("Menganalisis file Excel...");
    setError(null);
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membaca file');
      
      setSheetsData(data.sheets);
      const firstSheet = Object.keys(data.sheets)[0];
      if (firstSheet) {
          setSelectedSheet(firstSheet);
          // Initial mapping will be done when headerRow is set
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExtractData = async () => {
    setLoading(true);
    setLoadingMsg("Mengekstrak data organisasi...");
    setError(null);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('config', JSON.stringify({
      sheet_name: selectedSheet,
      header_row: headerRow,
      data_start_row: dataStartRow,
      col_start: colStart > 0 ? colStart : null,
      col_end: colEnd > 0 ? colEnd : null,
      column_mapping: columnMapping
    }));
    
    try {
      const res = await fetch('/api/extract', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengekstrak data');
      
      setCompanies(data.companies || []);
      setLevels(data.levels || []);
      setLevelCounts(data.level_counts || {});
      setLocations(data.locations || []);
      setPreviewData(data.preview_data || []);
      setPreviewColumns(data.preview_columns || []);
      
      const pfx = {};
      const cc = {};
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const IGNORE_WORDS = ["PT", "CV", "TBK", "UD", "FIRMA", "LLC", "INC", "LTD", "CORP"];
      
      (data.companies || []).forEach((c, i) => {
        let prefix = i < 26 ? letters[i] : letters[Math.floor(i/26)-1] + letters[i%26];
        pfx[c] = prefix;
        
        let words = c.toUpperCase().replace(/\./g, "").split(/\s+/);
        let validWords = words.filter(w => !IGNORE_WORDS.includes(w));
        let abbr = validWords.map(w => w[0]).join('').substring(0,3);
        if (!abbr) abbr = c.substring(0,3).toUpperCase();
        
        cc[c] = abbr;
      });
      setCompanyPrefixes(pfx);
      setCompanyCodes(cc);
      
      const locCodes = {};
      (data.locations || []).forEach(l => {
        let abbr = l.substring(0,3).toUpperCase();
        locCodes[l] = abbr;
      });
      setLocationCodes(locCodes);
      
      const defaultOrder = data.default_level_order || {};
      const lo = {};
      (data.levels || []).forEach((l, i) => {
        let fallback = i + 6;
        lo[l] = defaultOrder[l] || fallback;
      });
      setLevelOrder(lo);
      
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLivePreview = async () => {
    if (!file || !selectedSheet) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('config', JSON.stringify({
      sheet_name: selectedSheet,
      header_row: headerRow,
      data_start_row: dataStartRow,
      col_start: colStart > 0 ? colStart : null,
      col_end: colEnd > 0 ? colEnd : null,
      column_mapping: columnMapping
    }));
    try {
      const res = await fetch('/api/extract', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setPreviewData(data.preview_data || []);
        setPreviewColumns(data.preview_columns || []);
        setTotalRows(data.total_rows || 0);
        setTotalCols(data.total_cols || 0);
      }
    } catch (err) {
      // Ignore errors in background live preview
    }
  };

  useEffect(() => {
    if (step === 2) {
      fetchLivePreview();
    }
  }, [headerRow, dataStartRow, colStart, colEnd, selectedSheet, step]);

  const handleProcess = async () => {
    setLoading(true);
    setLoadingMsg("Memproses mapping Excel...");
    setError(null);
    
    const config = {
      sheet_name: selectedSheet,
      header_row: headerRow,
      data_start_row: dataStartRow,
      column_mapping: columnMapping,
      code_mode: codeMode,
      start_number: startNumber,
      digit_count: digitCount,
      ascending: ascending,
      level_order: levelOrder,
      company_prefixes: companyPrefixes,
      company_codes: companyCodes,
      location_codes: locationCodes,
      use_company_prefix: usePrefix
    };

    const formData = new FormData();
    formData.append('file', file);
    formData.append('config', JSON.stringify(config));
    
    try {
      const res = await fetch('/api/process', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process file');
      }
      
      const byteCharacters = atob(data.excel_base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      
      setDownloadUrl(url);
      setResultStats(data.stats || {});
      setResultPreviewData(data.preview_data || []);
      setResultPreviewCols(data.preview_columns || []);
      
      setStep(5);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getHeaderColumns = () => {
    if (!sheetsData[selectedSheet] || !sheetsData[selectedSheet].preview) return [];
    const rowIdx = headerRow - 1;
    const previewData = sheetsData[selectedSheet].preview;
    if (rowIdx >= 0 && rowIdx < previewData.length) {
      return previewData[rowIdx].map(c => typeof c === 'string' ? c.trim() : String(c).trim()).filter(c => c !== "");
    }
    return [];
  };

  // Auto-detect columns when header row changes
  useEffect(() => {
    if (step === 2 && sheetsData[selectedSheet]) {
      const cols = getHeaderColumns();
      const newMapping = {};
      targetFields.forEach(field => {
        const match = cols.find(c => c.toLowerCase() === field.toLowerCase() || c.toLowerCase().includes(field.toLowerCase()));
        if (match) newMapping[field] = match;
      });
      setColumnMapping(newMapping);
    }
  }, [headerRow, selectedSheet, step]);

  return (
    <div className="app-container">
      <nav className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">🏢</div>
          <div className="sidebar-title">Master Organization</div>
          <div className="sidebar-subtitle">Code Mapper</div>
        </div>
        <div className="sidebar-nav">
          {STEPS.map((s) => (
            <div key={s.id} className={`nav-item ${step === s.id ? 'active' : ''} ${step > s.id ? 'completed' : ''}`}>
              <div className="step-circle">{step > s.id ? '✓' : s.id}</div>
              {s.icon} {s.label}
            </div>
          ))}
        </div>
        <div className="sidebar-footer">
          App version v1.0.0<br/>© 2026 Master Organization Mapper
        </div>
      </nav>

      <main className="main-content">
        {error && <div className="alert-error"><span>⚠️</span> <strong>Error:</strong> {error}</div>}
        
        {step === 1 && (
          <div>
            <h2 className="step-title">📁 Upload File Excel</h2>
            <p className="step-subtitle">Upload file Master Organization Anda untuk memulai proses mapping kode.</p>
            
            <div className="container-box">
              <label className="form-label">Pilih file Excel (.xlsx / .xls)</label>
              <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx,.xls" style={{display: 'none'}} />
                {loading ? <div style={{textAlign:'center', color:'var(--text-muted)'}}>⏳ {loadingMsg}</div> : 
                 file ? <div style={{textAlign:'center', color:'var(--text-main)'}}>File terpilih: <strong>{file.name}</strong></div> : 
                 <div style={{textAlign:'center', color:'var(--text-muted)'}}>Drag and drop file di sini atau klik untuk memilih file</div>}
              </div>

              {file && !loading && (
                <div className="file-pill">
                  <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
                    <span style={{fontSize:'1.2rem'}}>📄</span>
                    <div>
                      <div style={{fontWeight:600}}>{file.name}</div>
                      <div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>{(file.size/1024).toFixed(1)} KB</div>
                    </div>
                  </div>
                  <div className="badge badge-green">{Object.keys(sheetsData).length} Sheet</div>
                </div>
              )}
            </div>

            {file && sheetsData[selectedSheet] && (
              <>
                <div className="container-box">
                  <label className="form-label">Pilih Sheet yang akan diproses</label>
                  <select className="form-control" value={selectedSheet} onChange={(e) => {
                    setSelectedSheet(e.target.value);
                    setColumnMapping({});
                  }}>
                    {Object.keys(sheetsData).map(sheet => (
                      <option key={sheet} value={sheet}>{sheet}</option>
                    ))}
                  </select>
                </div>

                <div className="container-box" style={{padding: 0, overflow: 'hidden'}}>
                  <div className="container-title" style={{padding: '1.5rem 1.5rem 0'}}>👁️ Preview Data Mentah (10 baris pertama)</div>
                  <div className="table-wrapper" style={{margin: '1.5rem', border: 'none'}}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th className="idx-col"></th>
                          {sheetsData[selectedSheet]?.preview?.[0]?.map((_, i) => (
                            <th key={i}>{i}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sheetsData[selectedSheet]?.preview?.map((row, rIdx) => (
                          <tr key={rIdx}>
                            <td className="idx-col">{rIdx}</td>
                            {row.map((cell, cIdx) => (
                              <td key={cIdx}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <button className="btn-primary btn" style={{padding:'0.8rem'}} onClick={() => setStep(2)}>
                  Lanjutkan ke Konfigurasi Tabel →
                </button>
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="step-title">📊 Konfigurasi Tabel</h2>
            <p className="step-subtitle">Atur posisi header dan mapping kolom agar sistem mengenali data Anda.</p>
            
            <div className="container-box">
              <div className="container-title">📐 Posisi Header & Data</div>
              <div className="grid-2">
                <NumberInput label="Baris Header (1-indexed)" value={headerRow} onChange={setHeaderRow} min={1} />
                <NumberInput label="Data Mulai dari Baris" value={dataStartRow} onChange={setDataStartRow} min={2} />
                <NumberInput label="Kolom Mulai (1 = A)" value={colStart} onChange={setColStart} min={1} />
                <NumberInput label="Kolom Akhir (0 = Auto)" value={colEnd} onChange={setColEnd} min={0} />
              </div>
            </div>

            <div className="container-box">
              <div className="container-title">🔗 Mapping Kolom</div>
              <p style={{fontSize:'0.9rem', color:'var(--text-muted)', marginBottom:'1.5rem'}}>Cocokkan setiap field target dengan kolom yang sesuai di file Excel Anda.</p>
              
              <div className="grid-cols-mapping">
                {targetFields.map(field => (
                  <div key={field} className="form-group">
                    <label className="form-label" style={{color:'#fbbf24'}}>❖ {field}</label>
                    <select 
                      className="form-control" 
                      value={columnMapping[field] || ''}
                      onChange={e => setColumnMapping({...columnMapping, [field]: e.target.value})}
                    >
                      <option value="">-- Abaikan --</option>
                      {getHeaderColumns().map((col, idx) => (
                        <option key={`${col}-${idx}`} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {previewData.length > 0 && (
              <div className="container-box" style={{padding: 0, overflow: 'hidden'}}>
                <div className="container-title" style={{padding: '1.5rem 1.5rem 0.5rem', marginBottom: 0}}>👁️ Preview Data Terkonfigurasi</div>
                <div style={{padding: '0 1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem'}}>
                  Tampil <strong>{previewData.length}</strong> baris dari total <strong>{totalRows}</strong> baris, <strong>{totalCols}</strong> kolom
                </div>
                <div className="table-wrapper" style={{margin: '1.5rem', border: 'none'}}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        {previewColumns.map((col, i) => (
                          <th key={i}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, rIdx) => (
                        <tr key={rIdx}>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{display: 'flex', gap:'1rem'}}>
              <button className="btn" onClick={() => setStep(1)} style={{flex:1}}>← Kembali ke Upload</button>
              <button className="btn btn-primary" onClick={handleExtractData} disabled={loading} style={{flex:3}}>
                {loading ? 'Mengekstrak...' : 'Lanjutkan ke Konfigurasi Kode →'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="step-title">🏷️ Konfigurasi Kode</h2>
            <p className="step-subtitle">Pilih mode pengkodean: gunakan format default atau buat kustom sesuai kebutuhan.</p>
            
            <div className="container-box">
              <div className="container-title">🏢 Company Terdeteksi</div>
              <div style={{marginBottom:'1rem'}}>
                {companies.length > 1 ? 
                  <span className="badge badge-amber">🔀 {companies.length} Company (Multi-Company Mode)</span> : 
                  <span className="badge badge-green">✅ {companies.length} Company (Single-Company Mode)</span>
                }
              </div>
              {companies.map(c => (
                <div key={c} style={{fontSize:'0.95rem', margin:'0.5rem 0'}}>
                  • <strong>{c}</strong> → Singkatan: <code style={{color:'#34d399'}}>{companyCodes[c]}</code>
                </div>
              ))}
            </div>

            <div className="tabs">
              <div className={`tab ${activeTab==='default'?'active':''}`} onClick={() => {setActiveTab('default'); setCodeMode('default')}}>+ Mode Default</div>
              <div className={`tab ${activeTab==='custom'?'active':''}`} onClick={() => {setActiveTab('custom'); setCodeMode('custom')}}>+ Mode Custom</div>
            </div>

            {activeTab === 'default' ? (
              <div className="container-box">
                <div className="container-title" style={{color:'#60a5fa'}}>ℹ️ Cara Kerja Mode Default</div>
                <div style={{background:'rgba(59,130,246,0.1)', padding:'1rem', borderRadius:'6px', border:'1px solid rgba(59,130,246,0.3)', marginBottom:'1.5rem', color:'var(--text-main)', fontSize:'0.95rem'}}>
                  {companies.length > 1 ? 
                    <><strong>Multi-Company terdeteksi.</strong> Setiap company akan diberi prefix huruf otomatis (A, B, C, ...) diikuti angka 4-digit.<br/><br/>Contoh: <code style={{color:'#a78bfa'}}>A0001, A0002, B0001, B0002, ...</code></> :
                    <><strong>Single Company.</strong> Kode berupa angka 5-digit tanpa prefix.<br/><br/>Contoh: <code style={{color:'#a78bfa'}}>00001, 00002, 00003, ...</code></>
                  }
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr><th>Company</th><th>Prefix</th><th>Contoh Kode</th></tr>
                    </thead>
                    <tbody>
                      {companies.map(c => (
                        <tr key={c}>
                          <td>{c}</td><td>{companyPrefixes[c]}</td><td>{companyPrefixes[c]}0001, {companyPrefixes[c]}0002, ...</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button className="btn btn-primary" onClick={() => setStep(4)} style={{marginTop:'1.5rem'}}>✅ Gunakan Mode Default</button>
              </div>
            ) : (
              <div>
                <div className="container-box">
                  <div className="container-title">⚙️ Pengaturan Umum</div>
                  <div className="grid-3">
                    <NumberInput label="Mulai dari Angka" value={startNumber} onChange={setStartNumber} min={0} />
                    <NumberInput label="Jumlah Digit Angka" value={digitCount} onChange={setDigitCount} min={2} max={8} />
                    <div className="form-group">
                      <label className="form-label">Urutan</label>
                      <select className="form-control" value={ascending.toString()} onChange={e => setAscending(e.target.value === 'true')}>
                        <option value="true">Ascending (1, 2, 3, ...)</option>
                        <option value="false">Descending (1000, 999, ...)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {companies.length > 1 && (
                  <div className="container-box">
                    <div className="container-title">🔤 Prefix Per Company</div>
                    <p style={{fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:'1rem'}}>Tentukan prefix unik untuk setiap company. Prefix akan ditambahkan di depan kode angka.</p>
                    
                    <label style={{display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1.5rem', cursor:'pointer'}}>
                      <input type="checkbox" checked={usePrefix} onChange={e=>setUsePrefix(e.target.checked)} style={{width:'18px', height:'18px', accentColor:'var(--accent-purple)'}} />
                      <span>Gunakan prefix Company</span>
                    </label>

                    {usePrefix && companies.map(c => (
                      <div key={c} style={{display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1rem'}}>
                        <div style={{flex: 2, fontSize:'0.95rem', fontWeight:600}}>{c}</div>
                        <div style={{flex: 1}}>
                          <input type="text" className="form-control" value={companyPrefixes[c] || ''} onChange={e=>setCompanyPrefixes({...companyPrefixes, [c]: e.target.value})} />
                        </div>
                        <div style={{flex: 2}}>
                          <span className="badge badge-blue" style={{background:'rgba(59,130,246,0.1)'}}>Preview: {companyPrefixes[c]}{String(startNumber).padStart(digitCount,'0')}, ...</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="container-box">
                  <div className="container-title">🏷️ Kode Company (Singkatan)</div>
                  <p style={{fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:'1.5rem'}}>Kode singkatan untuk kolom 'Code Company'. Default: singkatan otomatis dari nama.</p>
                  
                  {companies.map(c => (
                    <div key={c} style={{display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1rem'}}>
                      <div style={{flex: 2, fontSize:'0.95rem', fontWeight:600}}>{c}</div>
                      <div style={{flex: 3}}>
                        <input type="text" className="form-control" value={companyCodes[c] || ''} onChange={e=>setCompanyCodes({...companyCodes, [c]: e.target.value})} />
                      </div>
                    </div>
                  ))}
                </div>

                {locations.length > 0 && (
                  <div className="container-box">
                    <div className="container-title" style={{cursor:'pointer'}} onClick={() => setShowLocationExpander(!showLocationExpander)}>
                      <span style={{width:'20px', display:'inline-block'}}>{showLocationExpander ? 'v' : '>'}</span> 
                      📍 Kustomisasi Kode Lokasi (opsional)
                    </div>
                    
                    {showLocationExpander && (
                      <div style={{marginTop:'1.5rem'}}>
                        <p style={{fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:'1.5rem'}}>Ubah kode singkatan lokasi jika diperlukan.</p>
                        {locations.map(loc => (
                          <div key={loc} style={{display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1rem'}}>
                            <div style={{flex: 2, fontSize:'0.95rem', fontWeight:600}}>{loc}</div>
                            <div style={{flex: 3}}>
                              <input type="text" className="form-control" value={locationCodes[loc] || ''} onChange={e=>setLocationCodes({...locationCodes, [loc]: e.target.value})} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button className="btn btn-primary" onClick={() => setStep(4)} style={{background:'var(--accent-purple)', borderColor:'var(--accent-purple)'}}>
                  ✅ Gunakan Mode Custom
                </button>
              </div>
            )}
            
            <div style={{marginTop:'1.5rem'}}>
              <button className="btn" onClick={() => setStep(2)} style={{width:'100%'}}>← Kembali ke Konfigurasi Tabel</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="step-title">📶 Urutan Level Jabatan</h2>
            <p className="step-subtitle">Atur urutan level jabatan dari yang tertinggi (1) ke terendah. Urutan ini menentukan kode level yang dihasilkan.</p>
            
            <div className="container-box">
              <div className="container-title">🔍 Level Jabatan Terdeteksi</div>
              <div style={{marginBottom:'1.5rem'}}>
                <span className="badge badge-blue" style={{background:'rgba(139,92,246,0.15)', color:'#c084fc', border:'1px solid rgba(139,92,246,0.3)'}}>
                  📊 {levels.length} level unik ditemukan
                </span>
              </div>
              
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:'10px'}}>
                {levels.map(lev => (
                  <div key={lev} className="level-card">
                    <div style={{fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:'4px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title={lev}>{lev}</div>
                    <div style={{fontSize:'1.6rem', fontWeight:700, color:'white'}}>{levelCounts[lev] || 0}</div>
                    <div style={{fontSize:'0.68rem', color:'#06b6d4'}}>pegawai</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="container-box">
              <div className="container-title">🔢 Atur Urutan Level</div>
              <p style={{fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:'1.5rem'}}>Berikan nomor urut untuk setiap level. 1 = tertinggi (misal: Direktur), angka besar = terendah (misal: Staff). Level dengan urutan sama akan mendapat kode yang sama.</p>
              
              {levels.map(lev => (
                <div key={lev} style={{display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1rem'}}>
                  <div style={{flex: 2, fontWeight:600}}>{lev}</div>
                  <div style={{flex: 1}}><span className="badge badge-blue" style={{background:'rgba(6,182,212,0.1)', color:'#06b6d4', border:'1px solid rgba(6,182,212,0.3)'}}>{levelCounts[lev] || 0} pegawai</span></div>
                  <div style={{flex: 1}}>
                    <NumberInput value={levelOrder[lev] || 1} onChange={val => setLevelOrder({...levelOrder, [lev]: val})} min={1} max={99} />
                  </div>
                </div>
              ))}
            </div>

            <div className="container-box">
              <div className="container-title">👁️ Preview Kode Level</div>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr><th>Level</th><th>Urutan</th><th>Kode Level</th><th>Jumlah</th></tr>
                  </thead>
                  <tbody>
                    {levels.slice().sort((a,b) => (levelOrder[a]||99) - (levelOrder[b]||99)).map(lev => {
                       let ord = levelOrder[lev] || 99;
                       let width = codeMode === 'custom' ? digitCount : 4;
                       let codeExample = (codeMode === 'custom' && usePrefix) ? `[Prefix]${String(ord).padStart(width, '0')}` : String(ord).padStart(width + 1, '0');
                       return (
                         <tr key={lev}>
                           <td>{lev}</td><td>{ord}</td><td>{codeExample}</td><td>{levelCounts[lev] || 0}</td>
                         </tr>
                       )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{display:'flex', gap:'1rem', marginTop:'1.5rem'}}>
              <button className="btn" onClick={() => setStep(3)} style={{flex:1}}>← Kembali ke Konfigurasi Kode</button>
              <button className="btn btn-primary" onClick={handleProcess} disabled={loading} style={{flex:1}}>
                {loading ? 'Memproses...' : '🚀 Proses Mapping & Preview →'}
              </button>
            </div>
          </div>
        )}
        
        {step === 5 && (
          <div>
            <h2 className="step-title">🗂️ Preview & Download</h2>
            <p className="step-subtitle">Hasil mapping kode organisasi Anda. Periksa hasilnya, lalu download file Excel.</p>
            
            <div className="grid-3" style={{marginBottom:'1.5rem'}}>
              <div className="container-box" style={{textAlign:'center', marginBottom:0}}>
                <div style={{color:'var(--text-muted)', fontSize:'0.85rem', marginBottom:'0.5rem'}}>📊 Total Baris</div>
                <div style={{fontSize:'1.8rem', fontWeight:700}}>{resultStats.total_rows || 0}</div>
              </div>
              <div className="container-box" style={{textAlign:'center', marginBottom:0}}>
                <div style={{color:'var(--text-muted)', fontSize:'0.85rem', marginBottom:'0.5rem'}}>🏢 Company</div>
                <div style={{fontSize:'1.8rem', fontWeight:700}}>{resultStats.companies || 0}</div>
              </div>
              <div className="container-box" style={{textAlign:'center', marginBottom:0}}>
                <div style={{color:'var(--text-muted)', fontSize:'0.85rem', marginBottom:'0.5rem'}}>⚡ Waktu Proses</div>
                <div style={{fontSize:'1.8rem', fontWeight:700}}>{resultStats.time || 0}s</div>
              </div>
            </div>

            <div className="container-box" style={{padding: 0, overflow: 'hidden'}}>
              <div className="container-title" style={{padding: '1.5rem 1.5rem 0'}}>👁️ Tabel Hasil Mapping (Preview)</div>
              <div className="table-wrapper" style={{margin: '1.5rem', border: 'none'}}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {resultPreviewCols.map((col, i) => (
                        <th key={i}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultPreviewData.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="container-box">
              <div className="container-title">📥 Download Hasil</div>
              <p style={{fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:'1.5rem'}}>File Excel akan berisi 2 sheet: Data Asli (EDIT), dan HASIL.</p>
              
              <div style={{display:'flex', gap:'1rem'}}>
                {downloadUrl && (
                  <a href={downloadUrl} download={file?.name ? file.name.replace('.xlsx', '_MAPPED.xlsx') : 'MAPPED.xlsx'} className="btn btn-primary" style={{flex: 1, padding:'0.8rem', background:'var(--accent-purple)', borderColor:'var(--accent-purple)'}}>
                    📥 Download Excel (.xlsx)
                  </a>
                )}
              </div>
            </div>
            
            <div style={{marginTop:'1.5rem'}}>
              <button className="btn" onClick={() => setStep(1)} style={{width:'100%'}}>Mulai Baru Lagi</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
