// frontend/src/pages/Login.jsx
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Container, Card, Form, Button, Alert, Spinner } from "react-bootstrap";
import cliente from "../api/axios";

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
    <div className="min-vh-100 position-relative d-flex align-items-center">
      <div className="position-absolute top-0 start-0 w-100 h-100" style={{ zIndex: 0 }}>
        <img
          src="/Login.png"
          alt="Inicio"
          className="w-100 h-100"
          style={{ objectFit: "cover", filter: "contrast(1.05) saturate(1.05)" }}
        />
        <div
          className="position-absolute top-0 start-0 w-100 h-100"
          style={{
            background:
              "linear-gradient(135deg, rgba(11,11,12,0.70) 0%, rgba(11,11,12,0.25) 55%, rgba(193,18,31,0.18) 100%)",
          }}
        />
      </div>

      <Container fluid className="position-relative" style={{ zIndex: 1 }}>
        <div className="row justify-content-center">
          <div className="col-12 col-sm-10 col-md-7 col-lg-5 col-xl-4">
            <Card className="shadow-lg border-0">
              <Card.Body className="p-4 p-md-5">
                <div className="text-center mb-4">
                  <div className="fw-bold text-dark" style={{ fontSize: "1.35rem" }}>
                    Iniciar sesión
                  </div>
                  <div className="text-muted small">Acceso al sistema</div>
                </div>

                {error && (
                  <Alert variant="danger" className="dm-alert-accent">
                    {error}
                  </Alert>
                )}

                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3" controlId="usuario">
                    <Form.Label className="fw-semibold">Usuario</Form.Label>
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
                    <Form.Label className="fw-semibold">Contraseña</Form.Label>
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
                      <span className="d-inline-flex align-items-center justify-content-center gap-2">
                        <Spinner size="sm" /> Ingresando...
                      </span>
                    ) : (
                      "Ingresar"
                    )}
                  </Button>
                </Form>

                <div className="text-muted mt-4 small text-center">
                  Sistema de Gestión de Planillas - Proyecto de Graduación
                </div>
              </Card.Body>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
}
