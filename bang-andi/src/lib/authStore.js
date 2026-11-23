import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from './supabase.js';
import { syncFromSupabase } from './supabaseService.js';
import { translateErrorMessage } from './errorHandler.js';

export const useAuthStore = create((set) => ({
  user: null,
  session: null,
  loading: true,
  isConfigured: isSupabaseConfigured,
  isGuest: true,
  authError: null,
  isAuthModalOpen: false,
  setAuthModalOpen: (open) => set({ isAuthModalOpen: Boolean(open) }),

  initializeAuth: async () => {
    set({ loading: true });

    if (!isSupabaseConfigured || !supabase) {
      // Offline / local mode
      const savedGuest = localStorage.getItem('bang_andi_guest_mode') === 'true';
      set({ loading: false, isGuest: savedGuest || true });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        set({ user: session.user, session, loading: false, isGuest: false });
        // Auto sync data on login
        syncFromSupabase();
      } else {
        set({ user: null, session: null, loading: false, isGuest: true });
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (newSession) {
          set({ user: newSession.user, session: newSession, isGuest: false });
          syncFromSupabase();
        } else {
          set({ user: null, session: null });
        }
      });
    } catch {
      set({ loading: false, isGuest: true });
    }
  },

  login: async (email, password) => {
    set({ loading: true, authError: null });

    if (!isSupabaseConfigured || !supabase) {
      // Local fallback login
      if (email && password) {
        const localUser = { id: 'bang-andi-owner', email };
        set({ user: localUser, loading: false, isGuest: false });
        return { success: true };
      }
      set({ loading: false, authError: 'Email dan password harus diisi' });
      return { success: false, error: 'Email dan password harus diisi' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const friendly = translateErrorMessage(error, 'Email atau kata sandi tidak valid.');
        set({ loading: false, authError: friendly });
        return { success: false, error: friendly };
      }

      set({ user: data.user, session: data.session, loading: false, isGuest: false });
      await syncFromSupabase();
      return { success: true };
    } catch (err) {
      const friendly = translateErrorMessage(err, 'Terjadi kendala saat login.');
      set({ loading: false, authError: friendly });
      return { success: false, error: friendly };
    }
  },

  signUp: async (email, password) => {
    set({ loading: true, authError: null });

    if (!isSupabaseConfigured || !supabase) {
      const localUser = { id: 'bang-andi-owner', email };
      set({ user: localUser, loading: false, isGuest: false });
      return { success: true };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        const friendly = translateErrorMessage(error, 'Gagal mendaftar akun.');
        set({ loading: false, authError: friendly });
        return { success: false, error: friendly };
      }

      set({ user: data.user, session: data.session, loading: false });
      return { success: true };
    } catch (err) {
      const friendly = translateErrorMessage(err, 'Terjadi kendala saat pendaftaran.');
      set({ loading: false, authError: friendly });
      return { success: false, error: friendly };
    }
  },

  logout: async () => {
    set({ loading: true });
    localStorage.removeItem('bang_andi_guest_mode');

    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Sign out error:', err);
      }
    }

    set({ user: null, session: null, isGuest: false, loading: false });
  },

  continueAsGuest: () => {
    localStorage.setItem('bang_andi_guest_mode', 'true');
    set({ isGuest: true, authError: null });
  },
}));

export default useAuthStore;
