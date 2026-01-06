// Modelo para gestionar los horarios laborales en la base de datos
const db = require("../config/db");
// Funciones para interactuar con la tabla Horario_Laboral
const horarioLaboralModel = {
  // Lista todos los horarios laborales
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
// Verifica si un horario laboral existe por su ID
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
};

module.exports = horarioLaboralModel;
