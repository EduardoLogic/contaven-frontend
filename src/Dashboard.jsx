import React, { useState, useEffect } from 'react';

const Dashboard = ({ onLogout }) => {
  // ==========================================
  // 1. ESTADOS
  // ==========================================
  const [view, setView] = useState('menu'); 
  const [productos, setProductos] = useState([]); 
  const [carrito, setCarrito] = useState([]); 
  const [historial, setHistorial] = useState([]); 
  const [tasaBCV, setTasaBCV] = useState(36.50); 
  const [busqueda, setBusqueda] = useState("");
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);
  const [datosUltimaVenta, setDatosUltimaVenta] = useState(null); 
  const [metodoPago, setMetodoPago] = useState(""); 
  const [mostrarTicketFinal, setMostrarTicketFinal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editandoProducto, setEditandoProducto] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [user, setUser] = useState(null);

  // --- CONFIGURACIÓN DE NEGOCIO ---
  const [config, setConfig] = useState({
    impuesto: 16, // IVA %
    descuento: 0,  // Descuento %
    nombreNegocio: "CONTAVEN"
  });

  // --- FILTROS DE INFORMES ---
  const [filtroFecha, setFiltroFecha] = useState({ inicio: '', fin: '' });

  // --- ESTADO CONVERSOR REGISTRO ---
  const [inputPrecio, setInputPrecio] = useState({ usd: 0, ves: 0 });

  const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:3000' 
    : 'https://contaven-backend.onrender.com';

  // ==========================================
  // 🚨 FUNCIÓN DE APOYO (DEBE IR ANTES DE LOS EFECTOS)
  // ==========================================
  const calcularDiasRestantes = () => {
    if (user) console.log("Estructura completa del user:", user);
    const listaLicencias = user?.licencias || user?.usuario?.licencias;
    if (!listaLicencias || listaLicencias.length === 0) return 0;

    const fechaVencimiento = listaLicencias[0].fecha_vencimiento;
    if (!fechaVencimiento) return 0;

    const hoy = new Date();
    const vencimiento = new Date(fechaVencimiento);
    const diff = vencimiento - hoy;
    const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return dias > 0 ? dias : 0;
  };

  // ==========================================
  // 2. EFECTOS
  // ==========================================
  useEffect(() => {
    const inicializarDashboard = async () => {
      // 1. Cargar Tasa BCV
      try {
        const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        const data = await response.json();
        setTasaBCV(data.promedio);
      } catch (error) {
        setTasaBCV(36.50);
      }

      // 2. CARGAR USUARIO
      const datosUsuario = localStorage.getItem('usuario'); 
      if (datosUsuario) {
        const userParsed = JSON.parse(datosUsuario);
        setUser(userParsed); 
        console.log("DATOS EN LOCALSTORAGE:", userParsed);
        
        const id = userParsed.id || userParsed.usuario?.id;
        ejecutarCargaInicial(id);
      }
    };

    inicializarDashboard();
  }, []);

  const ejecutarCargaInicial = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/productos?usuarioId=${id}`);
      const data = await response.json();
      setProductos(Array.isArray(data) ? data : []);
    } catch (e) { console.error("Error en carga inicial:", e); }
  };

  // ==========================================
  // 3. FUNCIONES DE LÓGICA
  // ==========================================



  // --- 3.1. PRODUCTOS: CARGAR DESDE DB ---
  const cargarProductos = async (proximaVista) => {
    const idActivo = user?.id || user?.usuario?.id; 
    if (!idActivo) return; 
    try {
      const response = await fetch(`${API_BASE_URL}/productos?usuarioId=${idActivo}`);
      if (!response.ok) throw new Error("Error en respuesta de productos");
      const data = await response.json();
      setProductos(Array.isArray(data) ? data : []);
      if (proximaVista) setView(proximaVista);
    } catch (error) {
      console.error("Error al cargar productos:", error);
      setProductos([]); 
    }
  };

  // --- 3.2. PRODUCTOS: REGISTRAR NUEVO ---
  const registrarNuevoProducto = async (datos) => {
    const datosConUsuario = { 
      ...datos, 
      creado_por: user?.id || user?.usuario?.id 
    };

    try {
      const response = await fetch(`${API_BASE_URL}/productos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosConUsuario) 
      });

      if (response.ok) {
        alert("✅ Producto registrado exitosamente");
        await cargarProductos('inventario');
        setInputPrecio({ usd: 0, ves: 0 });
      } else {
        alert("Error al guardar el producto");
      }
    } catch (error) {
      alert("Error de conexión al registrar");
    }
  };

  // --- 3.3. PRODUCTOS: ACTUALIZAR EXISTENTE ---
  const actualizarProducto = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/productos/${editandoProducto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editandoProducto)
      });

      if (response.ok) {
        alert("✅ Producto actualizado");
        setEditandoProducto(null);
        await cargarProductos('inventario');
      }
    } catch (error) {
      alert("Error al actualizar");
    }
  };

  // --- 3.4. PRODUCTOS: ELIMINAR ---
  const eliminarProducto = async (id) => {
    if(!confirm("¿Deseas eliminar permanentemente este producto?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/productos/${id}`, { method: 'DELETE' });
      if(response.ok) {
        setProductos(productos.filter(p => p.id !== id));
      }
    } catch (error) { alert("Error al eliminar"); }
  };

  // --- 3.5. CARRITO: AGREGAR ITEM ---
  const agregarAlCarrito = (producto) => {
    if (producto.stock <= 0) return alert("⚠️ Producto agotado");
    
    setCarrito(prevCarrito => {
      const existe = prevCarrito.find(item => item.id === producto.id);
      if (existe) {
        if (existe.cantidad >= producto.stock) {
          alert("No hay más stock disponible");
          return prevCarrito;
        }
        return prevCarrito.map(item => 
          item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
        );
      }
      return [...prevCarrito, { ...producto, cantidad: 1 }];
    });
  };

  // --- 3.6. VENTAS: CALCULAR TOTALES (MOTOR) ---
  const calcularTotal = () => {
    const subtotal = carrito.reduce((acc, item) => acc + (Number(item.precio_usd) * item.cantidad), 0);
    const montoDescuento = subtotal * (config.descuento / 100);
    const baseImponible = subtotal - montoDescuento;
    const montoImpuesto = baseImponible * (config.impuesto / 100);
    const totalFinalUSD = baseImponible + montoImpuesto;

    return {
      subtotal: subtotal.toFixed(2),
      descuento: montoDescuento.toFixed(2),
      impuesto: montoImpuesto.toFixed(2),
      usd: totalFinalUSD.toFixed(2),
      ves: (totalFinalUSD * tasaBCV).toFixed(2)
    };
  };

  // --- 3.7. VENTAS: PROCESAR COBRO Y TICKET ---
  const registrarVenta = async () => {
    const dias = calcularDiasRestantes();
    const licencias = user?.licencias || user?.usuario?.licencias;
    const estadoLicencia = licencias?.[0]?.estado;

    if (dias <= 0 || estadoLicencia === 'bloqueada' || estadoLicencia === 'expirada') {
      return alert("❌ Tu licencia ha vencido o está bloqueada.");
    }

    if (carrito.length === 0 || !metodoPago) return alert("Faltan datos");

    const totales = calcularTotal();
    const datosVenta = {
      usuarioId: user?.id || user?.usuario?.id,
      productos: carrito.map(item => ({ 
        id: item.id, 
        cantidad: item.cantidad, 
        precio_al_momento_usd: parseFloat(item.precio_usd) 
      })),
      total_usd: parseFloat(totales.usd),
      tasa_bcv: parseFloat(tasaBCV),
      metodo_pago: metodoPago,
      iva_aplicado: parseFloat(config.impuesto),
      descuento_aplicado: parseFloat(config.descuento)
    };

    try {
      const response = await fetch(`${API_BASE_URL}/venta/cobrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosVenta)
      });

      if (response.ok) {
        const res = await response.json();
        setDatosUltimaVenta({
          ...res,
          total_usd: totales.usd,
          tasa_bcv: tasaBCV,
          detalles: carrito 
        });
        setMostrarTicketFinal(true); 
      }
    } catch (error) { alert("Error de conexión"); }
  };

  // --- 3.8. VENTAS: FINALIZAR Y LIMPIAR ---
  const limpiarParaNuevaVenta = () => {
    setCarrito([]); 
    setMetodoPago(''); 
    setMostrarTicketFinal(false); 
    setDatosUltimaVenta(null);
    cargarProductos(); 
    console.log("Sistema listo para la siguiente venta");
  };

  // --- 3.9. HISTORIAL: CARGAR Y FILTRAR ---
  const cargarHistorial = async (vistasiguiente = 'historial') => {
    const idActivo = user?.id || user?.usuario?.id;
    try {
      const response = await fetch(`${API_BASE_URL}/venta/historial?usuarioId=${idActivo}`);
      const data = await response.json();
      setHistorial(Array.isArray(data) ? data : []);
      setView(vistasiguiente); 
    } catch (error) {
      console.error("Error historial:", error);
    }
  };

  const obtenerVentasFiltradas = () => {
    if (!Array.isArray(historial)) return [];
    if (!filtroFecha.inicio || !filtroFecha.fin) return historial;
    return historial.filter(v => {
      const f = new Date(v.fecha).toISOString().split('T')[0];
      return f >= filtroFecha.inicio && f <= filtroFecha.fin;
    });
  };

  // --- 3.10. FILTROS DINÁMICOS (BUSCADOR Y CATEGORÍA) ---
  const categoriasUnicas = ['Todas', ...new Set(productos.map(p => p.categoria || 'Sin Categoría'))];

  const productosInventario = productos.filter(p => {
    const coincideNombre = (p.nombre || "").toLowerCase().includes(busqueda.toLowerCase());
    const coincideCategoria = filtroCategoria === 'Todas' || p.categoria === filtroCategoria;
    return coincideNombre && coincideCategoria;
  });




  // ==========================================
  // 4. RENDERIZADO (ESTRUCTURA COMPLETA ETIQUETADA)
  // ==========================================
  return (
    <div className="min-h-screen flex bg-slate-100 font-sans text-slate-800">
      
      {/* 4.0. SIDEBAR (MENÚ LATERAL) */}
      {/* AGREGAMOS EL OVERLAY AQUÍ: Si el sidebar está abierto en móvil, esta capa cierra al tocar afuera */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-[100] w-64 bg-slate-900 text-white transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 lg:relative lg:translate-x-0 shadow-2xl`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-black italic text-blue-400">Eduardo POS</h1>
            {/* BOTÓN "X" PARA CERRAR EN MÓVIL */}
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
              ✕
            </button>
          </div>
          <p className="text-[10px] tracking-widest opacity-50 uppercase mb-10 text-center">SISTEMA DE POS</p>
          
          <nav className="space-y-2">
              <button onClick={() => { setView('menu'); setSidebarOpen(false); }} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold text-sm transition-all ${view === 'menu' ? 'bg-blue-600 shadow-lg text-white' : 'hover:bg-white/5 text-slate-400'}`}>
                <span>🏠</span> Inicio
              </button>
              
              <button onClick={() => { cargarProductos('venta'); setSidebarOpen(false); }} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold text-sm transition-all ${view === 'venta' ? 'bg-blue-600 shadow-lg text-white' : 'hover:bg-white/5 text-slate-400'}`}>
                <span>🛒</span> Ventas
              </button>

              <button onClick={() => { setView('registro'); setSidebarOpen(false); }} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold text-sm transition-all ${view === 'registro' ? 'bg-purple-600 shadow-lg text-white' : 'hover:bg-white/5 text-slate-400'}`}>
                <span>➕</span> Agregar Producto
              </button>

              <button onClick={() => { cargarProductos('inventario'); setSidebarOpen(false); }} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold text-sm transition-all ${view === 'inventario' ? 'bg-blue-600 shadow-lg text-white' : 'hover:bg-white/5 text-slate-400'}`}>
                <span>📦</span> Inventario
              </button>

              <button onClick={() => { cargarHistorial('historial'); setSidebarOpen(false); }} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold text-sm transition-all ${view === 'historial' ? 'bg-blue-600 shadow-lg text-white' : 'hover:bg-white/5 text-slate-400'}`}>
                <span>📜</span> Historial
              </button>

              <button onClick={() => { setView('config'); setSidebarOpen(false); }} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-bold text-sm transition-all ${view === 'config' ? 'bg-blue-600 shadow-lg text-white' : 'hover:bg-white/5 text-slate-400'}`}>
                <span>⚙️</span> Configuración
              </button>
          </nav>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* 4.1. HEADER (BARRA SUPERIOR) */}
        <header className="bg-white border-b p-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-2xl p-2 bg-slate-100 rounded-lg">☰</button>
          
          <div className="flex-1 px-4 hidden lg:block">
            <h2 className="font-black uppercase text-[10px] text-slate-400 tracking-widest italic">Dashboard / {view}</h2>
          </div>

          {/* INDICADOR DE LICENCIA DINÁMICO */}
          <div className={`mr-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${
            calcularDiasRestantes() <= 5 
              ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' 
              : 'bg-green-50 text-green-600 border-green-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${calcularDiasRestantes() <= 5 ? 'bg-red-500' : 'bg-green-500'}`}></span>
            {calcularDiasRestantes()} días restantes
          </div>

          <div className="flex items-center gap-4 bg-blue-50 px-4 py-2 rounded-2xl border border-blue-100">
            <div className="text-right">
                <p className="text-[9px] font-black text-blue-400 uppercase leading-none">Tasa Oficial</p>
                <p className="text-sm font-black text-blue-700 leading-none mt-1">{tasaBCV.toFixed(2)} Bs</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-md uppercase">
                {user?.nombre_usuario?.substring(0, 2) || 'EA'}
            </div>
          </div>
        </header>

        <main className="p-4 md:p-8 overflow-y-auto">
          
          {/* 4.2. VISTA: MENÚ PRINCIPAL (BOTONES DE ACCESO RÁPIDO) */}
          {view === 'menu' && (
            <div className="animate-in fade-in zoom-in-95 duration-500">
              <div className="mb-10 text-center lg:text-left">
                <h1 className="text-4xl font-black text-slate-800 tracking-tighter uppercase italic">Panel de Control</h1>
                <p className="text-slate-500 font-bold text-xs mt-1 tracking-widest">BIENVENIDO A {config.nombreNegocio.toUpperCase()}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                <button onClick={() => { cargarProductos('venta'); }} className="bg-white p-8 rounded-[2.5rem] shadow-xl border-b-[12px] border-green-500 hover:scale-105 transition-all group">
                  <span className="text-5xl block mb-4">🛒</span>
                  <span className="text-lg font-black uppercase text-slate-700">Nueva Venta</span>
                </button>
                <button onClick={() => setView('registro')} className="bg-white p-8 rounded-[2.5rem] shadow-xl border-b-[12px] border-purple-500 hover:scale-105 transition-all group">
                  <span className="text-5xl block mb-4">➕</span>
                  <span className="text-lg font-black uppercase text-slate-700">Registrar</span>
                </button>
                <button onClick={() => { cargarProductos('inventario'); }} className="bg-white p-8 rounded-[2.5rem] shadow-xl border-b-[12px] border-blue-500 hover:scale-105 transition-all group">
                  <span className="text-5xl block mb-4">📦</span>
                  <span className="text-lg font-black uppercase text-slate-700">Stock</span>
                </button>
                <button onClick={() => cargarHistorial('historial')} className="bg-white p-8 rounded-[2.5rem] shadow-xl border-b-[12px] border-orange-500 hover:scale-105 transition-all group">
                  <span className="text-5xl block mb-4">📜</span>
                  <span className="text-lg font-black uppercase text-slate-700">Historial</span>
                </button>
                <button onClick={() => cargarHistorial('informes')} className="bg-white p-8 rounded-[2.5rem] shadow-xl border-b-[12px] border-cyan-500 hover:scale-105 transition-all group">
                  <span className="text-5xl block mb-4">📊</span>
                  <span className="text-lg font-black uppercase text-slate-700">Informes</span>
                </button>
              </div>
            </div>
          )}

          {/* 4.3. VISTA: CONFIGURACIÓN */}
          {view === 'config' && (
            <div className="max-w-2xl bg-white p-10 rounded-[3rem] shadow-xl border animate-in slide-in-from-bottom-4">
              <h3 className="text-xl font-black uppercase mb-8 border-b pb-4 italic text-slate-400 tracking-tighter">Ajustes Generales</h3>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IVA Aplicable (%)</label>
                  <input type="number" value={config.impuesto} onChange={(e)=>setConfig({...config, impuesto: e.target.value})} className="w-full bg-slate-100 p-4 rounded-2xl mt-2 font-bold focus:ring-2 ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descuento Global (%)</label>
                  <input type="number" value={config.descuento} onChange={(e)=>setConfig({...config, descuento: e.target.value})} className="w-full bg-slate-100 p-4 rounded-2xl mt-2 font-bold focus:ring-2 ring-blue-500 outline-none" />
                </div>
                <button onClick={()=>alert("Configuración Guardada")} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-lg uppercase transition-all active:scale-95">Guardar Cambios</button>
              </div>
            </div>
          )}

          {/* 4.4. VISTA: REGISTRO DE STOCK (ENTRADA) */}
          {view === 'registro' && (
            <div className="max-w-4xl mx-auto bg-white p-10 rounded-[3rem] shadow-2xl border animate-in zoom-in-95">
              <h3 className="text-xl font-black uppercase mb-8 italic text-slate-400 tracking-tighter">📥 Ingreso de Mercancía</h3>
              <form className="grid grid-cols-1 md:grid-cols-2 gap-8" onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.target);
                  registrarNuevoProducto({
                    nombre: f.get('nombre'),
                    precio_usd: parseFloat(inputPrecio.usd),
                    stock: parseInt(f.get('stock')),
                    categoria: f.get('categoria')
                  });
                  e.target.reset();
                }}>
                <div className="space-y-4">
                  <input name="nombre" placeholder="Nombre del Producto" className="w-full bg-slate-50 p-4 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none font-bold shadow-inner" required />
                  <input name="categoria" placeholder="Categoría" className="w-full bg-slate-50 p-4 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none font-bold shadow-inner" required />
                  <input name="stock" type="number" placeholder="Stock Inicial" className="w-full bg-slate-50 p-4 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none font-bold shadow-inner" required />
                </div>
                <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white space-y-4 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl font-black italic">REGISTRAR</div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Precio USD ($)</label>
                    <input type="number" step="0.01" value={inputPrecio.usd} onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setInputPrecio({ usd: val, ves: (val * tasaBCV).toFixed(2) });
                      }} className="w-full bg-white/10 p-4 rounded-xl mt-1 font-black text-xl outline-none focus:ring-2 ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-green-400 tracking-widest">Precio Bs (VES)</label>
                    <input type="number" step="0.01" value={inputPrecio.ves} onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setInputPrecio({ ves: val, usd: (val / tasaBCV).toFixed(2) });
                      }} className="w-full bg-white/10 p-4 rounded-xl mt-1 font-black text-xl outline-none focus:ring-2 ring-green-500" />
                  </div>
                  <button type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl uppercase transition-all shadow-lg active:scale-95">Registrar en DB</button>
                </div>
              </form>
            </div>
          )}

          {/* 4.5. VISTA: INFORMES Y REPORTES (ESTADÍSTICAS) */}
          {view === 'informes' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border flex flex-col md:flex-row justify-between items-end gap-6">
                <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2">Rango Inicio</label>
                    <input type="date" className="w-full bg-slate-100 p-4 rounded-2xl font-bold mt-1 shadow-inner border-none" onChange={(e)=>setFiltroFecha({...filtroFecha, inicio: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2">Rango Final</label>
                    <input type="date" className="w-full bg-slate-100 p-4 rounded-2xl font-bold mt-1 shadow-inner border-none" onChange={(e)=>setFiltroFecha({...filtroFecha, fin: e.target.value})} />
                  </div>
                </div>
                <button className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-blue-700 transition-all active:scale-95">📊 Filtrar Datos</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-green-600 p-8 rounded-[2.5rem] text-white shadow-2xl border-b-8 border-green-800">
                  <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Ventas Totales (USD)</p>
                  <h4 className="text-4xl font-black mt-2">${obtenerVentasFiltradas().reduce((a,v)=>a+Number(v.total_usd),0).toFixed(2)}</h4>
                  <div className="mt-4 bg-white/10 p-2 rounded-lg text-center text-[10px] font-bold uppercase tracking-tighter italic">Cálculo en base a {obtenerVentasFiltradas().length} operaciones</div>
                </div>
                <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl border-b-8 border-slate-700">
                  <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Base Imponible VES</p>
                  <h4 className="text-4xl font-black mt-2">{(obtenerVentasFiltradas().reduce((a,v)=>a+Number(v.total_usd),0) * tasaBCV).toFixed(2)} Bs</h4>
                  <div className="mt-4 bg-white/10 p-2 rounded-lg text-center text-[10px] font-bold uppercase italic tracking-tighter">Sujeto a tasa BCV del día</div>
                </div>
              </div>
            </div>
          )}

          {/* 4.6. VISTA: PUNTO DE VENTA (VENTAS / CARRITO) */}
          {view === 'venta' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-right-4">
              <div className="lg:col-span-2 bg-white p-6 rounded-[2.5rem] shadow-xl border">
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 px-2">
                  <h3 className="text-xl font-black italic text-slate-800 uppercase tracking-tighter">🛒 Catálogo de Venta</h3>
                  <input type="text" placeholder="Buscar producto..." className="bg-slate-100 p-4 px-8 rounded-full border-none focus:ring-2 ring-blue-500 font-bold text-sm w-full md:w-80 shadow-inner" onChange={(e)=>setBusqueda(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {productos?.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                    <button key={p.id} onClick={() => agregarAlCarrito(p)} className="flex justify-between items-center p-6 bg-slate-50 border-2 border-transparent hover:border-blue-500 hover:bg-white rounded-[1.5rem] transition-all text-left shadow-sm group">
                      <div>
                        <p className="font-black text-sm uppercase text-slate-700">{p.nombre}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase mb-2">{p.categoria || 'GENERAL'}</p>
                        <p className="text-blue-600 font-black text-2xl">${Number(p.precio_usd).toFixed(2)}</p>
                        <p className={`text-[9px] font-black uppercase mt-1 ${p.stock <= 5 ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>Stock: {p.stock}</p>
                      </div>
                      <div className="bg-blue-600 text-white w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg group-hover:rotate-90 transition-transform">+</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* LADO DERECHO: PANEL DE COBRO (FACTURACIÓN) */}
              <div className="bg-white p-8 rounded-[3rem] shadow-2xl border-[6px] border-slate-900 flex flex-col h-fit sticky top-28">
                 {!mostrarTicketFinal ? (
                   <>
                    <h3 className="font-black text-center text-xl mb-6 tracking-tighter uppercase italic text-slate-900 border-b pb-4">Orden Actual</h3>
                    <div className="space-y-4 mb-8 max-h-40 overflow-y-auto font-mono text-xs pr-2">
                      {carrito.length === 0 && <p className="text-center italic opacity-30 my-10">CARRITO VACÍO</p>}
                      {carrito.map((item, i) => (
                        <div key={i} className="flex justify-between items-center border-b border-dashed border-slate-200 pb-2">
                          <span className="font-black text-slate-700 italic">{item.cantidad}x {item.nombre.substring(0,18)}</span>
                          <span className="font-black text-blue-600">${(item.precio_usd * item.cantidad).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    
                    {/* Botón de Método de Pago */}
                    <div className="grid grid-cols-2 gap-2 mb-8">
                      {['Efectivo $', 'Efectivo Bs', 'Pago Móvil', 'Transferencia'].map(m => (
                        <button key={m} onClick={()=>setMetodoPago(m.toLowerCase().replace(' ', '_'))} className={`py-3 rounded-xl font-black text-[9px] uppercase border-2 transition-all ${metodoPago === m.toLowerCase().replace(' ', '_') ? 'bg-slate-900 text-white border-slate-900 shadow-lg scale-95' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'}`}>{m}</button>
                      ))}
                    </div>

                    {/* Resumen Final de Precios */}
                    <div className="bg-slate-50 p-6 rounded-[2rem] space-y-3 shadow-inner border-2 border-slate-100">
                      <div className="flex justify-between text-[10px] font-black uppercase opacity-40"><span>Subtotal</span> <span>${calcularTotal().subtotal}</span></div>
                      <div className="flex justify-between text-[10px] font-black uppercase text-red-500 italic"><span>Descuento ({config.descuento}%)</span> <span>-${calcularTotal().descuento}</span></div>
                      <div className="flex justify-between items-end pt-4 border-t-2 border-slate-200">
                        <span className="font-black text-xs uppercase italic tracking-tighter">Total Final</span>
                        <div className="text-right">
                           <p className="text-3xl font-black text-slate-900 tracking-tighter leading-none">${calcularTotal().usd}</p>
                           <p className="text-[10px] font-black text-green-600 mt-2">{calcularTotal().ves} VES</p>
                        </div>
                      </div>
                    </div>
                    <button onClick={registrarVenta} disabled={carrito.length === 0 || !metodoPago} className="w-full py-5 bg-green-600 hover:bg-green-500 text-white font-black rounded-2xl shadow-xl uppercase mt-8 transition-all active:scale-95 disabled:opacity-20 disabled:grayscale">🛒 Confirmar Pago</button>
                   </>
                 ) : (
                   /* ESTO SE MUESTRA DESPUÉS DE LA VENTA */
                   <div className="animate-in zoom-in-95 text-center p-4">
                      <div className="text-6xl mb-6">✅</div>
                      <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">¡Venta Exitosa!</h2>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 border-t pt-4">Nro de Referencia: #00{datosUltimaVenta?.id}</p>
                      <button onClick={limpiarParaNuevaVenta} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl uppercase text-xs mt-10 shadow-lg active:scale-95">Siguiente Cliente</button>
                   </div>
                 )}
              </div>
            </div>
          )}

          {/* 4.7. VISTA: INVENTARIO (LISTADO TABULAR ACTUALIZADO) */}
            {view === 'inventario' && (
              <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Cabecera del Panel (Negro/Slate 900) */}
                <div className="p-10 bg-slate-900 flex flex-col xl:flex-row justify-between items-center gap-6">
                  <div>
                    <h3 className="text-2xl font-black uppercase italic text-blue-400 tracking-tighter">Control de Inventario</h3>
                    <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest">
                      Mostrando {productosInventario.length} de {productos.length} productos
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-4 w-full xl:w-auto">
                    {/* BUSCADOR POR NOMBRE */}
                    <div className="relative flex-1 md:w-64">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 text-xs">🔍</span>
                      <input 
                        type="text" 
                        placeholder="Buscar por nombre..." 
                        className="w-full bg-white/10 pl-10 pr-4 py-4 rounded-2xl border-none focus:ring-2 ring-blue-500 font-bold text-xs text-white placeholder:text-white/20 transition-all" 
                        value={busqueda}
                        onChange={(e) => setSearchTerm(e.target.value)} 
                      />
                    </div>

                    {/* FILTRO POR CATEGORÍA (NUEVO) */}
                    <div className="relative w-full md:w-48">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 text-xs">📂</span>
                      <select 
                        className="w-full bg-white/10 pl-10 pr-4 py-4 rounded-2xl border-none focus:ring-2 ring-blue-500 font-bold text-xs text-white appearance-none cursor-pointer"
                        value={filtroCategoria}
                        onChange={(e) => setFiltroCategoria(e.target.value)}
                      >
                        {categoriasUnicas.map(cat => (
                          <option key={cat} value={cat} className="bg-slate-800 text-white">{cat}</option>
                        ))}
                      </select>
                    </div>

                    <button 
                      onClick={() => setView('registro')} 
                      className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-blue-500 hover:-translate-y-1 transition-all active:scale-95"
                    >
                      + Añadir Producto
                    </button>
                  </div>
                </div>

                {/* Tabla de Resultados */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-[11px] font-black uppercase text-slate-500">
                      <tr>
                        <th className="p-8">Detalle Producto</th>
                        <th className="p-8 text-right">Precio USD</th>
                        <th className="p-8 text-right">Precio VES</th>
                        <th className="p-8 text-center">Estado Stock</th>
                        <th className="p-8 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {/* USAMOS EL ARRAY FILTRADO DE LA SECCIÓN 3.10 */}
                      {productosInventario.length > 0 ? (
                        productosInventario.map((p) => (
                          <tr key={p.id} className="hover:bg-blue-50/50 transition-all group">
                            <td className="p-8">
                              <p className="font-black text-sm uppercase text-slate-800 tracking-tighter group-hover:text-blue-600 transition-colors">{p.nombre}</p>
                              <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 text-[9px] text-slate-400 font-black rounded uppercase italic">
                                {p.categoria || 'SIN CATEGORÍA'}
                              </span>
                            </td>
                            <td className="p-8 text-right font-black text-xl text-slate-900">${Number(p.precio_usd).toFixed(2)}</td>
                            <td className="p-8 text-right font-bold text-slate-400 text-xs">{(p.precio_usd * tasaBCV).toFixed(2)} Bs</td>
                            <td className="p-8 text-center">
                              <span className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm transition-all ${
                                p.stock <= 5 
                                ? 'bg-red-500 text-white animate-pulse' 
                                : 'bg-green-100 text-green-700'
                              }`}>
                                {p.stock} Unidades
                              </span>
                            </td>
                            <td className="p-8 text-center">
                              <div className="flex justify-center gap-2">
                                <button 
                                  onClick={() => setEditandoProducto(p)}
                                  className="p-3 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-500 hover:text-white transition-all shadow-sm"
                                  title="Editar"
                                >
                                  ✏️
                                </button>
                                <button 
                                  onClick={() => eliminarProducto(p.id)} 
                                  className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                  title="Eliminar"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="p-20 text-center">
                            <p className="text-4xl mb-4 grayscale opacity-20">📂</p>
                            <p className="font-black text-slate-300 uppercase italic tracking-widest">No se encontraron productos</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          {/* 4.8. VISTA: HISTORIAL DE OPERACIONES (BITÁCORA) */}
          {view === 'historial' && (
            <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border animate-in slide-in-from-left-4">
              <div className="p-10 border-b flex justify-between items-center bg-slate-50">
                <h3 className="text-2xl font-black uppercase italic text-slate-400 tracking-tighter">Bitácora de Ventas</h3>
                <span className="bg-slate-200 px-4 py-2 rounded-full text-[10px] font-black uppercase opacity-60">Total {historial?.length} Registros</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-400">
                    <tr><th className="p-8">Fecha y Hora</th><th className="p-8">Referencia</th><th className="p-8 text-right">Base USD</th><th className="p-8 text-right">Cierre Bs</th><th className="p-8 text-center">Pago</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Array.isArray(historial) && historial.length > 0 ? (
                      historial.map((v, i) => (
                        <tr key={i} onClick={() => setVentaSeleccionada(v)} className="hover:bg-blue-50 cursor-pointer transition-all">
                          <td className="p-8 text-xs font-bold text-slate-500 italic">{new Date(v.fecha).toLocaleString()}</td>
                          <td className="p-8"><span className="bg-slate-100 px-4 py-2 rounded-xl font-black">#VT-{v.id}</span></td>
                          <td className="p-8 text-right font-black">${Number(v.total_usd).toFixed(2)}</td>
                          <td className="p-8 text-right text-green-600 font-black">{(v.total_usd * v.tasa_bcv).toFixed(2)} Bs</td>
                          <td className="p-8 text-center text-[10px] font-black">{v.metodo_pago}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="5" className="p-20 text-center font-black opacity-20">SIN DATOS EN HISTORIAL</td></tr>
                    )}
                </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* 4.9. MODAL: DETALLES DE VENTA (EL TICKET DIGITAL) */}
      {ventaSeleccionada && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
           <div className="bg-white rounded-[3.5rem] w-full max-w-md p-10 shadow-[0_0_100px_rgba(0,0,0,0.5)] animate-in zoom-in-95 border-t-[16px] border-blue-600 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600"></div>
              
              <div className="text-center mb-10 pb-10 border-b-2 border-dashed border-slate-200">
                <h2 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900">Comprobante</h2>
                <p className="text-[10px] font-black text-blue-500 mt-2 tracking-widest uppercase opacity-60">ID DE OPERACIÓN: #VT-{ventaSeleccionada.id}</p>
              </div>

              <div className="space-y-4 mb-10 max-h-60 overflow-y-auto pr-4 font-mono text-[11px] custom-scrollbar">
                <div className="flex justify-between border-b pb-2 opacity-30 font-black italic"><span>Cant / Producto</span> <span>Total USD</span></div>
                {ventaSeleccionada.detalles?.map((d, i) => (
                  <div key={i} className="flex justify-between items-center font-bold uppercase text-slate-700">
                    <span className="italic">{d.cantidad}x {d.producto?.nombre || 'Producto Desconocido'}</span>
                    <span className="font-black text-blue-600">${(d.precio_al_momento_usd * d.cantidad).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100 mb-10 shadow-inner">
                <div className="flex justify-between font-black text-[11px] uppercase text-slate-400"><span>Iva aplicado</span> <span>{ventaSeleccionada.iva_aplicado}%</span></div>
                <div className="flex justify-between font-black text-[11px] uppercase text-slate-400 mt-1"><span>Descuento</span> <span>{ventaSeleccionada.descuento_aplicado}%</span></div>
                <div className="flex justify-between items-end mt-4 pt-4 border-t-2 border-slate-200">
                   <span className="font-black uppercase italic text-xs">Total Operación</span>
                   <span className="text-3xl font-black text-blue-600 tracking-tighter">${Number(ventaSeleccionada.total_usd).toFixed(2)}</span>
                </div>
              </div>

              <button onClick={()=>setVentaSeleccionada(null)} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-2xl active:scale-95 transition-all hover:bg-slate-800">Cerrar Visualización</button>
              <p className="text-center text-[9px] font-bold text-slate-300 mt-6 uppercase tracking-widest italic">Wunari POS System v2.0</p>
           </div>
        </div>
      )}

      {/* 4.10. EDITAR EL PRODUCTO DEL STOCK*/}
      {editandoProducto && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8 border-t-[10px] border-amber-500">
            <h2 className="text-2xl font-black mb-6 italic italic uppercase">Editar Producto</h2>
            
            <form onSubmit={actualizarProducto} className="space-y-4">
              <input 
                className="w-full p-4 bg-slate-100 rounded-xl font-bold"
                value={editandoProducto.nombre}
                onChange={e => setEditandoProducto({...editandoProducto, nombre: e.target.value})}
                placeholder="Nombre"
              />
              <input 
                className="w-full p-4 bg-slate-100 rounded-xl font-bold"
                value={editandoProducto.categoria}
                onChange={e => setEditandoProducto({...editandoProducto, categoria: e.target.value})}
                placeholder="Categoría"
              />
              <div className="grid grid-cols-2 gap-4">
                <input 
                  type="number"
                  className="w-full p-4 bg-slate-100 rounded-xl font-bold"
                  value={editandoProducto.precio_usd}
                  onChange={e => setEditandoProducto({...editandoProducto, precio_usd: e.target.value})}
                  placeholder="Precio $"
                />
                <input 
                  type="number"
                  className="w-full p-4 bg-slate-100 rounded-xl font-bold"
                  value={editandoProducto.stock}
                  onChange={e => setEditandoProducto({...editandoProducto, stock: e.target.value})}
                  placeholder="Stock"
                />
              </div>

              <div className="flex gap-4 mt-6">
                <button 
                  type="button"
                  onClick={() => setEditandoProducto(null)}
                  className="flex-1 p-4 bg-slate-200 rounded-xl font-black uppercase text-xs"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 p-4 bg-amber-500 text-white rounded-xl font-black uppercase text-xs shadow-lg shadow-amber-200"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DEL TICKET FINAL */}
{mostrarTicketFinal && datosUltimaVenta && (
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border-4 border-wunari-purple animate-in fade-in zoom-in duration-300">
      
      {/* Encabezado del Ticket */}
      <div className="bg-wunari-purple p-6 text-center text-white">
        <h2 className="text-2xl font-black italic tracking-tighter uppercase">¡Cobro Exitoso!</h2>
        <p className="text-xs opacity-80 font-bold uppercase tracking-widest mt-1">Comprobante de Venta</p>
      </div>

      <div className="p-6 space-y-4">
        {/* Info del Negocio */}
        <div className="text-center border-b border-dashed border-slate-300 pb-4">
          <h3 className="font-black text-slate-800 text-xl">{config.nombreNegocio}</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase">La Victoria, Edo. Aragua</p>
          <p className="text-[10px] text-slate-500">Fecha: {new Date().toLocaleString()}</p>
        </div>

        {/* Lista de Productos */}
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {datosUltimaVenta.detalles.map((item, index) => (
            <div key={index} className="flex justify-between text-sm font-medium text-slate-600">
              <span>{item.cantidad}x {item.nombre}</span>
              <span className="font-bold">${(item.precio_usd * item.cantidad).toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Totales Tikeck*/}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1">
          <div className="flex justify-between text-xs text-slate-500 font-bold">
            <span>MÉTODO:</span>
            <span className="uppercase text-wunari-purple">{metodoPago}</span>
          </div>
          <div className="flex justify-between text-lg font-black text-slate-800 border-t border-slate-200 mt-2 pt-2">
            <span>TOTAL USD:</span>
            <span>${datosUltimaVenta.total_usd}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-blue-600">
            <span>TOTAL BS:</span>
            <span>Bs. {(datosUltimaVenta.total_usd * tasaBCV).toFixed(2)}</span>
          </div>
        </div>

        {/* Botón de Cierre */}
        <button 
          onClick={limpiarParaNuevaVenta}
          className="w-full py-4 bg-wunari-purple hover:bg-wunari-dark text-white font-black rounded-2xl transition-all shadow-lg active:scale-95 uppercase tracking-widest"
        >
          Finalizar y Volver
        </button>
        
        <p className="text-center text-[10px] text-slate-400 font-bold italic">
          Gracias por su compra • ContaVen v1.0
        </p>
      </div>
    </div>
  </div>
)}

    </div>
  );
};

export default Dashboard;
