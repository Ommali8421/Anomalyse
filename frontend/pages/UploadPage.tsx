import React, { useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { uploadService } from '../services/uploadService';

const UploadPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus({ type: null, message: '' });
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setStatus({ type: null, message: '' });

    try {
      const result = await uploadService.uploadCSV(file);
      setStatus({ 
        type: 'success', 
        message: `${result.message} ${result.rowsProcessed} transactions queued for ML analysis.` 
      });
      setFile(null);
    } catch (error) {
      setStatus({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Upload failed.' 
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Data Ingestion</h1>
          <p className="text-slate-500">Upload batch transaction files (CSV) for anomaly detection.</p>
        </div>
        <a 
          href="https://drive.google.com/drive/folders/13NxFgHVNYKJAydSyvts_yTOqJNbNu4pf" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 transition-colors"
        >
          <FileText className="w-4 h-4" />
          Get Demo CSV File
        </a>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors">
          <div className="bg-white p-4 rounded-full shadow-sm mb-4">
            <UploadCloud className="w-8 h-8 text-blue-600" />
          </div>
          
          <h3 className="text-lg font-medium text-slate-900">Upload Transaction CSV</h3>
          <p className="text-slate-500 text-sm mt-1 mb-6 text-center">
            Drag and drop your file here, or click to browse. <br/>
            Supported format: .csv
          </p>

          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              cursor-pointer mx-auto max-w-xs
            "
          />
        </div>

        {file && (
          <div className="mt-6 flex items-center justify-between bg-blue-50 p-4 rounded-lg border border-blue-100">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-slate-900">{file.name}</p>
                <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
              </div>
            </div>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                uploading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {uploading ? 'Processing...' : 'Analyze Transactions'}
            </button>
          </div>
        )}

        {status.type === 'success' && (
          <div className="mt-6 p-4 bg-green-50 border border-green-100 rounded-lg flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-green-800">Upload Complete</h4>
              <p className="text-sm text-green-600 mt-1">{status.message}</p>
            </div>
          </div>
        )}

        {status.type === 'error' && (
          <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-red-800">Upload Failed</h4>
              <p className="text-sm text-red-600 mt-1">{status.message}</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg">
        <h4 className="text-sm font-medium text-amber-900 mb-2">Note to Analysts</h4>
        <p className="text-sm text-amber-800">
          Uploaded files are processed asynchronously by the backend ML pipeline.
          High-risk anomalies will appear on the Dashboard and Transactions page once processing is complete.
        </p>
      </div>
    </div>
  );
};

export default UploadPage;