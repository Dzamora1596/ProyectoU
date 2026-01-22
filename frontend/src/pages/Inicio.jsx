import React from "react";

export default function Inicio() {
  return (
    <div 
      className="d-flex justify-content-center align-items-center" 
      style={{ 
        minHeight: "calc(100vh - 100px)", 
        backgroundColor: "var(--dm-gray-light)",  
        overflow: "hidden"
      }}
    >
      <img
        src="/ImagenInicio.png"
        alt="Inicio"
        style={{
          width: "100%",
          maxWidth: "1100px",
          maxHeight: "85vh",
          objectFit: "contain",
          maskImage: "radial-gradient(circle, black 100%, transparent 95%)",
          WebkitMaskImage: "radial-gradient(circle, black 100%, transparent 100%)",
            
          border: "none"
        }}
      />
    </div>
  );
}