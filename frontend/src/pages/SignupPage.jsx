import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { gradientText } from '../components/UI/GradientText';
import { supabase } from '../supabaseClient';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M3.06364 7.50914C4.70909 4.24092 8.09084 2 12 2C14.6954 2 16.959 2.99095 18.6909 4.60455L15.8227 7.47274C14.7864 6.48185 13.4681 5.97727 12 5.97727C9.39542 5.97727 7.19084 7.73637 6.40455 10.1C6.2045 10.7 6.09086 11.3409 6.09086 12C6.09086 12.6591 6.2045 13.3 6.40455 13.9C7.19084 16.2636 9.39542 18.0227 12 18.0227C13.3454 18.0227 14.4909 17.6682 15.3864 17.0682C16.4454 16.3591 17.15 15.3 17.3818 14.05H12V10.1818H21.4181C21.5364 10.8363 21.6 11.5182 21.6 12.2273C21.6 15.2727 20.5091 17.8363 18.6181 19.5773C16.9636 21.1046 14.7 22 12 22C8.09084 22 4.70909 19.7591 3.06364 16.4909C2.38638 15.1409 2 13.6136 2 12C2 10.3864 2.38638 8.85911 3.06364 7.50914Z"/>
  </svg>
);

export default function SignupPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/'
        }
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(err.message || 'Google sign in failed');
      setGoogleLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length <= 7) {
      setError('Password must be more than 7 characters');
      return;
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: `${firstName} ${lastName}`.trim(),
          }
        }
      });
      
      if (signUpError) {
        setError(signUpError.message || 'Registration failed');
      } else {
        navigate('/login', { state: { message: 'Registration successful! Please check your email to verify your account.' } });
      }
    } catch (err) {
      setError('An error occurred during registration');
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
          Create an account
        </h2>
        <p className="mt-2 text-center text-sm font-medium text-gray-800 dark:text-gray-400 dark:font-normal">
          Start identifying top talent with AI
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/90 dark:bg-slate-900/80 border border-gray-200 dark:border-indigo-500/20 py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 backdrop-blur-md">
          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-600 dark:text-red-500 text-sm p-3 rounded-lg text-center">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg border border-gray-200 dark:border-indigo-500/30 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <GoogleIcon />
            {googleLoading ? 'Redirecting...' : 'Continue with Google'}
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200 dark:bg-white/[0.08]" />
            <span className="text-xs text-gray-400 dark:text-slate-500 whitespace-nowrap">
              or sign up with email
            </span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-white/[0.08]" />
          </div>

          <form className="space-y-6" onSubmit={handleSignup}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">First Name</label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </div>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="block w-full pl-10 bg-white dark:bg-slate-800/50 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 py-2.5"
                    placeholder="First"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Last Name</label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </div>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="block w-full pl-10 bg-white dark:bg-slate-800/50 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 py-2.5"
                    placeholder="Last"
                  />
                </div>
              </div>
            </div>

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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 bg-white dark:bg-slate-800/50 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 py-2.5"
                  placeholder="Create a password"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">Must be at least 8 characters</p>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 transition-all duration-200"
              >
                Create Account
              </button>
            </div>
            
            <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
