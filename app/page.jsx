'use client';

import { useState, useRef, useEffect } from 'react';

const STEPS = [
  { id: 1, icon: '📁', label: 'Upload File' },
  { id: 2, icon: '📊', label: 'Konfigurasi Tabel' },
  { id: 3, icon: '🏷️', label: 'Konfigurasi Kode' },
  { id: 4, icon: '📶', label: 'Urutan Level' },
  { id: 5, icon: '✅', label: 'Hasil Mapping' }
];

export default function Home() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState(null);
  
  // -- Step 2 State --
  const [sheetsData, setSheetsData] = useState({});
  const [selectedSheet, setSelectedSheet] = useState('');
  const [headerRow, setHeaderRow] = useState(2);
  const [dataStartRow, setDataStartRow] = useState(3);
  const targetFields = ["Company", "Directorate", "Division", "Department", "Section", "Location", "Level", "Job Title", "Position"];
  const [columnMapping, setColumnMapping] = useState({});
  
  // -- Extracted Data (Between Step 2 and 3) --
  const [companies, setCompanies] = useState([]);
  const [levels, setLevels] = useState([]);
  const [levelCounts, setLevelCounts] = useState({});
  const [locations, setLocations] = useState([]);
  
  // -- Step 3 State --
  const [codeMode, setCodeMode] = useState('default'); // 'default' or 'custom'
  const [startNumber, setStartNumber] = useState(1);
  const [digitCount, setDigitCount] = useState(4);
  const [ascending, setAscending] = useState(true);
  const [usePrefix, setUsePrefix] = useState(true);
  const [companyPrefixes, setCompanyPrefixes] = useState({});
  const [companyCodes, setCompanyCodes] = useState({});
  const [locationCodes, setLocationCodes] = useState({});
  const [activeTab, setActiveTab] = useState('default');
  
  // -- Step 4 State --
  const [levelOrder, setLevelOrder] = useState({});
  
  // -- Step 5 State --
  const [downloadUrl, setDownloadUrl] = useState(null);
  
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
          const cols = data.sheets[firstSheet] || [];
          const initialMap = {};
          targetFields.forEach(field => {
            const match = cols.find(c => c.toLowerCase().includes(field.toLowerCase()));
            if (match) initialMap[field] = match;
          });
          setColumnMapping(initialMap);
      }
      setStep(2);
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
      column_mapping: columnMapping
    }));
    
    try {
      const res = await fetch('/api/extract', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengekstrak data');
      
      setCompanies(data.companies || []);
      setLevels(data.levels || []);
      setLevelCounts(data.levelCounts || {});
      setLocations(data.locations || []);
      
      // Init company prefixes (A, B, C...)
      const pfx = {};
      const cc = {};
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      (data.companies || []).forEach((c, i) => {
        let prefix = i < 26 ? letters[i] : letters[Math.floor(i/26)-1] + letters[i%26];
        pfx[c] = prefix;
        // Basic abbreviation fallback
        let abbr = c.split(' ').map(w => w[0]).join('').substring(0,3).toUpperCase();
        cc[c] = abbr;
      });
      setCompanyPrefixes(pfx);
      setCompanyCodes(cc);
      
      // Init level order
      const defaultOrder = {"BOD": 1, "GM": 2, "MGR": 3, "SPV": 4, "STAFF": 5};
      const lo = {};
      (data.levels || []).forEach(l => {
        lo[l] = defaultOrder[l] || 99;
      });
      setLevelOrder(lo);
      
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
      if (!res.ok) {
        const text = await res.text();
        let errData;
        try { errData = JSON.parse(text); } catch(e) { throw new Error("Server error: " + text.substring(0, 100)); }
        throw new Error(errData.error || 'Failed to process file');
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      setDownloadUrl(url);
      setStep(5);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <nav className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">🏢</div>
          <div className="sidebar-title">Master Organization</div>
          <div className="sidebar-subtitle">Code Mapper</div>
        </div>
        
        <div className="sidebar-nav">
          {STEPS.map((s) => (
            <div 
              key={s.id} 
              className={`nav-item ${step === s.id ? 'active' : ''} ${step > s.id ? 'completed' : ''}`}
            >
              <div className="step-circle">
                {step > s.id ? '✓' : s.id}
              </div>
              {s.icon} {s.label}
            </div>
          ))}
        </div>
        
        <div className="sidebar-footer">
          v2.0 Premium • Next.js & Vercel
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="main-content">
        {error && (
          <div className="alert alert-error">
            <span>⚠️</span>
            <strong>Error:</strong> {error}
          </div>
        )}
        
        <div className="glass-card">
          {/* STEP 1 */}
          {step === 1 && (
            <div>
              <h2 className="step-title">Upload Data</h2>
              <p className="step-subtitle">Silakan unggah file Excel Master Organization Anda untuk memulai proses mapping.</p>
              
              <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
                <div className="upload-icon">📄</div>
                <h3>Pilih File Excel</h3>
                <p style={{color: 'var(--text-muted)', marginTop: '0.5rem'}}>Klik di sini atau seret file Anda (Hanya .xlsx)</p>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx" style={{display: 'none'}} />
              </div>
              
              {loading && (
                <div className="alert alert-info" style={{justifyContent: 'center'}}>
                  <span className="spinner">⏳</span> {loadingMsg}
                </div>
              )}
            </div>
          )}
          
          {/* STEP 2 */}
          {step === 2 && (
            <div>
              <h2 className="step-title">Konfigurasi Tabel</h2>
              <p className="step-subtitle">Pilih sheet dan atur posisi baris data Anda.</p>
              
              <div className="grid" style={{marginBottom: '2rem'}}>
                <div className="form-group">
                  <label className="form-label">Nama Sheet</label>
                  <select className="form-control" value={selectedSheet} onChange={(e) => {
                    setSelectedSheet(e.target.value);
                    setColumnMapping({});
                  }}>
                    {Object.keys(sheetsData).map(sheet => (
                      <option key={sheet} value={sheet}>{sheet}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Baris Header (Ke-)</label>
                  <input type="number" className="form-control" value={headerRow} onChange={e => setHeaderRow(Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Baris Awal Data (Ke-)</label>
                  <input type="number" className="form-control" value={dataStartRow} onChange={e => setDataStartRow(Number(e.target.value))} />
                </div>
              </div>
              
              <div style={{background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)'}}>
                <h3 style={{marginBottom: '1.5rem', color: 'white'}}>Pemetaan Kolom (Mapping)</h3>
                <div className="grid">
                  {targetFields.map(field => (
                    <div key={field} className="form-group">
                      <label className="form-label">{field}</label>
                      <select 
                        className="form-control" 
                        value={columnMapping[field] || ''}
                        onChange={e => setColumnMapping({...columnMapping, [field]: e.target.value})}
                      >
                        <option value="">-- Abaikan --</option>
                        {(sheetsData[selectedSheet] || []).map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              
              <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '3rem'}}>
                <button className="btn btn-secondary" onClick={() => setStep(1)}>← Kembali</button>
                <button className="btn btn-primary" onClick={handleExtractData} disabled={loading}>
                  {loading ? 'Mengekstrak...' : 'Selanjutnya →'}
                </button>
              </div>
            </div>
          )}
          
          {/* STEP 3 */}
          {step === 3 && (
            <div>
              <h2 className="step-title">🏷️ Konfigurasi Kode</h2>
              <p className="step-subtitle">Pilih mode pengkodean: gunakan format default atau buat kustom sesuai kebutuhan.</p>
              
              {/* Companies Detected Badge */}
              <div style={{padding: '1.5rem', border: '1px solid var(--border)', borderRadius: '12px', marginBottom: '2rem'}}>
                <h3 style={{fontSize: '1.1rem', marginBottom: '1rem'}}>🏢 Company Terdeteksi</h3>
                {companies.length > 1 ? (
                  <span style={{background: 'rgba(245, 158, 11, 0.2)', color: '#fcd34d', padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold'}}>
                    🔀 {companies.length} Company (Multi-Company Mode)
                  </span>
                ) : (
                  <span style={{background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold'}}>
                    ✅ {companies.length} Company (Single-Company Mode)
                  </span>
                )}
                <div style={{marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                  {companies.map(c => (
                    <div key={c} style={{background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.9rem'}}>
                      <strong>{c}</strong> → <code style={{color: 'var(--primary)'}}>{companyCodes[c]}</code>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabs */}
              <div style={{display: 'flex', gap: '1rem', marginBottom: '1.5rem'}}>
                <button 
                  className={`btn ${activeTab === 'default' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => { setActiveTab('default'); setCodeMode('default'); }}
                  style={{flex: 1}}
                >
                  🔹 Mode Default
                </button>
                <button 
                  className={`btn ${activeTab === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => { setActiveTab('custom'); setCodeMode('custom'); }}
                  style={{flex: 1}}
                >
                  🔸 Mode Custom
                </button>
              </div>

              {/* Tab Content */}
              <div style={{padding: '2rem', border: '1px solid var(--border)', borderRadius: '12px'}}>
                {activeTab === 'default' ? (
                  <div>
                    <h3 style={{marginBottom: '1rem'}}>ℹ️ Cara Kerja Mode Default</h3>
                    {companies.length > 1 ? (
                      <p style={{color: 'var(--text-muted)', lineHeight: '1.6'}}>
                        <strong>Multi-Company terdeteksi.</strong> Setiap company akan diberi prefix huruf otomatis (A, B, C, ...) diikuti angka 4-digit.<br/>
                        Contoh: <code style={{color: '#a78bfa'}}>A0001</code>, <code style={{color: '#a78bfa'}}>A0002</code>, <code style={{color: '#60a5fa'}}>B0001</code>...
                      </p>
                    ) : (
                      <p style={{color: 'var(--text-muted)', lineHeight: '1.6'}}>
                        <strong>Single Company.</strong> Kode berupa angka 5-digit tanpa prefix.<br/>
                        Contoh: <code style={{color: '#a78bfa'}}>00001</code>, <code style={{color: '#a78bfa'}}>00002</code>, <code style={{color: '#a78bfa'}}>00003</code>...
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <h3 style={{marginBottom: '1rem'}}>⚙️ Pengaturan Umum</h3>
                    <div className="grid">
                      <div className="form-group">
                        <label className="form-label">Mulai dari Angka</label>
                        <input type="number" className="form-control" value={startNumber} onChange={e => setStartNumber(Number(e.target.value))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Jumlah Digit</label>
                        <input type="number" className="form-control" value={digitCount} onChange={e => setDigitCount(Number(e.target.value))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Urutan</label>
                        <select className="form-control" value={ascending.toString()} onChange={e => setAscending(e.target.value === 'true')}>
                          <option value="true">Ascending (1, 2, 3)</option>
                          <option value="false">Descending (99, 98, 97)</option>
                        </select>
                      </div>
                    </div>

                    {companies.length > 1 && (
                      <div style={{marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border)'}}>
                        <h3 style={{marginBottom: '1rem'}}>🔤 Prefix Per Company</h3>
                        <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem'}}>
                          <input type="checkbox" checked={usePrefix} onChange={e => setUsePrefix(e.target.checked)} style={{width: '18px', height: '18px'}} />
                          Gunakan prefix Company
                        </label>
                        
                        {usePrefix && companies.map(c => (
                          <div key={c} style={{display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem'}}>
                            <div style={{width: '200px', fontWeight: 'bold'}}>{c}</div>
                            <input 
                              type="text" 
                              className="form-control" 
                              style={{width: '100px'}} 
                              value={companyPrefixes[c] || ''} 
                              onChange={e => setCompanyPrefixes({...companyPrefixes, [c]: e.target.value})} 
                            />
                            <div style={{color: 'var(--primary)', fontSize: '0.9rem'}}>
                              Preview: {companyPrefixes[c] || ''}{String(startNumber).padStart(digitCount, '0')}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '3rem'}}>
                <button className="btn btn-secondary" onClick={() => setStep(2)}>← Kembali</button>
                <button className="btn btn-primary" onClick={() => setStep(4)}>Selanjutnya →</button>
              </div>
            </div>
          )}
          
          {/* STEP 4 */}
          {step === 4 && (
            <div>
              <h2 className="step-title">📶 Urutan Level Jabatan</h2>
              <p className="step-subtitle">Atur urutan level jabatan dari yang tertinggi (1) ke terendah.</p>
              
              <div style={{padding: '1.5rem', border: '1px solid var(--border)', borderRadius: '12px', marginBottom: '2rem'}}>
                <h3 style={{fontSize: '1.1rem', marginBottom: '1.5rem'}}>🔍 {levels.length} Level Jabatan Terdeteksi</h3>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem'}}>
                  {levels.map(lev => (
                    <div key={lev} style={{background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '12px', padding: '1rem', textAlign: 'center'}}>
                      <div style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={lev}>{lev}</div>
                      <div style={{fontSize: '1.8rem', fontWeight: '800', color: 'white'}}>{levelCounts[lev] || 0}</div>
                      <div style={{fontSize: '0.75rem', color: 'var(--primary)'}}>pegawai</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{padding: '2rem', border: '1px solid var(--border)', borderRadius: '12px'}}>
                <h3 style={{marginBottom: '0.5rem'}}>🔢 Atur Urutan Level</h3>
                <p style={{color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem'}}>Berikan nomor urut untuk setiap level. 1 = tertinggi (misal: Direktur).</p>
                
                {levels.map(lev => (
                  <div key={lev} style={{display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.02)', padding: '0.5rem 1rem', borderRadius: '8px'}}>
                    <div style={{flex: 1, fontWeight: 'bold'}}>{lev}</div>
                    <div style={{width: '100px'}}>
                      <input 
                        type="number" 
                        className="form-control" 
                        min="1" max="99" 
                        value={levelOrder[lev] || ''} 
                        onChange={e => setLevelOrder({...levelOrder, [lev]: Number(e.target.value)})} 
                      />
                    </div>
                  </div>
                ))}
                {levels.length === 0 && <p style={{color: 'var(--text-muted)'}}>Tidak ada data level yang dimapping.</p>}
              </div>
              
              <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '3rem'}}>
                <button className="btn btn-secondary" onClick={() => setStep(3)}>← Kembali</button>
                <button className="btn btn-primary" onClick={handleProcess} disabled={loading}>
                  {loading ? 'Memproses Mapping...' : '🚀 Proses Mapping & Preview →'}
                </button>
              </div>
            </div>
          )}
          
          {/* STEP 5 */}
          {step === 5 && (
            <div style={{textAlign: 'center', padding: '2rem 0'}}>
              <div style={{fontSize: '5rem', marginBottom: '1rem'}}>🎉</div>
              <h2 className="step-title" style={{marginBottom: '1rem'}}>Pemrosesan Selesai!</h2>
              <p className="step-subtitle">File Excel Anda telah berhasil di-mapping dan siap diunduh.</p>
              
              {downloadUrl && (
                <a href={downloadUrl} download={file?.name ? file.name.replace('.xlsx', '_MAPPED.xlsx') : 'Master_Organization_MAPPED.xlsx'} className="btn btn-primary" style={{fontSize: '1.1rem', padding: '1rem 2.5rem', marginTop: '1rem'}}>
                  📥 Download File Hasil Mapping
                </a>
              )}
              
              <div style={{marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid var(--border)'}}>
                <button className="btn btn-secondary" onClick={() => {
                  setStep(1);
                  setFile(null);
                  setDownloadUrl(null);
                }}>🔄 Ulangi Proses Baru</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
