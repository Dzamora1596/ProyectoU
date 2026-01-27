// backend/src/controllers/incapacidadesController.js
const path = require("path");
const fs = require("fs");

const db = require("../config/db");
const withTransaction = require("../config/withTransaction");

let asistenciaService = null;
try {
  asistenciaService = require("./asistenciaController");
} catch (_) {
  asistenciaService = null;
}

function toNumOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getAuthContext(req) {
  const u = req.user || req.usuario || req.auth || req.sessionUser || {};

  // ✅ idUsuario (más variantes)
  const idUsuarioRaw =
    u.idUsuario ??
    u.IdUsuario ??
    u.usuarioId ??
    u.UsuarioId ??
    u.userId ??
    u.id ??
    req.idUsuario ??
    req.usuarioId ??
    null;

  // ✅ rol (más variantes: rolNombre incluido)
  const rolRaw =
    u.rolNombre ??
    u.RolNombre ??
    u.rol ??
    u.role ??
    u.Rol ??
    u.NombreRol ??
    u.nombreRol ??
    u.descripcionRol ??
    req.rol ??
    req.role ??
    req.rolNombre ??
    null;

  // ✅ empleadoId (más variantes)
  const empleadoIdRaw =
    u.Empleado_idEmpleado ??
    u.empleadoId ??
    u.idEmpleado ??
    u.EmpleadoId ??
    u.empleado?.idEmpleado ??
    u.empleado?.IdEmpleado ??
    req.empleadoId ??
    req.idEmpleado ??
    req.Empleado_idEmpleado ??
    req.EmpleadoId ??
    null;

  return {
    idUsuario: toNumOrNull(idUsuarioRaw),
    rol: String(rolRaw || "").trim(),
    empleadoId: toNumOrNull(empleadoIdRaw),
    raw: u,
  };
}

function isAdminOrJefatura(rol) {
  const r = String(rol || "").toLowerCase().trim();
  return r === "admin" || r === "jefatura";
}

function isPlanilla(rol) {
  const r = String(rol || "").toLowerCase().trim();
  return r === "personal de planilla" || r.includes("planilla");
}

function isColaborador(rol) {
  return String(rol || "").toLowerCase().trim() === "colaborador";
}

function isSelfOnlyRole(rol) {
  return isColaborador(rol) || isPlanilla(rol);
}

function canCreateOrUpload(rol) {
  return isAdminOrJefatura(rol) || isSelfOnlyRole(rol);
}

function canValidate(rol) {
  return isAdminOrJefatura(rol);
}

async function q(connOrDb, sql, params) {
  if (!connOrDb || typeof connOrDb.query !== "function") {
    throw new Error("DB no disponible o mal configurada.");
  }

  const r = connOrDb.query(sql, params);
  if (r && typeof r.then === "function") {
    const out = await r;
    return Array.isArray(out) ? out[0] : out;
  }

  return await new Promise((resolve, reject) => {
    connOrDb.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

const _colCache = new Map();
async function hasColumn(connOrDb, tableName, columnName) {
  const key = `${String(tableName || "").toLowerCase()}::${String(columnName || "").toLowerCase()}`;
  if (_colCache.has(key)) return _colCache.get(key);

  try {
    const rows = await q(
      connOrDb,
      `
      SELECT 1 AS ok
        FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = ?
         AND column_name = ?
       LIMIT 1
      `,
      [tableName, columnName]
    );
    const ok = !!(rows && rows[0] && rows[0].ok);
    _colCache.set(key, ok);
    return ok;
  } catch (_e) {
    _colCache.set(key, false);
    return false;
  }
}

function toSqlDateOnly(value) {
  const s0 = String(value || "").trim();
  if (!s0) return "";

  const dmy = s0.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    return `${yyyy}-${mm}-${dd}`;
  }

  const iso = s0.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m}-${d}`;
  }

  const t = Date.parse(s0);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return "";
}

async function getEstadoIdExact(conn, modulo, descripcion) {
  const rows = await q(
    conn,
    `SELECT idCatalogo_Estado
       FROM catalogo_estado
      WHERE UPPER(Modulo) = UPPER(?)
        AND UPPER(Descripcion) = UPPER(?)
        AND Activo = b'1'
      LIMIT 1`,
    [modulo, descripcion]
  );
  if (!rows || rows.length === 0) return null;
  return rows[0].idCatalogo_Estado;
}

async function getEstadoIdFlexible(conn, modulo, descripciones) {
  for (const d of descripciones) {
    const id = await getEstadoIdExact(conn, modulo, d);
    if (id) return id;
  }
  return null;
}

async function getPeriodoIdByFecha(conn, fecha) {
  if (!fecha) return null;

  const fechaSql = toSqlDateOnly(fecha);
  if (!fechaSql) return null;

  const rows = await q(
    conn,
    `
    SELECT idCatalogo_Periodo
      FROM catalogo_periodo
     WHERE Activo = b'1'
       AND ? BETWEEN Fecha_Inicio AND Fecha_Fin
     ORDER BY Fecha_Inicio DESC, idCatalogo_Periodo DESC
     LIMIT 1
    `,
    [fechaSql]
  );
  return rows && rows[0] ? rows[0].idCatalogo_Periodo : null;
}

async function getEmpleadoIdByUsuario(connOrDb, idUsuario) {
  const idU = toNumOrNull(idUsuario);
  if (!idU) return null;

  const queries = [
    `SELECT Empleado_idEmpleado AS idEmpleado FROM usuario WHERE idUsuario = ? LIMIT 1`,
    `SELECT idEmpleado AS idEmpleado FROM usuario WHERE idUsuario = ? LIMIT 1`,
    `SELECT Empleado_idEmpleado AS idEmpleado FROM usuarios WHERE idUsuario = ? LIMIT 1`,
    `SELECT idEmpleado AS idEmpleado FROM usuarios WHERE idUsuario = ? LIMIT 1`,
    `SELECT Empleado_idEmpleado AS idEmpleado FROM Usuario WHERE idUsuario = ? LIMIT 1`,
    `SELECT Empleado_idEmpleado AS idEmpleado FROM Usuarios WHERE idUsuario = ? LIMIT 1`,
  ];

  for (const sql of queries) {
    try {
      const rows = await q(connOrDb, sql, [idU]);
      const id = rows && rows[0] ? toNumOrNull(rows[0].idEmpleado) : null;
      if (id) return id;
    } catch (_e) {}
  }

  return null;
}

async function resolveEmpleadoForSelfOnly({ rol, empleadoId, idUsuario }) {
  if (!isSelfOnlyRole(rol)) return empleadoId || null;

  if (empleadoId) return empleadoId;

  const id = await getEmpleadoIdByUsuario(db, idUsuario);
  return id || null;
}

const ESTADOS_INCAP = {
  PENDIENTE: ["PENDIENTE_VALIDACION", "PENDIENTE", "PENDIENTE VALIDACION"],
  APROBADA: ["VALIDADA", "APROBADA", "APROBADO", "APROBADa", "VALIDADO"],
  RECHAZADA: ["RECHAZADA", "RECHAZADO"],
};

function truncObs(s) {
  const v = String(s ?? "").trim();
  if (!v) return "";
  return v.length > 250 ? v.slice(0, 250) : v;
}

function pickObsFromBody(body) {
  const b = body || {};
  return truncObs(b.Observacion ?? b.observacion ?? b.Motivo ?? b.motivo ?? "");
}

async function listarIncapacidades(req, res) {
  try {
    const { rol, empleadoId, idUsuario } = getAuthContext(req);

    if (!canCreateOrUpload(rol) && !canValidate(rol)) {
      return res.status(403).json({ message: "No autorizado." });
    }

    let empleadoFiltro = null;

    if (isSelfOnlyRole(rol)) {
      empleadoFiltro = await resolveEmpleadoForSelfOnly({ rol, empleadoId, idUsuario });
      if (!empleadoFiltro) {
        return res.status(400).json({
          message: "No se pudo determinar el empleado del usuario autenticado.",
        });
      }
    }

    let sql = `
      SELECT
        i.idIncapacidad,
        i.Empleado_idEmpleado,
        i.Tipo_Incapacidad_idTipo_Incapacidad,
        i.Catalogo_Periodo_idCatalogo_Periodo,
        i.Catalogo_Estado_idCatalogo_Estado,
        i.Descripcion,
        i.Fecha_Inicio,
        i.Fecha_Fin,
        i.Activo,
        ce.Descripcion AS Estado,
        cti.Descripcion AS TipoIncapacidad,
        p.Nombre, p.Apellido1, p.Apellido2
      FROM incapacidad i
      LEFT JOIN catalogo_estado ce
        ON ce.idCatalogo_Estado = i.Catalogo_Estado_idCatalogo_Estado
      LEFT JOIN catalogo_tipo_incapacidad cti
        ON cti.idCatalogo_Tipo_Incapacidad = i.Tipo_Incapacidad_idTipo_Incapacidad
      LEFT JOIN empleado e
        ON e.idEmpleado = i.Empleado_idEmpleado
      LEFT JOIN persona p
        ON p.idPersona = e.Persona_idPersona
      WHERE i.Activo = b'1'
    `;

    const params = [];

    if (empleadoFiltro) {
      sql += ` AND i.Empleado_idEmpleado = ? `;
      params.push(empleadoFiltro);
    }

    sql += ` ORDER BY i.idIncapacidad DESC `;

    const rows = await q(db, sql, params);
    return res.json(rows);
  } catch (err) {
    console.error("listarIncapacidades:", err);
    return res.status(500).json({ message: "Error al listar incapacidades." });
  }
}

async function obtenerIncapacidad(req, res) {
  try {
    const { rol, empleadoId, idUsuario } = getAuthContext(req);
    const id = Number(req.params.id);

    if (!canCreateOrUpload(rol) && !canValidate(rol)) {
      return res.status(403).json({ message: "No autorizado." });
    }

    if (!id) return res.status(400).json({ message: "ID inválido." });

    const baseSql = `
      SELECT
        i.*,
        ce.Descripcion AS Estado,
        cti.Descripcion AS TipoIncapacidad,
        p.Nombre, p.Apellido1, p.Apellido2
      FROM incapacidad i
      LEFT JOIN catalogo_estado ce
        ON ce.idCatalogo_Estado = i.Catalogo_Estado_idCatalogo_Estado
      LEFT JOIN catalogo_tipo_incapacidad cti
        ON cti.idCatalogo_Tipo_Incapacidad = i.Tipo_Incapacidad_idTipo_Incapacidad
      LEFT JOIN empleado e
        ON e.idEmpleado = i.Empleado_idEmpleado
      LEFT JOIN persona p
        ON p.idPersona = e.Persona_idPersona
      WHERE i.idIncapacidad = ?
        AND i.Activo = b'1'
      LIMIT 1
    `;

    const rows = await q(db, baseSql, [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Incapacidad no encontrada." });
    }

    const incapacidad = rows[0];

    if (isSelfOnlyRole(rol)) {
      const empleadoFinal = await resolveEmpleadoForSelfOnly({ rol, empleadoId, idUsuario });
      if (!empleadoFinal || Number(incapacidad.Empleado_idEmpleado) !== Number(empleadoFinal)) {
        return res.status(403).json({ message: "No autorizado." });
      }
    }

    const fileRows = await q(
      db,
      `
      SELECT
        ia.idIncapacidad_Archivo,
        ia.Nombre_Original,
        ia.Nombre_Guardado,
        ia.Ruta_Almacenamiento,
        ia.MimeType,
        ia.TamanoBytes,
        ia.Version,
        ia.EsActual,
        ia.Fecha_Subida,
        ia.Usuario_idUsuario
      FROM incapacidad_archivo ia
      WHERE ia.Incapacidad_idIncapacidad = ?
        AND ia.Activo = b'1'
        AND ia.EsActual = b'1'
      LIMIT 1
      `,
      [id]
    );

    incapacidad.ArchivoActual = fileRows && fileRows[0] ? fileRows[0] : null;

    return res.json(incapacidad);
  } catch (err) {
    console.error("obtenerIncapacidad:", err);
    return res.status(500).json({ message: "Error al obtener incapacidad." });
  }
}

async function crearIncapacidad(req, res) {
  try {
    const { rol, empleadoId, idUsuario } = getAuthContext(req);

    if (!canCreateOrUpload(rol)) {
      return res.status(403).json({ message: "No autorizado." });
    }

    const {
      Empleado_idEmpleado,
      Tipo_Incapacidad_idTipo_Incapacidad,
      Catalogo_Periodo_idCatalogo_Periodo,
      Catalogo_Estado_idCatalogo_Estado,
      Descripcion,
      Fecha_Inicio,
      Fecha_Fin,
      Activo,
    } = req.body || {};

    let empleadoFinal = Empleado_idEmpleado;

    if (isSelfOnlyRole(rol)) {
      empleadoFinal = await resolveEmpleadoForSelfOnly({ rol, empleadoId, idUsuario });
    }

    if (!empleadoFinal) return res.status(400).json({ message: "Empleado requerido." });
    if (!Tipo_Incapacidad_idTipo_Incapacidad)
      return res.status(400).json({ message: "Tipo de incapacidad requerido." });
    if (!Fecha_Inicio || !Fecha_Fin)
      return res.status(400).json({ message: "Fechas de inicio/fin requeridas." });

    const fechaInicioSql = toSqlDateOnly(Fecha_Inicio);
    const fechaFinSql = toSqlDateOnly(Fecha_Fin);

    if (!fechaInicioSql || !fechaFinSql) {
      return res.status(400).json({
        message: "Formato de Fecha_Inicio/Fecha_Fin inválido. Use dd/mm/yyyy (sin hora).",
      });
    }

    if (fechaInicioSql > fechaFinSql) {
      return res.status(400).json({ message: "Fecha_Fin no puede ser menor que Fecha_Inicio." });
    }

    let periodoFinal = Catalogo_Periodo_idCatalogo_Periodo;

    if (!periodoFinal) {
      periodoFinal = await getPeriodoIdByFecha(db, fechaInicioSql);
      if (!periodoFinal) {
        return res.status(400).json({
          message: "No se encontró un período activo que cubra la Fecha_Inicio.",
        });
      }
    }

    let estadoFinal = Catalogo_Estado_idCatalogo_Estado;

    if (!estadoFinal) {
      const pendienteId = await getEstadoIdFlexible(db, "INCAPACIDAD", ESTADOS_INCAP.PENDIENTE);
      estadoFinal = pendienteId;
    }

    if (!estadoFinal) {
      return res.status(400).json({
        message:
          "No se encontró estado PENDIENTE_VALIDACION para INCAPACIDAD en catalogo_estado, y no se envió Catalogo_Estado_idCatalogo_Estado.",
      });
    }

    const insertSql = `
      INSERT INTO incapacidad (
        Empleado_idEmpleado,
        Tipo_Incapacidad_idTipo_Incapacidad,
        Catalogo_Periodo_idCatalogo_Periodo,
        Catalogo_Estado_idCatalogo_Estado,
        Descripcion,
        Fecha_Inicio,
        Fecha_Fin,
        Activo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      empleadoFinal,
      Tipo_Incapacidad_idTipo_Incapacidad,
      periodoFinal,
      estadoFinal,
      Descripcion || "",
      fechaInicioSql,
      fechaFinSql,
      Activo === 0 || Activo === "0" ? 0 : 1,
    ];

    const result = await q(db, insertSql, params);

    if (idUsuario) {
      try {
        await q(
          db,
          `
          INSERT INTO bitacora (Tabla_Afectada, IdRegistro, Accion_Realizada, Usuario_idUsuario, Activo)
          VALUES ('incapacidad', ?, 'CREAR', ?, b'1')
          `,
          [String(result.insertId || ""), idUsuario]
        );
      } catch (_e) {}
    }

    return res.status(201).json({
      message: "Incapacidad creada.",
      idIncapacidad: result.insertId,
    });
  } catch (err) {
    console.error("crearIncapacidad:", err);
    return res.status(500).json({ message: "Error al crear incapacidad." });
  }
}

async function subirArchivoIncapacidad(req, res) {
  const id = Number(req.params.id);

  try {
    const { idUsuario, rol, empleadoId } = getAuthContext(req);

    if (!canCreateOrUpload(rol)) {
      try {
        if (req.file && req.file.path) fs.unlinkSync(req.file.path);
      } catch (_e) {}
      return res.status(403).json({ message: "No autorizado." });
    }

    if (!id) return res.status(400).json({ message: "ID inválido." });
    if (!req.file) return res.status(400).json({ message: "Debe adjuntar un archivo (campo: archivo)." });

    const incRows = await q(
      db,
      `SELECT idIncapacidad, Empleado_idEmpleado
         FROM incapacidad
        WHERE idIncapacidad = ?
          AND Activo = b'1'
        LIMIT 1`,
      [id]
    );

    if (!incRows || incRows.length === 0) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_e) {}
      return res.status(404).json({ message: "Incapacidad no encontrada." });
    }

    const incap = incRows[0];

    if (isSelfOnlyRole(rol)) {
      const empleadoFinal = await resolveEmpleadoForSelfOnly({
        rol,
        empleadoId,
        idUsuario,
      });

      if (!empleadoFinal || Number(incap.Empleado_idEmpleado) !== Number(empleadoFinal)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (_e) {}
        return res.status(403).json({ message: "No autorizado." });
      }
    }

    const relativePath = path.join("uploads", "incapacidades", req.file.filename).replace(/\\/g, "/");

    await withTransaction(async (conn) => {
      const verRows = await q(
        conn,
        `SELECT MAX(Version) AS maxVer
           FROM incapacidad_archivo
          WHERE Incapacidad_idIncapacidad = ?
            AND Activo = b'1'`,
        [id]
      );

      const nextVersion = verRows && verRows[0] && verRows[0].maxVer ? Number(verRows[0].maxVer) + 1 : 1;

      await q(
        conn,
        `
        UPDATE incapacidad_archivo
           SET EsActual = b'0'
         WHERE Incapacidad_idIncapacidad = ?
           AND EsActual = b'1'
           AND Activo = b'1'
        `,
        [id]
      );

      await q(
        conn,
        `
        INSERT INTO incapacidad_archivo (
          Incapacidad_idIncapacidad,
          Usuario_idUsuario,
          Nombre_Original,
          Nombre_Guardado,
          Ruta_Almacenamiento,
          MimeType,
          TamanoBytes,
          ChecksumSHA256,
          Version,
          EsActual,
          Activo
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, b'1', b'1')
        `,
        [
          id,
          idUsuario || 0,
          req.file.originalname || "",
          req.file.filename,
          relativePath,
          req.file.mimetype || "application/octet-stream",
          req.file.size || 0,
          nextVersion,
        ]
      );

      if (idUsuario) {
        try {
          await q(
            conn,
            `
            INSERT INTO bitacora (Tabla_Afectada, IdRegistro, Accion_Realizada, Usuario_idUsuario, Activo)
            VALUES ('incapacidad_archivo', ?, 'SUBIR_ARCHIVO', ?, b'1')
            `,
            [String(id), idUsuario]
          );
        } catch (_e) {}
      }
    });

    return res.status(201).json({
      message: "Archivo adjuntado correctamente.",
      ruta: relativePath,
      nombre: req.file.originalname,
    });
  } catch (err) {
    console.error("subirArchivoIncapacidad:", err);
    try {
      if (req.file && req.file.path) fs.unlinkSync(req.file.path);
    } catch (_e) {}
    return res.status(500).json({ message: "Error al adjuntar archivo." });
  }
}

async function aprobarIncapacidad(req, res) {
  try {
    const { idUsuario, rol } = getAuthContext(req);

    if (!canValidate(rol)) {
      return res.status(403).json({ message: "No autorizado." });
    }

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });

    const Observacion = pickObsFromBody(req.body);

    const estadoValidadaId = await getEstadoIdFlexible(db, "INCAPACIDAD", ESTADOS_INCAP.APROBADA);
    if (!estadoValidadaId) {
      return res.status(400).json({
        message: "No se encontró estado VALIDADA para INCAPACIDAD en catalogo_estado.",
      });
    }

    let incapacidadActualizada = null;

    await withTransaction(async (conn) => {
      const incRows = await q(
        conn,
        `
        SELECT
          i.idIncapacidad,
          i.Empleado_idEmpleado,
          i.Fecha_Inicio,
          i.Fecha_Fin,
          i.Catalogo_Estado_idCatalogo_Estado
        FROM incapacidad i
        WHERE i.idIncapacidad = ?
          AND i.Activo = b'1'
        LIMIT 1
        FOR UPDATE
        `,
        [id]
      );

      if (!incRows || incRows.length === 0) {
        const e = new Error("NOT_FOUND");
        e.code = "NOT_FOUND";
        throw e;
      }

      const hasObs = await hasColumn(conn, "incapacidad", "Observacion");
      const hasMotivo = await hasColumn(conn, "incapacidad", "Motivo");

      const sets = ["Catalogo_Estado_idCatalogo_Estado = ?"];
      const paramsUpd = [estadoValidadaId];

      if (Observacion && hasObs) {
        sets.push("Observacion = ?");
        paramsUpd.push(Observacion);
      }
      if (Observacion && hasMotivo) {
        sets.push("Motivo = ?");
        paramsUpd.push(Observacion);
      }

      paramsUpd.push(id);

      await q(
        conn,
        `
        UPDATE incapacidad
           SET ${sets.join(", ")}
         WHERE idIncapacidad = ?
           AND Activo = b'1'
        `,
        paramsUpd
      );

      const iniSql = toSqlDateOnly(incRows[0].Fecha_Inicio);
      const finSql = toSqlDateOnly(incRows[0].Fecha_Fin);

      if (asistenciaService && typeof asistenciaService.aplicarIncapacidadEnAsistencia === "function") {
        await asistenciaService.aplicarIncapacidadEnAsistencia(conn, {
          idIncapacidad: incRows[0].idIncapacidad,
          Empleado_idEmpleado: incRows[0].Empleado_idEmpleado,
          Fecha_Inicio: iniSql || incRows[0].Fecha_Inicio,
          Fecha_Fin: finSql || incRows[0].Fecha_Fin,
          Usuario_idUsuario: idUsuario || null,
          Observacion,
        });
      }

      if (idUsuario) {
        try {
          const accion = Observacion ? `VALIDAR: ${Observacion}` : "VALIDAR";
          await q(
            conn,
            `
            INSERT INTO bitacora (Tabla_Afectada, IdRegistro, Accion_Realizada, Usuario_idUsuario, Activo)
            VALUES ('incapacidad', ?, ?, ?, b'1')
            `,
            [String(id), accion.slice(0, 200), idUsuario]
          );
        } catch (_e) {}
      }

      const outRows = await q(
        conn,
        `
        SELECT
          i.*,
          ce.Descripcion AS Estado
        FROM incapacidad i
        LEFT JOIN catalogo_estado ce
          ON ce.idCatalogo_Estado = i.Catalogo_Estado_idCatalogo_Estado
        WHERE i.idIncapacidad = ?
          AND i.Activo = b'1'
        LIMIT 1
        `,
        [id]
      );

      incapacidadActualizada = outRows && outRows[0] ? outRows[0] : null;
    });

    if (!incapacidadActualizada) {
      return res.status(404).json({ message: "Incapacidad no encontrada." });
    }

    return res.json({ message: "Incapacidad validada.", incapacidad: incapacidadActualizada });
  } catch (err) {
    if (err && (err.code === "NOT_FOUND" || err.message === "NOT_FOUND")) {
      return res.status(404).json({ message: "Incapacidad no encontrada." });
    }
    console.error("aprobarIncapacidad:", err);
    return res.status(500).json({ message: "Error al validar incapacidad." });
  }
}

async function rechazarIncapacidad(req, res) {
  try {
    const { idUsuario, rol } = getAuthContext(req);

    if (!canValidate(rol)) {
      return res.status(403).json({ message: "No autorizado." });
    }

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });

    const Motivo = pickObsFromBody(req.body);

    const estadoRechazadaId = await getEstadoIdFlexible(db, "INCAPACIDAD", ESTADOS_INCAP.RECHAZADA);
    if (!estadoRechazadaId) {
      return res.status(400).json({
        message: "No se encontró estado RECHAZADA para INCAPACIDAD en catalogo_estado.",
      });
    }

    let incForAsistencia = null;

    await withTransaction(async (conn) => {
      const incRows = await q(
        conn,
        `
        SELECT
          i.idIncapacidad,
          i.Empleado_idEmpleado,
          i.Fecha_Inicio,
          i.Fecha_Fin
        FROM incapacidad i
        WHERE i.idIncapacidad = ?
          AND i.Activo = b'1'
        LIMIT 1
        FOR UPDATE
        `,
        [id]
      );

      if (!incRows || incRows.length === 0) {
        const e = new Error("NOT_FOUND");
        e.code = "NOT_FOUND";
        throw e;
      }

      incForAsistencia = incRows[0];

      const hasObs = await hasColumn(conn, "incapacidad", "Observacion");
      const hasMotivo = await hasColumn(conn, "incapacidad", "Motivo");

      const sets = ["Catalogo_Estado_idCatalogo_Estado = ?"];
      const paramsUpd = [estadoRechazadaId];

      if (Motivo && hasObs) {
        sets.push("Observacion = ?");
        paramsUpd.push(Motivo);
      }
      if (hasMotivo) {
        sets.push("Motivo = ?");
        paramsUpd.push(Motivo || "");
      }

      paramsUpd.push(id);

      const result = await q(
        conn,
        `
        UPDATE incapacidad
           SET ${sets.join(", ")}
         WHERE idIncapacidad = ?
           AND Activo = b'1'
        `,
        paramsUpd
      );

      if (!result || result.affectedRows === 0) {
        const e = new Error("NOT_FOUND");
        e.code = "NOT_FOUND";
        throw e;
      }

      const empleadoIdNum = Number(incForAsistencia.Empleado_idEmpleado || 0);
      const iniSql = toSqlDateOnly(incForAsistencia.Fecha_Inicio);
      const finSql = toSqlDateOnly(incForAsistencia.Fecha_Fin);

      if (empleadoIdNum && iniSql && finSql) {
        const obsPref = `RECHAZADA (Incapacidad #${id})`;
        const obsFinal = Motivo ? `${obsPref}: ${Motivo}` : obsPref;

        await q(
          conn,
          `
          UPDATE Asistencia a
             SET a.Observacion = CASE
               WHEN a.Observacion IS NULL OR TRIM(a.Observacion) = '' THEN ?
               ELSE CONCAT(
                 ?, ': ',
                 TRIM(
                   REGEXP_REPLACE(
                     TRIM(a.Observacion),
                     '^(RECHAZADA|DIA DE INCAPACIDAD|INCAPACIDAD)([^:]*):\\\\s*',
                     ''
                   )
                 )
               )
             END
           WHERE a.Activo = 1
             AND a.Empleado_idEmpleado = ?
             AND DATE(a.Fecha) BETWEEN DATE(?) AND DATE(?)
          `,
          [obsFinal, obsPref, empleadoIdNum, iniSql, finSql]
        );
      }

      if (idUsuario) {
        try {
          const accion = Motivo ? `RECHAZAR: ${Motivo}` : "RECHAZAR";
          await q(
            conn,
            `
            INSERT INTO bitacora (Tabla_Afectada, IdRegistro, Accion_Realizada, Usuario_idUsuario, Activo)
            VALUES ('incapacidad', ?, ?, ?, b'1')
            `,
            [String(id), accion.slice(0, 200), idUsuario]
          );
        } catch (_e) {}
      }
    });

    return res.json({ message: "Incapacidad rechazada." });
  } catch (err) {
    if (err && (err.code === "NOT_FOUND" || err.message === "NOT_FOUND")) {
      return res.status(404).json({ message: "Incapacidad no encontrada." });
    }
    console.error("rechazarIncapacidad:", err);
    return res.status(500).json({ message: "Error al rechazar incapacidad." });
  }
}

module.exports = {
  listarIncapacidades,
  obtenerIncapacidad,
  crearIncapacidad,
  subirArchivoIncapacidad,
  aprobarIncapacidad,
  rechazarIncapacidad,
};
