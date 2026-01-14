const telefonoModel = require("../models/telefonoModel");

const listarTiposTelefono = async (req, res) => {
  try {
    const tipos = await telefonoModel.listarTipos();
    return res.json({ ok: true, tipos });
  } catch (e) {
    return res.status(500).json({ ok: false, mensaje: "Error listando tipos de teléfono", error: String(e) });
  }
};

module.exports = { listarTiposTelefono };
