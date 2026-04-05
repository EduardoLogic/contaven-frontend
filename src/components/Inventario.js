import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Inventario = () => {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);

  // 1. Función para obtener datos del Backend (NestJS)
  const obtenerProductos = async () => {
    try {
      const respuesta = await axios.get('http://localhost:3000/productos');
      setProductos(respuesta.data);
      setCargando(false);
    } catch (error) {
      console.error("Error al conectar con el servidor", error);
      setCargando(false);
    }
  };

  useEffect(() => {
    obtenerProductos();
  }, []);

  if (cargando) return <p>Cargando inventario...</p>;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h2>📦 Inventario de Productos - ContaVen</h2>
      
      <table border="1" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f4f4f4' }}>
            <th style={{ padding: '10px' }}>ID</th>
            <th>Producto</th>
            <th>Precio (USD)</th>
            <th>Stock</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {productos.length === 0 ? (
            <tr>
              <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                No hay productos. ¡Agrega el primero desde el Backend!
              </td>
            </tr>
          ) : (
            productos.map((prod) => (
              <tr key={prod.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '10px' }}>{prod.id}</td>
                <td>{prod.nombre}</td>
                <td>${parseFloat(prod.precio_usd).toFixed(2)}</td>
                <td style={{ color: prod.stock < 10 ? 'red' : 'black', fontWeight: 'bold' }}>
                  {prod.stock}
                </td>
                <td>
                  {prod.stock > 0 ? '✅ Disponible' : '❌ Agotado'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Inventario;