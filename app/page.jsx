'use client';

import { useState, useRef } from 'react';

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
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyze file');
      
      setSheetsData(data.sheets);
      const firstSheet = Object.keys(data.sheets)[0];
      setSelectedSheet(firstSheet);
      
      // Auto-map columns if names match
      const cols = data.sheets[firstSheet] || [];
      const initialMap = {};
      targetFields.forEach(field => {
        const match = cols.find(c => c.toLowerCase().includes(field.toLowerCase()));
        if (match) initialMap[field] = match;
      });
      setColumnMapping(initialMap);
      
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
        const errData = await res.json();
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
    <div className="container">
      <div className="header">
        <h1>Master Organization Mapper</h1>
        <p>Premium Web App for Mapping Organizational Codes</p>
      </div>
      
      {error && (
        <div style={{background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', color: '#fca5a5'}}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      <div className="wizard-nav">
        {[1, 2, 3, 4, 5].map(s => (
          <div key={s} className={`wizard-step ${step === s ? 'active' : ''} ${step > s ? 'completed' : ''}`}>
            {s}
          </div>
        ))}
      </div>
      
      <div className="glass-card">
        {step === 1 && (
          <div>
            <h2>Step 1: Upload Data</h2>
            <p style={{color: 'var(--text-muted)', marginBottom: '2rem'}}>Silakan unggah file Excel Master Organization Anda.</p>
            
            <div 
              className="upload-zone" 
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="upload-icon">📄</div>
              <h3>Pilih File Excel</h3>
              <p>Klik di sini atau seret file Anda (Hanya .xlsx)</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept=".xlsx" 
                style={{display: 'none'}} 
              />
            </div>
            
            {loading && <div style={{textAlign: 'center', marginTop: '2rem'}}>Analyzing file...</div>}
          </div>
        )}
        
        {step === 2 && (
          <div>
            <h2>Step 2: Table Configuration</h2>
            <p style={{color: 'var(--text-muted)', marginBottom: '2rem'}}>Pilih sheet dan atur posisi baris.</p>
            
            <div className="grid">
              <div className="form-group">
                <label className="form-label">Sheet Name</label>
                <select className="form-control" value={selectedSheet} onChange={(e) => {
                  setSelectedSheet(e.target.value);
                  // Reset mapping
                  setColumnMapping({});
                }}>
                  {Object.keys(sheetsData).map(sheet => (
                    <option key={sheet} value={sheet}>{sheet}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Header Row</label>
                <input type="number" className="form-control" value={headerRow} onChange={e => setHeaderRow(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">Data Start Row</label>
                <input type="number" className="form-control" value={dataStartRow} onChange={e => setDataStartRow(Number(e.target.value))} />
              </div>
            </div>
            
            <h3 style={{marginTop: '2rem', marginBottom: '1rem'}}>Column Mapping</h3>
            <div className="grid">
              {targetFields.map(field => (
                <div key={field} className="form-group">
                  <label className="form-label">{field}</label>
                  <select 
                    className="form-control" 
                    value={columnMapping[field] || ''}
                    onChange={e => setColumnMapping({...columnMapping, [field]: e.target.value})}
                  >
                    <option value="">-- Ignore --</option>
                    {(sheetsData[selectedSheet] || []).map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            
            <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '2rem'}}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
              <button className="btn btn-primary" onClick={() => setStep(3)}>Next Step →</button>
            </div>
          </div>
        )}
        
        {step === 3 && (
          <div>
            <h2>Step 3: Code Configuration</h2>
            <p style={{color: 'var(--text-muted)', marginBottom: '2rem'}}>Atur format penomoran kode.</p>
            
            <div className="grid">
              <div className="form-group">
                <label className="form-label">Start Number</label>
                <input type="number" className="form-control" value={startNumber} onChange={e => setStartNumber(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">Digit Count</label>
                <input type="number" className="form-control" value={digitCount} onChange={e => setDigitCount(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">Sort Order</label>
                <select className="form-control" value={ascending.toString()} onChange={e => setAscending(e.target.value === 'true')}>
                  <option value="true">Ascending (1, 2, 3)</option>
                  <option value="false">Descending (99, 98, 97)</option>
                </select>
              </div>
            </div>
            
            <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '2rem'}}>
              <button className="btn btn-secondary" onClick={() => setStep(2)}>Back</button>
              <button className="btn btn-primary" onClick={() => setStep(4)}>Next Step →</button>
            </div>
          </div>
        )}
        
        {step === 4 && (
          <div>
            <h2>Step 4: Level Order</h2>
            <p style={{color: 'var(--text-muted)', marginBottom: '2rem'}}>Urutkan level organisasi (contoh: BOD, GM, dst).</p>
            
            <textarea 
              className="form-control" 
              style={{height: '200px', fontFamily: 'monospace'}}
              value={JSON.stringify(levelOrder, null, 2)}
              onChange={e => {
                try {
                  setLevelOrder(JSON.parse(e.target.value));
                } catch(e) {} // ignore invalid json while typing
              }}
            />
            
            <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '2rem'}}>
              <button className="btn btn-secondary" onClick={() => setStep(3)}>Back</button>
              <button className="btn btn-primary" onClick={handleProcess} disabled={loading}>
                {loading ? 'Processing...' : 'Run Mapping →'}
              </button>
            </div>
          </div>
        )}
        
        {step === 5 && (
          <div style={{textAlign: 'center'}}>
            <h2>✨ Success!</h2>
            <p style={{color: 'var(--text-muted)', marginBottom: '2rem'}}>Data Excel Anda berhasil di-mapping.</p>
            
            {downloadUrl && (
              <a href={downloadUrl} download="Master_Organization_MAPPED.xlsx" className="btn btn-primary" style={{fontSize: '1.2rem', padding: '1rem 2rem'}}>
                📥 Download Excel File
              </a>
            )}
            
            <div style={{marginTop: '3rem'}}>
              <button className="btn btn-secondary" onClick={() => {
                setStep(1);
                setFile(null);
                setDownloadUrl(null);
              }}>Start Over</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
