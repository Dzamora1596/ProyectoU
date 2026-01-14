// catalogosApi.js
import cliente from "./cliente";

 
export async function obtenerCatalogosRegistroPersonal() {
   
  return await cliente.get("/catalogos/registro-personal");
}

 
export async function obtenerCatalogosRoles() {
   
  return await cliente.get("/catalogos/roles");
}
