// models/horarioLaboralModel.js
const db = require("../config/db");

function mapBit01(v) {
  if (Buffer.isBuffer(v)) return v[0] ? 1 : 0;
  return Number(v) ? 1 : 0;
}

const horarioLaboralModel = {

  async listarHorarios() {
    const [rows] = await db.query(
      `SELECT 
        idHorario_Laboral AS idHorarioLaboral,
        Descripcion,
        Entrada,
        Salida,
        Activo
       FROM Horario_Laboral
       ORDER BY idHorario_Laboral ASC`
    );
    return rows;
  },

  async existeHorario(idHorarioLaboral) {
    const [rows] = await db.query(
      `SELECT idHorario_Laboral
       FROM Horario_Laboral
       WHERE idHorario_Laboral = ?
       LIMIT 1`,
      [Number(idHorarioLaboral)]
    );
    return rows.length > 0;
  },

  async crearHorario({ descripcion, entrada, salida, activo }) {
    const [r] = await db.query(
      `
      INSERT INTO Horario_Laboral (Descripcion, Entrada, Salida, Activo)
      VALUES (?, ?, ?, ?)
      `,
      [descripcion, entrada, salida, activo]
    );
    return { insertId: r.insertId };
  },

  async actualizarHorario(idHorarioLaboral, fields) {
    const sets = [];
    const params = [];

    if (fields.descripcion !== undefined) {
      sets.push("Descripcion = ?");
      params.push(fields.descripcion);
    }
    if (fields.entrada !== undefined) {
      sets.push("Entrada = ?");
      params.push(fields.entrada);
    }
    if (fields.salida !== undefined) {
      sets.push("Salida = ?");
      params.push(fields.salida);
    }
    if (fields.activo !== undefined) {
      sets.push("Activo = ?");
      params.push(fields.activo);
    }

    if (!sets.length) return { affectedRows: 0 };

    params.push(Number(idHorarioLaboral));

    const [r] = await db.query(
      `
      UPDATE Horario_Laboral
      SET ${sets.join(", ")}
      WHERE idHorario_Laboral = ?
      `,
      params
    );
    return { affectedRows: r.affectedRows };
  },

  async desactivarHorario(idHorarioLaboral) {
    const [r] = await db.query(
      `UPDATE Horario_Laboral SET Activo = 0 WHERE idHorario_Laboral = ?`,
      [Number(idHorarioLaboral)]
    );
    return { affectedRows: r.affectedRows };
  },

  

  async listarCatalogosHorario() {
    const [rows] = await db.query(`
      SELECT
        ch.idCatalogo_Horario AS idCatalogoHorario,
        ch.Descripcion AS descripcion,
        ch.Catalogo_Tipo_Horario_idCatalogo_Tipo_Horario AS tipoHorarioId,
        cth.Descripcion AS tipoHorarioDescripcion,
        ch.Activo AS activo,
        COUNT(DISTINCT chd.idCatalogo_Horario_Detalle) AS diasConfigurados
      FROM catalogo_horario ch
      LEFT JOIN catalogo_tipo_horario cth
        ON cth.idCatalogo_Tipo_Horario = ch.Catalogo_Tipo_Horario_idCatalogo_Tipo_Horario
      LEFT JOIN catalogo_horario_detalle chd
        ON chd.Catalogo_Horario_idCatalogo_Horario = ch.idCatalogo_Horario
       AND chd.Activo = 1
      WHERE ch.Activo = 1
      GROUP BY
        ch.idCatalogo_Horario,
        ch.Descripcion,
        ch.Catalogo_Tipo_Horario_idCatalogo_Tipo_Horario,
        cth.Descripcion,
        ch.Activo
      ORDER BY
        COALESCE(cth.Descripcion, '') ASC,
        ch.Descripcion ASC
    `);
    return rows;
  },

  async existeTipoHorarioActivo(idCatalogoTipoHorario) {
    const [rows] = await db.query(
      `
      SELECT idCatalogo_Tipo_Horario
      FROM catalogo_tipo_horario
      WHERE idCatalogo_Tipo_Horario = ?
        AND Activo = 1
      LIMIT 1
      `,
      [Number(idCatalogoTipoHorario)]
    );
    return rows.length > 0;
  },

  async crearCatalogoHorario({ tipoHorarioId, descripcion, activo }) {
    const [r] = await db.query(
      `
      INSERT INTO catalogo_horario
        (Catalogo_Tipo_Horario_idCatalogo_Tipo_Horario, Descripcion, Activo)
      VALUES (?, ?, ?)
      `,
      [Number(tipoHorarioId), descripcion, activo]
    );
    return { insertId: r.insertId };
  },

  async actualizarCatalogoHorario(idCatalogoHorario, fields) {
    const sets = [];
    const params = [];

    if (fields.descripcion !== undefined) {
      sets.push("Descripcion = ?");
      params.push(fields.descripcion);
    }
    if (fields.tipoHorarioId !== undefined) {
      sets.push("Catalogo_Tipo_Horario_idCatalogo_Tipo_Horario = ?");
      params.push(Number(fields.tipoHorarioId));
    }
    if (fields.activo !== undefined) {
      sets.push("Activo = ?");
      params.push(fields.activo);
    }

    if (!sets.length) return { affectedRows: 0 };

    params.push(Number(idCatalogoHorario));

    const [r] = await db.query(
      `
      UPDATE catalogo_horario
      SET ${sets.join(", ")}
      WHERE idCatalogo_Horario = ?
      `,
      params
    );
    return { affectedRows: r.affectedRows };
  },

  async desactivarCatalogoHorario(idCatalogoHorario) {
    const [r] = await db.query(
      `UPDATE catalogo_horario SET Activo = 0 WHERE idCatalogo_Horario = ?`,
      [Number(idCatalogoHorario)]
    );
    return { affectedRows: r.affectedRows };
  },

  async listarTiposHorarioActivos() {
    const [rows] = await db.query(`
      SELECT
        idCatalogo_Tipo_Horario AS idCatalogoTipoHorario,
        Descripcion AS descripcion,
        Activo AS activo
      FROM catalogo_tipo_horario
      WHERE Activo = 1
      ORDER BY Descripcion ASC
    `);
    return rows;
  },

  async existeCatalogoActivo(idCatalogoHorario) {
    const [rows] = await db.query(
      `
      SELECT idCatalogo_Horario
      FROM catalogo_horario
      WHERE idCatalogo_Horario = ?
        AND Activo = 1
      LIMIT 1
      `,
      [Number(idCatalogoHorario)]
    );
    return rows.length > 0;
  },

  async obtenerDetalleCatalogoHorario(idCatalogoHorario) {
    const [rows] = await db.query(
      `
      SELECT
        idCatalogo_Horario_Detalle AS idCatalogoHorarioDetalle,
        Dia_Semana AS diaSemana,
        Entrada AS entrada,
        Salida AS salida,
        Activo AS activo
      FROM catalogo_horario_detalle
      WHERE Catalogo_Horario_idCatalogo_Horario = ?
      ORDER BY Dia_Semana ASC
      `,
      [Number(idCatalogoHorario)]
    );
    return rows;
  },

  async crearDetalleCatalogoHorario(idCatalogoHorario, { diaSemana, entrada, salida, activo }) {
    const [r] = await db.query(
      `
      INSERT INTO catalogo_horario_detalle
        (Catalogo_Horario_idCatalogo_Horario, Dia_Semana, Entrada, Salida, Activo)
      VALUES (?, ?, ?, ?, ?)
      `,
      [Number(idCatalogoHorario), Number(diaSemana), entrada, salida, activo]
    );
    return { insertId: r.insertId };
  },

  async actualizarDetalleCatalogoHorario(idCatalogoHorario, idCatalogoHorarioDetalle, fields) {
    const sets = [];
    const params = [];

    if (fields.diaSemana !== undefined) {
      sets.push("Dia_Semana = ?");
      params.push(Number(fields.diaSemana));
    }
    if (fields.entrada !== undefined) {
      sets.push("Entrada = ?");
      params.push(fields.entrada);
    }
    if (fields.salida !== undefined) {
      sets.push("Salida = ?");
      params.push(fields.salida);
    }
    if (fields.activo !== undefined) {
      sets.push("Activo = ?");
      params.push(fields.activo);
    }

    if (!sets.length) return { affectedRows: 0 };

    params.push(Number(idCatalogoHorario), Number(idCatalogoHorarioDetalle));

    const [r] = await db.query(
      `
      UPDATE catalogo_horario_detalle
      SET ${sets.join(", ")}
      WHERE Catalogo_Horario_idCatalogo_Horario = ?
        AND idCatalogo_Horario_Detalle = ?
      `,
      params
    );
    return { affectedRows: r.affectedRows };
  },

  async desactivarDetalleCatalogoHorario(idCatalogoHorario, idCatalogoHorarioDetalle) {
    const [r] = await db.query(
      `
      UPDATE catalogo_horario_detalle
      SET Activo = 0
      WHERE Catalogo_Horario_idCatalogo_Horario = ?
        AND idCatalogo_Horario_Detalle = ?
      `,
      [Number(idCatalogoHorario), Number(idCatalogoHorarioDetalle)]
    );
    return { affectedRows: r.affectedRows };
  },

  async catalogoTieneDetalleActivoConn(conn, idCatalogoHorario) {
    const [rows] = await conn.query(
      `
      SELECT 1
      FROM catalogo_horario_detalle
      WHERE Catalogo_Horario_idCatalogo_Horario = ?
        AND Activo = 1
      LIMIT 1
      `,
      [Number(idCatalogoHorario)]
    );
    return rows.length > 0;
  },

  

  async obtenerAsignacionActivaEmpleado(idEmpleado) {
    const [rows] = await db.query(
      `
      SELECT
        he.idHorario_Empleado AS idHorarioEmpleado,
        he.Empleado_idEmpleado AS empleadoId,
        he.Catalogo_Horario_idCatalogo_Horario AS idCatalogoHorario,
        he.Fecha_Asignacion AS fechaAsignacion,
        he.Activo AS activo,
        ch.Descripcion AS catalogoDescripcion,
        ch.Catalogo_Tipo_Horario_idCatalogo_Tipo_Horario AS tipoHorarioId,
        cth.Descripcion AS tipoHorarioDescripcion
      FROM horario_empleado he
      JOIN catalogo_horario ch
        ON ch.idCatalogo_Horario = he.Catalogo_Horario_idCatalogo_Horario
      LEFT JOIN catalogo_tipo_horario cth
        ON cth.idCatalogo_Tipo_Horario = ch.Catalogo_Tipo_Horario_idCatalogo_Tipo_Horario
      WHERE he.Empleado_idEmpleado = ?
        AND he.Activo = 1
        AND ch.Activo = 1
      ORDER BY he.idHorario_Empleado DESC
      LIMIT 1
      `,
      [Number(idEmpleado)]
    );
    return rows[0] || null;
  },

  async obtenerDetalleActivoCatalogo(idCatalogoHorario) {
    const [rows] = await db.query(
      `
      SELECT
        idCatalogo_Horario_Detalle AS idCatalogoHorarioDetalle,
        Dia_Semana AS diaSemana,
        Entrada AS entrada,
        Salida AS salida,
        Activo AS activo
      FROM catalogo_horario_detalle
      WHERE Catalogo_Horario_idCatalogo_Horario = ?
        AND Activo = 1
      ORDER BY Dia_Semana ASC
      `,
      [Number(idCatalogoHorario)]
    );
    return rows;
  },

   async actualizarAsignacionActivaEmpleadoConn(conn, idEmpleado, idCatalogoHorario) {
    const [r] = await conn.query(
      `
      UPDATE horario_empleado
      SET Catalogo_Horario_idCatalogo_Horario = ?,
          Fecha_Asignacion = NOW()
      WHERE Empleado_idEmpleado = ?
        AND Activo = 1
      `,
      [Number(idCatalogoHorario), Number(idEmpleado)]
    );
    return { affectedRows: r.affectedRows };
  },

  async crearAsignacionEmpleadoConn(conn, idEmpleado, idCatalogoHorario) {
    const [r] = await conn.query(
      `
      INSERT INTO horario_empleado
        (Empleado_idEmpleado, Catalogo_Horario_idCatalogo_Horario, Fecha_Asignacion, Activo)
      VALUES (?, ?, NOW(), 1)
      `,
      [Number(idEmpleado), Number(idCatalogoHorario)]
    );
    return { insertId: r.insertId };
  },
};

module.exports = horarioLaboralModel;
