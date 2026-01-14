//correoController.js
const correoModel = require("../models/correoModel");

const listarTiposCorreo = async (req, res) => {
  try {
    const tipos = await correoModel.listarTipos();
    return res.json({ ok: true, tipos });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: "Error listando tipos de correo", error: String(e) });
  }
};

module.exports = { listarTiposCorreo };
