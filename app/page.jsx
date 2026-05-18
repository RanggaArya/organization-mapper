'use client';

import { useState, useRef } from 'react';

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
  const [error, setError] = useState(null);
  
  // Data from backend analyze
  const [sheetsData, setSheetsData] = useState({});
  const [selectedSheet, setSelectedSheet] = useState('');
  
  // Wizard Config State
  const [headerRow, setHeaderRow] = useState(2);
  const [dataStartRow, setDataStartRow] = useState(3);
  
  // Mapping columns
  const targetFields = ["Company", "Directorate", "Division", "Department", "Section", "Location", "Level", "Job Title", "Position"];
  const [columnMapping, setColumnMapping] = useState({});
  
  // Code config
  const [codeMode, setCodeMode] = useState('default');
  const [startNumber, setStartNumber] = useState(1);
  const [digitCount, setDigitCount] = useState(4);
  const [ascending, setAscending] = useState(true);
  
  // Level Order
  const [levelOrder, setLevelOrder] = useState({'BOD': 1, 'GM': 2, 'MGR': 3, 'SPV': 4, 'STAFF': 5});
  
  // Results
  const [downloadUrl, setDownloadUrl] = useState(null);
  
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setLoading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        throw new Error("Server did not return valid JSON. Ini biasanya karena API belum selesai di-deploy atau konfigurasi routing salah. Error: " + text.substring(0, 100));
      }
      
      if (!res.ok) throw new Error(data.error || 'Failed to analyze file');
      
      setSheetsData(data.sheets);
      const firstSheet = Object.keys(data.sheets)[0];
      if (firstSheet) {
          setSelectedSheet(firstSheet);
          // Auto-map columns if names match
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

  const handleProcess = async () => {
    setLoading(true);
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
      company_prefixes: {},
      company_codes: {},
      location_codes: {},
      use_company_prefix: false
    };

    const formData = new FormData();
    formData.append('file', file);
    formData.append('config', JSON.stringify(config));
    
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });
      
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
          {step === 1 && (
            <div>
              <h2 className="step-title">Upload Data</h2>
              <p className="step-subtitle">Silakan unggah file Excel Master Organization Anda untuk memulai proses mapping.</p>
              
              <div 
                className="upload-zone" 
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="upload-icon">📄</div>
                <h3>Pilih File Excel</h3>
                <p style={{color: 'var(--text-muted)', marginTop: '0.5rem'}}>Klik di sini atau seret file Anda (Hanya .xlsx)</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".xlsx" 
                  style={{display: 'none'}} 
                />
              </div>
              
              {loading && (
                <div className="alert alert-info" style={{justifyContent: 'center'}}>
                  <span className="spinner">⏳</span> Menganalisis file Excel Anda...
                </div>
              )}
            </div>
          )}
          
          {step === 2 && (
            <div>
              <h2 className="step-title">Konfigurasi Tabel</h2>
              <p className="step-subtitle">Pilih sheet dan atur posisi baris data Anda.</p>
              
              <div className="grid">
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
              
              <h3 style={{marginTop: '2rem', marginBottom: '1.5rem', color: 'white'}}>Pemetaan Kolom (Mapping)</h3>
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
              
              <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '3rem'}}>
                <button className="btn btn-secondary" onClick={() => setStep(1)}>← Kembali</button>
                <button className="btn btn-primary" onClick={() => setStep(3)}>Selanjutnya →</button>
              </div>
            </div>
          )}
          
          {step === 3 && (
            <div>
              <h2 className="step-title">Konfigurasi Kode</h2>
              <p className="step-subtitle">Atur format penomoran kode urut yang akan digenerate.</p>
              
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
              
              <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '3rem'}}>
                <button className="btn btn-secondary" onClick={() => setStep(2)}>← Kembali</button>
                <button className="btn btn-primary" onClick={() => setStep(4)}>Selanjutnya →</button>
              </div>
            </div>
          )}
          
          {step === 4 && (
            <div>
              <h2 className="step-title">Urutan Level</h2>
              <p className="step-subtitle">Tentukan urutan hierarki level organisasi (contoh: BOD = 1, GM = 2).</p>
              
              <div className="form-group">
                <label className="form-label">Level Mapping (JSON format)</label>
                <textarea 
                  className="form-control" 
                  style={{height: '250px', fontFamily: 'monospace', fontSize: '0.9rem', lineHeight: '1.6'}}
                  value={JSON.stringify(levelOrder, null, 2)}
                  onChange={e => {
                    try {
                      setLevelOrder(JSON.parse(e.target.value));
                    } catch(e) {} // ignore invalid json while typing
                  }}
                />
              </div>
              
              <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '3rem'}}>
                <button className="btn btn-secondary" onClick={() => setStep(3)}>← Kembali</button>
                <button className="btn btn-primary" onClick={handleProcess} disabled={loading}>
                  {loading ? 'Memproses Data...' : 'Mulai Mapping 🚀'}
                </button>
              </div>
            </div>
          )}
          
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
