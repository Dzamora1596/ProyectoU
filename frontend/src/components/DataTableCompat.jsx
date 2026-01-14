//dataTableCompat.jsx
import DataTableModule from "react-data-table-component";

export default function DataTableCompat(props) {
  
  const Comp = DataTableModule?.default ?? DataTableModule;

   
  if (typeof Comp !== "function") {
    console.error("DataTableCompat: import inválido:", DataTableModule);
    return (
      <div className="alert alert-warning m-0">
        No se pudo cargar react-data-table-component como componente. Revisá consola.
      </div>
    );
  }

  return <Comp {...props} />;
}
