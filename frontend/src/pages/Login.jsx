//Pagina de Login
import { useState } from "react";
import { login as loginService } from "../services/autenticarService";
import "../styles/autenticar.css";
// Componente de Login
export default function Login({ onLogin }) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
// Maneja el envío del formulario de login
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    try {
      const data = await loginService({ usuario, password });
      // data.usuario debe venir del backend
      onLogin(data.usuario);
    } catch (e2) {
      setErr(e2.response?.data?.mensaje || "Error al iniciar sesión");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Iniciar sesión</h2>
        <p className="auth-subtitle">Accede al sistema de planilla.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>Usuario</label>
          <input
            type="text"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            placeholder="Usuario"
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />

          <button type="submit" className="auth-btn-primary">
            Ingresar
          </button>

          {err && <p className="auth-error">{err}</p>}
        </form>
      </div>
    </div>
  );
}
