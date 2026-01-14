require("dotenv").config();
const bcrypt = require("bcryptjs");
const autenticarModel = require("../models/autenticarModel");

(async () => {
  try {
    const empleadoId = 1;             
    const nombreUsuario = "dzamora";    
    const password = "1526";     
    const rolId = 1;                 

     
    const empOk = await autenticarModel.empleadoExiste(empleadoId, { soloActivos: true });
    if (!empOk) throw new Error("Empleado no existe o está inactivo.");

    const existeNombre = await autenticarModel.nombreUsuarioExiste(nombreUsuario);
    if (existeNombre) throw new Error("Ese NombreUsuario ya existe.");

    const rolOk = await autenticarModel.rolExisteActivo(rolId);
    if (!rolOk) throw new Error("Rol inválido o inactivo.");

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await autenticarModel.insertarUsuarioRegistro({
      nombreUsuario,
      passwordHash,
      empleadoId,
      rolId,
    });

    console.log("✅ Usuario creado. idUsuario =", result.insertId);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();
