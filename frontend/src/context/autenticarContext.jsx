//autenticarContext.jsx
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';

const AutenticarContext = createContext(null);

export function AutenticarProvider({ children }) {
  const [token, setToken] = useState(null);
  const [rol, setRol] = useState(null);

  const login = (tokenRecibido, rolRecibido) => {
    setToken(tokenRecibido);
    setRol(rolRecibido);
  };

  const logout = () => {
    setToken(null);
    setRol(null);
  };

  return (
    <AutenticarContext.Provider
      value={{ token, rol, login, logout }}
    >
      {children}
    </AutenticarContext.Provider>
  );
}

export function useAutenticar() {
  const context = useContext(AutenticarContext);
  if (!context) {
    throw new Error(
      'useAutenticar debe usarse dentro de AutenticarProvider'
    );
  }
  return context;
}
