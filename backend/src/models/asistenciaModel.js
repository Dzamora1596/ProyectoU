// Modelo de Asistencia para la gestión de asistencias de empleados
const db = require("../config/db");

function toBit(v) {
  return v ? 1 : 0;
}

function normDate(d) {
  return String(d || "").slice(0, 10);
}

function normTime(t) {
  const s = String(t ?? "").trim();
  // valor convencionado
  if (!s) return "00:00:00";
  if (s.length === 5) return `${s}:00`;
  if (s.length === 8) return s;
  return "00:00:00";
}
// Lista colaboradores activos, con opción de búsqueda por id o nombre completo
async function listarColaboradores(buscar = "") {
  const q = String(buscar).trim();
  const like = `%${q}%`;

  const [rows] = await db.query(
    `
    SELECT 
      e.idEmpleado,
      CONCAT(p.Nombre,' ',p.Apellido1,' ',p.Apellido2) AS nombreCompleto
    FROM Empleado e
    INNER JOIN Persona p ON p.idPersona = e.Persona_idPersona
    WHERE e.Activo = b'1' AND p.Activo = b'1'
      AND (
        ? = '' OR
        CAST(e.idEmpleado AS CHAR) LIKE ? OR
        CONCAT(p.Nombre,' ',p.Apellido1,' ',p.Apellido2) LIKE ?
      )
    ORDER BY e.idEmpleado ASC
    `,
    [q, like, like]
  );

  return rows;
}
// Lista asistencias de un empleado en un rango de fechas
async function listarAsistenciasPorEmpleado(empleadoId, desde, hasta) {
  const [rows] = await db.query(
    `
    SELECT
      idAsistencia,
      Fecha,
      Entrada,
      Salida,
      Tardia,
      Ausente,
      Validado,
      Observacion
    FROM Asistencia
    WHERE Empleado_idEmpleado = ?
      AND Fecha BETWEEN ? AND ?
      AND Activo = b'1'
    ORDER BY Fecha ASC
    `,
    [Number(empleadoId), normDate(desde), normDate(hasta)]
  );

  return rows;
}
// Busca las asistencias por empleado y fecha, devuelve el id de Asistencia o null
async function buscarIdPorFecha(empleadoId, fecha) {
  const [rows] = await db.query(
    `
    SELECT idAsistencia
    FROM Asistencia
    WHERE Empleado_idEmpleado = ?
      AND Fecha = ?
      AND Activo = b'1'
    LIMIT 1
    `,
    [Number(empleadoId), normDate(fecha)]
  );
  return rows[0]?.idAsistencia ?? null;
}

// Guarda los cambios de asistencias para un empleado, recibe un arreglo de objetos de cambios
async function guardarCambios(empleadoId, cambios = []) {
  const nuevos = [];

  for (const c of cambios) {
    const fecha = normDate(c.fecha);
    const entrada = normTime(c.entrada);
    const salida = normTime(c.salida);

    const tardia = toBit(!!c.tardia);
    const ausente = toBit(!!c.ausente);
    const validado = toBit(!!c.validado);
    const observacion = String(c.observacion ?? "");

    const id = Number(c.idAsistencia || c.idRegistro || 0);

    if (id) {
      await db.query(
        `
        UPDATE Asistencia
        SET Entrada = ?,
            Salida = ?,
            Tardia = ?,
            Ausente = ?,
            Validado = ?,
            Observacion = ?
        WHERE idAsistencia = ?
          AND Empleado_idEmpleado = ?
          AND Activo = b'1'
        `,
        [entrada, salida, tardia, ausente, validado, observacion, id, Number(empleadoId)]
      );
    } else {
      // Evitar duplicados por fecha
      const ya = await buscarIdPorFecha(empleadoId, fecha);

      if (ya) {
        await db.query(
          `
          UPDATE Asistencia
          SET Entrada = ?,
              Salida = ?,
              Tardia = ?,
              Ausente = ?,
              Validado = ?,
              Observacion = ?
          WHERE idAsistencia = ?
            AND Empleado_idEmpleado = ?
            AND Activo = b'1'
          `,
          [entrada, salida, tardia, ausente, validado, observacion, Number(ya), Number(empleadoId)]
        );
      } else {
        const [ins] = await db.query(
          `
          INSERT INTO Asistencia
            (Empleado_idEmpleado, Fecha, Entrada, Salida, Tardia, Ausente, Validado, Observacion, Activo)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, b'1')
          `,
          [Number(empleadoId), fecha, entrada, salida, tardia, ausente, validado, observacion]
        );

        nuevos.push({ fecha, idAsistencia: ins.insertId });
      }
    }
  }

  return nuevos;
}
//Valida que las asistencias en un periodo estén marcadas como validadas
async function validarPeriodo(desde, hasta) {
  const [r] = await db.query(
    `
    UPDATE Asistencia
    SET Validado = b'1'
    WHERE Fecha BETWEEN ? AND ?
      AND Activo = b'1'
    `,
    [normDate(desde), normDate(hasta)]
  );
  return r.affectedRows;
}

module.exports = {
  listarColaboradores,
  listarAsistenciasPorEmpleado,
  guardarCambios,
  validarPeriodo,
};
