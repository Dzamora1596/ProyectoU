//Login.jsx
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Container, Card, Form, Button, Alert, Spinner } from "react-bootstrap";
import cliente from "../api/cliente";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const limpiarSesion = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    localStorage.removeItem("user");
    localStorage.removeItem("auth_user");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const u = usuario.trim();
    const p = password;

    if (!u || !p) {
      setError("Debe ingresar usuario y contraseña.");
      return;
    }

    setCargando(true);
    try {
      const resp = await cliente.post("/autenticar/login", { usuario: u, password: p });
      const data = resp?.data;

      if (!data?.ok) {
        setError(data?.mensaje || "No se pudo iniciar sesión.");
        return;
      }

      limpiarSesion();
      localStorage.setItem("token", data.token);
      localStorage.setItem("usuario", JSON.stringify(data.usuario));

       
      const destino = location.state?.from || "/inicio";
      navigate(destino, { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      const msgBackend = err?.response?.data?.mensaje;

      if (msgBackend) {
        setError(msgBackend);
      } else if (status) {
        setError(`Error iniciando sesión (HTTP ${status}).`);
      } else {
        setError("No se pudo conectar con el servidor. Verifique que el backend esté en 4000.");
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: "100vh" }}>
      <Card style={{ width: "420px" }} className="shadow">
        <Card.Body className="p-4">
          <h3 className="mb-3 text-center">Iniciar sesión</h3>

          {error && <Alert variant="danger">{error}</Alert>}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="usuario">
              <Form.Label>Usuario</Form.Label>
              <Form.Control
                type="text"
                placeholder="Ingrese su usuario"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                autoComplete="username"
                disabled={cargando}
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="password">
              <Form.Label>Contraseña</Form.Label>
              <Form.Control
                type="password"
                placeholder="Ingrese su contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={cargando}
              />
            </Form.Group>

            <Button type="submit" className="w-100" variant="primary" disabled={cargando}>
              {cargando ? (
                <>
                  <Spinner size="sm" className="me-2" /> Ingresando...
                </>
              ) : (
                "Ingresar"
              )}
            </Button>
          </Form>

          <div className="text-muted mt-3" style={{ fontSize: 13 }}>
            Backend esperado: <b>http://localhost:4000</b>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}
