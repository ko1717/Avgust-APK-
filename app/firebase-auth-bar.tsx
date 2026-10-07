'use client';
import {useState} from 'react';
import {Cloud, CloudCheck, LogIn, LogOut, ShieldCheck, UserCheck, X} from 'lucide-react';
import {useFirebaseAuth, ADMIN_EMAIL} from '@/lib/firebase';

export function FirebaseAuthBar({onSyncNow: _onSyncNow}:{onSyncNow?:()=>void} = {}){
  const {user, loading, loginWithGoogle, loginAnonymously, logout, isAdmin} = useFirebaseAuth();
  const [showModal, setShowModal] = useState(false);
  const [authError, setAuthError] = useState<string|null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    setAuthError(null);
    try {
      await loginWithGoogle();
      setShowModal(false);
    } catch (err) {
      setAuthError((err as Error).message || 'Error al iniciar sesión con Google.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnonLogin = async () => {
    setSubmitting(true);
    setAuthError(null);
    try {
      await loginAnonymously();
      setShowModal(false);
    } catch (err) {
      setAuthError((err as Error).message || 'Error al ingresar como administrador.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 text-xs">
        {loading ? (
          <span className="text-slate-400 text-[11px] flex items-center gap-1">
            <Cloud size={14} className="animate-pulse text-[#007fa3]"/>
            <span className="hidden sm:inline">Conectando nube…</span>
          </span>
        ) : user ? (
          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-1 rounded-full text-emerald-900 dark:text-emerald-200">
            <CloudCheck size={14} className="text-[#78be20] shrink-0" />
            <span className="font-semibold text-[11px] max-w-[140px] truncate" title={user.email || 'Administrador Conectado'}>
              {user.email || 'Admin Fincas'}
            </span>
            {isAdmin && (
              <span className="bg-[#78be20] text-white text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase">
                Admin
              </span>
            )}
            <button
              onClick={()=>void logout()}
              title="Cerrar sesión"
              className="text-slate-400 hover:text-rose-600 transition-colors ml-1 p-0.5 rounded cursor-pointer"
              aria-label="Cerrar sesión"
            >
              <LogOut size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 bg-[#007fa3]/10 hover:bg-[#007fa3]/20 text-[#007fa3] dark:text-[#38bdf8] border border-[#007fa3]/30 px-2.5 py-1 rounded-full font-bold text-[11px] transition-all cursor-pointer shadow-xs"
            title="Conectar Firebase Auth para sincronizar visitas e informes en tiempo real"
          >
            <LogIn size={13} />
            <span>Acceso Nube / Admin</span>
          </button>
        )}
      </div>

      {/* Modal de Inicio de Sesión para Administradores de Fincas */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative text-slate-900 dark:text-slate-100">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              aria-label="Cerrar ventana"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <div className="p-2.5 rounded-xl bg-[#007fa3]/10 text-[#007fa3]">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="text-base font-extrabold m-0 leading-tight">Acceso Administrador de Fincas</h3>
                <span className="text-[11px] text-slate-500">Firebase Firestore & Authentication</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 mb-4 leading-relaxed">
              Inicia sesión para sincronizar automáticamente en la nube todas las visitas en tiempo real y habilitar la generación de informes técnicos digitales accesibles por los responsables de finca.
            </p>

            {authError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-700 dark:text-rose-300 text-xs mb-4">
                {authError}
              </div>
            )}

            <div className="space-y-2.5">
              <button
                onClick={()=>void handleGoogleLogin()}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Continuar con Google</span>
              </button>

              <div className="relative my-3 text-center">
                <span className="bg-white dark:bg-slate-900 px-2 text-[10px] text-slate-400 uppercase tracking-widest relative z-10">o ingreso rápido</span>
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-800"></div></div>
              </div>

              <button
                onClick={()=>void handleAnonLogin()}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#78be20] hover:bg-[#68a71c] text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                <UserCheck size={16} />
                <span>Ingresar como Administrador de Campo</span>
              </button>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Administrador registrado:</span> {ADMIN_EMAIL}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
