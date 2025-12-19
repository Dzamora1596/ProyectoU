export async function loginRequest(usuario, password) {
  const res = await fetch('http://localhost:4000/api/autenticar/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, password }),
  });

  if (!res.ok) {
    throw new Error('Login incorrecto');
  }

  return res.json();
}
