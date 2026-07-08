export default function Loading() {
  return (
    <div className="adm">
      <div className="page-head"><h1>Pedidos</h1></div>
      <div className="card" style={{ padding: 20 }}>
        <div className="sk-grid">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="sk" style={{ height: 84 }} />)}</div>
        <div className="sk" style={{ height: 42, marginBottom: 16 }} />
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="sk" style={{ height: 62, marginBottom: 8 }} />)}
      </div>
    </div>
  );
}
