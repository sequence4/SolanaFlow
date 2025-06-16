'use client';

import { useContext } from 'react';
import AuthContext from '@/context/auth/AuthContext';

export const useAuth = () => {
  const auth = useContext(AuthContext);
  return auth;
}; 