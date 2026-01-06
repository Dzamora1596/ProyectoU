//Protege rutas en la aplicación según la autenticación y roles de usuario con React Router
import { Navigate } from 'react-router-dom'; //React-Router-Dom es una librería que permite la navegación entre diferentes componentes en una aplicación React

const ProtectedRoute = ({ children, roles }) => {//children  funciona como un contenedor para los componentes que queremos proteger y viene de las props que son las propiedades que se pasan a un componente de React
  const usuario = JSON.parse(localStorage.getItem('usuario')); 

  if (!usuario) return <Navigate to="/login" />;

  if (roles && !roles.includes(usuario.rol)) {
    return <Navigate to="/no-autorizado" />;
  }

  return children;
};

export default ProtectedRoute;

//jwt es un estándar abierto para compartir información de forma segura entre el cliente y el servidor como un objeto JSON.