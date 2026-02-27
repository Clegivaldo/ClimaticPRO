import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Shared authentication store
 * Requirement 10.1: Shared state management
 */

interface User {
  userId: string;
  email?: string;
  phone?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage), // This works on Web, for RN we'll need AsyncStorage
    }
  )
);
