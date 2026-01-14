// empleadoModel.js
const db = require("../config/db");

const empleadoModel = {
  
  async listarEmpleadosConPersona(conn = db) {
    const [rows] = await conn.query(
      `SELECT 
        e.idEmpleado,
        e.Persona_idPersona AS personaId,
        e.Fecha_Ingreso AS fechaIngreso,
        e.Salario AS salario,
        e.CadenciaPago AS cadenciaPago,
        e.Activo AS activo,

        p.Nombre AS nombre,
        p.Apellido1 AS apellido1,
        p.Apellido2 AS apellido2
      FROM Empleado e
      INNER JOIN Persona p ON p.idPersona = e.Persona_idPersona
      ORDER BY e.idEmpleado DESC`
    );
    return rows;
  },

  
  async obtenerEmpleadoPorId(idEmpleado, conn = db) {
    const [rows] = await conn.query(
      `SELECT 
        idEmpleado,
        Persona_idPersona AS personaId,
        Fecha_Ingreso AS fechaIngreso,
        Salario AS salario,
        CadenciaPago AS cadenciaPago,
        Activo AS activo
      FROM Empleado
      WHERE idEmpleado = ?
      LIMIT 1`,
      [Number(idEmpleado)]
    );
    return rows[0] || null;
  },

 
  async existePersona(personaId, conn = db) {
    const [rows] = await conn.query(
      `SELECT 1 FROM Persona WHERE idPersona = ? LIMIT 1`,
      [Number(personaId)]
    );
    return rows.length > 0;
  },

  
  async insertarEmpleado({ personaId, fechaIngreso, salario, cadenciaPago, activo = 1 }, conn = db) {
    const [result] = await conn.query(
      `INSERT INTO Empleado
        (Persona_idPersona, Fecha_Ingreso, Salario, CadenciaPago, Activo)
       VALUES (?, ?, ?, ?, ?)`,
      [Number(personaId), fechaIngreso, Number(salario), String(cadenciaPago), Number(activo)]
    );
    return result;
  },

  
  async actualizarEmpleado({ idEmpleado, personaId, fechaIngreso, salario, cadenciaPago, activo = 1 }, conn = db) {
    const [result] = await conn.query(
      `UPDATE Empleado
       SET Persona_idPersona = ?,
           Fecha_Ingreso = ?,
           Salario = ?,
           CadenciaPago = ?,
           Activo = ?
       WHERE idEmpleado = ?`,
      [
        Number(personaId),
        fechaIngreso,
        Number(salario),
        String(cadenciaPago),
        Number(activo),
        Number(idEmpleado),
      ]
    );
    return result;
  },

  
  async desactivarEmpleado(idEmpleado, conn = db) {
    const [result] = await conn.query(
      `UPDATE Empleado SET Activo = 0 WHERE idEmpleado = ?`,
      [Number(idEmpleado)]
    );
    return result;
  },
};

module.exports = empleadoModel;
