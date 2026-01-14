//Inicio.jsx
export default function Inicio() {
  return (
    <div className="p-3 d-flex justify-content-center align-items-center" style={{ minHeight: "calc(100vh - 24px)" }}>
      <img
        src="/ImagenInicio.png"
        alt="Inicio"
        style={{
          width: "100%",
          maxWidth: 1100,
          maxHeight: "85vh",
          objectFit: "contain",
          borderRadius: 12,
        }}
      />
    </div>
  );
}
