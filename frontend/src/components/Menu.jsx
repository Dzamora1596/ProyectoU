// Menu.jsx
import "bootstrap/dist/css/bootstrap.min.css";
import { NavLink, useLocation } from "react-router-dom";
import { useMemo, useState } from "react";
import { Button, Offcanvas } from "react-bootstrap";

function normalizarRol(user) {
  return String(user?.rolNombre || user?.rol || user?.nombreRol || "")
    .toLowerCase()
    .trim();
}

function puedeAcceder(user) {
  const rol = normalizarRol(user);

  const esAdmin = rol === "admin";
  const esJefatura = rol === "jefatura";
  const esPlanilla = rol === "personal de planilla";
  const esColaborador = rol === "colaborador";

  return {
    rolTexto: user?.rolNombre || user?.rol || user?.nombreRol || "",
    esAdmin,
    esJefatura,
    esPlanilla,
    esColaborador,

    puedeVerInicio: true,
    puedeRegistrarUsuarios: esAdmin || esJefatura,
    puedeRegistrarPersonal: esAdmin || esJefatura,
    puedeValidarAsistencias: esAdmin || esJefatura || esPlanilla,
    puedeRegistrarAsistencias: esAdmin || esJefatura,
    puedeCalcularPagos: esAdmin || esPlanilla,
    puedeVerMantenimientos: esAdmin,
    puedeVerConsultas: esAdmin || esJefatura || esPlanilla,
    puedeVerReportes: esAdmin || esJefatura || esPlanilla,
    puedeSolicitar: esColaborador,
    puedeVerSoloMiInfo: esColaborador,

     
     puedeVerHorarioEmpleado: esAdmin || esJefatura || esPlanilla,

     
    puedeVerCatalogosHorario: esAdmin || esJefatura,
  };
}

function SidebarContent({
  user,
  perms,
  items,
  collapsed,
  onToggleCollapsed,
  onLogout,
  onNavigate,
  pathname,
}) {
  return (
    <div className="d-flex flex-column h-100 position-relative">
      <button
        type="button"
        className="sidebar-handle d-none d-md-inline-flex"
        onClick={onToggleCollapsed}
        title={collapsed ? "Expandir" : "Colapsar"}
        aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
      >
        {collapsed ? "»" : "«"}
      </button>

      <div className="d-flex align-items-center justify-content-between px-3 py-3 border-bottom sidebar-header">
        <div className="d-flex flex-column" style={{ minWidth: 0 }}>
          <span className="fw-semibold text-truncate">
            {user?.nombreUsuario || "Usuario"}
          </span>
          <small className="text-muted text-truncate">{perms.rolTexto || ""}</small>
        </div>

        <Button
          variant="outline-secondary"
          size="sm"
          className="d-none d-md-inline"
          onClick={onToggleCollapsed}
          title={collapsed ? "Expandir" : "Colapsar"}
        >
          {collapsed ? "»" : "«"}
        </Button>
      </div>

      <div className="flex-grow-1 py-2">
        {items.map((it) => {
          if (it.type === "divider") {
            return (
              <div
                key={it.key}
                className={[
                  "pt-3 pb-1 text-uppercase text-muted small",
                  collapsed ? "text-center px-0" : "px-3",
                ].join(" ")}
                style={{ letterSpacing: 0.8 }}
              >
                {collapsed ? "•" : it.label}
              </div>
            );
          }

          return (
            <NavLink
              key={it.to}
              to={it.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                [
                  "menu-link d-flex align-items-center text-decoration-none",
                  collapsed ? "justify-content-center px-2" : "gap-2 px-3",
                  "py-2",
                  isActive ? "active" : "",
                ].join(" ")
              }
              title={collapsed ? it.label : undefined}
            >
              <span className="menu-icon">
                <i className={it.icon}></i>
              </span>
              {!collapsed && <span className="menu-label">{it.label}</span>}
            </NavLink>
          );
        })}
      </div>

      <div className="border-top p-3">
        <Button variant="outline-danger" className="w-100" onClick={onLogout}>
          {collapsed ? <i className="bi bi-power"></i> : "Cerrar sesión"}
        </Button>

        {!collapsed && (
          <div className="mt-2">
            <small className="text-muted">
              Ruta: <span className="font-monospace">{pathname}</span>
            </small>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Menu({ user, onLogout }) {
  const perms = useMemo(() => puedeAcceder(user), [user]);
  const [collapsed, setCollapsed] = useState(false);
  const [showMobile, setShowMobile] = useState(false);
  const location = useLocation();

  const items = [];

  items.push({ to: "/inicio", label: "Inicio", icon: "bi bi-house-door" });

  if (perms.puedeRegistrarPersonal) {
    items.push({
      to: "/registro-personal",
      label: "Registro personal",
      icon: "bi bi-person-badge",
    });
  }

  if (perms.puedeRegistrarUsuarios) {
    items.push({ to: "/usuarios", label: "Usuarios", icon: "bi bi-shield-lock" });
  }

   
  if (perms.puedeRegistrarAsistencias || perms.puedeValidarAsistencias) {
    items.push({ type: "divider", key: "div-asist", label: "Asistencias" });

    if (perms.puedeValidarAsistencias) {
      items.push({
        to: "/asistencias/validar",
        label: "Validar asistencias",
        icon: "bi bi-check2-circle",
      });
    }
  }

   
  if (perms.puedeVerHorarioEmpleado || perms.puedeVerCatalogosHorario) {
    items.push({ type: "divider", key: "div-horarios", label: "Horarios" });

    if (perms.puedeVerHorarioEmpleado) {
      items.push({
        to: "/mantenimientos/horario-empleado",
        label: "Horario de empleados",
        icon: "bi bi-calendar-week",
      });
    }

    if (perms.puedeVerCatalogosHorario) {
      items.push({
        to: "/mantenimientos/catalogos-horario",
        label: "Catálogos de horario",
        icon: "bi bi-calendar2-range",
      });
    }
  }

  if (perms.puedeCalcularPagos) {
    items.push({ type: "divider", key: "div-planilla", label: "Planilla" });
    items.push({
      to: "/planilla/calcular-salarios",
      label: "Calcular salarios",
      icon: "bi bi-cash-coin",
    });
    items.push({
      to: "/planilla/horas-extra",
      label: "Horas extra",
      icon: "bi bi-clock-history",
    });
    items.push({
      to: "/planilla/deducciones",
      label: "Deducciones",
      icon: "bi bi-file-earmark-minus",
    });
    items.push({
      to: "/planilla/adelantos",
      label: "Adelantos",
      icon: "bi bi-send-dash",
    });
    items.push({
      to: "/planilla/aguinaldo",
      label: "Aguinaldo",
      icon: "bi bi-gift",
    });
    items.push({
      to: "/planilla/incapacidades",
      label: "Incapacidades",
      icon: "bi bi-bandaid",
    });
    items.push({
      to: "/planilla/liquidacion",
      label: "Liquidación",
      icon: "bi bi-file-earmark-text",
    });
  }

  if (perms.esJefatura || perms.esAdmin) {
    items.push({ type: "divider", key: "div-gestion", label: "Gestión" });
    items.push({ to: "/permisos", label: "Permisos", icon: "bi bi-envelope-paper" });
    items.push({ to: "/vacaciones", label: "Vacaciones", icon: "bi bi-sun" });
  }

  if (perms.puedeSolicitar) {
    items.push({ type: "divider", key: "div-solic", label: "Mis solicitudes" });
    items.push({
      to: "/solicitudes/permisos",
      label: "Solicitar permiso",
      icon: "bi bi-file-earmark-medical",
    });
    items.push({
      to: "/solicitudes/vacaciones",
      label: "Solicitar vacaciones",
      icon: "bi bi-airplane",
    });
    items.push({
      to: "/solicitudes/adelantos",
      label: "Solicitar adelanto",
      icon: "bi bi-cash-stack",
    });
    items.push({ to: "/mi-info", label: "Mi información", icon: "bi bi-person-circle" });
  }

  if (perms.puedeVerConsultas || perms.puedeVerReportes) {
    items.push({ type: "divider", key: "div-cons", label: "Consultas / Reportes" });
    if (perms.puedeVerConsultas) {
      items.push({ to: "/consultas", label: "Consultas", icon: "bi bi-search" });
    }
    if (perms.puedeVerReportes) {
      items.push({ to: "/reportes", label: "Reportes", icon: "bi bi-bar-chart-line" });
    }
  }

  if (perms.puedeVerMantenimientos) {
    items.push({ type: "divider", key: "div-mant", label: "Administración" });
    items.push({
      to: "/mantenimientos",
      label: "Mantenimientos",
      icon: "bi bi-tools",
    });
  }

  return (
    <>
      <div className="d-md-none d-flex align-items-center justify-content-between px-3 py-2 border-bottom bg-white">
        <Button variant="outline-dark" onClick={() => setShowMobile(true)}>
          <i className="bi bi-list"></i> Menú
        </Button>
        <div className="text-end" style={{ minWidth: 0 }}>
          <div className="fw-semibold text-truncate">{user?.nombreUsuario || "Usuario"}</div>
          <small className="text-muted text-truncate">{perms.rolTexto || ""}</small>
        </div>
      </div>

      <aside className={`sidebar d-none d-md-flex ${collapsed ? "collapsed" : ""}`}>
        <SidebarContent
          user={user}
          perms={perms}
          items={items}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((v) => !v)}
          onLogout={onLogout}
          onNavigate={undefined}
          pathname={location.pathname}
        />
      </aside>

      <Offcanvas show={showMobile} onHide={() => setShowMobile(false)} placement="start">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Menú</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="p-0">
          <SidebarContent
            user={user}
            perms={perms}
            items={items}
            collapsed={false}
            onToggleCollapsed={() => {}}
            onLogout={onLogout}
            onNavigate={() => setShowMobile(false)}
            pathname={location.pathname}
          />
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}
