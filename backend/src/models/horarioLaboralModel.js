// horarioLaboralModel.js
const db = require("../config/db");

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
};

module.exports = horarioLaboralModel;
