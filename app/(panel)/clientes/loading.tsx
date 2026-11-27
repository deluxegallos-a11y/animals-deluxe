export default function Loading() {
  return (
    <div className="adm">
      <div className="page-head"><h1>CRM · Clientes</h1></div>
      <div className="card" style={{ padding: 20 }}>
        <div className="sk-grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="sk" style={{ height: 88 }} />)}</div>
        <div className="sk" style={{ height: 42, marginBottom: 16 }} />
        <div className="sk-cards">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="sk sk-card" />)}</div>
      </div>
    </div>
  );
}
