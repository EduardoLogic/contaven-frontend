import React, { useState, useEffect } from 'react';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState(''); 
  const [isRegistering, setIsRegistering] = useState(false);

  // 🧹 EFECTO PARA RESETEAR CAMPOS
  useEffect(() => {
    setUsername('');
    setPassword('');
    setEmail('');
  }, [isRegistering]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 🌐 DETECCIÓN INTELIGENTE DE LA API
    // Si la web corre en tu PC (localhost), usa el puerto 3000. 
    // Si corre en internet, usa tu servidor de Render.
    const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://127.0.0.1:3000' 
      : 'https://contaven-backend.onrender.com';

    const endpoint = isRegistering ? 'register' : 'login';
    const url = `${API_BASE_URL}/auth/${endpoint}`;

    const bodyData = { nombre_usuario: username, password: password };
    if (isRegistering) bodyData.email = email; 

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });

      const data = await response.json();

      if (response.ok) {
        if (isRegistering) {
          alert("🎉 ¡Registro exitoso! Se te han otorgado 30 días de licencia gratuita para ContaVen. Ahora inicia sesión.");
          setIsRegistering(false);
        } else {
          // GUARDAR DATOS: Importante para el Dashboard
          localStorage.setItem('usuario', JSON.stringify(data));
          onLoginSuccess();
        }
      } else {
        alert("Error: " + (data.message || "Revisa los datos"));
      }
    } catch (error) {
      console.error("Error en login/registro:", error);
      alert("Error de conexión con el servidor. Verifica que el backend esté activo.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div className="bg-wunari-purple p-8 text-center">
            <h1 className="text-3xl font-bold text-white tracking-tight italic">
              {isRegistering ? 'Registro ContaVen' : 'Created by Eduardo'}
            </h1>
        </div>
        
        <form className="p-8 space-y-4" onSubmit={handleSubmit}>
          {isRegistering && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-wunari-purple outline-none" 
                required={isRegistering}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Usuario</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Tu usuario" 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-wunari-purple outline-none" 
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-wunari-purple outline-none" 
              required
            />
          </div>

          <button type="submit" className={`w-full py-3 ${isRegistering ? 'bg-blue-600' : 'bg-wunari-purple'} text-white font-bold rounded-lg transition-all`}>
            {isRegistering ? 'Crear Cuenta' : 'Entrar'}
          </button>
        </form>

        <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
          <button onClick={() => setIsRegistering(!isRegistering)} className="text-wunari-purple font-black text-sm uppercase hover:underline">
            {isRegistering ? 'Volver al Login' : 'Registrarse aquí'}
          </button>
        </div>
      </div>
    </div>
  );
}