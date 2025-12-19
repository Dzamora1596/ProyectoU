import { useAutenticar } from './context/autenticarContext';
import Login from './pages/Login';
import EmpleadoTable from './components/empleados/EmpleadoTable';

function App() {
  const { token } = useAutenticar();

  if (!token) {
    return <Login />;
  }

  return (
    <div>
      <h1>Sistema de Planilla</h1>
      <EmpleadoTable />
    </div>
  );
}

export default App;
