import { Download } from 'lucide-react';
import { getExportUrl } from '../../services/api';

/**
 * CSV export button.
 * @param {{ sessionId: string }} props
 */
export default function ExportButton({ sessionId }) {
  if (!sessionId) return null;

  return (
    <a
      href={getExportUrl(sessionId)}
      download
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                 bg-[#615FFF] hover:bg-[rgba(97,95,255,0.9)] text-white
                 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30
                 transition-all duration-200 active:scale-95 btn-export-csv"
    >
      <Download className="w-4 h-4" />
      Export CSV
    </a>
  );
}
