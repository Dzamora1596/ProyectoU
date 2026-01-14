// registroPersonalModel.js
const db = require("../config/db");


function aNumero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function limpiarTexto(v) {
  return String(v ?? "").trim();
}

function aBit(v, defaultValue = 1) {
  
  if (v === undefined || v === null || v === "") return defaultValue ? 1 : 0;
  return v ? 1 : 0;
}

function toDate(v) {
  const s = limpiarTexto(v);
  return s ? s.slice(0, 10) : "";
}

function calcularEdad(fechaNacimientoYYYYMMDD) {
  const d = toDate(fechaNacimientoYYYYMMDD);
  if (!d) return NaN;

  const parts = d.split("-");
  if (parts.length !== 3) return NaN;

  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(day)) return NaN;

  const birth = new Date(Date.UTC(y, m - 1, day));
  if (Number.isNaN(birth.getTime())) return NaN;

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  let age = today.getUTCFullYear() - birth.getUTCFullYear();

  const birthdayThisYear = new Date(Date.UTC(today.getUTCFullYear(), birth.getUTCMonth(), birth.getUTCDate()));
  if (today < birthdayThisYear) age -= 1;

  return age;
}

async function existeEnTabla(conn, sql, params) {
  const [rows] = await conn.query(sql, params);
  return rows.length > 0;
}

async function obtenerCadenciaPagoId(conn, empleado) {
  
  if (
    empleado?.cadenciaPagoId !== undefined &&
    empleado?.cadenciaPagoId !== null &&
    empleado?.cadenciaPagoId !== ""
  ) {
    const id = aNumero(empleado.cadenciaPagoId);
    if (!Number.isFinite(id) || id <= 0) throw new Error("cadenciaPagoId inválido.");

    const ok = await existeEnTabla(
      conn,
      `SELECT 1
       FROM Catalogo_Cadencia_Pago
       WHERE idCatalogo_Cadencia_Pago = ? AND Activo = 1`,
      [id]
    );
    if (!ok) throw new Error("La cadencia de pago indicada no existe o está inactiva.");
    return id;
  }

  
  const cad = limpiarTexto(empleado?.cadenciaPago);
  if (!cad) throw new Error("Debe indicar cadencia de pago (cadenciaPagoId o cadenciaPago).");

  const [rows] = await conn.query(
    `SELECT idCatalogo_Cadencia_Pago AS id
     FROM Catalogo_Cadencia_Pago
     WHERE Descripcion = ? AND Activo = 1
     LIMIT 1`,
    [cad]
  );

  if (rows.length === 0) throw new Error("La cadencia de pago indicada no existe en el catálogo.");
  return rows[0].id;
}


async function crearRegistroPersonal(payload) {
  const conn = await db.getConnection();
  let tx = false;

  try {
    await conn.beginTransaction();
    tx = true;

    const persona = payload?.persona || {};
    const empleado = payload?.empleado || {};
    const telefonos = Array.isArray(payload?.telefonos) ? payload.telefonos : [];
    const correos = Array.isArray(payload?.correos) ? payload.correos : [];

    
    const idPersona = aNumero(persona.idPersona);
    const generoId = aNumero(persona.generoId);

    
    const cantidadHijosRaw = persona.cantidadHijos;
    const cantidadHijos =
      cantidadHijosRaw === undefined || cantidadHijosRaw === null || cantidadHijosRaw === ""
        ? 0
        : aNumero(cantidadHijosRaw);

    const nombre = limpiarTexto(persona.nombre);
    const apellido1 = limpiarTexto(persona.apellido1);
    const apellido2 = limpiarTexto(persona.apellido2);
    const fechaNacimiento = toDate(persona.fechaNacimiento);

    if (!Number.isFinite(idPersona) || idPersona <= 0) throw new Error("Identificación (idPersona) inválida.");
    if (!nombre || !apellido1 || !apellido2) throw new Error("Faltan datos de persona (nombre/apellidos).");
    if (!Number.isFinite(generoId) || generoId <= 0) throw new Error("Género (generoId) inválido.");
    if (!fechaNacimiento) throw new Error("Debe indicar fecha de nacimiento (YYYY-MM-DD).");
    if (!Number.isFinite(cantidadHijos) || cantidadHijos < 0) throw new Error("CantidadHijos inválida.");

    
    const edad = calcularEdad(fechaNacimiento);
    if (!Number.isFinite(edad)) throw new Error("Fecha de nacimiento inválida.");
    if (edad < 18) throw new Error("No se permite registrar empleados menores de 18 años.");

    
    const existePersona = await existeEnTabla(conn, `SELECT 1 FROM Persona WHERE idPersona = ?`, [idPersona]);
    if (existePersona) throw new Error("Ya existe una persona con esa identificación.");

    
    const existeGenero = await existeEnTabla(
      conn,
      `SELECT 1 FROM Catalogo_Genero WHERE idCatalogo_Genero = ? AND Activo = 1`,
      [generoId]
    );
    if (!existeGenero) throw new Error("El género indicado no existe o está inactivo.");

    await conn.query(
      `INSERT INTO Persona
       (idPersona, Nombre, Apellido1, Apellido2, Catalogo_Genero_idCatalogo_Genero, Fecha_Nacimiento, CantidadHijos, Activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [idPersona, nombre, apellido1, apellido2, generoId, fechaNacimiento, cantidadHijos, aBit(persona.activo, 1)]
    );

    
    const fechaIngreso = toDate(empleado.fechaIngreso);
    const salario = aNumero(empleado.salario);

    if (!fechaIngreso) throw new Error("Debe indicar fecha de ingreso (YYYY-MM-DD).");
    if (!Number.isFinite(salario)) throw new Error("Salario inválido.");

    
    const existeEmpleadoParaPersona = await existeEnTabla(
      conn,
      `SELECT 1 FROM Empleado WHERE Persona_idPersona = ?`,
      [idPersona]
    );
    if (existeEmpleadoParaPersona) throw new Error("Ya existe un empleado asociado a esta persona.");

    const cadenciaPagoId = await obtenerCadenciaPagoId(conn, empleado);

    const [empResult] = await conn.query(
      `INSERT INTO Empleado
       (Persona_idPersona, Fecha_Ingreso, Salario, Catalogo_Cadencia_Pago_idCatalogo_Cadencia_Pago, Activo)
       VALUES (?, ?, ?, ?, ?)`,
      [idPersona, fechaIngreso, salario, cadenciaPagoId, aBit(empleado.activo, 1)]
    );

    const idEmpleadoCreado = empResult?.insertId;

   
    for (const t of telefonos) {
      const idTelefono = aNumero(t?.idTelefono);
      const tipoTelefonoId = aNumero(t?.tipoTelefonoId);

      if (!Number.isFinite(idTelefono) || idTelefono <= 0) throw new Error("Teléfono inválido (idTelefono).");
      if (!Number.isFinite(tipoTelefonoId) || tipoTelefonoId <= 0) throw new Error("Debe seleccionar tipo de teléfono.");

      const tipoOk = await existeEnTabla(
        conn,
        `SELECT 1
         FROM Catalogo_Tipo_Telefono
         WHERE idCatalogo_Tipo_Telefono = ? AND Activo = 1`,
        [tipoTelefonoId]
      );
      if (!tipoOk) throw new Error("El tipo de teléfono indicado no existe o está inactivo.");

      
      const telEnUso = await existeEnTabla(conn, `SELECT 1 FROM Telefono WHERE idTelefono = ? AND Activo = 1`, [
        idTelefono,
      ]);
      if (telEnUso) throw new Error(`El teléfono ${idTelefono} ya está registrado.`);

      await conn.query(
        `INSERT INTO Telefono
         (idTelefono, Catalogo_Tipo_Telefono_idCatalogo_Tipo_Telefono, Persona_idPersona, Activo)
         VALUES (?, ?, ?, ?)`,
        [idTelefono, tipoTelefonoId, idPersona, aBit(t?.activo, 1)]
      );
    }

    
    for (const c of correos) {
      const correo = limpiarTexto(c?.correo);
      const tipoCorreoId = aNumero(c?.tipoCorreoId);

      if (!correo) throw new Error("Correo inválido (correo).");
      if (!Number.isFinite(tipoCorreoId) || tipoCorreoId <= 0) throw new Error("Debe seleccionar tipo de correo.");

      const tipoOk = await existeEnTabla(
        conn,
        `SELECT 1
         FROM Catalogo_Tipo_Correo
         WHERE idCatalogo_Tipo_Correo = ? AND Activo = 1`,
        [tipoCorreoId]
      );
      if (!tipoOk) throw new Error("El tipo de correo indicado no existe o está inactivo.");

      
      const correoEnUso = await existeEnTabla(
        conn,
        `SELECT 1 FROM Correo_Electronico WHERE idCorreo_Electronico = ? AND Activo = 1`,
        [correo]
      );
      if (correoEnUso) throw new Error(`El correo ${correo} ya está registrado.`);

      await conn.query(
        `INSERT INTO Correo_Electronico
         (idCorreo_Electronico, Catalogo_Tipo_Correo_idCatalogo_Tipo_Correo, Persona_idPersona, Activo)
         VALUES (?, ?, ?, ?)`,
        [correo, tipoCorreoId, idPersona, aBit(c?.activo, 1)]
      );
    }

    await conn.commit();

    return {
      ok: true,
      mensaje: "Registro personal creado correctamente.",
      data: { idEmpleado: idEmpleadoCreado, idPersona },
    };
  } catch (e) {
    if (tx) await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}


async function listarRegistroPersonal({ texto = "", activo } = {}) {
  const t = limpiarTexto(texto);
  const tieneActivo = activo !== undefined && activo !== null && activo !== "";
  const act = tieneActivo ? aNumero(activo) : null;

  const params = [];
  let where = `WHERE 1=1`;

  if (t) {
    where += `
      AND (
        CAST(e.idEmpleado AS CHAR) LIKE ?
        OR CAST(p.idPersona AS CHAR) LIKE ?
        OR p.Nombre LIKE ?
        OR p.Apellido1 LIKE ?
        OR p.Apellido2 LIKE ?
      )
    `;
    const like = `%${t}%`;
    params.push(like, like, like, like, like);
  }

  if (tieneActivo) {
    const bit = act ? 1 : 0;
    where += ` AND e.Activo = ? AND p.Activo = ?`;
    params.push(bit, bit);
  }

  const [rows] = await db.query(
    `
    SELECT
      e.idEmpleado,
      e.Persona_idPersona AS idPersona,
      e.Fecha_Ingreso AS fechaIngreso,
      e.Salario AS salario,
      e.Catalogo_Cadencia_Pago_idCatalogo_Cadencia_Pago AS cadenciaPagoId,
      ccp.Descripcion AS cadenciaPago,
      e.Activo AS empleadoActivo,

      p.Nombre AS nombre,
      p.Apellido1 AS apellido1,
      p.Apellido2 AS apellido2,
      p.Catalogo_Genero_idCatalogo_Genero AS generoId,
      g.Descripcion_Genero AS genero,
      p.Fecha_Nacimiento AS fechaNacimiento,
      p.CantidadHijos AS cantidadHijos,
      p.Activo AS personaActivo
    FROM Empleado e
    INNER JOIN Persona p ON p.idPersona = e.Persona_idPersona
    LEFT JOIN Catalogo_Genero g ON g.idCatalogo_Genero = p.Catalogo_Genero_idCatalogo_Genero
    LEFT JOIN Catalogo_Cadencia_Pago ccp ON ccp.idCatalogo_Cadencia_Pago = e.Catalogo_Cadencia_Pago_idCatalogo_Cadencia_Pago
    ${where}
    ORDER BY e.idEmpleado DESC
    LIMIT 300
    `,
    params
  );

  return { ok: true, data: rows };
}


async function obtenerRegistroPersonalPorId(idEmpleado) {
  const id = aNumero(idEmpleado);
  if (!Number.isFinite(id) || id <= 0) throw new Error("idEmpleado inválido.");

  const [baseRows] = await db.query(
    `
    SELECT
      e.idEmpleado,
      e.Persona_idPersona AS idPersona,
      e.Fecha_Ingreso AS fechaIngreso,
      e.Salario AS salario,
      e.Catalogo_Cadencia_Pago_idCatalogo_Cadencia_Pago AS cadenciaPagoId,
      ccp.Descripcion AS cadenciaPago,
      e.Activo AS empleadoActivo,

      p.Nombre AS nombre,
      p.Apellido1 AS apellido1,
      p.Apellido2 AS apellido2,
      p.Catalogo_Genero_idCatalogo_Genero AS generoId,
      g.Descripcion_Genero AS genero,
      p.Fecha_Nacimiento AS fechaNacimiento,
      p.CantidadHijos AS cantidadHijos,
      p.Activo AS personaActivo
    FROM Empleado e
    INNER JOIN Persona p ON p.idPersona = e.Persona_idPersona
    LEFT JOIN Catalogo_Genero g ON g.idCatalogo_Genero = p.Catalogo_Genero_idCatalogo_Genero
    LEFT JOIN Catalogo_Cadencia_Pago ccp ON ccp.idCatalogo_Cadencia_Pago = e.Catalogo_Cadencia_Pago_idCatalogo_Cadencia_Pago
    WHERE e.idEmpleado = ?
    LIMIT 1
    `,
    [id]
  );

  if (baseRows.length === 0) {
    return { ok: true, data: null };
  }

  const base = baseRows[0];
  const personaId = base.idPersona;

  const [telefonos] = await db.query(
    `
    SELECT
      t.idTelefono,
      t.Catalogo_Tipo_Telefono_idCatalogo_Tipo_Telefono AS tipoTelefonoId,
      ctt.Descripcion_Tipo_Telefono AS tipoTelefono,
      t.Activo AS activo
    FROM Telefono t
    LEFT JOIN Catalogo_Tipo_Telefono ctt
      ON ctt.idCatalogo_Tipo_Telefono = t.Catalogo_Tipo_Telefono_idCatalogo_Tipo_Telefono
    WHERE t.Persona_idPersona = ?
    ORDER BY t.idTelefono ASC
    `,
    [personaId]
  );

  const [correos] = await db.query(
    `
    SELECT
      c.idCorreo_Electronico AS correo,
      c.Catalogo_Tipo_Correo_idCatalogo_Tipo_Correo AS tipoCorreoId,
      ctc.Descripcion_Tipo_Correo AS tipoCorreo,
      c.Activo AS activo
    FROM Correo_Electronico c
    LEFT JOIN Catalogo_Tipo_Correo ctc
      ON ctc.idCatalogo_Tipo_Correo = c.Catalogo_Tipo_Correo_idCatalogo_Tipo_Correo
    WHERE c.Persona_idPersona = ?
    ORDER BY c.idCorreo_Electronico ASC
    `,
    [personaId]
  );

  return {
    ok: true,
    data: {
      empleado: {
        idEmpleado: base.idEmpleado,
        fechaIngreso: base.fechaIngreso,
        salario: base.salario,
        cadenciaPagoId: base.cadenciaPagoId,
        cadenciaPago: base.cadenciaPago,
        activo: base.empleadoActivo,
      },
      persona: {
        idPersona: base.idPersona,
        nombre: base.nombre,
        apellido1: base.apellido1,
        apellido2: base.apellido2,
        generoId: base.generoId,
        genero: base.genero,
        fechaNacimiento: base.fechaNacimiento,
        cantidadHijos: base.cantidadHijos,
        activo: base.personaActivo,
      },
      telefonos,
      correos,
    },
  };
}


async function actualizarRegistroPersonal(idEmpleado, payload) {
  const conn = await db.getConnection();
  let tx = false;

  try {
    await conn.beginTransaction();
    tx = true;

    const id = aNumero(idEmpleado);
    if (!Number.isFinite(id) || id <= 0) throw new Error("idEmpleado inválido.");

    const [empRows] = await conn.query(
      `SELECT idEmpleado, Persona_idPersona AS idPersona FROM Empleado WHERE idEmpleado = ? LIMIT 1`,
      [id]
    );
    if (empRows.length === 0) throw new Error("Empleado no existe.");

    const personaIdDb = empRows[0].idPersona;

    const persona = payload?.persona || {};
    const empleado = payload?.empleado || {};
    const telefonos = Array.isArray(payload?.telefonos) ? payload.telefonos : null;
    const correos = Array.isArray(payload?.correos) ? payload.correos : null;

    
    const idPersonaPayload = aNumero(persona.idPersona);
    if (!Number.isFinite(idPersonaPayload) || idPersonaPayload !== personaIdDb) {
      throw new Error("idPersona no coincide con el empleado. No se permite cambiar la identificación.");
    }

    
    const generoId = aNumero(persona.generoId);

    const cantidadHijosRaw = persona.cantidadHijos;
    const cantidadHijos =
      cantidadHijosRaw === undefined || cantidadHijosRaw === null || cantidadHijosRaw === ""
        ? 0
        : aNumero(cantidadHijosRaw);

    const nombre = limpiarTexto(persona.nombre);
    const apellido1 = limpiarTexto(persona.apellido1);
    const apellido2 = limpiarTexto(persona.apellido2);
    const fechaNacimiento = toDate(persona.fechaNacimiento);

    if (!nombre || !apellido1 || !apellido2) throw new Error("Faltan datos de persona (nombre/apellidos).");
    if (!Number.isFinite(generoId) || generoId <= 0) throw new Error("Género (generoId) inválido.");
    if (!fechaNacimiento) throw new Error("Debe indicar fecha de nacimiento (YYYY-MM-DD).");
    if (!Number.isFinite(cantidadHijos) || cantidadHijos < 0) throw new Error("CantidadHijos inválida.");

   
    const edad = calcularEdad(fechaNacimiento);
    if (!Number.isFinite(edad)) throw new Error("Fecha de nacimiento inválida.");
    if (edad < 18) throw new Error("No se permite registrar empleados menores de 18 años.");

    const generoOk = await existeEnTabla(
      conn,
      `SELECT 1 FROM Catalogo_Genero WHERE idCatalogo_Genero = ? AND Activo = 1`,
      [generoId]
    );
    if (!generoOk) throw new Error("El género indicado no existe o está inactivo.");

    await conn.query(
      `
      UPDATE Persona
      SET Nombre = ?,
          Apellido1 = ?,
          Apellido2 = ?,
          Catalogo_Genero_idCatalogo_Genero = ?,
          Fecha_Nacimiento = ?,
          CantidadHijos = ?,
          Activo = ?
      WHERE idPersona = ?
      `,
      [nombre, apellido1, apellido2, generoId, fechaNacimiento, cantidadHijos, aBit(persona.activo, 1), personaIdDb]
    );

   
    const fechaIngreso = toDate(empleado.fechaIngreso);
    const salario = aNumero(empleado.salario);

    if (!fechaIngreso) throw new Error("Debe indicar fecha de ingreso (YYYY-MM-DD).");
    if (!Number.isFinite(salario)) throw new Error("Salario inválido.");

    const cadenciaPagoId = await obtenerCadenciaPagoId(conn, empleado);

    await conn.query(
      `
      UPDATE Empleado
      SET Fecha_Ingreso = ?,
          Salario = ?,
          Catalogo_Cadencia_Pago_idCatalogo_Cadencia_Pago = ?,
          Activo = ?
      WHERE idEmpleado = ?
      `,
      [fechaIngreso, salario, cadenciaPagoId, aBit(empleado.activo, 1), id]
    );

   
    if (telefonos !== null) {
      await conn.query(`UPDATE Telefono SET Activo = 0 WHERE Persona_idPersona = ?`, [personaIdDb]);

      for (const t of telefonos) {
        const idTelefono = aNumero(t?.idTelefono);
        const tipoTelefonoId = aNumero(t?.tipoTelefonoId);

        if (!Number.isFinite(idTelefono) || idTelefono <= 0) throw new Error("Teléfono inválido (idTelefono).");
        if (!Number.isFinite(tipoTelefonoId) || tipoTelefonoId <= 0)
          throw new Error("Debe seleccionar tipo de teléfono.");

        const tipoOk = await existeEnTabla(
          conn,
          `SELECT 1 FROM Catalogo_Tipo_Telefono WHERE idCatalogo_Tipo_Telefono = ? AND Activo = 1`,
          [tipoTelefonoId]
        );
        if (!tipoOk) throw new Error("El tipo de teléfono indicado no existe o está inactivo.");

        
        const telEnUso = await existeEnTabla(
          conn,
          `SELECT 1 FROM Telefono
           WHERE idTelefono = ? AND Persona_idPersona <> ? AND Activo = 1`,
          [idTelefono, personaIdDb]
        );
        if (telEnUso) throw new Error(`El teléfono ${idTelefono} ya está registrado por otra persona.`);

        await conn.query(
          `
          INSERT INTO Telefono
            (idTelefono, Catalogo_Tipo_Telefono_idCatalogo_Tipo_Telefono, Persona_idPersona, Activo)
          VALUES (?, ?, ?, 1)
          ON DUPLICATE KEY UPDATE
            Catalogo_Tipo_Telefono_idCatalogo_Tipo_Telefono = VALUES(Catalogo_Tipo_Telefono_idCatalogo_Tipo_Telefono),
            Activo = 1
          `,
          [idTelefono, tipoTelefonoId, personaIdDb]
        );
      }
    }

   
    if (correos !== null) {
      await conn.query(`UPDATE Correo_Electronico SET Activo = 0 WHERE Persona_idPersona = ?`, [personaIdDb]);

      for (const c of correos) {
        const correo = limpiarTexto(c?.correo);
        const tipoCorreoId = aNumero(c?.tipoCorreoId);

        if (!correo) throw new Error("Correo inválido (correo).");
        if (!Number.isFinite(tipoCorreoId) || tipoCorreoId <= 0) throw new Error("Debe seleccionar tipo de correo.");

        const tipoOk = await existeEnTabla(
          conn,
          `SELECT 1 FROM Catalogo_Tipo_Correo WHERE idCatalogo_Tipo_Correo = ? AND Activo = 1`,
          [tipoCorreoId]
        );
        if (!tipoOk) throw new Error("El tipo de correo indicado no existe o está inactivo.");

        const correoEnUso = await existeEnTabla(
          conn,
          `SELECT 1 FROM Correo_Electronico
           WHERE idCorreo_Electronico = ? AND Persona_idPersona <> ? AND Activo = 1`,
          [correo, personaIdDb]
        );
        if (correoEnUso) throw new Error(`El correo ${correo} ya está registrado por otra persona.`);

        await conn.query(
          `
          INSERT INTO Correo_Electronico
            (idCorreo_Electronico, Catalogo_Tipo_Correo_idCatalogo_Tipo_Correo, Persona_idPersona, Activo)
          VALUES (?, ?, ?, 1)
          ON DUPLICATE KEY UPDATE
            Catalogo_Tipo_Correo_idCatalogo_Tipo_Correo = VALUES(Catalogo_Tipo_Correo_idCatalogo_Tipo_Correo),
            Activo = 1
          `,
          [correo, tipoCorreoId, personaIdDb]
        );
      }
    }

    await conn.commit();
    return { ok: true, mensaje: "Registro personal actualizado correctamente." };
  } catch (e) {
    if (tx) await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}


async function desactivarRegistroPersonal(idEmpleado) {
  const conn = await db.getConnection();
  let tx = false;

  try {
    await conn.beginTransaction();
    tx = true;

    const id = aNumero(idEmpleado);
    if (!Number.isFinite(id) || id <= 0) throw new Error("idEmpleado inválido.");

    const [empRows] = await conn.query(
      `SELECT idEmpleado, Persona_idPersona AS idPersona FROM Empleado WHERE idEmpleado = ? LIMIT 1`,
      [id]
    );
    if (empRows.length === 0) throw new Error("Empleado no existe.");

    const personaId = empRows[0].idPersona;

    await conn.query(`UPDATE Empleado SET Activo = 0 WHERE idEmpleado = ?`, [id]);
    await conn.query(`UPDATE Persona SET Activo = 0 WHERE idPersona = ?`, [personaId]);
    await conn.query(`UPDATE Telefono SET Activo = 0 WHERE Persona_idPersona = ?`, [personaId]);
    await conn.query(`UPDATE Correo_Electronico SET Activo = 0 WHERE Persona_idPersona = ?`, [personaId]);

    
    await conn.query(`UPDATE Usuario SET Activo = 0, Bloqueado = 1 WHERE Empleado_idEmpleado = ?`, [id]);

    await conn.commit();
    return { ok: true, mensaje: "Registro personal desactivado correctamente." };
  } catch (e) {
    if (tx) await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = {
  crearRegistroPersonal,
  listarRegistroPersonal,
  obtenerRegistroPersonalPorId,
  actualizarRegistroPersonal,
  desactivarRegistroPersonal,
};
