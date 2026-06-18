import { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { gradientText } from '../components/UI/GradientText';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const calledOnce = useRef(false);

  const [status, setStatus] = useState('loading'); // loading, success, error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('Invalid or missing verification link.');
      return;
    }

    if (calledOnce.current) return;
    calledOnce.current = true;

    const verifyEmail = async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${API_BASE}/api/auth/verify-email`, {          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        
        if (res.ok) {
          setStatus('success');
          setTimeout(() => navigate('/login'), 3000);
        } else {
          const data = await res.json();
          setErrorMsg(data.detail || 'Email verification failed');
          setStatus('error');
        }
      } catch (err) {
        setErrorMsg('An error occurred. Please try again later.');
        setStatus('error');
      }
    };

    verifyEmail();
  }, [token, navigate]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
      <div className="absolute top-4 right-4">
        <Link to="/" className="text-gray-400 hover:text-white bg-slate-800/50 hover:bg-slate-700/50 p-2 rounded-full transition-colors inline-flex items-center justify-center">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Link>
      </div>
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex flex-col items-center group">
          <img src="/logo.png" alt="TalentLens Logo" className="w-20 h-20 object-cover mix-blend-screen" />
          <span className="text-3xl font-black leading-tight mt-2" style={gradientText}>
            TalentLens
          </span>
        </Link>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900/80 border border-indigo-500/20 py-8 px-4 shadow sm:rounded-2xl sm:px-10 backdrop-blur-md text-center">
          
          {status === 'loading' && (
            <div className="flex flex-col items-center">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Verifying your email</h2>
              <p className="text-gray-400">Please wait while we verify your account...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center h-16 w-16 rounded-full bg-green-100/10 mb-4">
                <CheckCircle className="h-10 w-10 text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Email Verified!</h2>
              <p className="text-gray-400 mb-6">Your account has been successfully verified.</p>
              <p className="text-sm text-indigo-400 mb-6">Redirecting you to login...</p>
              <Link
                to="/login"
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 transition-all duration-200"
              >
                Go to Login
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center h-16 w-16 rounded-full bg-red-100/10 mb-4">
                <XCircle className="h-10 w-10 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Verification Failed</h2>
              <p className="text-gray-400 mb-6">{errorMsg}</p>
              <Link
                to="/login"
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 transition-all duration-200"
              >
                Back to Login
              </Link>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}
