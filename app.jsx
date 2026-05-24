const { useState, useEffect } = React;

function App() {
    return (
        <div>
            <header className="app-header">
                {/* Temporary placeholder for Logo */}
                <div style={{ width: '40px', height: '40px', backgroundColor: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'var(--lm-green)', fontWeight: 'bold' }}>LM</span>
                </div>
                <h1>Remodeling LM — Livry-Gargan</h1>
            </header>
            
            <main className="main-container">
                <div className="card">
                    <h2>Bienvenue dans l'outil de Remodeling</h2>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        L'interface est en cours de construction. Nous intégrons les données...
                    </p>
                    <div style={{ marginTop: '1.5rem' }}>
                        <button className="btn btn-primary">Commencer</button>
                    </div>
                </div>
            </main>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
