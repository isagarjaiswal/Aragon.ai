import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  UploadCloud, 
  CheckCircle2, 
  AlertTriangle, 
  Trash2, 
  X, 
  Image as ImageIcon, 
  ScanFace,
  Crop,
  RotateCcw,
  Sparkles,
  HelpCircle
} from 'lucide-react';

const API_BASE = 'http://localhost:5001/api/images';

export default function App() {
  // Required Assessment State Variables
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [acceptedPhotos, setAcceptedPhotos] = useState([]);
  const [rejectedPhotos, setRejectedPhotos] = useState([]);
  
  // Auxiliary UI State Variables
  const [allPhotos, setAllPhotos] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null); // Detailed modal audit
  const [globalError, setGlobalError] = useState(null);

  // 1. Fetch images from Express database and categorize into states
  const fetchPhotos = useCallback(async () => {
    try {
      const res = await fetch(API_BASE);
      if (!res.ok) throw new Error('Failed to retrieve image logs.');
      const data = await res.json();
      
      setAllPhotos(data);
      // Categorize photos into the states specified by the assessment sheet
      setAcceptedPhotos(data.filter((img) => img.status === 'ACCEPTED'));
      setRejectedPhotos(data.filter((img) => img.status === 'REJECTED'));
    } catch (err) {
      console.error(err);
      setGlobalError('Unable to connect to the backend server. Make sure the server is running on port 5001.');
    }
  }, []);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  // 2. Setup react-dropzone with file filters (only PNG, JPG, and HEIC)
  const onDrop = useCallback(async (acceptedFiles, rejectedFiles) => {
    setGlobalError(null);
    
    // Provide instant feedback for frontend validation rejections
    if (rejectedFiles && rejectedFiles.length > 0) {
      setGlobalError('Format not permitted. Only PNG, JPEG, and HEIC format images are allowed.');
      return;
    }

    if (acceptedFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(10); // Start progress indicator

    let uploadedCount = 0;
    const totalFiles = acceptedFiles.length;

    for (let file of acceptedFiles) {
      const formData = new FormData();
      formData.append('image', file);

      try {
        setUploadProgress(Math.min(90, Math.round((uploadedCount / totalFiles) * 100) + 15));

        const res = await fetch(`${API_BASE}/upload`, {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Server validation rejected the image structure.');
        }

        uploadedCount++;
        setUploadProgress(Math.round((uploadedCount / totalFiles) * 100));

        // Re-fetch images immediately after a successful upload transaction
        await fetchPhotos();
      } catch (err) {
        console.error(err);
        setGlobalError(`Failed to process "${file.name}": ${err.message}`);
      }
    }

    // Clean up loading state variables
    setUploading(false);
    setTimeout(() => setUploadProgress(0), 1000);
  }, [fetchPhotos]);

  // Enforce frontend validations strictly through react-dropzone configuration
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
      'image/heic': ['.heic'],
      'image/heif': ['.heif']
    },
    multiple: true
  });

  // 3. Delete an image permanently from cloud/local storage and DB
  const handleDeleteImage = async (e, id) => {
    e.stopPropagation(); // Stop click bubble from triggering detailed modal
    if (!window.confirm('Are you sure you want to permanently delete this photo?')) return;

    try {
      const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Purge transaction failed.');
      
      if (selectedImage && selectedImage.id === id) {
        setSelectedImage(null);
      }
      
      await fetchPhotos();
    } catch (err) {
      console.error(err);
      setGlobalError(`Delete failed: ${err.message}`);
    }
  };

  // Helper to format byte sizes
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper to dynamically calculate dynamic validation item results for drawer modal
  const getAuditChecklist = (img) => {
    const isAccepted = img.status === 'ACCEPTED';
    const reason = img.rejectReason || '';

    const check = (keyword) => {
      if (isAccepted) return { passed: true, msg: 'Passed automated audit' };
      if (reason.toLowerCase().includes(keyword.toLowerCase())) {
        return { passed: false, msg: reason };
      }
      return { passed: true, msg: 'Passed automated audit' };
    };

    return [
      { id: 'format', name: 'Mime & Format Audit', desc: 'Accepts JPEG, PNG, or HEIC', ...check('format') },
      {
        id: 'resolution',
        name: 'Size & Canvas Resolution',
        desc: 'Resolution >= 200px, File Size >= 10KB',
        ...(() => {
          if (isAccepted) return { passed: true, msg: 'Passed automated audit' };
          if (reason.toLowerCase().includes('size') || reason.toLowerCase().includes('resolution') || reason.toLowerCase().includes('corrupt')) {
            return { passed: false, msg: reason };
          }
          return { passed: true, msg: 'Passed automated audit' };
        })()
      },
      { id: 'similarity', name: 'Perceptual Similarity Collision', desc: 'Checks duplicate hashing overlays', ...check('similar') },
      { id: 'blur', name: 'Focus & Blurriness Check', desc: 'Checks image sharpness variance', ...check('blurry') },
      {
        id: 'faceCount',
        name: 'Face Count Match',
        desc: 'Requires exactly 1 face',
        ...(() => {
          if (isAccepted) return { passed: true, msg: 'Passed automated audit' };
          if (reason.toLowerCase().includes('no face') || reason.toLowerCase().includes('multiple faces') || reason.toLowerCase().includes('face audit')) {
            return { passed: false, msg: reason };
          }
          return { passed: true, msg: 'Passed automated audit' };
        })()
      },
      { id: 'faceSize', name: 'Face Proportionality Ratio', desc: 'Face canvas ratio must be >= 10%', ...check('face size') }
    ];
  };

  return (
    <div className="bg-obsidian min-h-screen text-white font-sans p-6 sm:p-12">
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        
        {/* ⚡ HEADER SECTION */}
        <header className="flex justify-between items-center pb-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="logo-glowing-dot"></div>
            <h1 className="text-2xl font-black tracking-tight text-white font-sans">
              Aragon <span className="text-neonCyan font-light">Auditor</span>
            </h1>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-charcoal border border-white/5 py-2 px-4 rounded-full text-xs text-slate-400 font-semibold">
            <ScanFace size={14} className="text-neonCyan animate-pulse" />
            <span>Tailwind-Optimized Engine</span>
          </div>
        </header>

        {/* ⚠️ GLOBAL BANNER NOTIFICATIONS */}
        {globalError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex justify-between items-center gap-4 animate-pulse">
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="flex-shrink-0" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-red-500">Pipeline Alert</span>
                <span className="text-sm font-medium">{globalError}</span>
              </div>
            </div>
            <button onClick={() => setGlobalError(null)} className="text-red-400 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
        )}

        {/* 🚀 TASK 3: TOP SECTION DROPZONE */}
        <section className="bg-charcoal border border-white/5 rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
            <Sparkles size={16} className="text-neonCyan" />
            Upload photos
          </h2>
          
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed border-white/10 hover:border-neonCyan rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 relative overflow-hidden bg-obsidian/40 group ${isDragActive ? 'border-neonCyan bg-neonCyan/5' : ''}`}
          >
            <input {...getInputProps()} />
            
            <div className="w-14 h-14 bg-charcoal border border-white/5 text-neonCyan rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-neonCyan group-hover:text-obsidian group-hover:scale-110 group-hover:shadow-[0_0_20px_#00F2FE]">
              <UploadCloud size={28} />
            </div>
            
            <h3 className="font-semibold text-base mb-1 text-white">Drag and drop your portraits</h3>
            <p className="text-xs text-slate-400 font-medium max-w-sm mb-3">Accepts high-res PNG, JPG, and HEIC format images automatically</p>
            <span className="bg-neonCyan/10 border border-neonCyan/30 text-neonCyan text-[10px] uppercase tracking-wider font-extrabold px-3 py-1 rounded-full">
              HEIC • PNG • JPEG
            </span>
          </div>

          {/* 🔄 PROGRESS / UPLOADING LOADER */}
          {uploading && (
            <div className="mt-5 p-4 bg-obsidian/50 border border-white/5 rounded-xl flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="spinner"></div>
                  <span className="text-xs font-semibold text-slate-300">Auditing and processing image uploads...</span>
                </div>
                <span className="text-xs font-extrabold text-neonCyan">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-charcoal h-1.5 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="bg-neonCyan h-full transition-all duration-300 shadow-[0_0_8px_#00F2FE]"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </section>

        {/* 🟢 ACCEPTED PHOTOS SECTION */}
        <section className="bg-charcoal border border-white/5 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10B981]"></span>
              Accepted Photos
            </h2>
            <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-extrabold text-xs px-3 py-1 rounded-full">
              {acceptedPhotos.length} Total
            </span>
          </div>

          {acceptedPhotos.length === 0 ? (
            <div className="border border-dashed border-white/5 bg-obsidian/20 rounded-xl py-12 px-4 flex flex-col items-center justify-center text-center text-slate-400">
              <ImageIcon size={36} className="text-slate-600 mb-3" />
              <h3 className="text-sm font-semibold text-slate-300">No accepted photos</h3>
              <p className="text-xs max-w-xs mt-1">Uploaded portraits passing all 6 guidelines will populate here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {acceptedPhotos.map((img) => (
                <div 
                  key={img.id} 
                  className="bg-obsidian border border-white/5 hover:border-white/10 rounded-xl overflow-hidden shadow-md cursor-pointer hover:-translate-y-1 transition-all duration-300 relative group"
                  onClick={() => setSelectedImage(img)}
                >
                  {/* Photo Canvas */}
                  <div className="w-full h-48 bg-charcoal overflow-hidden relative">
                    <img src={img.s3Url} alt={img.originalName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    
                    {/* TOP RIGHT GREEN CHECKMARK OVERLAY */}
                    <div className="absolute top-3 right-3 bg-emerald-500 text-white rounded-full p-1 shadow-lg border border-emerald-400/40 z-10 flex items-center justify-center">
                      <CheckCircle2 size={16} />
                    </div>
                  </div>

                  {/* Card Detail block */}
                  <div className="p-4 flex flex-col justify-between flex-grow gap-2">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-100 truncate" title={img.originalName}>{img.originalName}</span>
                      <span className="text-[10px] font-semibold text-slate-400 font-sans mt-0.5">{img.width}x{img.height}px • {formatBytes(img.size)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-white/5 mt-1">
                      <span className="text-[10px] font-extrabold text-emerald-400 tracking-wider">ACCEPTED</span>
                      <button 
                        onClick={(e) => handleDeleteImage(e, img.id)}
                        className="text-slate-500 hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition-all"
                        title="Delete photo"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 🔴 REJECTED PHOTOS SECTION */}
        <section className="bg-charcoal border border-white/5 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold tracking-tight text-red-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#EF4444]"></span>
              Some Photos Didn't Meet Our Guidelines
            </h2>
            <span className="bg-red-500/10 border border-red-500/30 text-red-400 font-extrabold text-xs px-3 py-1 rounded-full">
              {rejectedPhotos.length} Failing
            </span>
          </div>

          {rejectedPhotos.length === 0 ? (
            <div className="border border-dashed border-white/5 bg-obsidian/20 rounded-xl py-12 px-4 flex flex-col items-center justify-center text-center text-slate-400">
              <CheckCircle2 size={36} className="text-slate-600 mb-3" />
              <h3 className="text-sm font-semibold text-slate-300">All photos compliant</h3>
              <p className="text-xs max-w-xs mt-1">No failing images found. You are fully aligned with the guidelines!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {rejectedPhotos.map((img) => (
                <div 
                  key={img.id} 
                  className="bg-obsidian border border-white/5 hover:border-white/10 rounded-xl overflow-hidden shadow-md cursor-pointer hover:-translate-y-1 transition-all duration-300 relative group flex flex-col"
                  onClick={() => setSelectedImage(img)}
                >
                  {/* Photo Canvas with CROP / TRY AGAIN overlays */}
                  <div className="w-full h-48 bg-charcoal overflow-hidden relative">
                    <img src={img.s3Url} alt={img.originalName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    
                    {/* REJECTED BADGE TOP RIGHT */}
                    <div className="absolute top-3 right-3 bg-red-500 text-white rounded-full p-1 shadow-lg border border-red-400/40 z-10 flex items-center justify-center">
                      <X size={16} />
                    </div>


                    {/* VISUAL OVERLAY BADGE SHOWING DATABASE REJECT REASON */}
                    <div className="absolute bottom-0 inset-x-0 bg-red-900/90 backdrop-blur-sm py-2 px-3 flex items-center gap-1.5 text-red-100 border-t border-red-500/20 z-10">
                      <AlertTriangle size={14} className="flex-shrink-0 text-red-400" />
                      <span className="text-[10px] font-bold truncate tracking-wide" title={img.rejectReason}>
                        {img.rejectReason || 'Validation audit failed'}
                      </span>
                    </div>
                  </div>

                  {/* Card Detail block */}
                  <div className="p-4 flex flex-col justify-between flex-grow gap-2 bg-obsidian">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-100 truncate" title={img.originalName}>{img.originalName}</span>
                      <span className="text-[10px] font-semibold text-slate-400 font-sans mt-0.5">
                        {img.width > 0 ? `${img.width}x${img.height}px` : 'N/A'} • {formatBytes(img.size)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-white/5 mt-1">
                      <span className="text-[10px] font-extrabold text-red-500 tracking-wider">REJECTED</span>
                      <button 
                        onClick={(e) => handleDeleteImage(e, img.id)}
                        className="text-slate-500 hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition-all"
                        title="Delete log"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      {/* 🔍 DETAILED AUDIT MODAL DRAWER */}
      {selectedImage && (
        <div className="modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="modal-content overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Close Cross */}
            <button className="modal-close" onClick={() => setSelectedImage(null)}>
              <X size={18} />
            </button>

            <div className="modal-body flex flex-col md:grid md:grid-cols-2">
              {/* Left Canvas */}
              <div className="modal-image-container h-80 md:h-full bg-black/60 flex items-center justify-center border-b md:border-b-0 md:border-r border-white/5">
                <img src={selectedImage.s3Url} alt={selectedImage.originalName} className="max-h-full max-w-full object-contain" />
              </div>

              {/* Right Audits */}
              <div className="p-8 flex flex-col overflow-y-auto max-h-[80vh] md:max-h-[90vh]">
                <h2 className="text-xl font-bold tracking-tight text-white truncate" title={selectedImage.originalName}>
                  {selectedImage.originalName}
                </h2>
                <span className="text-xs text-slate-400 font-semibold font-sans mt-1">
                  Format: {selectedImage.mimeType.split('/').pop().toUpperCase()} • ID: {selectedImage.id.substring(0, 8)}
                </span>

                <div className={`mt-4 inline-flex items-center gap-1.5 py-1.5 px-4 rounded-full text-xs font-bold self-start border ${selectedImage.status === 'ACCEPTED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                  {selectedImage.status === 'ACCEPTED' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                  <span>{selectedImage.status === 'ACCEPTED' ? 'PASSED PIPELINE VALIDATIONS' : 'FAILED GUIDELINE VALIDATIONS'}</span>
                </div>

                {/* Verification Checklist */}
                <h3 className="text-xs uppercase font-extrabold text-slate-400 tracking-wider mt-6 mb-3">Verification Checklist</h3>
                <div className="flex flex-col gap-3 mb-6">
                  {getAuditChecklist(selectedImage).map((item) => (
                    <div 
                      key={item.id}
                      className={`flex gap-3 p-3 bg-white/5 border rounded-xl items-start transition-colors duration-200 ${item.passed ? 'border-l-4 border-l-emerald-500 border-white/5' : 'border-l-4 border-l-red-500 border-white/5'}`}
                    >
                      <div className={`flex-shrink-0 mt-0.5 ${item.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                        {item.passed ? <CheckCircle2 size={16} /> : <X size={16} />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white">{item.name}</span>
                        <span className={`text-[10px] font-semibold mt-0.5 ${item.passed ? 'text-slate-400' : 'text-red-400/90'}`}>
                          {item.passed ? item.desc : item.msg}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Spec details grid */}
                <h3 className="text-xs uppercase font-extrabold text-slate-400 tracking-wider mb-3">Technical Attributes</h3>
                <div className="grid grid-cols-2 gap-3 p-4 bg-black/40 border border-white/5 rounded-xl">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Resolution</span>
                    <span className="text-xs font-bold text-white">{selectedImage.width}x{selectedImage.height}px</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">File size</span>
                    <span className="text-xs font-bold text-white">{formatBytes(selectedImage.size)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Blur Variance</span>
                    <span className="text-xs font-bold text-white">{selectedImage.blurScore.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Face Count</span>
                    <span className="text-xs font-bold text-white">{selectedImage.faceCount}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Face Canvas Ratio</span>
                    <span className="text-xs font-bold text-white">{(selectedImage.faceSizeRatio * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">imageHash</span>
                    <span className="text-xs font-mono font-bold text-white uppercase tracking-wider truncate">{selectedImage.imageHash || 'N/A'}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
