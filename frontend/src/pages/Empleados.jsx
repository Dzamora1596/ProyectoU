//Pagina para gestionar empleados
import { useEffect, useState } from 'react';
import { obtenerEmpleados } from '../services/empleadoService';
// Funcion para la página de empleados
function Empleados() {
  const [empleados, setEmpleados] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const cargarEmpleados = async () => {
      try {
        const data = await obtenerEmpleados();
        setEmpleados(data);
      } catch (err) {
        console.error(err);
        setError('Error al cargar empleados');
      }
    };
// Llama a la función para cargar empleados al montar el componente
    cargarEmpleados();
  }, []);

  if (error) return <p>{error}</p>;

  return (
    <div>
      <h1>Listado de Empleados</h1>

      <table border="1" cellPadding="5">
        <thead>
          <tr>
            <th>ID</th>
            <th>Fecha Ingreso</th>
            <th>Activo</th>
          </tr>
        </thead>
        <tbody>
          {empleados.map((emp) => (
            <tr key={emp.idEmpleado}>
              <td>{emp.idEmpleado}</td>
              <td>{emp.FechaIngreso}</td>
              <td>{emp.Activo ? 'Sí' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Empleados;
