//Manejo de consultas para a la tabla Empleado
const db = require('../config/db');

const Empleado = {
async findAll() {
  const [rows] = await db.query(`
    SELECT 
      e.idEmpleado,
      p.idPersona,
      p.Nombre,
      p.Apellido1,
      p.Apellido2,
      e.FechaIngreso,
      e.Activo
    FROM Empleado e
    INNER JOIN Persona p 
      ON e.Persona_idPersona = p.idPersona
  `);
  return rows;
},

  async findById(idEmpleado) {
    const [rows] = await db.query(
      `
      SELECT 
        e.idEmpleado,
        p.Nombre,
        p.Apellido1,
        p.Apellido2,
        e.FechaIngreso,
        e.Activo
      FROM Empleado e
      INNER JOIN Persona p 
        ON e.Persona_idPersona = p.idPersona
      WHERE e.idEmpleado = ?
      `,
      [idEmpleado]
    );
    return rows[0] || null;
  },
};

module.exports = Empleado;
