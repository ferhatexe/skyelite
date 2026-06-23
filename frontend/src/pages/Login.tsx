import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, ShieldAlert, Sparkles, Cpu } from 'lucide-react';

export const Login: React.FC = () => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pin.length !== 4) return;
    setError(null);
    setIsLoading(true);

    try {
      await login(pin);
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Giriş başarısız. Lütfen PIN kodunu kontrol edin.');
      setPin(''); // Clear PIN on error so they can re-type
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-submit when PIN reaches 4 digits
  React.useEffect(() => {
    if (pin.length === 4) {
      const timer = setTimeout(() => {
        handleSubmit();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pin]);

  return (
    <div className="min-h-screen bg-[#070b19] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* High-tech glow rings in background */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-sky-500/10 to-indigo-500/0 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-bl from-purple-500/10 to-emerald-500/0 blur-[120px] pointer-events-none"></div>

      {/* Cyber Grid Pattern Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.005)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.005)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none [mask-image:radial-gradient(ellipse_at_center,white_30%,transparent_90%)]"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="relative group cursor-pointer">
            {/* Pulsing neon frame */}
            <div className="absolute -inset-1 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-2xl blur-md opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
            <div className="relative p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center">
              <Cpu className="w-8 h-8 text-sky-400 group-hover:rotate-90 transition-transform duration-700" />
            </div>
          </div>
        </div>
        
        <h2 className="mt-8 text-center text-3xl font-extrabold tracking-tight text-white">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-250 to-purple-400">
            SkyElite
          </span>
        </h2>
        <p className="mt-2 text-center text-xs font-semibold text-sky-500/80 tracking-widest uppercase">
          YÖNETİCİ KONTROL KONSOLU
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 relative z-10">
        <div className="shimmer-border glass-card py-8 px-6 shadow-[0_25px_60px_rgba(0,0,0,0.8)] rounded-[2rem] sm:px-10 border border-white/5 relative">
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl flex items-start space-x-3 text-xs animate-bounce">
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* PIN Input */}
            <div className="space-y-3">
              <label htmlFor="pin" className="block text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                GÜVENLİ PIN KODU
              </label>
              <div className="relative rounded-xl group max-w-[200px] mx-auto">
                <div className="absolute -inset-px bg-gradient-to-r from-sky-500/20 to-indigo-500/20 rounded-xl blur-[2px] group-focus-within:from-sky-500 group-focus-within:to-indigo-500 transition duration-300"></div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4.5 w-4.5 text-slate-500 group-focus-within:text-sky-400 transition-colors" />
                  </div>
                  <input
                    id="pin"
                    name="pin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    required
                    value={pin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setPin(val);
                    }}
                    className="block w-full pl-10 pr-4 py-3.5 bg-slate-950/60 border border-slate-850 rounded-xl text-white placeholder-slate-650 focus:outline-none focus:border-transparent transition-all text-xl font-bold tracking-[0.5em] text-center"
                    placeholder="••••"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading || pin.length !== 4}
                className="w-full relative group overflow-hidden py-4 px-4 rounded-xl shadow-lg shadow-sky-500/10 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {/* Button background gradients */}
                <div className="absolute inset-0 bg-gradient-to-r from-sky-600 to-indigo-600 group-hover:from-sky-500 group-hover:to-indigo-500 transition-all duration-300"></div>
                
                {/* Shimmer light effect */}
                <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white/15 opacity-40 group-hover:animate-shimmer" style={{ animationDuration: '1.5s' }}></div>

                <span className="relative z-10 flex items-center justify-center space-x-2 text-sm font-bold text-white tracking-wider uppercase">
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>SİSTEME GİRİŞ YAP</span>
                      <Sparkles className="w-4 h-4 text-sky-200" />
                    </>
                  )}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* Decorative Console Footer */}
      <div className="text-center mt-8 text-[10px] text-slate-500 tracking-wider relative z-10 font-mono">
        SYSTEM SECURITY PROTOCOL STAGE 2 // READY
      </div>
    </div>
  );
};
