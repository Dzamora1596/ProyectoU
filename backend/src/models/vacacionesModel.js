// vacacionesModel.js
const db = require("../config/db");

function normalizeQueryResult(result) {
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0];
  if (result && Array.isArray(result.rows)) return result.rows;
  return result;
}

function bitTo01(v) {
  if (Buffer.isBuffer(v)) return v[0] ? 1 : 0;
  return Number(v) ? 1 : 0;
}

function isDateOnlyYYYYMMDD(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim());
}

function normalizeDesde(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (isDateOnlyYYYYMMDD(s)) return `${s} 00:00:00`;
  if (s.includes("T")) return s.replace("T", " ");
  return s;
}

function normalizeHasta(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (isDateOnlyYYYYMMDD(s)) return `${s} 23:59:59`;
  if (s.includes("T")) return s.replace("T", " ");
  return s;
}

function throw400(code, message, extra = null) {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = code;
  err.extra = extra;
  throw err;
}

function pad2(n) {
  const x = Number(n);
  return x < 10 ? `0${x}` : String(x);
}

function formatDMY(value, withTime = true) {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    const dd = pad2(value.getDate());
    const mm = pad2(value.getMonth() + 1);
    const yyyy = value.getFullYear();
    if (!withTime) return `${dd}/${mm}/${yyyy}`;
    const hh = pad2(value.getHours());
    const mi = pad2(value.getMinutes());
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  }

  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const [, y, mo, d, hh, mm] = m;
    if (!withTime || hh === undefined || mm === undefined) return `${d}/${mo}/${y}`;
    return `${d}/${mo}/${y} ${hh}:${mm}`;
  }

  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) return formatDMY(dt, withTime);

  return s;
}

function mapVacacionesRowDates(row) {
  if (!row || typeof row !== "object") return row;
  return {
    ...row,
    Fecha_Inicio: formatDMY(row.Fecha_Inicio, true),
    Fecha_Fin: formatDMY(row.Fecha_Fin, true),
  };
}

function mapRowsDates(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(mapVacacionesRowDates);
}

function toMySqlDateTime(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;

  if (isDateOnlyYYYYMMDD(s)) return `${s} 00:00:00`;

  if (s.includes("T")) {
    const t = s.replace("T", " ");
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(t)) return `${t}:00`;
    return t;
  }

  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(s)) return `${s}:00`;

  return s;
}

async function insertBitacora({ tabla, idRegistro, accion, usuarioId }) {
  const sql = `
    INSERT INTO bitacora
      (Tabla_Afectada, IdRegistro, Accion_Realizada, Usuario_idUsuario, Activo)
    VALUES
      (?, ?, ?, ?, b'1')
  `;
  await db.query(sql, [tabla, String(idRegistro), accion, usuarioId]);
}

async function getPeriodoIdByDate(fechaInicio) {
  const sql = `
    SELECT idCatalogo_Periodo
    FROM catalogo_periodo
    WHERE Activo = b'1'
      AND ? BETWEEN Fecha_Inicio AND Fecha_Fin
    ORDER BY idCatalogo_Periodo DESC
    LIMIT 1
  `;
  const res = await db.query(sql, [fechaInicio]);
  const rows = normalizeQueryResult(res);
  return rows?.[0]?.idCatalogo_Periodo ?? null;
}

function requireScopeEmpleadoId(scopeEmpleadoId) {
  const sid = Number(scopeEmpleadoId || 0);
  if (!sid) throw400("SCOPE_REQUIRED", "No se pudo determinar el empleado del usuario.");
  return sid;
}

/**
 * ✅ Nombre del empleado desde PERSONA (porque EMPLEADO no tiene nombre).
 * persona: Nombre, Apellido1, Apellido2
 * Devuelve "Nombre Apellido1 Apellido2" y si está vacío cae al idEmpleado.
 */
function getEmpleadoNombreExpr(empleadoAlias = "e", personaAlias = "p") {
  return `
    COALESCE(
      NULLIF(TRIM(CONCAT_WS(' ',
        NULLIF(TRIM(${personaAlias}.Nombre), ''),
        NULLIF(TRIM(${personaAlias}.Apellido1), ''),
        NULLIF(TRIM(${personaAlias}.Apellido2), '')
      )), ''),
      CAST(${empleadoAlias}.idEmpleado AS CHAR)
    )
  `;
}

async function getTraslapes({ empleadoId, fechaInicio, fechaFin, excludeIdVacaciones = null }) {
  const ini = toMySqlDateTime(fechaInicio);
  const fin = toMySqlDateTime(fechaFin);

  if (!empleadoId || !ini || !fin) return [];

  const params = [Number(empleadoId), fin, ini];

  let extra = "";
  if (excludeIdVacaciones) {
    extra = " AND v.idVacaciones <> ? ";
    params.push(Number(excludeIdVacaciones));
  }

  const empNombreExpr = getEmpleadoNombreExpr("e", "p");

  const sql = `
    SELECT
      v.idVacaciones,
      v.Empleado_idEmpleado,
      ${empNombreExpr} AS EmpleadoNombre,
      v.Catalogo_Estado_idCatalogo_Estado,
      ce.Descripcion AS EstadoDescripcion,
      v.Fecha_Inicio,
      v.Fecha_Fin,
      v.Vacaciones_Disfrutadas,
      v.Vacaciones_a_Derecho,
      v.Activo
    FROM vacaciones v
    LEFT JOIN catalogo_estado ce
      ON ce.idCatalogo_Estado = v.Catalogo_Estado_idCatalogo_Estado
    LEFT JOIN empleado e
      ON e.idEmpleado = v.Empleado_idEmpleado
    LEFT JOIN persona p
      ON p.idPersona = e.Persona_idPersona
    WHERE v.Activo = b'1'
      AND v.Empleado_idEmpleado = ?
      AND v.Fecha_Inicio <= ?
      AND v.Fecha_Fin >= ?
      ${extra}
    ORDER BY v.Fecha_Inicio ASC, v.idVacaciones ASC
  `;

  const res = await db.query(sql, params);
  const rows = normalizeQueryResult(res) || [];
  return mapRowsDates(rows);
}

async function getById(idVacaciones, opts = {}) {
  const { scopeEmpleadoId = null, requireScope = false } = opts;

  const params = [idVacaciones];
  let scopeSql = "";

  if (requireScope) {
    const sid = requireScopeEmpleadoId(scopeEmpleadoId);
    scopeSql = " AND v.Empleado_idEmpleado = ? ";
    params.push(sid);
  } else if (scopeEmpleadoId) {
    scopeSql = " AND v.Empleado_idEmpleado = ? ";
    params.push(Number(scopeEmpleadoId));
  }

  const empNombreExpr = getEmpleadoNombreExpr("e", "p");

  const sql = `
    SELECT
      v.idVacaciones,
      v.Empleado_idEmpleado,
      ${empNombreExpr} AS EmpleadoNombre,
      v.Catalogo_Periodo_idCatalogo_Periodo,
      v.Catalogo_Estado_idCatalogo_Estado,
      ce.Modulo AS EstadoModulo,
      ce.Descripcion AS EstadoDescripcion,
      v.Fecha_Inicio,
      v.Fecha_Fin,
      v.Vacaciones_Disfrutadas,
      v.Vacaciones_a_Derecho,
      v.Activo
    FROM vacaciones v
    LEFT JOIN catalogo_estado ce
      ON ce.idCatalogo_Estado = v.Catalogo_Estado_idCatalogo_Estado
    LEFT JOIN empleado e
      ON e.idEmpleado = v.Empleado_idEmpleado
    LEFT JOIN persona p
      ON p.idPersona = e.Persona_idPersona
    WHERE v.idVacaciones = ?
      ${scopeSql}
    LIMIT 1
  `;

  const res = await db.query(sql, params);
  const rows = normalizeQueryResult(res);
  const row = rows?.[0] || null;
  return mapVacacionesRowDates(row);
}

async function list(filters = {}, opts = {}) {
  const { empleadoId, estadoId, periodoId, desde, hasta, activo = 1 } = filters;
  const { scopeEmpleadoId = null, requireScope = false } = opts;

  const where = [];
  const params = [];

  if (activo !== undefined && activo !== null) {
    where.push("v.Activo = ?");
    params.push(activo ? 1 : 0);
  }

  let empleadoIdEff = null;

  if (requireScope) {
    empleadoIdEff = requireScopeEmpleadoId(scopeEmpleadoId);
  } else if (scopeEmpleadoId) {
    empleadoIdEff = Number(scopeEmpleadoId);
  } else if (empleadoId) {
    empleadoIdEff = Number(empleadoId);
  }

  if (empleadoIdEff) {
    where.push("v.Empleado_idEmpleado = ?");
    params.push(empleadoIdEff);
  }

  if (estadoId) {
    where.push("v.Catalogo_Estado_idCatalogo_Estado = ?");
    params.push(estadoId);
  }

  if (periodoId) {
    where.push("v.Catalogo_Periodo_idCatalogo_Periodo = ?");
    params.push(periodoId);
  }

  const desdeNorm = normalizeDesde(desde);
  const hastaNorm = normalizeHasta(hasta);

  if (desdeNorm) {
    where.push("v.Fecha_Inicio >= ?");
    params.push(desdeNorm);
  }

  if (hastaNorm) {
    where.push("v.Fecha_Fin <= ?");
    params.push(hastaNorm);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const empNombreExpr = getEmpleadoNombreExpr("e", "p");

  const sql = `
    SELECT
      v.idVacaciones,
      v.Empleado_idEmpleado,
      ${empNombreExpr} AS EmpleadoNombre,
      v.Catalogo_Periodo_idCatalogo_Periodo,
      v.Catalogo_Estado_idCatalogo_Estado,
      ce.Modulo AS EstadoModulo,
      ce.Descripcion AS EstadoDescripcion,
      v.Fecha_Inicio,
      v.Fecha_Fin,
      v.Vacaciones_Disfrutadas,
      v.Vacaciones_a_Derecho,
      v.Activo
    FROM vacaciones v
    LEFT JOIN catalogo_estado ce
      ON ce.idCatalogo_Estado = v.Catalogo_Estado_idCatalogo_Estado
    LEFT JOIN empleado e
      ON e.idEmpleado = v.Empleado_idEmpleado
    LEFT JOIN persona p
      ON p.idPersona = e.Persona_idPersona
    ${whereSql}
    ORDER BY v.idVacaciones DESC
  `;

  const res = await db.query(sql, params);
  const rows = normalizeQueryResult(res);
  return mapRowsDates(rows);
}

async function calcularVacacionesADerecho(empleadoId, fechaCorte = null) {
  const empId = Number(empleadoId || 0);
  if (!empId) throw400("EMPLEADO_INVALIDO", "Empleado inválido");

  const sql = `
    SELECT
      LEAST(
        12,
        GREATEST(
          0,
          TIMESTAMPDIFF(
            MONTH,
            DATE_ADD(
              e.Fecha_Ingreso,
              INTERVAL TIMESTAMPDIFF(
                YEAR,
                e.Fecha_Ingreso,
                COALESCE(DATE(?), CURDATE())
              ) YEAR
            ),
            COALESCE(DATE(?), CURDATE())
          )
        )
      ) AS Derecho
    FROM empleado e
    WHERE e.idEmpleado = ?
      AND e.Activo = b'1'
    LIMIT 1
  `;

  const res = await db.query(sql, [fechaCorte, fechaCorte, empId]);
  const rows = normalizeQueryResult(res) || [];
  const derecho = Number(rows?.[0]?.Derecho ?? 0);

  if (!Number.isFinite(derecho)) return 0;
  return derecho < 0 ? 0 : derecho;
}

async function validarCalendarioCompleto(desdeDate, hastaDate) {
  const sql = `
    SELECT COUNT(*) AS faltantes
    FROM (
      SELECT DATE(?) AS d1, DATE(?) AS d2
    ) r
    JOIN numbers n
      ON n.n BETWEEN 0 AND DATEDIFF(r.d2, r.d1)
    LEFT JOIN calendario c
      ON c.Fecha = DATE_ADD(r.d1, INTERVAL n.n DAY)
     AND c.Activo = b'1'
    WHERE c.idCalendario IS NULL
  `;
  const res = await db.query(sql, [desdeDate, hastaDate]);
  const rows = normalizeQueryResult(res) || [];
  const faltantes = Number(rows?.[0]?.faltantes ?? 0);
  if (faltantes > 0) throw400("CALENDARIO_SIN_RANGO", "No hay registros en calendario para el rango indicado");
}

async function getHorarioActualEmpleadoId(empleadoId) {
  const sql = `
    SELECT he.Catalogo_Horario_idCatalogo_Horario AS HorarioId
    FROM horario_empleado he
    WHERE he.Empleado_idEmpleado = ?
      AND he.Activo = b'1'
    ORDER BY he.Fecha_Asignacion DESC, he.idHorario_Empleado DESC
    LIMIT 1
  `;
  const res = await db.query(sql, [Number(empleadoId)]);
  const rows = normalizeQueryResult(res) || [];
  const horarioId = rows?.[0]?.HorarioId ?? null;
  if (!horarioId) throw400("HORARIO_NO_ASIGNADO", "El empleado no tiene un horario asignado");
  return Number(horarioId);
}

async function calcularDiasPorHorarioYFeriados(empleadoId, fechaInicio, fechaFin) {
  const iniDT = toMySqlDateTime(fechaInicio);
  const finDT = toMySqlDateTime(fechaFin);
  if (!iniDT || !finDT) throw400("FECHAS_INVALIDAS", "Fecha_Inicio o Fecha_Fin inválidas");

  const d1 = String(iniDT).slice(0, 10);
  const d2 = String(finDT).slice(0, 10);

  await validarCalendarioCompleto(d1, d2);

  const horarioId = await getHorarioActualEmpleadoId(empleadoId);

  const sql = `
    SELECT
      d.Fecha,
      d.DiaSemana,
      CASE WHEN hd.idCatalogo_Horario_Detalle IS NULL THEN 0 ELSE 1 END AS TieneJornada,
      CASE WHEN c.Feriado_idFeriado IS NOT NULL AND c.Feriado_idFeriado <> 0 THEN 1 ELSE 0 END AS EsFeriado,
      f.Nombre AS FeriadoNombre
    FROM (
      SELECT
        DATE_ADD(r.d1, INTERVAL n.n DAY) AS Fecha,
        DAYOFWEEK(DATE_ADD(r.d1, INTERVAL n.n DAY)) AS DiaSemana
      FROM (SELECT DATE(?) AS d1, DATE(?) AS d2) r
      JOIN numbers n
        ON n.n BETWEEN 0 AND DATEDIFF(r.d2, r.d1)
    ) d
    JOIN calendario c
      ON c.Fecha = d.Fecha
     AND c.Activo = b'1'
    LEFT JOIN feriado f
      ON f.idFeriado = c.Feriado_idFeriado
     AND f.Activo = b'1'
    LEFT JOIN catalogo_horario_detalle hd
      ON hd.Catalogo_Horario_idCatalogo_Horario = ?
     AND hd.Dia_Semana = d.DiaSemana
     AND hd.Activo = b'1'
    ORDER BY d.Fecha ASC
  `;

  const res = await db.query(sql, [d1, d2, horarioId]);
  const rows = normalizeQueryResult(res) || [];

  let totalConJornada = 0;
  let diasCobrar = 0;
  const feriadosEnRango = [];

  for (const r of rows) {
    const tieneJornada = Number(r.TieneJornada || 0) === 1;
    const esFeriado = Number(r.EsFeriado || 0) === 1;

    if (tieneJornada) totalConJornada += 1;

    if (tieneJornada && esFeriado) {
      feriadosEnRango.push({
        Fecha: String(r.Fecha),
        Nombre: r.FeriadoNombre || null,
      });
    }

    if (tieneJornada && !esFeriado) diasCobrar += 1;
  }

  const uniqueFeriados = [];
  const seen = new Set();
  for (const f of feriadosEnRango) {
    const k = `${f.Fecha}|${f.Nombre || ""}`;
    if (!seen.has(k)) {
      seen.add(k);
      uniqueFeriados.push(f);
    }
  }

  return { diasCobrar, totalConJornada, feriados: uniqueFeriados, d1, d2 };
}

/* ✅✅✅ getSaldoByEmpleadoId + EmpleadoNombre DESDE PERSONA */
async function getSaldoByEmpleadoId(empleadoId) {
  const empId = Number(empleadoId || 0);
  if (!empId) throw400("EMPLEADO_INVALIDO", "Empleado inválido");

  const empNombreExpr = getEmpleadoNombreExpr("e", "p");

  const sql = `
    SELECT
      e.idEmpleado AS Empleado_idEmpleado,
      ${empNombreExpr} AS EmpleadoNombre,

      LEAST(
        12,
        GREATEST(
          0,
          TIMESTAMPDIFF(
            MONTH,
            DATE_ADD(
              e.Fecha_Ingreso,
              INTERVAL TIMESTAMPDIFF(YEAR, e.Fecha_Ingreso, CURDATE()) YEAR
            ),
            CURDATE()
          )
        )
      ) AS Vacaciones_a_Derecho,

      GREATEST(
        0,
        TIMESTAMPDIFF(MONTH, e.Fecha_Ingreso, CURDATE())
      ) AS Vacaciones_a_Derecho_Real,

      COALESCE(op.Aprobadas_Operativas, 0) AS Vacaciones_Disfrutadas_Aprobadas,
      COALESCE(op.Pendientes, 0) AS Vacaciones_Pendientes,
      COALESCE(hist.Aprobadas_Total, 0) AS Vacaciones_Disfrutadas_Aprobadas_Total

    FROM empleado e
    LEFT JOIN persona p
      ON p.idPersona = e.Persona_idPersona

    LEFT JOIN (
      SELECT
        v.Empleado_idEmpleado,
        SUM(CASE
          WHEN UPPER(ce.Modulo) = UPPER('VACACIONES') AND UPPER(ce.Descripcion) = UPPER('APROBADO')
            THEN COALESCE(v.Vacaciones_Disfrutadas, 0)
          ELSE 0
        END) AS Aprobadas_Operativas,

        SUM(CASE
          WHEN UPPER(ce.Modulo) = UPPER('VACACIONES') AND UPPER(ce.Descripcion) = UPPER('PENDIENTE')
            THEN COALESCE(v.Vacaciones_Disfrutadas, 0)
          ELSE 0
        END) AS Pendientes

      FROM vacaciones v
      LEFT JOIN catalogo_estado ce
        ON ce.idCatalogo_Estado = v.Catalogo_Estado_idCatalogo_Estado
      WHERE v.Activo = b'1'
        AND v.Fecha_Inicio >= DATE_ADD(
          (SELECT Fecha_Ingreso FROM empleado WHERE idEmpleado = ?),
          INTERVAL TIMESTAMPDIFF(
            YEAR,
            (SELECT Fecha_Ingreso FROM empleado WHERE idEmpleado = ?),
            CURDATE()
          ) YEAR
        )
        AND v.Fecha_Inicio < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
      GROUP BY v.Empleado_idEmpleado
    ) op ON op.Empleado_idEmpleado = e.idEmpleado

    LEFT JOIN (
      SELECT
        v2.Empleado_idEmpleado,
        SUM(CASE
          WHEN UPPER(ce2.Modulo) = UPPER('VACACIONES') AND UPPER(ce2.Descripcion) = UPPER('APROBADO')
            THEN COALESCE(v2.Vacaciones_Disfrutadas, 0)
          ELSE 0
        END) AS Aprobadas_Total
      FROM vacaciones v2
      LEFT JOIN catalogo_estado ce2
        ON ce2.idCatalogo_Estado = v2.Catalogo_Estado_idCatalogo_Estado
      WHERE v2.Activo = b'1'
      GROUP BY v2.Empleado_idEmpleado
    ) hist ON hist.Empleado_idEmpleado = e.idEmpleado

    WHERE e.idEmpleado = ?
      AND e.Activo = b'1'
    LIMIT 1
  `;

  const res = await db.query(sql, [empId, empId, empId]);
  const rows = normalizeQueryResult(res) || [];
  const r = rows?.[0];

  if (!r) throw400("EMPLEADO_INVALIDO", "Empleado inválido");

  const derechoOperativo = Number(r.Vacaciones_a_Derecho || 0);
  const derechoReal = Number(r.Vacaciones_a_Derecho_Real || 0);

  const disfrutadasAprobadas = Number(r.Vacaciones_Disfrutadas_Aprobadas || 0);
  const pendientes = Number(r.Vacaciones_Pendientes || 0);

  const disfrutadasAprobadasTotal = Number(r.Vacaciones_Disfrutadas_Aprobadas_Total || 0);

  const disponiblesOperativos = derechoOperativo - disfrutadasAprobadas;
  const disponiblesTotal = derechoReal - disfrutadasAprobadasTotal;

  const payload = {
    Empleado_idEmpleado: empId,
    EmpleadoNombre: r.EmpleadoNombre ?? null,
    Vacaciones_a_Derecho: derechoOperativo < 0 ? 0 : derechoOperativo,
    Vacaciones_a_Derecho_Real: derechoReal < 0 ? 0 : derechoReal,
    Vacaciones_Disfrutadas: disfrutadasAprobadas < 0 ? 0 : disfrutadasAprobadas,
    Vacaciones_Pendientes: pendientes < 0 ? 0 : pendientes,
    Vacaciones_Disponibles: disponiblesOperativos < 0 ? 0 : disponiblesOperativos,
    Vacaciones_Disfrutadas_Total: disfrutadasAprobadasTotal < 0 ? 0 : disfrutadasAprobadasTotal,
    Vacaciones_Disponibles_Total: disponiblesTotal < 0 ? 0 : disponiblesTotal,
  };

  if ((payload.Vacaciones_Disponibles_Total || 0) > 12) {
    payload.warnings = {
      mensajeAcumulado:
        `El colaborador tiene ${payload.Vacaciones_Disponibles_Total} días de vacaciones disponibles acumulados. ` +
        `Debe programar vacaciones conforme avanzan los meses. El sistema mantiene un tope operativo anual de 12 días, ` +
        `pero los días acumulados no se eliminan.`,
      disponiblesTotal: payload.Vacaciones_Disponibles_Total,
      topeOperativoAnual: 12,
    };
  }

  return payload;
}

async function create(data, usuarioId) {
  const {
    Empleado_idEmpleado,
    Catalogo_Periodo_idCatalogo_Periodo,
    Catalogo_Estado_idCatalogo_Estado,
    Fecha_Inicio,
    Fecha_Fin,
    Vacaciones_Disfrutadas,
    Activo = 1,
  } = data;

  const warningsTraslape = await getTraslapes({
    empleadoId: Empleado_idEmpleado,
    fechaInicio: Fecha_Inicio,
    fechaFin: Fecha_Fin,
  });

  const fechaCorte = Fecha_Inicio ? String(toMySqlDateTime(Fecha_Inicio)).slice(0, 10) : null;
  const derechoAuto = await calcularVacacionesADerecho(Number(Empleado_idEmpleado), fechaCorte);

  const sql = `
    INSERT INTO vacaciones
      (Empleado_idEmpleado, Catalogo_Periodo_idCatalogo_Periodo, Catalogo_Estado_idCatalogo_Estado,
       Fecha_Inicio, Fecha_Fin, Vacaciones_Disfrutadas, Vacaciones_a_Derecho, Activo)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const res = await db.query(sql, [
    Empleado_idEmpleado,
    Catalogo_Periodo_idCatalogo_Periodo,
    Catalogo_Estado_idCatalogo_Estado,
    Fecha_Inicio,
    Fecha_Fin,
    Vacaciones_Disfrutadas,
    derechoAuto,
    Activo ? 1 : 0,
  ]);

  const insertId = res?.insertId ?? (Array.isArray(res) ? res[0]?.insertId : null);

  if (insertId) {
    await insertBitacora({
      tabla: "vacaciones",
      idRegistro: insertId,
      accion: "CREAR",
      usuarioId,
    });
  }

  return { insertId, warnings: { traslapes: warningsTraslape } };
}

async function update(idVacaciones, data, usuarioId, opts = {}) {
  const { scopeEmpleadoId = null, requireScope = false } = opts;

  const actual = await getById(idVacaciones, { scopeEmpleadoId, requireScope });
  if (!actual) return { affectedRows: 0, warnings: { traslapes: [] } };

  const { Fecha_Inicio, Fecha_Fin, Vacaciones_Disfrutadas, Catalogo_Estado_idCatalogo_Estado } = data;

  const warningsTraslape = await getTraslapes({
    empleadoId: actual.Empleado_idEmpleado,
    fechaInicio: Fecha_Inicio ?? actual.Fecha_Inicio,
    fechaFin: Fecha_Fin ?? actual.Fecha_Fin,
    excludeIdVacaciones: idVacaciones,
  });

  const sets = [];
  const params = [];

  const fechaInicioEff = Fecha_Inicio ?? actual.Fecha_Inicio;

  if (Fecha_Inicio !== undefined) {
    sets.push("Fecha_Inicio = ?");
    params.push(Fecha_Inicio);
  }
  if (Fecha_Fin !== undefined) {
    sets.push("Fecha_Fin = ?");
    params.push(Fecha_Fin);
  }
  if (Vacaciones_Disfrutadas !== undefined) {
    sets.push("Vacaciones_Disfrutadas = ?");
    params.push(Vacaciones_Disfrutadas);
  }
  if (Catalogo_Estado_idCatalogo_Estado !== undefined) {
    sets.push("Catalogo_Estado_idCatalogo_Estado = ?");
    params.push(Catalogo_Estado_idCatalogo_Estado);
  }

  const fechaCorte = fechaInicioEff ? String(toMySqlDateTime(fechaInicioEff)).slice(0, 10) : null;
  const derechoAuto = await calcularVacacionesADerecho(Number(actual.Empleado_idEmpleado), fechaCorte);
  sets.push("Vacaciones_a_Derecho = ?");
  params.push(derechoAuto);

  if (!sets.length) return { affectedRows: 0, warnings: { traslapes: warningsTraslape } };

  const sql = `
    UPDATE vacaciones
    SET ${sets.join(", ")}
    WHERE idVacaciones = ?
      AND Activo = b'1'
  `;

  params.push(idVacaciones);

  const res = await db.query(sql, params);
  const affectedRows = res?.affectedRows ?? (Array.isArray(res) ? res[0]?.affectedRows : 0);

  if (affectedRows > 0) {
    await insertBitacora({
      tabla: "vacaciones",
      idRegistro: idVacaciones,
      accion: "ACTUALIZAR",
      usuarioId,
    });
  }

  return { affectedRows, warnings: { traslapes: warningsTraslape } };
}

async function updateEstado(idVacaciones, estadoId, usuarioId, accionBitacora, opts = {}) {
  const { scopeEmpleadoId = null, requireScope = false } = opts;

  if (requireScope) {
    const sid = requireScopeEmpleadoId(scopeEmpleadoId);

    const sqlScoped = `
      UPDATE vacaciones
      SET Catalogo_Estado_idCatalogo_Estado = ?
      WHERE idVacaciones = ?
        AND Empleado_idEmpleado = ?
        AND Activo = b'1'
    `;
    const res = await db.query(sqlScoped, [estadoId, idVacaciones, sid]);
    const affectedRows = res?.affectedRows ?? (Array.isArray(res) ? res[0]?.affectedRows : 0);

    if (affectedRows > 0) {
      await insertBitacora({
        tabla: "vacaciones",
        idRegistro: idVacaciones,
        accion: accionBitacora || "CAMBIAR_ESTADO",
        usuarioId,
      });
    }

    return affectedRows;
  }

  const sql = `
    UPDATE vacaciones
    SET Catalogo_Estado_idCatalogo_Estado = ?
    WHERE idVacaciones = ?
      AND Activo = b'1'
  `;

  const res = await db.query(sql, [estadoId, idVacaciones]);
  const affectedRows = res?.affectedRows ?? (Array.isArray(res) ? res[0]?.affectedRows : 0);

  if (affectedRows > 0) {
    await insertBitacora({
      tabla: "vacaciones",
      idRegistro: idVacaciones,
      accion: accionBitacora || "CAMBIAR_ESTADO",
      usuarioId,
    });
  }

  return affectedRows;
}

async function softDelete(idVacaciones, usuarioId, opts = {}) {
  const { scopeEmpleadoId = null, requireScope = false } = opts;

  if (requireScope) {
    const sid = requireScopeEmpleadoId(scopeEmpleadoId);

    const sqlScoped = `
      UPDATE vacaciones
      SET Activo = b'0'
      WHERE idVacaciones = ?
        AND Empleado_idEmpleado = ?
        AND Activo = b'1'
    `;
    const res = await db.query(sqlScoped, [idVacaciones, sid]);
    const affectedRows = res?.affectedRows ?? (Array.isArray(res) ? res[0]?.affectedRows : 0);

    if (affectedRows > 0) {
      await insertBitacora({
        tabla: "vacaciones",
        idRegistro: idVacaciones,
        accion: "DESACTIVAR",
        usuarioId,
      });
    }

    return affectedRows;
  }

  const sql = `
    UPDATE vacaciones
    SET Activo = b'0'
    WHERE idVacaciones = ?
      AND Activo = b'1'
  `;

  const res = await db.query(sql, [idVacaciones]);
  const affectedRows = res?.affectedRows ?? (Array.isArray(res) ? res[0]?.affectedRows : 0);

  if (affectedRows > 0) {
    await insertBitacora({
      tabla: "vacaciones",
      idRegistro: idVacaciones,
      accion: "DESACTIVAR",
      usuarioId,
    });
  }

  return affectedRows;
}

module.exports = {
  getPeriodoIdByDate,
  getTraslapes,
  getById,
  list,
  getSaldoByEmpleadoId,
  calcularVacacionesADerecho,
  calcularDiasPorHorarioYFeriados,
  create,
  update,
  updateEstado,
  softDelete,
};
