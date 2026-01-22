import React from "react";
import DataTableModule, { createTheme } from "react-data-table-component";

 createTheme('marenco', {
  text: {
    primary: '#1a1a1b',     
    secondary: '#6c757d',
  },
  background: {
    default: '#ffffff',
  },
  context: {
    background: '#9e1b1e',  
    text: '#FFFFFF',
  },
  divider: {
    default: '#e3e6f0',
  },
  button: {
    default: '#9e1b1e',
    hover: 'rgba(0,0,0,.08)',
    focus: 'rgba(255,255,255,.12)',
    disabled: 'rgba(255, 255, 255, .34)',
  },
  sortFocus: {
    default: '#9e1b1e',
  },
}, 'light');

 const customStyles = {
  header: {
    style: {
      minHeight: '56px',
    },
  },
  headRow: {
    style: {
      borderTopStyle: 'solid',
      borderTopWidth: '1px',
      borderTopColor: '#e3e6f0',
      backgroundColor: '#f8f9fc',
    },
  },
  headCells: {
    style: {
      fontWeight: 'bold',
      fontSize: '0.85rem',
      color: '#1a1a1b',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    },
  },
  cells: {
    style: {
      fontSize: '0.9rem',
      paddingTop: '12px',
      paddingBottom: '12px',
    },
  },
  rows: {
    style: {
      '&:not(:last-of-type)': {
        borderBottomStyle: 'solid',
        borderBottomWidth: '1px',
        borderBottomColor: '#e3e6f0',
      },
    },
  },
};

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

  return (
    <Comp 
      theme="marenco"
      customStyles={customStyles}
      paginationComponentOptions={{
        rowsPerPageText: 'Filas por página:',
        rangeSeparatorText: 'de',
        noRowsPerPage: false,
        selectAllRowsItem: false,
      }}
      noDataComponent={
        <div className="p-4 text-muted">No hay registros para mostrar</div>
      }
      {...props} 
    />
  );
}