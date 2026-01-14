//catalogosModel.js
const db = require("../config/db");

const catalogosModel = {
  
  async obtenerCatalogosRegistroPersonal() {
    
    return {};
  },

  
  async obtenerRolesActivos() {
    const [rows] = await db.query(`
      SELECT idCatalogo_Rol, Descripcion
      FROM Catalogo_Rol
      WHERE Activo = 1
      ORDER BY Descripcion ASC
    `);
    return rows;
  },
};

module.exports = catalogosModel;
