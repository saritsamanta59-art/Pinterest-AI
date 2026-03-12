import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';

interface User {
  id: string;
  email: string;
  name: string;
  geminiApiKey?: string;
  pinterestAccounts?: any[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  updateProfile: (data: Partial<User>) => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// We use a constant ID for the single-user mode
const DEFAULT_USER_ID = 'default-user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Directly fetch/sync the default user document
    const userDocRef = doc(db, 'users', DEFAULT_USER_ID);
    
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setUser(docSnap.data() as User);
      } else {
        // Create default user doc if it doesn't exist
        const newUser: User = {
          id: DEFAULT_USER_ID,
          email: 'admin@pingenius.ai',
          name: 'Admin User',
          geminiApiKey: '',
          pinterestAccounts: []
        };
        setDoc(userDocRef, newUser);
        setUser(newUser);
      }
      setLoading(false);
    }, (error) => {
      console.error('Firestore snapshot error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateProfile = async (data: Partial<User>) => {
    try {
      const userDocRef = doc(db, 'users', DEFAULT_USER_ID);
      await updateDoc(userDocRef, data);
    } catch (error) {
      console.error('Update profile failed', error);
      throw error;
    }
  };

  const getIdToken = async () => {
    // In no-auth mode, we return a dummy token or null
    // Note: The backend proxy might need adjustment if it strictly verifies tokens
    return 'no-auth-token';
  };

  return (
    <AuthContext.Provider value={{ user, loading, updateProfile, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
