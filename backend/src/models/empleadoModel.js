// Modelo de Empleado para gestionar empleados en la base de datos
const db = require("../config/db");

const empleadoModel = {
// Lista todos los empleados con datos de persona y horario laboral
  async listarEmpleadosConPersonaYHorario() {
    const [rows] = await db.query(
      `SELECT 
        e.idEmpleado,
        e.Persona_idPersona AS personaId,
        e.Fecha_Ingreso AS fechaIngreso,
        e.Horario_Laboral_idHorario_Laboral AS horarioId,
        e.Activo AS activo,

        p.Nombre AS nombre,
        p.Apellido1 AS apellido1,
        p.Apellido2 AS apellido2,

        h.Descripcion AS horarioDescripcion,
        h.Entrada AS horarioEntrada,
        h.Salida AS horarioSalida,
        h.Activo AS horarioActivo
      FROM Empleado e
      INNER JOIN Persona p ON p.idPersona = e.Persona_idPersona
      INNER JOIN Horario_Laboral h ON h.idHorario_Laboral = e.Horario_Laboral_idHorario_Laboral
      ORDER BY e.idEmpleado DESC`
    );
    return rows;
  },
// Obtiene un empleado por su ID
  async obtenerEmpleadoPorId(idEmpleado) {
    const [rows] = await db.query(
      `SELECT 
        idEmpleado,
        Persona_idPersona AS personaId,
        Fecha_Ingreso AS fechaIngreso,
        Horario_Laboral_idHorario_Laboral AS horarioId,
        Activo AS activo
      FROM Empleado
      WHERE idEmpleado = ?
      LIMIT 1`,
      [Number(idEmpleado)]
    );
    return rows[0] || null;
  },

  // Verifica si una persona existe por su ID
  async existePersona(personaId) {
    const [rows] = await db.query(
      `SELECT idPersona FROM Persona WHERE idPersona = ? LIMIT 1`,
      [Number(personaId)]
    );
    return rows.length > 0;
  },
  // Verifica si un horario laboral existe por su ID
  async existeHorario(horarioId) {
    const [rows] = await db.query(
      `SELECT idHorario_Laboral FROM Horario_Laboral WHERE idHorario_Laboral = ? LIMIT 1`,
      [Number(horarioId)]
    );
    return rows.length > 0;
  },

  // Evita que una persona tenga más de un empleado asociado
  async personaYaTieneEmpleado(personaId, excludeIdEmpleado = null) {
    if (excludeIdEmpleado) {
      const [rows] = await db.query(
        `SELECT idEmpleado
         FROM Empleado
         WHERE Persona_idPersona = ?
           AND idEmpleado <> ?
         LIMIT 1`,
        [Number(personaId), Number(excludeIdEmpleado)]
      );
      return rows.length > 0;
    }

    const [rows] = await db.query(
      `SELECT idEmpleado
       FROM Empleado
       WHERE Persona_idPersona = ?
       LIMIT 1`,
      [Number(personaId)]
    );
    return rows.length > 0;
  },

  // Inserta un nuevo empleado
  async insertarEmpleado({ personaId, fechaIngreso, horarioId, activo }) {
    const [result] = await db.query(
      `INSERT INTO Empleado
        (Persona_idPersona, Fecha_Ingreso, Horario_Laboral_idHorario_Laboral, Activo)
       VALUES (?, ?, ?, ?)`,
      [Number(personaId), fechaIngreso, Number(horarioId), Number(activo ?? 1)]
    );
    return result; 
  },
// Actualiza un empleado existente
  async actualizarEmpleado({ idEmpleado, personaId, fechaIngreso, horarioId, activo }) {
    const [result] = await db.query(
      `UPDATE Empleado
       SET Persona_idPersona = ?,
           Fecha_Ingreso = ?,
           Horario_Laboral_idHorario_Laboral = ?,
           Activo = ?
       WHERE idEmpleado = ?`,
      [Number(personaId), fechaIngreso, Number(horarioId), Number(activo ?? 1), Number(idEmpleado)]
    );
    return result;
  },
// Desactiva un empleado 
  async desactivarEmpleado(idEmpleado) {
    const [result] = await db.query(
      `UPDATE Empleado SET Activo = 0 WHERE idEmpleado = ?`,
      [Number(idEmpleado)]
    );
    return result;
  },
};

module.exports = empleadoModel;
