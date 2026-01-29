import { NavLink, useLocation } from "react-router-dom";
import { useMemo, useState } from "react";
import { Button, Offcanvas } from "react-bootstrap";
import { setAuth as setAuthAsistencias } from "../services/asistenciaService";

function normalizarRol(user) {
  return String(user?.rolNombre || user?.rol || user?.nombreRol || "")
    .toLowerCase()
    .trim();
}

function puedeAcceder(user) {
  const rol = normalizarRol(user);
  const esAdmin = rol === "admin";
  const esJefatura = rol === "jefatura";
  const esPlanilla = rol.includes("planilla");
  const esColaborador = rol === "colaborador";

  const puedeVerIncapacidades = esAdmin || esJefatura || esPlanilla || esColaborador;

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
    puedeCalcularPagos: esAdmin || esJefatura || esPlanilla,
    puedeVerMantenimientos: esAdmin,
    puedeVerConsultas: esAdmin || esJefatura || esPlanilla,
    puedeVerReportes: esAdmin || esJefatura || esPlanilla,
    puedeSolicitar: esColaborador || esPlanilla,
    puedeVerSoloMiInfo: esColaborador || esPlanilla,
    puedeVerHorarioEmpleado: esAdmin || esJefatura || esPlanilla,
    puedeVerCatalogosHorario: esAdmin || esJefatura,
    puedeSolicitarVacaciones: esColaborador || esPlanilla,
    puedeVerVacaciones: esAdmin || esJefatura || esPlanilla || esColaborador,
    puedeVerRoles: esAdmin,
    puedeVerIncapacidades,
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
  allowCollapse,
}) {
  const headerPx = collapsed ? "px-2" : "px-3";
  const navMx = collapsed ? "mx-1" : "mx-2";
  const navPx = collapsed ? "px-0" : "px-3";
  const navJustify = collapsed ? "justify-content-center" : "";
  const navGap = collapsed ? "" : "gap-3";

  return (
    <div className="d-flex flex-column h-100 bg-white">
      <div className={`d-flex align-items-center justify-content-between ${headerPx} py-3 border-bottom`}>
        <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
          <div
            className="bg-dark text-white rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
            style={{ width: 36, height: 36 }}
          >
            {user?.nombreUsuario?.charAt(0).toUpperCase() || "U"}
          </div>

          {!collapsed && (
            <div className="d-flex flex-column" style={{ minWidth: 0 }}>
              <div className="fw-bold text-truncate" style={{ fontSize: "0.9rem" }}>
                {user?.nombreUsuario || "Usuario"}
              </div>
              <div
                className="text-muted text-uppercase fw-bold text-truncate"
                style={{ fontSize: "0.65rem", letterSpacing: "0.10em" }}
              >
                {perms.rolTexto || ""}
              </div>
            </div>
          )}
        </div>

        {allowCollapse && (
          <button
            type="button"
            className="btn btn-sm btn-outline-danger dm-btn-outline-red d-none d-md-inline-flex align-items-center justify-content-center"
            onClick={onToggleCollapsed}
            style={{ width: 36, height: 36, borderRadius: 999 }}
            aria-label="Contraer/Expandir"
          >
            <i className={collapsed ? "bi bi-chevron-right" : "bi bi-chevron-left"}></i>
          </button>
        )}
      </div>

      <div className="flex-grow-1 py-2 overflow-auto">
        {items.map((it, idx) => {
          if (it.type === "divider") {
            return (
              <div key={it.key || idx} className={collapsed ? "px-2 py-2" : "pt-4 pb-2 px-3"}>
                {collapsed ? (
                  <div style={{ height: 1, background: "rgba(11, 11, 12, 0.10)" }} />
                ) : (
                  <div
                    className="text-uppercase fw-bold"
                    style={{ letterSpacing: "0.12em", fontSize: "0.65rem", color: "rgba(11, 11, 12, 0.45)" }}
                  >
                    {it.label}
                  </div>
                )}
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
                  navJustify,
                  navGap,
                  navPx,
                  navMx,
                  "py-2 mb-1",
                  isActive ? "active" : "",
                ].join(" ")
              }
              title={collapsed ? it.label : undefined}
            >
              <span className="d-inline-flex align-items-center justify-content-center" style={{ width: 26 }}>
                <i className={it.icon}></i>
              </span>
              {!collapsed && <span style={{ fontSize: "0.92rem" }}>{it.label}</span>}
            </NavLink>
          );
        })}
      </div>

      <div className={`border-top bg-body-tertiary ${collapsed ? "p-2" : "p-3"}`}>
        <Button
          variant="outline-dark"
          className="w-100 d-flex align-items-center justify-content-center gap-2 fw-bold"
          onClick={onLogout}
        >
          <i className="bi bi-box-arrow-left"></i>
          {!collapsed && <span>Cerrar sesión</span>}
        </Button>

        {!collapsed && pathname && (
          <div className="text-center mt-2">
            <small className="text-muted fw-bold" style={{ fontSize: "0.6rem", letterSpacing: "0.08em" }}>
              RUTA: <span className="text-marenco-red">{pathname.toUpperCase()}</span>
            </small>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Menu({ user, onLogout, collapsed: collapsedProp, onToggleCollapsed: onToggleCollapsedProp }) {
  const perms = useMemo(() => puedeAcceder(user), [user]);

  const [collapsedInternal, setCollapsedInternal] = useState(false);
  const collapsed = typeof collapsedProp === "boolean" ? collapsedProp : collapsedInternal;

  const toggleCollapsed =
    typeof onToggleCollapsedProp === "function"
      ? onToggleCollapsedProp
      : () => setCollapsedInternal((v) => !v);

  const [showMobile, setShowMobile] = useState(false);
  const location = useLocation();

  const handleLogout = () => {
    setAuthAsistencias(null);
    if (typeof onLogout === "function") onLogout();
  };

  const items = [];
  items.push({ to: "/inicio", label: "Inicio", icon: "bi bi-house-door" });

  if (perms.puedeRegistrarPersonal) {
    items.push({ to: "/registro-personal", label: "Registro personal", icon: "bi bi-person-badge" });
  }

  if (perms.puedeRegistrarUsuarios) {
    items.push({ to: "/usuarios", label: "Usuarios", icon: "bi bi-shield-lock" });
  }

  if (perms.puedeVerRoles) {
    items.push({ to: "/roles", label: "Roles", icon: "bi bi-person-gear" });
  }

  if (perms.puedeRegistrarAsistencias || perms.puedeValidarAsistencias) {
    items.push({ type: "divider", key: "div-asist", label: "Asistencias" });
    if (perms.puedeValidarAsistencias) {
      items.push({ to: "/asistencias/validar", label: "Validar asistencias", icon: "bi bi-check2-circle" });
    }
  }

  if (perms.puedeVerHorarioEmpleado || perms.puedeVerCatalogosHorario) {
    items.push({ type: "divider", key: "div-horarios", label: "Horarios" });
    if (perms.puedeVerHorarioEmpleado) {
      items.push({ to: "/mantenimientos/horario-empleado", label: "Horario empleados", icon: "bi bi-calendar-week" });
    }
    if (perms.puedeVerCatalogosHorario) {
      items.push({ to: "/mantenimientos/catalogos-horario", label: "Catálogos horario", icon: "bi bi-calendar2-range" });
    }
  }

  if (perms.puedeCalcularPagos) {
    items.push({ type: "divider", key: "div-planilla", label: "Planilla" });
    items.push({ to: "/planilla/calcular-salarios", label: "Calcular salarios", icon: "bi bi-cash-coin" });
    items.push({ to: "/planilla/horas-extra", label: "Horas extra", icon: "bi bi-clock-history" });
    items.push({ to: "/planilla/deducciones", label: "Deducciones", icon: "bi bi-file-earmark-minus" });
    items.push({ to: "/planilla/adelantos", label: "Adelantos", icon: "bi bi-send-dash" });
    items.push({ to: "/planilla/aguinaldo", label: "Aguinaldo", icon: "bi bi-gift" });
    items.push({ to: "/planilla/incapacidades", label: "Incapacidades", icon: "bi bi-bandaid" });
    items.push({ to: "/planilla/liquidacion", label: "Liquidación", icon: "bi bi-file-earmark-text" });
  } else if (perms.puedeVerIncapacidades) {
    items.push({ type: "divider", key: "div-planilla", label: "Planilla" });
    items.push({ to: "/planilla/incapacidades", label: "Incapacidades", icon: "bi bi-bandaid" });
  }

  if (perms.esJefatura || perms.esAdmin) {
    items.push({ type: "divider", key: "div-gestion", label: "Gestión" });
    items.push({ to: "/permisos", label: "Permisos", icon: "bi bi-envelope-paper" });
  }

  if (perms.puedeVerVacaciones) {
    if (!(perms.esJefatura || perms.esAdmin)) {
      items.push({ type: "divider", key: "div-gestion-vac", label: "Gestión" });
    }
    items.push({ to: "/vacaciones", label: "Vacaciones", icon: "bi bi-sun" });
  }

  if (perms.puedeSolicitar) {
    items.push({ type: "divider", key: "div-solic", label: "Mis solicitudes" });
    items.push({ to: "/solicitudes/permisos", label: "Solicitar permiso", icon: "bi bi-file-earmark-medical" });
    items.push({ to: "/solicitudes/vacaciones", label: "Solicitar vacaciones", icon: "bi bi-airplane" });
    items.push({ to: "/solicitudes/adelantos", label: "Solicitar adelanto", icon: "bi bi-cash-stack" });
    items.push({ to: "/mi-info", label: "Mi información", icon: "bi bi-person-circle" });
  }

  if (perms.puedeVerConsultas || perms.puedeVerReportes) {
    items.push({ type: "divider", key: "div-cons", label: "Consultas / Reportes" });
    if (perms.puedeVerConsultas) items.push({ to: "/consultas", label: "Consultas", icon: "bi bi-search" });
    if (perms.puedeVerReportes) items.push({ to: "/reportes", label: "Reportes", icon: "bi bi-bar-chart-line" });
  }

  if (perms.puedeVerMantenimientos) {
    items.push({ type: "divider", key: "div-mant", label: "Administración" });
    items.push({ to: "/mantenimientos", label: "Mantenimientos", icon: "bi bi-tools" });
  }

  return (
    <>
      <div className="d-md-none d-flex align-items-center justify-content-between px-3 py-2 border-bottom bg-white">
        <Button
          variant="outline-dark"
          className="d-inline-flex align-items-center gap-2"
          onClick={() => setShowMobile(true)}
        >
          <i className="bi bi-list"></i> Menú
        </Button>

        <div className="text-end" style={{ minWidth: 0 }}>
          <div className="fw-semibold text-truncate">{user?.nombreUsuario || "Usuario"}</div>
          <small className="text-muted text-truncate">{perms.rolTexto || ""}</small>
        </div>
      </div>

      <div className="d-none d-md-flex flex-column h-100">
        <SidebarContent
          user={user}
          perms={perms}
          items={items}
          collapsed={collapsed}
          allowCollapse
          onToggleCollapsed={toggleCollapsed}
          onLogout={handleLogout}
          pathname={location.pathname}
        />
      </div>

      <Offcanvas show={showMobile} onHide={() => setShowMobile(false)} placement="start" style={{ width: 280 }}>
        <Offcanvas.Header closeButton className="border-bottom">
          <Offcanvas.Title className="fw-bold">Menú Marenco</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="p-0">
          <SidebarContent
            user={user}
            perms={perms}
            items={items}
            collapsed={false}
            allowCollapse={false}
            onLogout={handleLogout}
            onNavigate={() => setShowMobile(false)}
            pathname={location.pathname}
          />
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}
