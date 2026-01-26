// backend/src/controllers/incapacidadesController.js
const path = require("path");
const fs = require("fs");

const db = require("../config/db");
const withTransaction = require("../config/withTransaction");

/**
 * Intenta obtener el contexto de autenticación sin asumir un nombre exacto.
 * Ajusta a tu middleware sin romper.
 */
function getAuthContext(req) {
  const u = req.user || req.usuario || req.auth || req.sessionUser || {};

  const idUsuario = u.idUsuario ?? u.usuarioId ?? u.id ?? req.idUsuario ?? null;

  const rol =
    u.rol ??
    u.role ??
    u.NombreRol ??
    u.descripcionRol ??
    req.rol ??
    null;

  const empleadoId =
    u.Empleado_idEmpleado ??
    u.empleadoId ??
    u.idEmpleado ??
    req.idEmpleado ??
    null;

  return { idUsuario, rol, empleadoId, raw: u };
}

function isAdminOrJefatura(rol) {
  const r = String(rol || "").toLowerCase();
  return r === "admin" || r === "jefatura";
}

function isPlanilla(rol) {
  return String(rol || "").toLowerCase().includes("planilla");
}

function isColaborador(rol) {
  return String(rol || "").toLowerCase() === "colaborador";
}

/**
 * Helpers DB: soporta mysql2/promise o callbacks (promisify básico)
 */
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

/**
 * Busca idCatalogo_Estado por (Modulo, Descripcion) exacto.
 */
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

/**
 * Busca idCatalogo_Estado probando múltiples descripciones (en orden).
 */
async function getEstadoIdFlexible(conn, modulo, descripciones) {
  for (const d of descripciones) {
    const id = await getEstadoIdExact(conn, modulo, d);
    if (id) return id;
  }
  return null;
}

// Tus descripciones reales (y variantes por si cambian)
const ESTADOS_INCAP = {
  PENDIENTE: ["PENDIENTE_VALIDACION", "PENDIENTE", "PENDIENTE VALIDACION"],
  APROBADA: ["VALIDADA", "APROBADA", "APROBADO", "APROBADa", "VALIDADO"],
  RECHAZADA: ["RECHAZADA", "RECHAZADO"],
};

/**
 * LISTAR
 * - Admin/Jefatura/Planilla: ven todas
 * - Colaborador: ve solo las suyas (por su empleadoId)
 */
async function listarIncapacidades(req, res) {
  try {
    const { rol, empleadoId } = getAuthContext(req);

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

    if (isColaborador(rol)) {
      if (!empleadoId) {
        return res.status(400).json({
          message: "No se pudo determinar el empleado del colaborador autenticado.",
        });
      }
      sql += ` AND i.Empleado_idEmpleado = ? `;
      params.push(empleadoId);
    }

    sql += ` ORDER BY i.idIncapacidad DESC `;

    const rows = await q(db, sql, params);
    return res.json(rows);
  } catch (err) {
    console.error("listarIncapacidades:", err);
    return res.status(500).json({ message: "Error al listar incapacidades." });
  }
}

/**
 * OBTENER DETALLE
 * - Admin/Jefatura/Planilla: cualquiera
 * - Colaborador: solo la suya
 * Incluye archivo "actual" (si existe)
 */
async function obtenerIncapacidad(req, res) {
  try {
    const { rol, empleadoId } = getAuthContext(req);
    const id = Number(req.params.id);

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

    if (isColaborador(rol)) {
      if (!empleadoId || Number(incapacidad.Empleado_idEmpleado) !== Number(empleadoId)) {
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

/**
 * CREAR INCAPACIDAD
 * - Todos pueden crear
 * - Colaborador: se fuerza a su empleadoId (ignora el Empleado_idEmpleado del body)
 * Estado por defecto: PENDIENTE_VALIDACION (según tu catálogo)
 */
async function crearIncapacidad(req, res) {
  try {
    const { rol, empleadoId, idUsuario } = getAuthContext(req);

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

    const empleadoFinal = isColaborador(rol) ? empleadoId : Empleado_idEmpleado;

    if (!empleadoFinal) return res.status(400).json({ message: "Empleado requerido." });
    if (!Tipo_Incapacidad_idTipo_Incapacidad)
      return res.status(400).json({ message: "Tipo de incapacidad requerido." });
    if (!Catalogo_Periodo_idCatalogo_Periodo)
      return res.status(400).json({ message: "Período requerido." });
    if (!Fecha_Inicio || !Fecha_Fin)
      return res.status(400).json({ message: "Fechas de inicio/fin requeridas." });

    // Si envían estado explícito lo respeta; si no, usa PENDIENTE_VALIDACION (11)
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
      Catalogo_Periodo_idCatalogo_Periodo,
      estadoFinal,
      Descripcion || "",
      Fecha_Inicio,
      Fecha_Fin,
      Activo === 0 || Activo === "0" ? 0 : 1,
    ];

    const result = await q(db, insertSql, params);

    // Bitácora
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

/**
 * SUBIR ARCHIVO Y REGISTRAR EN incapacidad_archivo (Opción B)
 * - Versiona: incrementa Version
 * - Deja solo 1 EsActual=1
 */
async function subirArchivoIncapacidad(req, res) {
  const id = Number(req.params.id);

  try {
    const { idUsuario, rol, empleadoId } = getAuthContext(req);

    if (!id) return res.status(400).json({ message: "ID inválido." });
    if (!req.file) return res.status(400).json({ message: "Debe adjuntar un archivo (campo: archivo)." });

    // Validar acceso si es Colaborador
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
      try { fs.unlinkSync(req.file.path); } catch (_e) {}
      return res.status(404).json({ message: "Incapacidad no encontrada." });
    }

    const incap = incRows[0];

    if (isColaborador(rol)) {
      if (!empleadoId || Number(incap.Empleado_idEmpleado) !== Number(empleadoId)) {
        try { fs.unlinkSync(req.file.path); } catch (_e) {}
        return res.status(403).json({ message: "No autorizado." });
      }
    }

    const relativePath = path
      .join("uploads", "incapacidades", req.file.filename)
      .replace(/\\/g, "/");

    await withTransaction(async (conn) => {
      const verRows = await q(
        conn,
        `SELECT MAX(Version) AS maxVer
           FROM incapacidad_archivo
          WHERE Incapacidad_idIncapacidad = ?
            AND Activo = b'1'`,
        [id]
      );

      const nextVersion =
        verRows && verRows[0] && verRows[0].maxVer ? Number(verRows[0].maxVer) + 1 : 1;

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
    try { if (req.file && req.file.path) fs.unlinkSync(req.file.path); } catch (_e) {}
    return res.status(500).json({ message: "Error al adjuntar archivo." });
  }
}

/**
 * APROBAR (VALIDAR)
 * Solo Admin/Jefatura (la ruta ya restringe)
 * Cambia Catalogo_Estado a VALIDADA (12)
 */
async function aprobarIncapacidad(req, res) {
  try {
    const { idUsuario } = getAuthContext(req);
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "ID inválido." });

    const estadoValidadaId = await getEstadoIdFlexible(db, "INCAPACIDAD", ESTADOS_INCAP.APROBADA);
    if (!estadoValidadaId) {
      return res.status(400).json({
        message: "No se encontró estado VALIDADA para INCAPACIDAD en catalogo_estado.",
      });
    }

    const result = await q(
      db,
      `
      UPDATE incapacidad
         SET Catalogo_Estado_idCatalogo_Estado = ?
       WHERE idIncapacidad = ?
         AND Activo = b'1'
      `,
      [estadoValidadaId, id]
    );

    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ message: "Incapacidad no encontrada." });
    }

    if (idUsuario) {
      try {
        await q(
          db,
          `
          INSERT INTO bitacora (Tabla_Afectada, IdRegistro, Accion_Realizada, Usuario_idUsuario, Activo)
          VALUES ('incapacidad', ?, 'VALIDAR', ?, b'1')
          `,
          [String(id), idUsuario]
        );
      } catch (_e) {}
    }

    return res.json({ message: "Incapacidad validada." });
  } catch (err) {
    console.error("aprobarIncapacidad:", err);
    return res.status(500).json({ message: "Error al validar incapacidad." });
  }
}

/**
 * RECHAZAR
 * Solo Admin/Jefatura (la ruta ya restringe)
 * Cambia Catalogo_Estado a RECHAZADA (13)
 * (Motivo puede venir en body.Motivo)
 */
async function rechazarIncapacidad(req, res) {
  try {
    const { idUsuario } = getAuthContext(req);
    const id = Number(req.params.id);
    const { Motivo } = req.body || {};

    if (!id) return res.status(400).json({ message: "ID inválido." });

    const estadoRechazadaId = await getEstadoIdFlexible(db, "INCAPACIDAD", ESTADOS_INCAP.RECHAZADA);
    if (!estadoRechazadaId) {
      return res.status(400).json({
        message: "No se encontró estado RECHAZADA para INCAPACIDAD en catalogo_estado.",
      });
    }

    const result = await q(
      db,
      `
      UPDATE incapacidad
         SET Catalogo_Estado_idCatalogo_Estado = ?
       WHERE idIncapacidad = ?
         AND Activo = b'1'
      `,
      [estadoRechazadaId, id]
    );

    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ message: "Incapacidad no encontrada." });
    }

    if (idUsuario) {
      const accion = Motivo ? `RECHAZAR: ${String(Motivo).slice(0, 200)}` : "RECHAZAR";
      try {
        await q(
          db,
          `
          INSERT INTO bitacora (Tabla_Afectada, IdRegistro, Accion_Realizada, Usuario_idUsuario, Activo)
          VALUES ('incapacidad', ?, ?, ?, b'1')
          `,
          [String(id), accion, idUsuario]
        );
      } catch (_e) {}
    }

    return res.json({ message: "Incapacidad rechazada." });
  } catch (err) {
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
