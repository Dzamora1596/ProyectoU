// App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Inicio from "./pages/Inicio";
import RegistroPersonal from "./pages/RegistroPersonal";
import Usuarios from "./pages/Usuarios";
import ValidarAsistencias from "./pages/asistencias/ValidarAsistencias";
import HorasExtra from "./pages/planilla/HorasExtra";
import HorarioEmpleado from "./pages/horarios/HorarioEmpleado";
import CatalogosHorario from "./pages/horarios/CatalogosHorario";
import Permisos from "./pages/permisos/Permisos";
import Vacaciones from "./pages/vacaciones/Vacaciones";

function Placeholder({ titulo }) {
  return (
    <div className="p-3">
      <h3 style={{ margin: 0 }}>{titulo}</h3>
      <p className="text-muted mt-2 mb-0">Página en construcción.</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Inicio />} />
          <Route path="/inicio" element={<Inicio />} />
          <Route path="/registro-personal" element={<RegistroPersonal />} />
          <Route path="/usuarios" element={<Usuarios />} />

          <Route path="/asistencias/validar" element={<ValidarAsistencias />} />
          <Route
            path="/asistencias/registro"
            element={<Placeholder titulo="Registrar/ajustar asistencias" />}
          />

          <Route
            path="/planilla/calcular-salarios"
            element={<Placeholder titulo="Calcular salarios" />}
          />
          <Route path="/planilla/horas-extra" element={<HorasExtra />} />
          <Route path="/planilla/deducciones" element={<Placeholder titulo="Deducciones" />} />
          <Route path="/planilla/adelantos" element={<Placeholder titulo="Adelantos" />} />
          <Route path="/planilla/aguinaldo" element={<Placeholder titulo="Aguinaldo" />} />
          <Route path="/planilla/incapacidades" element={<Placeholder titulo="Incapacidades" />} />
          <Route path="/planilla/liquidacion" element={<Placeholder titulo="Liquidación" />} />

          <Route path="/permisos" element={<Permisos />} />
          <Route path="/vacaciones" element={<Vacaciones />} />
          <Route path="/consultas" element={<Placeholder titulo="Consultas" />} />
          <Route path="/reportes" element={<Placeholder titulo="Reportes" />} />

          <Route path="/mantenimientos" element={<Placeholder titulo="Mantenimientos" />} />
          <Route path="/mantenimientos/horario-empleado" element={<HorarioEmpleado />} />
          <Route path="/mantenimientos/catalogos-horario" element={<CatalogosHorario />} />

          <Route path="/solicitudes/permisos" element={<Permisos />} />
          <Route path="/solicitudes/vacaciones" element={<Vacaciones mode="solicitar" />} />
          <Route path="/solicitudes/adelantos" element={<Placeholder titulo="Solicitar adelanto" />} />

          <Route path="/mi-info" element={<Placeholder titulo="Mi información" />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/inicio" replace />} />
    </Routes>
  );
}
