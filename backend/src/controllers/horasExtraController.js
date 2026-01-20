// controllers/horasExtraController.js
const db = require("../config/db");

function parseTimeToMinutes(t) {
  const s = String(t || "00:00:00").trim();
  const parts = s.split(":").map((x) => Number(x));
  const hh = parts[0] || 0;
  const mm = parts[1] || 0;
  return hh * 60 + mm;
}

function minutesToTimeStr(mins) {
  let m = Number(mins || 0);
  m = ((m % 1440) + 1440) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(Math.floor(m % 60)).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

function ymd(v) {
  const s = String(v || "").trim();
  if (!s) return "";
   if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return "";
}

function cadenciaToHoursBase(desc) {
  const d = String(desc || "").trim().toLowerCase();
  if (d.includes("mens")) return 240;
  if (d.includes("quin")) return 120;
  if (d.includes("seman")) return 48;
  return 240;
}

 
function buildSegmentsDiurnoNocturnoOrdered(startAbs, endAbs) {
  let s = Number(startAbs || 0);
  let e = Number(endAbs || 0);
  if (e <= s) e += 1440;

  const segments = [];

  for (let day = 0; day < 2; day++) {
    const base = day * 1440;
    const dayStart = base;
    const dayEnd = base + 1440;

    const xStart = Math.max(s, dayStart);
    const xEnd = Math.min(e, dayEnd);
    if (xEnd <= xStart) continue;

    const diStart = base + 300;  
    const diEnd = base + 1140;  

     const n1s = xStart;
    const n1e = Math.min(xEnd, diStart);
    if (n1e > n1s) segments.push({ tipo: "NOCTURNA", inicio: n1s, fin: n1e });

     const ds = Math.max(xStart, diStart);
    const de = Math.min(xEnd, diEnd);
    if (de > ds) segments.push({ tipo: "DIURNA", inicio: ds, fin: de });

     const n2s = Math.max(xStart, diEnd);
    const n2e = xEnd;
    if (n2e > n2s) segments.push({ tipo: "NOCTURNA", inicio: n2s, fin: n2e });
  }

  segments.sort((a, b) => a.inicio - b.inicio);

   const out = [];
  for (const seg of segments) {
    if (!seg || seg.fin <= seg.inicio) continue;
    const last = out[out.length - 1];
    if (last && last.tipo === seg.tipo && last.fin === seg.inicio) {
      last.fin = seg.fin;
    } else {
      out.push({ ...seg });
    }
  }

  return out;
}

 
async function asegurarPeriodoAutoExacto(conn, desde, hasta) {
  const d = ymd(desde);
  const h = ymd(hasta);
  if (!d || !h) return 0;

   const [rows] = await conn.query(
    `
    SELECT idCatalogo_Periodo AS id
    FROM catalogo_periodo
    WHERE Activo = 1
      AND DATE(Fecha_Inicio) = DATE(?)
      AND DATE(Fecha_Fin) = DATE(?)
    LIMIT 1
    `,
    [d, h]
  );

  if (rows?.length) return Number(rows[0].id) || 0;

   const [ins] = await conn.query(
    `
    INSERT INTO catalogo_periodo (Fecha_Inicio, Fecha_Fin, Estado, Activo)
    VALUES (DATE(?), DATE(?), ?, 1)
    `,
    [d, h, "Auto"]
  );

  const newId = Number(ins?.insertId || 0);
  if (newId) return newId;

   const [rows2] = await conn.query(
    `
    SELECT idCatalogo_Periodo AS id
    FROM catalogo_periodo
    WHERE Activo = 1
      AND DATE(Fecha_Inicio) = DATE(?)
      AND DATE(Fecha_Fin) = DATE(?)
    ORDER BY idCatalogo_Periodo DESC
    LIMIT 1
    `,
    [d, h]
  );

  return rows2?.length ? Number(rows2[0].id) || 0 : 0;
}

async function calcularHorasExtraPeriodo(req, res, next) {
  let conn;
  try {
     
    const desdeBody = ymd(req.body?.desde);
    const hastaBody = ymd(req.body?.hasta);

    const idUsuario = req.usuario?.idUsuario;
    if (!idUsuario) {
      return res.status(401).json({ ok: false, mensaje: "Usuario no autenticado" });
    }

    if (!desdeBody || !hastaBody) {
      return res.status(400).json({
        ok: false,
        mensaje: "Debe enviar (desde y hasta) para calcular.",
      });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

     
    const periodoId = await asegurarPeriodoAutoExacto(conn, desdeBody, hastaBody);
    if (!periodoId) {
      await conn.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: "No fue posible crear/encontrar el período interno (Auto) para el rango.",
      });
    }

    const [tipoRows] = await conn.query(
      `
      SELECT idCatalogo_Tipo_Hora_Extra AS id, Descripcion AS descripcion, PorcentajePago
      FROM catalogo_tipo_hora_extra
      WHERE Activo = 1
      `
    );

    const tipoDiurna = tipoRows.find((t) =>
      String(t.descripcion || "").toLowerCase().includes("diurn")
    );
    const tipoNocturna = tipoRows.find((t) =>
      String(t.descripcion || "").toLowerCase().includes("nocturn")
    );

    if (!tipoDiurna || !tipoNocturna) {
      await conn.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: "Faltan tipos de hora extra (Diurna y Nocturna) en catalogo_tipo_hora_extra",
      });
    }

    const [estadoPend] = await conn.query(
      `
      SELECT idCatalogo_Estado AS id
      FROM catalogo_estado
      WHERE Activo = 1 AND Modulo = 'HORA_EXTRA' AND Descripcion = 'PENDIENTE'
      LIMIT 1
      `
    );

    if (!estadoPend.length) {
      await conn.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: "Falta estado HORA_EXTRA PENDIENTE en catalogo_estado",
      });
    }

    const estadoPendienteId = Number(estadoPend[0].id);

     
    await conn.query(
      `
      UPDATE horas_extras he
      JOIN (
        SELECT x.Horas_Extras_idExtra
        FROM estado_horasextra x
        WHERE x.Activo = 1
          AND x.Catalogo_Estado_idCatalogo_Estado = ?
      ) pend ON pend.Horas_Extras_idExtra = he.idExtra
      SET he.Activo = 0
      WHERE he.Activo = 1
        AND DATE(he.Fecha) BETWEEN DATE(?) AND DATE(?)
      `,
      [estadoPendienteId, desdeBody, hastaBody]
    );

    await conn.query(
      `
      UPDATE estado_horasextra x
      JOIN horas_extras he ON he.idExtra = x.Horas_Extras_idExtra
      SET x.Activo = 0
      WHERE x.Activo = 1
        AND x.Catalogo_Estado_idCatalogo_Estado = ?
        AND DATE(he.Fecha) BETWEEN DATE(?) AND DATE(?)
      `,
      [estadoPendienteId, desdeBody, hastaBody]
    );

     
    const [rows] = await conn.query(
      `
      SELECT
        a.idAsistencia,
        a.Empleado_idEmpleado AS empleadoId,
        a.Fecha,
        a.Entrada,
        a.Salida,
        a.Ausente,
        a.Validado,
        chd.Entrada AS EntradaHorario,
        chd.Salida AS SalidaHorario,
        emp.Salario,
        ccp.Descripcion AS CadenciaPago
      FROM asistencia a
      JOIN empleado emp ON emp.idEmpleado = a.Empleado_idEmpleado
      JOIN catalogo_cadencia_pago ccp
        ON ccp.idCatalogo_Cadencia_Pago = emp.Catalogo_Cadencia_Pago_idCatalogo_Cadencia_Pago

      LEFT JOIN horario_empleado hemp
        ON hemp.Empleado_idEmpleado = emp.idEmpleado
       AND hemp.Activo = 1

      LEFT JOIN catalogo_horario_detalle chd
        ON chd.Catalogo_Horario_idCatalogo_Horario = hemp.Catalogo_Horario_idCatalogo_Horario
       AND chd.Activo = 1
       AND chd.Dia_Semana = DAYOFWEEK(a.Fecha)

      WHERE a.Activo = 1
        AND a.Validado = 1
        AND a.Ausente = 0
        AND DATE(a.Fecha) BETWEEN DATE(?) AND DATE(?)
      `,
      [desdeBody, hastaBody]
    );

    let totalInsertadas = 0;

    for (const r of rows) {
      if (!r.EntradaHorario || !r.SalidaHorario) continue;

      const entradaTrab = parseTimeToMinutes(r.Entrada);
      const salidaTrabRaw = parseTimeToMinutes(r.Salida);
      let salidaTrab = salidaTrabRaw;
      if (salidaTrab <= entradaTrab) salidaTrab += 1440;

      const entradaHor = parseTimeToMinutes(r.EntradaHorario);
      const salidaHorRaw = parseTimeToMinutes(r.SalidaHorario);
      let salidaHor = salidaHorRaw;
      if (salidaHor <= entradaHor) salidaHor += 1440;

      const minutosHor = salidaHor - entradaHor;
      if (minutosHor <= 0) continue;

       if (entradaTrab > entradaHor) continue;
      if (salidaTrab < salidaHor) continue;

       let minutosExtra = salidaTrab - salidaHor;
      if (minutosExtra <= 0) continue;

       const maxTotal = 720; // 12h
      const maxExtra = Math.max(0, maxTotal - minutosHor);
      minutosExtra = Math.min(minutosExtra, maxExtra);
      if (minutosExtra <= 0) continue;

      const extraStartAbs = salidaHor;
      const extraEndAbs = salidaHor + minutosExtra;

      const horasBase = cadenciaToHoursBase(r.CadenciaPago);
      const salario = Number(r.Salario || 0);
      const tarifaHora = horasBase > 0 ? salario / horasBase : 0;

       const segments = buildSegmentsDiurnoNocturnoOrdered(extraStartAbs, extraEndAbs);

      for (const seg of segments) {
        const minutosSeg = seg.fin - seg.inicio;
        if (!minutosSeg || minutosSeg <= 0) continue;

        const tipo = seg.tipo === "DIURNA" ? tipoDiurna : tipoNocturna;
        const nombre = seg.tipo === "DIURNA" ? "EXTRA_DIURNA" : "EXTRA_NOCTURNA";

        const porc = Number(tipo.PorcentajePago || 0);
        const monto = tarifaHora * (1 + porc) * (minutosSeg / 60);

        const [ins] = await conn.query(
          `
          INSERT INTO horas_extras
            (Empleado_idEmpleado, Catalogo_Tipo_Hora_Extra_idCatalogo_Tipo_Hora_Extra, Catalogo_Periodo_idCatalogo_Periodo,
             Descripcion, Monto, Cantidad, Fecha, Hora_Inicio, Hora_Final, Activo)
          VALUES (?, ?, ?, ?, ?, ?, CONCAT(?, ' 00:00:00'), ?, ?, 1)
          `,
          [
            Number(r.empleadoId),
            Number(tipo.id),
            Number(periodoId),
            `AUTO_${nombre}`,
            Number(monto.toFixed(5)),
            Math.round(minutosSeg),
            String(r.Fecha),
            minutesToTimeStr(seg.inicio),
            minutesToTimeStr(seg.fin),
          ]
        );

        const idExtra = ins.insertId;

        await conn.query(
          `
          INSERT INTO estado_horasextra
            (Horas_Extras_idExtra, Usuario_idUsuario, Catalogo_Estado_idCatalogo_Estado, Fecha_Aprobacion, Motivo_Rechazo, Activo)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP, '', 1)
          `,
          [idExtra, Number(idUsuario), estadoPendienteId]
        );

        totalInsertadas += 1;
      }
    }

    await conn.commit();
    return res.json({
      ok: true,
      mensaje: "Cálculo ejecutado",
      totalInsertadas,
      desde: desdeBody,
      hasta: hastaBody,
    });
  } catch (err) {
    if (conn) await conn.rollback();
    return next(err);
  } finally {
    if (conn) conn.release();
  }
}

async function listarHorasExtra(req, res, next) {
  try {
    const { periodoId, empleadoId, estado, desde, hasta } = req.query;

    const filtros = ["he.Activo = 1"];
    const params = [];

     
    if (periodoId) {
      filtros.push("he.Catalogo_Periodo_idCatalogo_Periodo = ?");
      params.push(Number(periodoId));
    }

    if (empleadoId) {
      filtros.push("he.Empleado_idEmpleado = ?");
      params.push(Number(empleadoId));
    }

    const d = ymd(desde);
    const h = ymd(hasta);
    if (d && h) {
      filtros.push("DATE(he.Fecha) BETWEEN DATE(?) AND DATE(?)");
      params.push(d, h);
    } else if (d) {
      filtros.push("DATE(he.Fecha) >= DATE(?)");
      params.push(d);
    } else if (h) {
      filtros.push("DATE(he.Fecha) <= DATE(?)");
      params.push(h);
    }

    if (estado) {
      const est = String(estado).trim();
      if (/^\d+$/.test(est)) {
        filtros.push("ce.idCatalogo_Estado = ?");
        params.push(Number(est));
      } else {
        filtros.push("ce.Descripcion = ?");
        params.push(est);
      }
    }

    const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

    const sql = `
      SELECT
        he.idExtra,
        he.Empleado_idEmpleado,
        CONCAT(p.Nombre,' ',p.Apellido1,' ',p.Apellido2) AS EmpleadoNombre,
        he.Catalogo_Periodo_idCatalogo_Periodo AS periodoId,
        he.Catalogo_Tipo_Hora_Extra_idCatalogo_Tipo_Hora_Extra AS tipoHoraExtraId,
        cthe.Descripcion AS TipoHoraExtra,
        he.Descripcion,
        he.Monto,
        he.Cantidad,
        DATE(he.Fecha) AS Fecha,
        he.Hora_Inicio,
        he.Hora_Final,
        ce.Descripcion AS Estado
      FROM horas_extras he
      JOIN empleado e ON e.idEmpleado = he.Empleado_idEmpleado
      JOIN persona p ON p.idPersona = e.Persona_idPersona
      JOIN catalogo_tipo_hora_extra cthe
        ON cthe.idCatalogo_Tipo_Hora_Extra = he.Catalogo_Tipo_Hora_Extra_idCatalogo_Tipo_Hora_Extra

      LEFT JOIN (
        SELECT x.*
        FROM estado_horasextra x
        JOIN (
          SELECT Horas_Extras_idExtra, MAX(Fecha_Aprobacion) AS maxFecha
          FROM estado_horasextra
          WHERE Activo = 1
          GROUP BY Horas_Extras_idExtra
        ) m
          ON m.Horas_Extras_idExtra = x.Horas_Extras_idExtra
         AND m.maxFecha = x.Fecha_Aprobacion
        WHERE x.Activo = 1
      ) eh
        ON eh.Horas_Extras_idExtra = he.idExtra

      LEFT JOIN catalogo_estado ce
        ON ce.idCatalogo_Estado = eh.Catalogo_Estado_idCatalogo_Estado

      ${where}
      ORDER BY DATE(he.Fecha) DESC, EmpleadoNombre ASC, he.idExtra DESC
    `;

    const [rows] = await db.query(sql, params);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
}

async function cambiarEstadoHoraExtra(req, res, next) {
  let conn;
  try {
    const idExtra = Number(req.params.id);
    const estadoId = Number(req.body?.estadoId);
    const idUsuario = req.usuario?.idUsuario;
    const motivoRechazo = String(req.body?.motivoRechazo || "").trim();

    if (!idExtra || !estadoId) {
      return res.status(400).json({ ok: false, mensaje: "id y estadoId requeridos" });
    }
    if (!idUsuario) return res.status(401).json({ ok: false, mensaje: "Usuario no autenticado" });

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [exists] = await conn.query(
      `SELECT idExtra FROM horas_extras WHERE idExtra = ? AND Activo = 1 LIMIT 1`,
      [idExtra]
    );
    if (!exists.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, mensaje: "Hora extra no encontrada" });
    }

    await conn.query(
      `UPDATE estado_horasextra SET Activo = 0 WHERE Horas_Extras_idExtra = ? AND Activo = 1`,
      [idExtra]
    );

    await conn.query(
      `
      INSERT INTO estado_horasextra
        (Horas_Extras_idExtra, Usuario_idUsuario, Catalogo_Estado_idCatalogo_Estado, Fecha_Aprobacion, Motivo_Rechazo, Activo)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, 1)
      `,
      [idExtra, Number(idUsuario), estadoId, motivoRechazo || ""]
    );

    await conn.commit();
    return res.json({ ok: true, mensaje: "Estado actualizado" });
  } catch (err) {
    if (conn) await conn.rollback();
    return next(err);
  } finally {
    if (conn) conn.release();
  }
}

module.exports = {
  calcularHorasExtraPeriodo,
  listarHorasExtra,
  cambiarEstadoHoraExtra,
};
