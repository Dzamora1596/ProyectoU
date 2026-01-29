// frontend/src/pages/Inicio.jsx
import React from "react";

export default function Inicio() {
  return (
    <div className="container-fluid">
      <div className="card border-0 shadow-sm overflow-hidden">
        <div className="card-body p-3 p-md-4">
          <div className="d-flex align-items-center justify-content-center">
            <img
              src="/ImagenInicio.png"
              alt="Inicio"
              className="img-fluid"
              style={{
                maxWidth: "1100px",
                width: "100%",
                maxHeight: "90vh",
                objectFit: "contain",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
