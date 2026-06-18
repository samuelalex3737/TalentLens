import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUp, FileText, X, Upload } from 'lucide-react';

/**
 * Drag-and-drop resume PDF upload zone with file list management.
 * @param {{ files: File[], setFiles: function }} props
 */
export default function ResumeDropzone({ files, setFiles }) {
  const onDrop = useCallback((acceptedFiles) => {
    const pdfFiles = acceptedFiles.filter(f => f.type === 'application/pdf');
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name));
      const newFiles = pdfFiles.filter(f => !existing.has(f.name));
      return [...prev, ...newFiles].slice(0, 20);
    });
  }, [setFiles]);

  const removeFile = (name) => {
    setFiles(prev => prev.filter(f => f.name !== name));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 20,
  });

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-indigo-500/10">
          <Upload className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Upload Resumes</h3>
          <p className="text-xs text-gray-500">Drag & drop PDF resumes (max 20)</p>
        </div>
      </div>

      <div
        {...getRootProps()}
        id="resume-dropzone"
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragActive
            ? 'border-blue-500 bg-blue-500/5'
            : 'border-white/10 hover:border-blue-500/30 hover:bg-white/[0.02]'
        }`}
      >
        <input {...getInputProps()} />
        <FileUp className={`w-10 h-10 mx-auto mb-3 ${isDragActive ? 'text-blue-400' : 'text-gray-600'}`} />
        {isDragActive ? (
          <p className="text-blue-400 font-medium">Drop resumes here...</p>
        ) : (
          <>
            <p className="text-gray-400 font-medium">Drag & drop PDF resumes here</p>
            <p className="text-xs text-gray-600 mt-1">or click to browse files</p>
          </>
        )}
      </div>

      {/* File List */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-400">
                {files.length} resume{files.length !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => setFiles([])}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Clear all
              </button>
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-1.5 pr-1">
              {files.map((file) => (
                <motion.div
                  key={file.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{ background: 'var(--surface-3)' }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="text-sm text-gray-300 truncate">{file.name}</span>
                    <span className="text-xs text-gray-600 shrink-0">
                      {(file.size / 1024).toFixed(0)} KB
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(file.name); }}
                    className="p-1 rounded hover:bg-white/5 text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
