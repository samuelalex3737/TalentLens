import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { gradientText } from '../components/UI/GradientText';

import { supabase } from '../supabaseClient';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });      
      if (error) {
        setErrorMsg(error.message || 'Failed to send reset link');
        setStatus('error');
      } else {
        setStatus('success');
      }
    } catch (err) {
      setErrorMsg('An error occurred. Please try again later.');
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-white/60 dark:bg-slate-950/60 backdrop-blur-md overflow-y-auto">
      <div className="absolute top-4 right-4">
        <Link to="/" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-white/50 dark:bg-slate-800/50 hover:bg-white/80 dark:hover:bg-slate-700/50 p-2 rounded-full shadow-sm dark:shadow-none transition-colors inline-flex items-center justify-center">
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
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Reset your password
        </h2>
        <p className="mt-2 text-center text-sm font-medium text-gray-800 dark:text-gray-400 dark:font-normal">
          Enter your email address to receive a reset link.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/90 dark:bg-slate-900/80 border border-gray-200 dark:border-indigo-500/20 py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 backdrop-blur-md">
          {status === 'success' ? (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100/50 dark:bg-green-100/10 mb-4">
                <CheckCircle className="h-6 w-6 text-green-500 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Check your email</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                We've sent a password reset link to <span className="font-semibold text-gray-800 dark:text-gray-300">{email}</span>.
              </p>
              <Link
                to="/login"
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 transition-all duration-200"
              >
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              {status === 'error' && (
                <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-600 dark:text-red-500 text-sm p-3 rounded-lg text-center">
                  {errorMsg}
                </div>
              )}
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email address</label>
                  <div className="mt-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 bg-white dark:bg-slate-800/50 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 py-2.5"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 focus:outline-none transition-all duration-200 disabled:opacity-50"
                  >
                    {status === 'loading' ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </div>
                
                <div className="mt-4 flex justify-center">
                  <Link to="/login" className="flex items-center text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Login
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
