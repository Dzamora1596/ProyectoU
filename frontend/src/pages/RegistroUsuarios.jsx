//Registro de usuarios en la aplicación React
import { useState } from 'react';
import { registrarUsuario } from '../services/autenticarService';

export default function RegistroUsuarios() {
  const [idUsuario, setIdUsuario] = useState(10);
  const [empleadoId, setEmpleadoId] = useState(2615);
  const [nombreUsuario, setNombreUsuario] = useState('usuario_prueba');
  const [password, setPassword] = useState('12345');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');

    try {
      const data = await registrarUsuario({ idUsuario, empleadoId, nombreUsuario, password });
      setMsg(data.mensaje || 'Usuario creado');
    } catch (e2) {
      setErr(e2.response?.data?.mensaje || 'Error creando usuario');
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '20px auto' }}>
      <h2>Crear usuario (para pruebas)</h2>

      <form onSubmit={handleSubmit}>
        <input
          type="number"
          value={idUsuario}
          onChange={(e) => setIdUsuario(Number(e.target.value))}
          placeholder="idUsuario"
          style={{ width: '100%', marginBottom: 10 }}
        />

        <input
          type="number"
          value={empleadoId}
          onChange={(e) => setEmpleadoId(Number(e.target.value))}
          placeholder="Empleado_idEmpleado"
          style={{ width: '100%', marginBottom: 10 }}
        />

        <input
          value={nombreUsuario}
          onChange={(e) => setNombreUsuario(e.target.value)}
          placeholder="NombreUsuario"
          style={{ width: '100%', marginBottom: 10 }}
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={{ width: '100%', marginBottom: 10 }}
        />

        <button style={{ width: '100%' }} type="submit">
          Crear
        </button>

        {msg && <p style={{ color: 'green' }}>{msg}</p>}
        {err && <p style={{ color: 'red' }}>{err}</p>}
      </form>
    </div>
  );
}
