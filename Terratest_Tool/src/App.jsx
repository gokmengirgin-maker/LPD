import React, { useState, useEffect, useRef } from 'react';
import { Download, Calendar, MapPin, Activity, FileText, Layers, Crosshair, HardDrive, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

// Template hex string from 5AB0881A.TTD
const TTD_TEMPLATE_HEX = "00d23032303932343031323434380a180a123225051617005305353031332e343331384e30303834362e373235374500000000000000000000000000000000010102030507090c0f1216191d2023272a2d2f3235383b3d40424547494a4c4d4e5051525253545454555555555554545454535352525150504f4e4d4c4b4a494847454443413f3d3b393633302d2a2724211e1b1815120f0c09060300000000000000000000000006e903555420202020202020202020202020202020202020202000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010102030506090b0e1215191c1f2326292c2e313437393c3e41434547494a4b4d4e4f505051525252535353535353525252515150504f4e4e4d4c4b4b4a494746454442413f3e3c3a3735322f2c292623201d1a1714110e0b08050200000000000000000000000006cd03420000000000000000000000000000000000000000000102030406080b0e1114181b1f2225282b2d303235383a3d3f4143454648494a4b4c4d4e4f4f4f505050505050504f4f4f4e4e4d4d4c4b4b4a4948474645444342413f3e3c3a393634322f2c292624211e1b1815120f0c0906030000000000000000000000000006b2032600000000";

function hexToBytes(hex) {
  let bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function writeString(bytes, offset, str, maxLen) {
  for (let i = 0; i < str.length && i < maxLen; i++) {
    bytes[offset + i] = str.charCodeAt(i);
  }
}

function writeWordBE(bytes, offset, val) {
  bytes[offset] = (val >> 8) & 0xff;
  bytes[offset + 1] = val & 0xff;
}

function toBCD(val) {
  return ((Math.floor(val / 10) << 4) | (val % 10));
}

function parseDDMToDecimal(ddmStr, isLon = false) {
  if (!ddmStr) return null;
  const cleaned = ddmStr.trim().toUpperCase();
  const suffix = cleaned.slice(-1);
  if (!['N', 'S', 'E', 'W'].includes(suffix)) return null;
  
  const numPart = cleaned.slice(0, -1);
  const dotIndex = numPart.indexOf('.');
  if (dotIndex === -1) {
    const degLen = isLon ? 3 : 2;
    if (numPart.length < degLen) return null;
    const deg = parseFloat(numPart.slice(0, degLen));
    const min = parseFloat(numPart.slice(degLen));
    if (isNaN(deg) || isNaN(min)) return null;
    let decimal = deg + min / 60;
    if (suffix === 'S' || suffix === 'W') decimal = -decimal;
    return decimal;
  }
  
  const minStartIndex = Math.max(0, dotIndex - 2);
  const degStr = numPart.slice(0, minStartIndex);
  const minStr = numPart.slice(minStartIndex);
  
  const deg = parseFloat(degStr) || 0;
  const min = parseFloat(minStr);
  if (isNaN(min)) return null;
  
  let decimal = deg + min / 60;
  if (suffix === 'S' || suffix === 'W') {
    decimal = -decimal;
  }
  return decimal;
}

export default function App() {
  const [template, setTemplate] = useState(hexToBytes(TTD_TEMPLATE_HEX));
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState(format(new Date(), 'HH:mm:ss'));
  const [lat, setLat] = useState('5013.4318N');
  const [lon, setLon] = useState('00846.7257E');
  const [s1, setS1] = useState(1050);
  const [s2, setS2] = useState(990);
  const [s3, setS3] = useState(920);
  const [projectName, setProjectName] = useState('25_05_16');
  const [serial, setSerial] = useState('020924012448');
  const [googleCoords, setGoogleCoords] = useState('');
  const [targetEvd, setTargetEvd] = useState(34);
  const [calMonth, setCalMonth] = useState(10);
  const [calYear, setCalYear] = useState(18);
  const [expMonth, setExpMonth] = useState(10);
  const [expYear, setExpYear] = useState(19);
  const [isTemplateLoaded, setIsTemplateLoaded] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const mapInstanceRef = useRef(null);
  const markerInstanceRef = useRef(null);

  const handleAddressSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();
      if (data && data.length > 0) {
        const latVal = parseFloat(data[0].lat);
        const lonVal = parseFloat(data[0].lon);
        
        setLat(convertToDDM(latVal, false));
        setLon(convertToDDM(lonVal, true));
        
        const map = mapInstanceRef.current;
        const marker = markerInstanceRef.current;
        if (map && marker) {
          marker.setLatLng([latVal, lonVal]);
          map.setView([latVal, lonVal], 13);
        }
        setStatus({ type: 'success', message: 'Konum bulundu!' });
        setTimeout(() => setStatus({ type: '', message: '' }), 3000);
      } else {
        setStatus({ type: 'error', message: 'Adres bulunamadı.' });
        setTimeout(() => setStatus({ type: '', message: '' }), 3000);
      }
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', message: 'Arama sırasında bir hata oluştu.' });
      setTimeout(() => setStatus({ type: '', message: '' }), 3000);
    } finally {
      setIsSearching(false);
    }
  };

  // convertToDDM must be defined BEFORE updateCoordsFromMap (which calls it)
  const convertToDDM = (decimal, isLon = false) => {
    if (!decimal) return '';
    const abs = Math.abs(decimal);
    const degrees = Math.floor(abs);
    const minutes = ((abs - degrees) * 60).toFixed(4);
    
    let degStr = degrees.toString();
    if (isLon) {
      degStr = degStr.padStart(3, '0');
    } else {
      degStr = degStr.padStart(2, '0');
    }
    
    let [mInt, mDec] = minutes.split('.');
    mInt = mInt.padStart(2, '0');
    const suffix = decimal >= 0 ? (isLon ? 'E' : 'N') : (isLon ? 'W' : 'S');
    
    return `${degStr}${mInt}.${mDec}${suffix}`;
  };

  // Helper to update coords from map interaction
  const updateCoordsFromMap = (latVal, lngVal) => {
    const formattedLat = convertToDDM(latVal, false);
    const formattedLon = convertToDDM(lngVal, true);
    setLat(formattedLat);
    setLon(formattedLon);
    
    if (markerInstanceRef.current) {
      markerInstanceRef.current.setLatLng([latVal, lngVal]);
    }
  };

  // Map Initialization Effect
  useEffect(() => {
    const initialLat = 50.223863;
    const initialLon = 8.778761;

    const map = L.map('map', {
      center: [initialLat, initialLon],
      zoom: 12
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const customIcon = L.divIcon({
      className: 'custom-map-marker',
      html: '<div class="marker-pulse"></div><div class="marker-pin"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const marker = L.marker([initialLat, initialLon], {
      icon: customIcon,
      draggable: true
    }).addTo(map);

    mapInstanceRef.current = map;
    markerInstanceRef.current = marker;

    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      updateCoordsFromMap(lat, lng);
    });

    marker.on('dragend', (e) => {
      const { lat, lng } = e.target.getLatLng();
      updateCoordsFromMap(lat, lng);
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
    };
  }, []);

  // Sync state changes back to map (Google Maps paste or manual edit)
  useEffect(() => {
    if (!lat || !lon) return;
    const latDec = parseDDMToDecimal(lat, false);
    const lonDec = parseDDMToDecimal(lon, true);

    if (latDec !== null && lonDec !== null) {
      const map = mapInstanceRef.current;
      const marker = markerInstanceRef.current;

      if (map && marker) {
        const currentLatLng = marker.getLatLng();
        if (Math.abs(currentLatLng.lat - latDec) > 0.0001 || Math.abs(currentLatLng.lng - lonDec) > 0.0001) {
          marker.setLatLng([latDec, lonDec]);
          map.setView([latDec, lonDec], map.getZoom());
        }
      }
    }
  }, [lat, lon]);

  const calculateSettlementFromEvd = (evd) => {
    if (!evd || evd <= 0) return;
    const sMeanMm = 22.5 / evd;
    const sMeanUm = Math.round(sMeanMm * 1000);
    // Add slight natural variance
    setS1(sMeanUm + Math.floor(Math.random() * 10 - 5));
    setS2(sMeanUm + Math.floor(Math.random() * 10 - 5));
    setS3(sMeanUm + Math.floor(Math.random() * 10 - 5));
  };

  const calculateEvdFromSettlements = (v1, v2, v3) => {
    const meanUm = (v1 + v2 + v3) / 3;
    const meanMm = meanUm / 1000;
    if (meanMm > 0) {
      setTargetEvd(parseFloat((22.5 / meanMm).toFixed(1)));
    }
  };

  // (convertToDDM and status are defined above, before updateCoordsFromMap)

  const handleGooglePaste = (val) => {
    if (!val) return;
    setGoogleCoords(val);
    
    // Regex to match coordinates in "lat, lon", "lat lon" or URL formats
    const coordPattern = /(-?\d+\.\d+)\s*[,|\s+]\s*(-?\d+\.\d+)/;
    const urlPattern = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    
    const match = val.match(urlPattern) || val.match(coordPattern);
    
    if (match) {
      const latVal = parseFloat(match[1]);
      const lonVal = parseFloat(match[2]);
      setLat(convertToDDM(latVal, false));
      setLon(convertToDDM(lonVal, true));
      setStatus({ type: 'success', message: 'Koordinatlar dönüştürüldü!' });
      setTimeout(() => setStatus({ type: '', message: '' }), 3000);
    } else {
      setStatus({ type: 'error', message: 'Koordinat formatı anlaşılamadı.' });
      setTimeout(() => setStatus({ type: '', message: '' }), 3000);
    }
  };

  const handleTemplateUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setTemplate(new Uint8Array(e.target.result));
        setIsTemplateLoaded(true);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleDownload = () => {
    const bytes = new Uint8Array(template);
    
    // 1. Device Serial / Date ID
    writeString(bytes, 2, serial.padEnd(12, ' '), 12);

    // 2. Calibration Dates (Reverted to direct integers as they were working)
    bytes[14] = calMonth;
    bytes[15] = calYear;
    bytes[16] = expMonth;
    bytes[17] = expYear;

    const yy = parseInt(date.substring(2, 4));
    const mm = parseInt(date.substring(5, 7));
    const dd = parseInt(date.substring(8, 10));
    const hh = parseInt(time.substring(0, 2));
    const min = parseInt(time.substring(3, 5));

    // 3. Project / Test Date (Keep BCD as it fixed the test date)
    bytes[18] = 0x32; // Marker
    bytes[19] = toBCD(yy);
    bytes[20] = toBCD(mm);
    bytes[21] = toBCD(dd);
    bytes[22] = toBCD(hh);
    bytes[23] = toBCD(min);

    // 3. Coordinates
    writeString(bytes, 26, lat.padEnd(10, ' '), 10);
    writeString(bytes, 36, lon.padEnd(11, ' '), 11);

    // 4. Settlements (Big Endian at precise offsets)
    // 0xA8, 0x179, 0x1F9 are markers (usually 0x06)
    bytes[0xA8] = 0x06;
    writeWordBE(bytes, 0xA9, s1);
    
    bytes[0x179] = 0x06;
    writeWordBE(bytes, 0x17A, s2);
    
    bytes[0x1F9] = 0x06;
    writeWordBE(bytes, 0x1FA, s3);

    // 5. Scale Curves (Pulse duration usually up to 96 bytes)
    const scaleCurve = (start, end, ratio) => {
      for (let i = start; i <= end; i++) {
        bytes[i] = Math.min(255, Math.max(0, Math.round(bytes[i] * ratio)));
      }
    };
    scaleCurve(0x40, 0x9F, s1 / 1001);
    scaleCurve(0x110, 0x16F, s2 / 973);
    scaleCurve(0x190, 0x1EF, s3 / 946);

    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filename = `TTD_${date.replace(/-/g, '')}_${time.replace(/:/g, '')}.TTD`;
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-wrapper">
      <div className="main-card">
        <header>
          <div className="badge">Terratest Engine v2.0</div>
          <h1>TTD Generator</h1>
          <p className="subtitle">LPD Veri Manipülasyon ve Rapor Hazırlama Sistemi</p>
        </header>

        <main className="inputs-panel">
          <div className="input-section">
            <h2 className="section-title"><Layers size={16} /> Dosya ve Cihaz Bilgileri</h2>
            <div className="field">
              <label>Şablon Yükle (Makine Verilerini Korur)</label>
              <div className="input-wrapper">
                <input type="file" accept=".TTD" onChange={handleTemplateUpload} />
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Proje Kodu</label>
                <div className="input-wrapper">
                  <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Cihaz Seri No</label>
                <div className="input-wrapper">
                  <input type="text" value={serial} onChange={(e) => setSerial(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div className="field">
                <label>Son Kalibrasyon (Ay/Yıl)</label>
                <div className="grid-2">
                  <div className="input-wrapper">
                    <input type="number" value={calMonth} onChange={(e) => setCalMonth(parseInt(e.target.value))} />
                  </div>
                  <div className="input-wrapper">
                    <input type="number" value={calYear} onChange={(e) => setCalYear(parseInt(e.target.value))} />
                  </div>
                </div>
              </div>
              <div className="field">
                <label>Geçerlilik (Ay/Yıl)</label>
                <div className="grid-2">
                  <div className="input-wrapper">
                    <input type="number" value={expMonth} onChange={(e) => setExpMonth(parseInt(e.target.value))} />
                  </div>
                  <div className="input-wrapper">
                    <input type="number" value={expYear} onChange={(e) => setExpYear(parseInt(e.target.value))} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="input-section">
            <h2 className="section-title"><Crosshair size={16} /> Zaman ve Konum</h2>
            
            <div className="field">
              <label>Google Maps Koordinatı veya Linki Yapıştır</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div className={`input-wrapper ${status.type}`} style={{ 
                  border: status.type === 'success' ? '1px solid #22c55e' : 
                          status.type === 'error' ? '1px solid #ef4444' : 
                          '1px dashed #3b82f6', 
                  flex: 1 
                }}>
                  <input 
                    type="text" 
                    placeholder="Link veya koordinatları buraya yapıştırın..." 
                    value={googleCoords}
                    onChange={(e) => setGoogleCoords(e.target.value)}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData('Text');
                      handleGooglePaste(text);
                    }}
                  />
                </div>
                <button 
                  onClick={() => handleGooglePaste(googleCoords)}
                  className="convert-btn"
                  style={{
                    padding: '0 20px',
                    borderRadius: '12px',
                    border: 'none',
                    background: status.type === 'success' ? '#16a34a' : 'rgba(59, 130, 246, 0.2)',
                    color: status.type === 'success' ? '#fff' : '#60a5fa',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '0.8rem'
                  }}
                >
                  {status.type === 'success' ? '✓' : 'DÖNÜŞTÜR'}
                </button>
              </div>
              {status.message && (
                <p style={{ 
                  fontSize: '0.7rem', 
                  marginTop: '4px', 
                  color: status.type === 'success' ? '#22c55e' : '#ef4444' 
                }}>
                  {status.message}
                </p>
              )}
            </div>

            <div className="grid-2">
              <div className="field">
                <label>Test Tarihi</label>
                <div className="input-wrapper">
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Saat</label>
                <div className="input-wrapper">
                  <input type="time" step="1" value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Enlem (Lat)</label>
                <div className="input-wrapper">
                  <input type="text" value={lat} onChange={(e) => setLat(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Boylam (Lon)</label>
                <div className="input-wrapper">
                  <input type="text" value={lon} onChange={(e) => setLon(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className="input-section">
            <h2 className="section-title"><Activity size={16} /> Ölçüm Sonuçları Hesaplayıcı</h2>
            
            <div className="field">
              <label>Hedef Evd Değeri (MPa)</label>
              <div className="input-wrapper" style={{ border: '1px solid #8b5cf6' }}>
                <input 
                  type="number" 
                  step="0.1"
                  value={targetEvd} 
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setTargetEvd(val);
                    calculateSettlementFromEvd(val);
                  }}
                  placeholder="Örn: 45"
                />
              </div>
              <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>
                Formül: Evd = 22.5 / s_ort | Girdiğiniz MPa değerine göre s1, s2, s3 otomatik hesaplanır.
              </p>
            </div>

            <div className="settlement-grid">
              <div className="field">
                <label>S1</label>
                <div className="input-wrapper">
                  <input 
                    type="number" 
                    value={s1} 
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setS1(val);
                      calculateEvdFromSettlements(val, s2, s3);
                    }} 
                  />
                </div>
              </div>
              <div className="field">
                <label>S2</label>
                <div className="input-wrapper">
                  <input 
                    type="number" 
                    value={s2} 
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setS2(val);
                      calculateEvdFromSettlements(s1, val, s3);
                    }} 
                  />
                </div>
              </div>
              <div className="field">
                <label>S3</label>
                <div className="input-wrapper">
                  <input 
                    type="number" 
                    value={s3} 
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setS3(val);
                      calculateEvdFromSettlements(s1, s2, val);
                    }} 
                  />
                </div>
              </div>
            </div>
          </div>
        </main>

        <div className="right-panel">
          <section className="map-section">
            <h2 className="section-title"><MapPin size={16} /> İnteraktif Harita</h2>
            <div className="search-bar-wrapper">
              <div className="input-wrapper" style={{ flex: 1 }}>
                <input 
                  type="text" 
                  placeholder="Şehir, ilçe veya adres arayın..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddressSearch(); }}
                />
              </div>
              <button className="search-btn" onClick={handleAddressSearch} disabled={isSearching}>
                {isSearching ? 'ARANIYOR...' : 'ARA'}
              </button>
            </div>
            <div className="map-container-wrapper">
              <div id="map"></div>
            </div>
          </section>

          <aside className="preview-panel">
            <h2 className="section-title"><ShieldCheck size={16} /> Veri Önizleme</h2>
            
            <div className="preview-grid">
              <div className="preview-item">
                <p className="preview-label">Hedef Dosya Adı</p>
                <p className="preview-value">TTD_{date.replace(/-/g, '')}_{time.replace(/:/g, '')}.TTD</p>
              </div>

              <div className="preview-item">
                <p className="preview-label">Tanımlayıcı (ID)</p>
                <p className="preview-value">{serial === '020924012448' ? format(new Date(date), 'ddMMyy') + time.replace(/:/g, '') : serial}</p>
              </div>

              <div className="preview-item">
                <p className="preview-label">Durum</p>
                <p className="preview-value" style={{ color: isTemplateLoaded ? '#10b981' : '#f59e0b' }}>
                  {isTemplateLoaded ? 'Özel Şablon Aktif' : 'Varsayılan Şablon'}
                </p>
              </div>

              <div className="preview-item" style={{ border: 'none' }}>
                <p className="preview-label">Konum Verisi</p>
                <p className="preview-value">{lat} / {lon}</p>
              </div>
            </div>

            <button className="action-btn" onClick={handleDownload}>
              <Download size={20} /> DOSYAYI ÜRET
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
