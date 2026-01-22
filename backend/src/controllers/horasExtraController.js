// controllers/horasExtraController.js
const db = require("../config/db");

function parseTimeToMinutes(t) {
  const s = String(t || "00:00:00").trim();
  if (!s || s === "00:00:00") return 0;

  const parts = s.split(":").map((x) => Number(x));
  const hh = Number.isFinite(parts[0]) ? parts[0] : 0;
  const mm = Number.isFinite(parts[1]) ? parts[1] : 0;

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

function addDaysToYMD(ymdStr, days) {
  const d = String(ymdStr || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;

   
  const dt = new Date(`${d}T00:00:00.000Z`);
  dt.setUTCDate(dt.getUTCDate() + Number(days || 0));
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function cadenciaToHoursBase(desc) {
  const d = String(desc || "").trim().toLowerCase();
  if (d.includes("mens")) return 240;  
  if (d.includes("quin")) return 120;  
  if (d.includes("seman")) return 48;  
  return 240;
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function round5(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100000) / 100000;
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
      SELECT idCatalogo_Tipo_Hora_Extra AS id, Descripcion AS descripcion
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
        DATE(a.Fecha) AS Fecha,
        a.Entrada,
        a.Salida,
        a.Ausente,
        a.Validado,

        chd.Entrada AS EntradaHorario,
        chd.Salida AS SalidaHorario,

        emp.Salario,
        ccp.Descripcion AS CadenciaPago,

        CASE
          WHEN cal.idCalendario IS NULL THEN 0
          WHEN cal.Feriado_idFeriado IS NULL THEN 0
          WHEN cal.Feriado_idFeriado = 0 THEN 0
          ELSE 1
        END AS EsFeriado,
        f.Nombre AS FeriadoNombre

      FROM asistencia a
      JOIN empleado emp ON emp.idEmpleado = a.Empleado_idEmpleado
      JOIN catalogo_cadencia_pago ccp
        ON ccp.idCatalogo_Cadencia_Pago = emp.Catalogo_Cadencia_Pago_idCatalogo_Cadencia_Pago

      LEFT JOIN calendario cal
        ON cal.Activo = 1 AND DATE(cal.Fecha) = DATE(a.Fecha)

      LEFT JOIN feriado f
        ON f.Activo = 1
       AND f.idFeriado = cal.Feriado_idFeriado
       AND cal.Feriado_idFeriado <> 0

      LEFT JOIN horario_empleado hemp
        ON hemp.idHorario_Empleado = (
          SELECT he2.idHorario_Empleado
          FROM horario_empleado he2
          WHERE he2.Activo = 1
            AND he2.Empleado_idEmpleado = emp.idEmpleado
            AND DATE(he2.Fecha_Asignacion) <= DATE(a.Fecha)
          ORDER BY he2.Fecha_Asignacion DESC, he2.idHorario_Empleado DESC
          LIMIT 1
        )

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
    let totalDiasConExtra = 0;

    for (const r of rows) {
      if (!r.EntradaHorario || !r.SalidaHorario) continue;

      if (!r.Entrada || String(r.Entrada).startsWith("00:00")) continue;
      if (!r.Salida || String(r.Salida).startsWith("00:00")) continue;

      const fechaBase = String(r.Fecha).slice(0, 10);

      const entradaTrab = parseTimeToMinutes(r.Entrada);
      const salidaTrabRaw = parseTimeToMinutes(r.Salida);

      let salidaTrab = salidaTrabRaw;
      if (salidaTrab <= entradaTrab) salidaTrab += 1440;

      const entradaHor = parseTimeToMinutes(r.EntradaHorario);
      const salidaHorRaw = parseTimeToMinutes(r.SalidaHorario);

      let salidaHor = salidaHorRaw;
      if (salidaHor <= entradaHor) salidaHor += 1440;

      const minutosTrab = salidaTrab - entradaTrab;
      if (minutosTrab <= 0) continue;

      const minutosHor = salidaHor - entradaHor;
      if (minutosHor <= 0) continue;

      
      let extraAntes = Math.max(0, entradaHor - entradaTrab);
      let extraDespues = Math.max(0, salidaTrab - salidaHor);

      let minutosExtraTotal = extraAntes + extraDespues;
      if (minutosExtraTotal <= 0) continue;

      
      const maxTotal = 720;
      if (minutosTrab > maxTotal) {
        const exceso = minutosTrab - maxTotal;
        minutosExtraTotal = Math.max(0, minutosExtraTotal - exceso);
      }

      
      const maxExtraDia = 240;
      minutosExtraTotal = Math.min(minutosExtraTotal, maxExtraDia);
      if (minutosExtraTotal <= 0) continue;

      let remaining = minutosExtraTotal;
      const antesFinal = Math.min(extraAntes, remaining);
      remaining -= antesFinal;
      const despuesFinal = Math.min(extraDespues, remaining);
      remaining -= despuesFinal;

      const tramos = [];
      if (antesFinal > 0) {
        tramos.push({ inicio: entradaTrab, fin: entradaTrab + antesFinal, origen: "ANTES" });
      }
      if (despuesFinal > 0) {
        tramos.push({ inicio: salidaHor, fin: salidaHor + despuesFinal, origen: "DESPUES" });
      }

      const horasBase = cadenciaToHoursBase(r.CadenciaPago);
      const salario = Number(r.Salario || 0);
      const tarifaHora = horasBase > 0 ? salario / horasBase : 0;
      if (tarifaHora <= 0) continue;

      const esFeriado = Number(r.EsFeriado || 0) === 1;
 
      const factorLey = esFeriado ? 3.0 : 1.5;

      let insertoDia = false;

      for (const t of tramos) {
        const segs = buildSegmentsDiurnoNocturnoOrdered(t.inicio, t.fin);

        for (const seg of segs) {
          const minutosSeg = seg.fin - seg.inicio;
          if (!minutosSeg || minutosSeg <= 0) continue;

          const horasSeg = round2(minutosSeg / 60);
          if (horasSeg <= 0) continue;

          const tipo = seg.tipo === "DIURNA" ? tipoDiurna : tipoNocturna;
          const nombre = seg.tipo === "DIURNA" ? "EXTRA_DIURNA" : "EXTRA_NOCTURNA";

          const monto = tarifaHora * factorLey * horasSeg;

          const dayOffset = Math.floor(Number(seg.inicio) / 1440);
          const fechaReal = addDaysToYMD(fechaBase, dayOffset);

          const hhmmssInicio = minutesToTimeStr(seg.inicio).slice(0, 8);
          const fechaHoraInicio = `${fechaReal} ${hhmmssInicio}`;

          const descripcionFinal = `AUTO_${nombre}_${t.origen}${esFeriado ? "_FERIADO" : ""}`;

          const [ins] = await conn.query(
            `
            INSERT INTO horas_extras
              (Empleado_idEmpleado, Catalogo_Tipo_Hora_Extra_idCatalogo_Tipo_Hora_Extra, Catalogo_Periodo_idCatalogo_Periodo,
               Descripcion, Monto, Cantidad, Fecha, Hora_Inicio, Hora_Final, Activo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            `,
            [
              Number(r.empleadoId),
              Number(tipo.id),
              Number(periodoId),
              descripcionFinal,
              round5(monto),
              horasSeg,
              fechaHoraInicio,
              minutesToTimeStr(seg.inicio),
              minutesToTimeStr(seg.fin),
            ]
          );

          const idExtra = ins.insertId;

          
          await conn.query(
            `
            UPDATE estado_horasextra
            SET Activo = 0
            WHERE Horas_Extras_idExtra = ? AND Activo = 1
            `,
            [idExtra]
          );

          await conn.query(
            `
            INSERT INTO estado_horasextra
              (Horas_Extras_idExtra, Usuario_idUsuario, Catalogo_Estado_idCatalogo_Estado, Fecha_Aprobacion, Motivo_Rechazo, Activo)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, '', 1)
            `,
            [idExtra, Number(idUsuario), estadoPendienteId]
          );

          totalInsertadas += 1;
          insertoDia = true;
        }
      }

      if (insertoDia) totalDiasConExtra += 1;
    }

    await conn.commit();
    return res.json({
      ok: true,
      mensaje: "Cálculo de horas extra ejecutado",
      totalInsertadas,
      totalDiasConExtra,
      desde: desdeBody,
      hasta: hastaBody,
      periodoId,
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
    const { periodoId, empleadoId, estado, desde, hasta, feriado } = req.query;

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

     
    if (String(feriado ?? "").trim() !== "") {
      const f = String(feriado).trim().toLowerCase();
      const wants = f === "1" || f === "true" || f === "si" || f === "sí";
      if (wants) filtros.push("(cal.idCalendario IS NOT NULL AND cal.Feriado_idFeriado <> 0)");
      else filtros.push("(cal.idCalendario IS NULL OR cal.Feriado_idFeriado = 0)");
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
        ce.Descripcion AS Estado,

        CASE
          WHEN cal.idCalendario IS NULL THEN 0
          WHEN cal.Feriado_idFeriado IS NULL THEN 0
          WHEN cal.Feriado_idFeriado = 0 THEN 0
          ELSE 1
        END AS EsFeriado,
        f.Nombre AS FeriadoNombre

      FROM horas_extras he
      JOIN empleado e ON e.idEmpleado = he.Empleado_idEmpleado
      JOIN persona p ON p.idPersona = e.Persona_idPersona
      JOIN catalogo_tipo_hora_extra cthe
        ON cthe.idCatalogo_Tipo_Hora_Extra = he.Catalogo_Tipo_Hora_Extra_idCatalogo_Tipo_Hora_Extra

      LEFT JOIN calendario cal
        ON cal.Activo = 1
       AND DATE(cal.Fecha) = DATE(he.Fecha)

      LEFT JOIN feriado f
        ON f.Activo = 1
       AND f.idFeriado = cal.Feriado_idFeriado
       AND cal.Feriado_idFeriado <> 0

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
    const motivoRechazo = String(req.body?.motivoRechazo || "").trim(); // NOT NULL friendly

    if (!idExtra || Number.isNaN(idExtra) || idExtra <= 0) {
      return res.status(400).json({ ok: false, mensaje: "id inválido" });
    }
    if (!estadoId || Number.isNaN(estadoId) || estadoId <= 0) {
      return res.status(400).json({ ok: false, mensaje: "estadoId inválido" });
    }
    if (!idUsuario) return res.status(401).json({ ok: false, mensaje: "Usuario no autenticado" });

    conn = await db.getConnection();
    await conn.beginTransaction();

     
    const [exists] = await conn.query(
      `SELECT idExtra FROM horas_extras WHERE idExtra = ? AND Activo = 1 LIMIT 1 FOR UPDATE`,
      [idExtra]
    );
    if (!exists.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, mensaje: "Hora extra no encontrada" });
    }

     
    const [est] = await conn.query(
      `
      SELECT idCatalogo_Estado AS id, Descripcion AS descripcion
      FROM catalogo_estado
      WHERE Activo = 1 AND Modulo = 'HORA_EXTRA' AND idCatalogo_Estado = ?
      LIMIT 1
      `,
      [estadoId]
    );
    if (!est.length) {
      await conn.rollback();
      return res.status(400).json({ ok: false, mensaje: "Estado inválido para HORA_EXTRA" });
    }

    const descEstado = String(est[0].descripcion || "").trim().toUpperCase();

     
    if (descEstado === "RECHAZADO" && !motivoRechazo) {
      await conn.rollback();
      return res.status(400).json({ ok: false, mensaje: "Debe indicar motivoRechazo para RECHAZADO" });
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
